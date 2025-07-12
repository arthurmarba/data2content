/**
 * @fileoverview Orquestrador de chamadas à API OpenAI com Function Calling e Streaming.
 * @version 0.11.3 (Ajuste fino na extração de enums Zod para cada caso específico)
 */

import { Types, Model } from 'mongoose';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';

// Importa os Zod Schemas atualizados
import * as ZodSchemas from './aiFunctionSchemas.zod';

// Importa as constantes/enums
import {
    VALID_FORMATS,
    VALID_PROPOSALS,
    VALID_CONTEXTS,
    VALID_QUALITATIVE_OBJECTIVES
} from '@/app/lib/constants/communityInspirations.constants';

import { IUser } from '@/app/models/User';
import { IMetric, IMetricStats } from '@/app/models/Metric';
import { MetricsNotFoundError, DatabaseError } from '@/app/lib/errors';

// --- Importando a nova função do dataService ---
import {
  fetchAndPrepareReportData,
  getAdDealInsights,
  AdDealInsights,
  IEnrichedReport,
  IAccountInsight,
  getInspirations as getCommunityInspirationsDataService,
  CommunityInspirationFilters, 
  IDailyMetricSnapshot,
  getDailySnapshotsForMetric,
  getLatestAccountInsights as getLatestAccountInsightsFromDataService,
  getLatestAudienceDemographics as getLatestAudienceDemographicsFromDataService,
  getTopPostsByMetric as getTopPostsByMetricFromDataService,
  getMetricDetails as getMetricDetailsFromDataService,
  findMetricsByCriteria as findMetricsByCriteriaFromDataService,
  FindMetricsCriteriaArgs,
  fetchTopCategories,
  getMetricsHistory as getMetricsHistoryFromDataService,
  getFollowerTrend,
  getReachEngagementTrend,
  getFpcTrend
} from './dataService';
import { CategoryRankingMetricEnum } from './dataService/marketAnalysis/types';
import { subDays, subYears, startOfDay } from 'date-fns';

import * as PricingKnowledge from './knowledge/pricingKnowledge';
import * as AlgorithmKnowledge from './knowledge/algorithmKnowledge';
import * as MetricsKnowledge from './knowledge/metricsKnowledge';
import * as BrandingKnowledge from './knowledge/personalBrandingKnowledge';
import * as MethodologyKnowledge from './knowledge/methodologyDeepDive';
import * as ExtraKnowledge from './knowledge/extraKnowledge';

/* ------------------------------------------------------------------ *
 * 1.  JSON-schemas expostos ao LLM                                   *
 * ------------------------------------------------------------------ */
export const functionSchemas = [
  {
    name: 'getAggregatedReport',
    description: 'Retorna um relatório completo com métricas agregadas de posts E TAMBÉM os insights sobre parcerias publicitárias recentes do usuário. Use para análises gerais, planos, rankings, perguntas sobre performance e publicidade. **É o ponto de partida OBRIGATÓRIO para a maioria das análises.** Permite especificar o período da análise em número de dias.',
    parameters: {
      type: 'object',
      properties: {
        analysisPeriod: {
          type: 'number',
          default: 180,
          description: "O número de dias a serem considerados para a análise do relatório (ex: 7, 30, 40, 90, 180). Use 180 como padrão se nenhum período específico for solicitado. Use 0 para 'todo o período disponível'.",
        }
      },
      required: []
    }
  },
  {
    name: 'getLatestAccountInsights',
    description: 'Busca os insights de conta e dados demográficos mais recentes disponíveis para o usuário. Útil para entender o perfil da audiência (idade, gênero, localização) e o desempenho geral da conta (alcance, impressões da conta). Não recebe argumentos da IA.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'getLatestAudienceDemographics',
    description: 'Retorna somente a distribuição demográfica mais recente dos seguidores (idade, gênero, país e cidade). Use quando o usuário pedir detalhes específicos do público.',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'fetchCommunityInspirations',
    description: "Busca exemplos de posts da Comunidade de Inspiração IA Tuca que tiveram bom desempenho qualitativo. Use quando o usuário pedir explicitamente por inspiração, ou para ilustrar sugestões de planejamento de conteúdo. Baseie-se na proposta e contexto fornecidos, e opcionalmente em um objetivo qualitativo de desempenho.",
    parameters: {
      type: 'object',
      properties: {
        proposal: {
          type: 'string',
          description: `A proposta/tema do conteúdo para o qual se busca inspiração (obrigatório). Valores válidos: ${VALID_PROPOSALS.join(', ')}.`
        },
        context: {
          type: 'string',
          description: `O contexto específico dentro da proposta (obrigatório). Valores válidos: ${VALID_CONTEXTS.join(', ')}.`
        },
        format: {
          type: 'string',
          description: `Opcional. Formato do post para refinar a busca. Valores válidos: ${VALID_FORMATS.join(', ')}.`
        },
        primaryObjectiveAchieved_Qualitative: {
          type: 'string',
          description: `Opcional. O objetivo qualitativo principal que a inspiração deve ter demonstrado. Valores válidos: ${VALID_QUALITATIVE_OBJECTIVES.join(', ')}.`
        },
        count: {
          type: 'number',
          default: 2,
          minimum: 1,
          maximum: 3,
          description: "Número de exemplos a retornar (padrão 2, mínimo 1, máximo 3)."
        }
      },
      required: ['proposal', 'context']
    }
  },
  {
    name: 'getTopPosts',
    description: 'Retorna os N posts com melhor desempenho em uma métrica específica (shares, saved, likes, comments, reach, views). Use APENAS se o usuário pedir explicitamente por "top posts" e após ter o relatório geral via getAggregatedReport.',
    parameters: {
        type: 'object',
        properties: {
            metric: {
                type: 'string',
                // Este schema É opcional, então precisa do .unwrap()
                enum: ZodSchemas.GetTopPostsArgsSchema.shape.metric.removeDefault().unwrap()._def.values,
                default: 'shares',
                description: "Métrica para ordenar os seus posts (compartilhamentos, salvamentos, curtidas, comentários, alcance ou visualizações)."
            },
            limit: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                default: 3,
                description: "Número de posts a retornar (entre 1 e 10)."
            }
        },
        required: []
    }
  },
  {
    name: 'getCategoryRanking',
    description: 'Cria um ranking das SUAS categorias de conteúdo (formato, proposta ou contexto) com base em uma métrica de performance específica. Use para responder perguntas como "qual o ranking das minhas propostas com mais compartilhamentos?" ou "quais os formatos que eu mais uso?".',
    parameters: {
        type: 'object',
        properties: {
            category: {
                type: 'string',
                enum: ['proposal', 'format', 'context'],
                description: "A dimensão do conteúdo a ser ranqueada: 'proposal', 'format' ou 'context'."
            },
            metric: {
                type: 'string',
                default: 'shares',
                description: "A métrica para ordenar o ranking (ex: 'shares', 'likes', 'views', 'comments', ou 'posts' para contar o número de publicações)."
            },
            periodDays: {
                type: 'number',
                default: 90,
                description: "O período de análise em dias (padrão: 90)."
            },
            limit: {
                type: 'number',
                minimum: 1,
                maximum: 10,
                default: 5,
                description: "Número de itens no ranking a retornar (padrão: 5)."
            }
        },
        required: ['category', 'metric']
    }
  },
  {
    name: 'getUserTrend',
    description: 'Retorna séries temporais do crescimento de seguidores ou do alcance/engajamento do usuário para geração de gráficos.',
    parameters: {
      type: 'object',
      properties: {
        trendType: {
          type: 'string',
          enum: ['followers', 'reach_engagement'],
          description: 'Tipo de tendência a buscar: seguidores ou alcance/engajamento.'
        },
        timePeriod: {
          type: 'string',
          // CORREÇÃO: Este schema NÃO é opcional, então o .unwrap() é removido.
          enum: ZodSchemas.GetUserTrendArgsSchema.shape.timePeriod.removeDefault()._def.values,
          default: 'last_30_days',
          description: 'Período de tempo para a análise.'
        },
        granularity: {
          type: 'string',
          enum: ['daily', 'weekly', 'monthly'],
          default: 'daily',
          description: 'Granularidade dos pontos da série.'
        }
      },
      required: ['trendType']
    }
  },
  {
    name: 'getFpcTrendHistory',
    description: 'Retorna a média de interações por semana ou mês para uma combinação específica de formato, proposta e contexto.',
    parameters: {
      type: 'object',
      properties: {
        format: { type: 'string', enum: VALID_FORMATS },
        proposal: { type: 'string', enum: VALID_PROPOSALS },
        context: { type: 'string', enum: VALID_CONTEXTS },
        timePeriod: {
          type: 'string',
          // CORREÇÃO: Este schema também NÃO é opcional.
          enum: ZodSchemas.GetFpcTrendHistoryArgsSchema.shape.timePeriod.removeDefault()._def.values,
          default: 'last_90_days'
        },
        granularity: {
          type: 'string',
          enum: ['weekly','monthly'],
          default: 'weekly'
        }
      },
      required: ['format','proposal','context']
    }
  },
  {
    name: 'getDayPCOStats',
    description: 'Retorna dados de desempenho médio agrupados por Dia da Semana, Proposta e Contexto (usando nomes padronizados). Use APENAS se o usuário perguntar sobre melhor dia/horário para nichos específicos e após ter o relatório geral via getAggregatedReport.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getMetricDetailsById',
    description: 'Busca e retorna os detalhes completos (incluindo métricas) de um único post específico, dado o seu ID interno do sistema. Use para aprofundar a análise de um post mencionado (ex: um post do top 3, ou um post encontrado por busca).',
    parameters: {
        type: 'object',
        properties: {
            metricId: {
                type: 'string',
                description: "O ID interno do post/métrica a ser detalhado (deve ser um ObjectId válido)."
            }
        },
        required: ['metricId']
    }
  },
  {
    name: 'findPostsByCriteria',
    description: 'Busca posts que correspondem a critérios específicos como formato, proposta, contexto ou data. Use para encontrar exemplos de posts sobre um tema ou de um tipo específico, APÓS ter a visão geral do relatório (getAggregatedReport), se necessário para aprofundar.',
    parameters: {
        type: 'object',
        properties: {
            criteria: {
                type: 'object',
                properties: {
                    format: { type: 'string', description: `Opcional. Formato do post. Valores válidos: ${VALID_FORMATS.join(', ')}.` },
                    proposal: { type: 'string', description: `Opcional. Proposta/tema do post. Valores válidos: ${VALID_PROPOSALS.join(', ')}.` },
                    context: { type: 'string', description: `Opcional. Contexto do post. Valores válidos: ${VALID_CONTEXTS.join(', ')}.` },
                    dateRange: {
                        type: 'object',
                        properties: {
                            start: { type: 'string', format: 'date', description: "Data de início (YYYY-MM-DD) para filtrar posts." },
                            end: { type: 'string', format: 'date', description: "Data de fim (YYYY-MM-DD) para filtrar posts." }
                        },
                        description: "Intervalo de datas para filtrar os posts."
                    },
                    minLikes: { type: 'number', description: "Número mínimo de curtidas. Use 0 se não houver um mínimo." },
                    minShares: { type: 'number', description: "Número mínimo de compartilhamentos (deve ser maior que 0 se especificado)." }
                },
                description: "Critérios de busca para os posts."
            },
            limit: { type: 'number', default: 5, minimum: 1, maximum: 20, description: "Número máximo de posts a retornar (entre 1 e 20)." },
            sortBy: {
                type: 'string',
                // Este é opcional e precisa do .unwrap()
                enum: ZodSchemas.FindPostsByCriteriaArgsSchema.shape.sortBy.removeDefault().unwrap()._def.values,
                default: 'postDate',
                description: "Campo para ordenar os resultados."
            },
            sortOrder: {
                type: 'string',
                // Este é opcional e precisa do .unwrap()
                enum: ZodSchemas.FindPostsByCriteriaArgsSchema.shape.sortOrder.removeDefault().unwrap()._def.values,
                default: 'desc',
                description: "Ordem da classificação (ascendente ou descendente)."
            }
        },
        required: ['criteria']
    }
  },
  {
    name: 'getDailyMetricHistory',
    description: 'Busca o histórico de métricas diárias e cumulativas para um post específico (usando seu ID interno do sistema), limitado aos primeiros 30 dias. Use para analisar crescimento, viralização e picos de engajamento, APÓS identificar um post de interesse com seu ID interno.',
    parameters: {
        type: 'object',
        properties: {
            metricId: {
                type: 'string',
                description: "O ID interno do post/métrica para buscar o histórico diário (deve ser um ObjectId válido)."
            }
        },
        required: ['metricId']
    }
  },
  {
    name: 'getMetricsHistory',
    description: 'Retorna séries históricas agregadas por dia para diversas métricas do usuário, permitindo analisar tendências ao longo do tempo.',
    parameters: {
        type: 'object',
        properties: {
            days: {
                type: 'number',
                default: 360,
                description: 'Quantidade de dias no histórico a retornar (padrão 360).'
            }
        },
        required: []
    }
  },
  {
    name: 'getConsultingKnowledge',
    description: 'Busca informações e explicações detalhadas sobre algoritmos do Instagram, estratégias de precificação, análise de métricas, personal branding ou a metodologia de consultoria.',
    parameters: {
        type: 'object',
        properties: {
            topic: {
                type: 'string',
                // Este não é nem opcional nem com default, acessamos diretamente.
                enum: ZodSchemas.GetConsultingKnowledgeArgsSchema.shape.topic._def.values,
                description: `Tópico sobre o qual buscar conhecimento. Tópicos válidos: ${ZodSchemas.GetConsultingKnowledgeArgsSchema.shape.topic._def.values.join(', ')}`
            }
        },
        required: ['topic']
    }
  }
] as const;

type ExecutorFn = (args: any, user: IUser) => Promise<unknown>;

/* ---------------------------------------------------------------------- *
 * 2.  Executores das Funções                                             *
 * ---------------------------------------------------------------------- */

/* ... (as funções getAggregatedReport, getLatestAccountInsights, fetchCommunityInspirations, getTopPosts permanecem inalteradas) ... */
/* 2.1 getAggregatedReport */
const getAggregatedReport: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetAggregatedReportArgsSchema>, loggedUser) => {
  const fnTag = '[fn:getAggregatedReport v0.10.12]'; // Nenhuma mudança lógica aqui, mantém versão
  try {
    const periodInDays = args.analysisPeriod === undefined ? 180 : args.analysisPeriod;
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id} com período de análise: ${periodInDays} dias.`);
    let sinceDate: Date;
    const now = new Date();

    if (periodInDays === 0) {
      sinceDate = new Date('1970-01-01T00:00:00.000Z');
    } else if (periodInDays > 0) {
      sinceDate = subDays(now, periodInDays);
    } else {
      logger.warn(`${fnTag} Período de análise inválido (${periodInDays} dias) recebido. Usando padrão de 180 dias.`);
      sinceDate = subDays(now, 180);
    }
    logger.debug(`${fnTag} Data de início da análise calculada: ${sinceDate.toISOString()} para período de ${periodInDays} dias.`);

    let adDealPeriodString: 'last30d' | 'last90d' | 'all' = 'last90d';
    if (periodInDays === 0) adDealPeriodString = 'all';
    else if (periodInDays <= 30) adDealPeriodString = 'last30d';
    else if (periodInDays <= 90) adDealPeriodString = 'last90d';
    else adDealPeriodString = 'all';

    const [reportResult, adDealResult] = await Promise.allSettled([
        fetchAndPrepareReportData({
            user: loggedUser,
            analysisSinceDate: sinceDate
        }),
        getAdDealInsights(loggedUser._id.toString(), adDealPeriodString)
    ]);

    let enrichedReportData: IEnrichedReport | null = null;
    let reportError: string | null = null;
    if (reportResult.status === 'fulfilled') {
        enrichedReportData = reportResult.value.enrichedReport;
        logger.info(`${fnTag} Relatório agregado de métricas gerado com sucesso para o período de ${periodInDays} dias. Posts no relatório: ${enrichedReportData?.overallStats?.totalPosts ?? 'N/A'}`);
    } else {
        reportError = `Falha ao gerar parte do relatório (métricas) para o período de ${periodInDays} dias: ${(reportResult.reason as Error)?.message || 'Erro desconhecido'}`;
        logger.error(`${fnTag} Erro ao gerar relatório agregado de métricas:`, reportResult.reason);
    }

    let adDealInsightsData: AdDealInsights | null = null;
    let adDealError: string | null = null;
    if (adDealResult.status === 'fulfilled') {
        adDealInsightsData = adDealResult.value;
        logger.info(`${fnTag} Insights de publicidade ${adDealInsightsData ? `encontrados (${adDealInsightsData.totalDeals} deals)` : 'não encontrados'} para o período correspondente.`);
    } else {
        adDealError = `Falha ao buscar dados de publicidade: ${(adDealResult.reason as Error)?.message || 'Erro desconhecido'}`;
        logger.error(`${fnTag} Erro ao buscar insights de publicidade:`, adDealResult.reason);
    }

    if (!enrichedReportData && !adDealInsightsData) {
        const primaryError = reportError || adDealError || "Nenhum dado encontrado para o período selecionado.";
        logger.warn(`${fnTag} Nenhum dado de relatório ou publicidade retornado para ${loggedUser._id} no período de ${periodInDays} dias. Erro principal: ${primaryError}`);
        return { error: primaryError, message: "Não foi possível obter dados para o relatório no período especificado." };
    }

    return {
        analysisPeriodUsed: periodInDays,
        reportData: enrichedReportData,
        adDealInsights: adDealInsightsData,
        reportError: reportError,
        adDealError: adDealError
    };

  } catch (err) {
    logger.error(`${fnTag} Erro inesperado:`, err);
    return { error: "Ocorreu um erro inesperado ao tentar gerar o relatório completo. Por favor, tente novamente." };
  }
};

/* 2.2 getLatestAccountInsights */
const getLatestAccountInsights: ExecutorFn = async (_args: z.infer<typeof ZodSchemas.GetLatestAccountInsightsArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getLatestAccountInsights v0.10.12]'; // Nenhuma mudança lógica aqui, mantém versão
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id} via dataService.`);
    try {
        const latestInsight: IAccountInsight | null = await getLatestAccountInsightsFromDataService(loggedUser._id.toString());

        if (!latestInsight) {
            logger.warn(`${fnTag} Nenhum insight de conta ou dado demográfico útil encontrado para User ${loggedUser._id} (via dataService).`);
            return {
                message: "Ainda não tenho dados demográficos ou insights gerais da sua conta para analisar. Assim que forem coletados, poderei te ajudar com isso!",
                data: null
            };
        }

        logger.info(`${fnTag} Insights de conta mais recentes encontrados para User ${loggedUser._id} (gravado em: ${latestInsight.recordedAt?.toISOString()}) (via dataService).`);
        return {
            recordedAt: latestInsight.recordedAt?.toISOString(),
            accountInsightsPeriod: latestInsight.accountInsightsPeriod,
            audienceDemographics: latestInsight.audienceDemographics,
            accountDetails: latestInsight.accountDetails
        };
    } catch (err: any) {
        logger.error(`${fnTag} Erro ao buscar os insights de conta mais recentes para User ${loggedUser._id} (via dataService):`, err);
        return { error: err.message || "Ocorreu um erro inesperado ao tentar buscar os dados mais recentes da sua conta. Por favor, tente novamente." };
    }
};

/* 2.3 getLatestAudienceDemographics */
const getLatestAudienceDemographics: ExecutorFn = async (_args: z.infer<typeof ZodSchemas.GetLatestAudienceDemographicsArgsSchema>, loggedUser) => {
  const fnTag = '[fn:getLatestAudienceDemographics v0.1]';
  logger.info(`${fnTag} Executando para usuário ${loggedUser._id} via dataService.`);
  try {
    const demographics = await getLatestAudienceDemographicsFromDataService(loggedUser._id.toString());
    if (!demographics) {
      logger.warn(`${fnTag} Nenhum snapshot demográfico encontrado para User ${loggedUser._id}.`);
      return { message: 'Ainda não possuo dados demográficos suficientes para analisar seu público.' };
    }
    logger.info(`${fnTag} Snapshot demográfico retornado para User ${loggedUser._id}.`);
    return { demographics };
  } catch (err: any) {
    logger.error(`${fnTag} Erro ao buscar demografia para User ${loggedUser._id}:`, err);
    return { error: err.message || 'Erro ao buscar dados demográficos.' };
  }
};

/* 2.X fetchCommunityInspirations */
const fetchCommunityInspirations: ExecutorFn = async (args: z.infer<typeof ZodSchemas.FetchCommunityInspirationsArgsSchema>, loggedUser) => {
  const fnTag = '[fn:fetchCommunityInspirations v0.10.12]'; // Nenhuma mudança lógica aqui, mantém versão
  logger.info(`${fnTag} Executando para User ${loggedUser._id} com args: ${JSON.stringify(args)}`);
  try {
    if (!loggedUser.communityInspirationOptIn) {
        logger.warn(`${fnTag} User ${loggedUser._id} não optou por participar da comunidade de inspiração.`);
        return {
            message: "Parece que você ainda não ativou a Comunidade de Inspiração. Se quiser ver exemplos de outros criadores, posso te mostrar como ativar!",
            inspirations: []
        };
    }

    const filters: CommunityInspirationFilters = {
      proposal: args.proposal,
      context: args.context,
      format: args.format,
      primaryObjectiveAchieved_Qualitative: args.primaryObjectiveAchieved_Qualitative,
    };

    let excludeIds: string[] = [];
    if (loggedUser.lastCommunityInspirationShown_Daily?.date &&
        loggedUser.lastCommunityInspirationShown_Daily.inspirationIds &&
        loggedUser.lastCommunityInspirationShown_Daily.inspirationIds.length > 0) {
        const today = startOfDay(new Date());
        const lastShownDate = startOfDay(new Date(loggedUser.lastCommunityInspirationShown_Daily.date));
        if (today.getTime() === lastShownDate.getTime()) {
            excludeIds = loggedUser.lastCommunityInspirationShown_Daily.inspirationIds.map(id => id.toString());
            logger.debug(`${fnTag} Excluindo IDs de inspiração já mostrados hoje para User ${loggedUser._id}: ${excludeIds.join(', ')}`);
        }
    }
    const inspirations = await getCommunityInspirationsDataService(filters, args.count ?? 2, excludeIds);

    if (!inspirations || inspirations.length === 0) {
      logger.info(`${fnTag} Nenhuma inspiração encontrada para os critérios para User ${loggedUser._id}. Filtros: ${JSON.stringify(filters)}`);
      return {
        message: "Não encontrei nenhuma inspiração na comunidade para esses critérios no momento. Que tal explorarmos outra combinação, ou posso te dar algumas dicas gerais sobre esse tema?",
        inspirations: []
      };
    }
    const formattedInspirations = inspirations.map(insp => ({
      id: insp._id.toString(),
      originalInstagramPostUrl: insp.originalInstagramPostUrl,
      proposal: insp.proposal,
      context: insp.context,
      format: insp.format,
      contentSummary: insp.contentSummary,
      performanceHighlights_Qualitative: insp.performanceHighlights_Qualitative,
      primaryObjectiveAchieved_Qualitative: insp.primaryObjectiveAchieved_Qualitative,
    }));
    logger.info(`${fnTag} ${formattedInspirations.length} inspirações formatadas e seguras retornadas para User ${loggedUser._id}.`);
    return { inspirations: formattedInspirations };
  } catch (err: any) {
    logger.error(`${fnTag} Erro ao buscar inspirações da comunidade para User ${loggedUser._id}:`, err);
    return { error: "Desculpe, tive um problema ao buscar as inspirações da comunidade. Poderia tentar novamente em alguns instantes?" };
  }
};

/* 2.3 getTopPosts */
const getTopPosts: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetTopPostsArgsSchema>, loggedUser) => {
  const fnTag = '[fn:getTopPosts v0.10.12]'; // Nenhuma mudança lógica aqui, mantém versão
  const userId = loggedUser._id.toString();
  try {
    const metricKey = args.metric;
    const limit = args.limit;
    logger.info(`${fnTag} Executando para user ${userId}. Métrica: ${metricKey}, Limite: ${limit} (via dataService)`);

    const topPostsFromDataService: IMetric[] = await getTopPostsByMetricFromDataService(userId, metricKey, limit);

    if (topPostsFromDataService.length === 0) {
        logger.warn(`${fnTag} Nenhum post encontrado para o ranking com a métrica ${metricKey} (via dataService).`);
        return { message: `Nenhum post encontrado com a métrica '${metricKey}' para criar o ranking.`, metric: metricKey, limit, posts: [] };
    }

    const formattedPosts = topPostsFromDataService.map(post => {
        const metricValue = post.stats?.[metricKey as keyof IMetricStats] ?? 0;
        return {
            _id: post._id.toString(),
            description: post.description ?? 'Sem descrição',
            postLink: post.postLink,
            metricTarget: metricKey,
            metricValue: metricValue,
            shares: post.stats?.shares,
            saved: post.stats?.saved,
            likes: post.stats?.likes,
            comments: post.stats?.comments,
            reach: post.stats?.reach,
            video_views: post.stats?.video_views,
            format: post.format,
            postDate: post.postDate?.toISOString().split('T')[0]
        };
    });
    logger.info(`${fnTag} Top ${formattedPosts.length} posts encontrados para métrica ${metricKey} (via dataService).`);
    return { metric: metricKey, limit, posts: formattedPosts };

  } catch (err: any) {
    logger.error(`${fnTag} Erro ao buscar top posts para User ${loggedUser._id.toString()} com métrica ${args.metric} (via dataService):`, err);
    return { error: err.message || "Ocorreu um erro inesperado ao buscar os top posts. Por favor, tente novamente." };
  }
};


// --- (NOVO) Executor da função de Ranking de Categorias ---
const getCategoryRanking: ExecutorFn = async (args, loggedUser) => {
  const fnTag = '[fn:getCategoryRanking v1.0.0]';

  // Validação interna dos argumentos com Zod
  const validationSchema = z.object({
      category: z.enum(['proposal', 'format', 'context']),
      metric: CategoryRankingMetricEnum.default('shares'),
      periodDays: z.number().min(0).default(90),
      limit: z.number().min(1).max(10).default(5)
  });

  const validation = validationSchema.safeParse(args);
  if (!validation.success) {
      logger.warn(`${fnTag} Argumentos inválidos recebidos:`, validation.error);
      return { error: 'Recebi parâmetros inválidos para criar o ranking. Por favor, tente reformular a pergunta.' };
  }
  
  const { category, metric, periodDays, limit } = validation.data;
  const userId = loggedUser._id.toString();
  logger.info(`${fnTag} Executando para User ${userId} com args:`, { category, metric, periodDays, limit });

  try {
      const endDate = new Date();
      const startDate = periodDays === 0 ? new Date(0) : subDays(endDate, periodDays);

      const results = await fetchTopCategories({
          userId,
          dateRange: { startDate, endDate },
          category,
          metric,
          limit,
      });

      if (results.length === 0) {
          logger.info(`${fnTag} Nenhum resultado encontrado para User ${userId}.`);
          const periodText = periodDays === 0 ? 'todo o período disponível' : `nos últimos ${periodDays} dias`;
          return { message: `Não encontrei dados suficientes sobre seus posts para criar um ranking de '${category}' por '${metric}' ${periodText}.` };
      }

      logger.info(`${fnTag} Ranking gerado com sucesso para User ${userId}. Itens: ${results.length}`);
      const leader = results[0];
      const rankingList = results.map((item, index) => `${index + 1}. ${item.category}: ${item.value.toLocaleString('pt-BR')}`).join('\n');

      const periodText = periodDays === 0 ? 'todo o período disponível' : `nos últimos ${periodDays} dias`;
      return {
        summary: `Aqui está o ranking das suas categorias de '${category}' por '${metric}' ${periodText}, ${loggedUser.name || 'usuário'}:\n${rankingList}`,
        ranking: results
      };

  } catch (err: any) {
      logger.error(`${fnTag} Erro ao executar getCategoryRanking para User ${userId}:`, err);
      return { error: 'Desculpe, tive um problema ao gerar o ranking. Poderia tentar novamente?' };
  }
};
// --- FIM DO NOVO EXECUTOR ---

// Executor para obter tendências de seguidores ou alcance/engajamento
const getUserTrend: ExecutorFn = async (args, loggedUser) => {
  const fnTag = '[fn:getUserTrend v1.0.1]';
  const userId = loggedUser._id.toString();

  // --- CORREÇÃO: Validar os argumentos recebidos com o schema Zod ---
  const validation = ZodSchemas.GetUserTrendArgsSchema.safeParse(args);
  if (!validation.success) {
    logger.warn(`${fnTag} Argumentos inválidos recebidos para getUserTrend:`, validation.error.flatten());
    return { error: 'Recebi parâmetros inválidos para a busca de tendência.' };
  }
  
  // CORREÇÃO: Adiciona uma anotação de tipo explícita na desestruturação.
  // Isso garante que `timePeriod` e `granularity` tenham seus tipos corretamente inferidos
  // do schema Zod, resolvendo o erro 'unknown'.
  const { trendType, timePeriod, granularity }: z.infer<typeof ZodSchemas.GetUserTrendArgsSchema> = validation.data;

  try {
    if (trendType === 'followers') {
      // Agora 'timePeriod' e 'granularity' têm os tipos corretos
      return await getFollowerTrend(userId, timePeriod, granularity as 'daily' | 'monthly');
    }
    return await getReachEngagementTrend(userId, timePeriod, granularity as 'daily' | 'weekly');
  } catch (err) {
    logger.error(`${fnTag} Erro ao buscar tendência`, err);
    return { error: 'Não foi possível obter a tendência solicitada.' };
  }
};

const getFpcTrendHistory: ExecutorFn = async (
  args: z.infer<typeof ZodSchemas.GetFpcTrendHistoryArgsSchema>,
  loggedUser
) => {
  const fnTag = '[fn:getFpcTrendHistory v1.0.0]';
  const userId = loggedUser._id.toString();
  try {
    return await getFpcTrend(
      userId,
      args.format,
      args.proposal,
      args.context,
      args.timePeriod,
      args.granularity as 'weekly' | 'monthly'
    );
  } catch (err) {
    logger.error(`${fnTag} Erro ao buscar histórico FPC`, err);
    return { error: 'Não foi possível obter o histórico solicitado.' };
  }
};


/* 2.4 getDayPCOStats */
const getDayPCOStats: ExecutorFn = async (_args: z.infer<typeof ZodSchemas.GetDayPCOStatsArgsSchema>, loggedUser) => {
   const fnTag = '[fn:getDayPCOStats v0.10.13]'; // ATUALIZADO
   try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
    const sinceDate = subDays(new Date(), 180); // Período padrão para esta análise
    const { enrichedReport } = await fetchAndPrepareReportData({
        user: loggedUser,
        analysisSinceDate: sinceDate
    });
    const pcoData = enrichedReport.performanceByDayPCO;

    if (!pcoData || Object.keys(pcoData).length === 0) {
         logger.warn(`${fnTag} Dados Dia/P/C não encontrados ou vazios para ${loggedUser._id} no período padrão.`);
         return { 
            message: "Não encontrei dados suficientes ou classificados por Dia/Proposta/Contexto para esta análise no período padrão (últimos 180 dias).",
            dayPCOStats: {} // Retorno consistente para dados não encontrados
        };
    }
    logger.info(`${fnTag} Dados Dia/P/C obtidos para o período padrão.`);
    return { dayPCOStats: pcoData }; // Dados encapsulados em uma chave

  } catch (err) {
    logger.error(`${fnTag} Erro ao buscar estatísticas Dia/Proposta/Contexto:`, err);
    if (err instanceof MetricsNotFoundError) { // Supondo que MetricsNotFoundError seja um erro específico que pode ser lançado por fetchAndPrepareReportData
        return { error: err.message, dayPCOStats: {} };
    }
    return { error: "Ocorreu um erro inesperado ao buscar as estatísticas Dia/Proposta/Contexto. Por favor, tente novamente.", dayPCOStats: {} };
  }
};

/* 2.5 getMetricDetailsById */
const getMetricDetailsById: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetMetricDetailsByIdArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getMetricDetailsById v0.10.13]'; // ATUALIZADO
    try {
        const metricId = args.metricId;
        const userId = loggedUser._id.toString();

        // Validação defensiva do metricId
        if (!Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} Metric ID inválido (não é ObjectId) recebido: ${metricId} para User ${userId}`);
            return { error: "O ID fornecido para detalhar o post parece ser inválido. Ele deveria ser um ID interno do sistema." };
        }

        logger.info(`${fnTag} Buscando detalhes para Metric ID: ${metricId} para User: ${userId} (via dataService)`);
        const metricDoc: IMetric | null = await getMetricDetailsFromDataService(metricId, userId);

        if (!metricDoc) {
            logger.warn(`${fnTag} Métrica com ID ${metricId} não encontrada para User ${userId} ou sem permissão (via dataService).`);
            // Mantém retorno de erro pois a LLM espera um post aqui
            return { error: "Não encontrei nenhuma métrica com este ID que pertença a você ou você não tem permissão para acessá-la." };
        }

        logger.info(`${fnTag} Detalhes da Métrica ${metricId} encontrados (via dataService).`);
        
        // CORREÇÃO: A propriedade `format` é um array de strings. A verificação foi alterada de `===` para `?.includes()`.
        // Isso verifica se a string 'Reel' está presente no array `format`, o que é a intenção correta.
        if (metricDoc.format?.includes('Reel') && metricDoc.stats) {
            logger.debug(`${fnTag} Detalhes do Reel ${metricId}: avgWatchTime(ms)=${(metricDoc.stats as IMetricStats).ig_reels_avg_watch_time}, totalWatchTime(ms)=${(metricDoc.stats as IMetricStats).ig_reels_video_view_total_time}`);
        }
        const result = {
            ...metricDoc,
            _id: metricDoc._id.toString(),
            user: metricDoc.user.toString() 
            // Não serializar o objeto Mongoose completo, mas uma representação em POJO
            // Se metricDoc for um Mongoose document, usar .toObject() ou construir manualmente
        };
        // Exemplo se metricDoc for um Mongoose Document:
        // const plainMetricDoc = metricDoc.toObject();
        // return { ...plainMetricDoc, _id: plainMetricDoc._id.toString(), user: plainMetricDoc.user.toString() };
        return result; // Assumindo que getMetricDetailsFromDataService já retorna um objeto simples ou que a serialização ocorre corretamente.

    } catch (err: any) {
        logger.error(`${fnTag} Erro ao buscar detalhes da métrica ${args.metricId} (chamando dataService):`, err);
        return { error: err.message || "Ocorreu um erro inesperado ao buscar os detalhes desta métrica. Por favor, tente novamente." };
    }
};

/* 2.6 findPostsByCriteria */
const findPostsByCriteria: ExecutorFn = async (args: z.infer<typeof ZodSchemas.FindPostsByCriteriaArgsSchema>, loggedUser) => {
    const fnTag = '[fn:findPostsByCriteria v0.10.12]'; // Nenhuma mudança lógica aqui, mantém versão
    try {
        const userId = loggedUser._id.toString();
        const dataServiceArgs: FindMetricsCriteriaArgs = {
            criteria: {
                format: args.criteria.format,
                proposal: args.criteria.proposal,
                context: args.criteria.context,
                dateRange: args.criteria.dateRange ? {
                    start: args.criteria.dateRange.start,
                    end: args.criteria.dateRange.end,
                } : undefined,
                minLikes: args.criteria.minLikes,
                minShares: args.criteria.minShares,
            },
            limit: args.limit,
            sortBy: args.sortBy,
            sortOrder: args.sortOrder,
        };

        logger.info(`${fnTag} Executando busca para User ${userId} com critérios: ${JSON.stringify(dataServiceArgs.criteria)} (via dataService)`);
        const postsFromDataService: IMetric[] = await findMetricsByCriteriaFromDataService(userId, dataServiceArgs);

        if (postsFromDataService.length === 0) {
            logger.info(`${fnTag} Nenhum post encontrado para os critérios (via dataService).`);
            return { message: "Não encontrei nenhum post que corresponda aos seus critérios de busca.", count: 0, posts: [] };
        }

        logger.info(`${fnTag} Encontrados ${postsFromDataService.length} posts para os critérios (via dataService).`);
        const formattedPosts = postsFromDataService.map(post => ({
             _id: post._id.toString(),
             description: post.description ?? 'Sem descrição',
             postLink: post.postLink,
             postDate: post.postDate?.toISOString().split('T')[0],
             format: post.format,
             proposal: post.proposal,
             context: post.context,
             likes: post.stats?.likes ?? 0,
             shares: post.stats?.shares ?? 0,
             saved: post.stats?.saved ?? 0,
             reach: post.stats?.reach ?? 0,
             comments: post.stats?.comments ?? 0,
             video_views: post.stats?.video_views ?? 0,
        }));
        return { count: formattedPosts.length, posts: formattedPosts };

    } catch (err: any) {
        logger.error(`${fnTag} Erro ao buscar posts por critérios para User ${loggedUser._id.toString()} (chamando dataService):`, err);
        return { error: err.message || "Ocorreu um erro inesperado ao buscar posts com esses critérios. Por favor, tente novamente." };
    }
};

/* 2.7 getDailyMetricHistory */
const getDailyMetricHistory: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetDailyMetricHistoryArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getDailyMetricHistory v0.10.13]'; // ATUALIZADO
    try {
        const metricId = args.metricId;
        const userId = loggedUser._id.toString();

        // Validação defensiva do metricId
        if (!Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} Metric ID inválido (não é ObjectId) recebido: ${metricId} para User ${userId}`);
            return { error: "O ID fornecido para o histórico do post parece ser inválido. Ele deveria ser um ID interno do sistema." };
        }

        logger.info(`${fnTag} Buscando histórico diário para Metric ID: ${metricId} para User: ${userId}`);
        const snapshots: IDailyMetricSnapshot[] = await getDailySnapshotsForMetric(metricId, userId);

        if (snapshots.length === 0) {
            logger.info(`${fnTag} Nenhum snapshot diário encontrado para Metric ${metricId} (via dataService).`);
            return { message: "Ainda não há histórico diário disponível para este post ou você não tem permissão para vê-lo.", history: [] };
        }

        logger.info(`${fnTag} Encontrados ${snapshots.length} snapshots diários para Metric ${metricId} (via dataService).`);
        const formattedHistory = snapshots.map(snap => ({ ...snap, date: snap.date.toISOString().split('T')[0] }));
        return { history: formattedHistory };

    } catch (err: any) {
        logger.error(`${fnTag} Erro ao buscar histórico diário da métrica ${args?.metricId} para User ${loggedUser._id.toString()} (chamando dataService):`, err);
        return { error: err.message || "Ocorreu um erro inesperado ao buscar o histórico diário deste post. Por favor, tente novamente." };
    }
};

/* 2.8 getMetricsHistory */
const getMetricsHistory: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetMetricsHistoryArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getMetricsHistory v0.1.0]';
    try {
        const userId = loggedUser._id.toString();
        const days = args.days ?? 360;
        logger.info(`${fnTag} Buscando histórico para User ${userId} - últimos ${days} dias`);
        const history = await getMetricsHistoryFromDataService(userId, days);
        return { history };
    } catch (err: any) {
        logger.error(`${fnTag} Erro ao buscar histórico para User ${loggedUser._id.toString()}:`, err);
        return { error: err.message || 'Erro ao buscar histórico de métricas.' };
    }
};



/* 2.8 getConsultingKnowledge */
const getConsultingKnowledge: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetConsultingKnowledgeArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getConsultingKnowledge v0.10.12]'; // Nenhuma mudança lógica aqui, mantém versão
    const topic = args.topic;

    logger.info(`${fnTag} Buscando conhecimento sobre o tópico: ${topic} para User ${loggedUser._id}`);
    try {
        let knowledge = '';
        switch (topic) {
            // --- Algorithm knowledge ---
            case 'algorithm_overview':
                knowledge = AlgorithmKnowledge.getAlgorithmOverview();
                break;
            case 'algorithm_feed':
                knowledge = AlgorithmKnowledge.explainFeedAlgorithm();
                break;
            case 'algorithm_stories':
                knowledge = AlgorithmKnowledge.explainStoriesAlgorithm();
                break;
            case 'algorithm_reels':
                knowledge = AlgorithmKnowledge.explainReelsAlgorithm();
                break;
            case 'algorithm_explore':
                knowledge = AlgorithmKnowledge.explainExploreAlgorithm();
                break;
            case 'engagement_signals':
                knowledge = AlgorithmKnowledge.listEngagementSignals();
                break;
            case 'account_type_differences':
                knowledge = AlgorithmKnowledge.explainAccountTypeDifferences();
                break;
            case 'format_treatment':
                knowledge = AlgorithmKnowledge.explainFormatTreatment();
                break;
            case 'ai_ml_role':
                knowledge = AlgorithmKnowledge.explainAI_ML_Role();
                break;
            case 'recent_updates':
                knowledge = AlgorithmKnowledge.getRecentAlgorithmUpdates();
                break;
            case 'best_practices':
                knowledge = AlgorithmKnowledge.getBestPractices();
                break;

            // --- Pricing knowledge ---
            case 'pricing_overview_instagram':
                knowledge = PricingKnowledge.getInstagramPricingRanges();
                break;
            case 'pricing_overview_tiktok':
                knowledge = PricingKnowledge.getTikTokPricingRanges();
                break;
            case 'pricing_benchmarks_sector':
                knowledge = PricingKnowledge.getSectorBenchmarks();
                break;
            case 'pricing_negotiation_contracts':
                knowledge = PricingKnowledge.getNegotiationStructureInfo();
                break;
            case 'pricing_trends':
                knowledge = PricingKnowledge.getPricingTrends();
                break;

            // --- Metrics knowledge ---
            case 'metrics_analysis':
                knowledge = MetricsKnowledge.getCoreMetricsAnalysis();
                break;
            case 'metrics_retention_rate':
                knowledge = MetricsKnowledge.explainRetentionRate();
                break;
            case 'metrics_avg_watch_time':
                knowledge = MetricsKnowledge.explainAvgWatchTimeVsDuration();
                break;
            case 'metrics_reach_ratio':
                knowledge = MetricsKnowledge.explainFollowerVsNonFollowerReach();
                break;
            case 'metrics_follower_growth':
                knowledge = MetricsKnowledge.analyzeFollowerGrowth();
                break;
            case 'metrics_propagation_index':
                knowledge = MetricsKnowledge.explainPropagationIndex();
                break;

            // --- Branding knowledge ---
            case 'personal_branding_principles':
                knowledge = BrandingKnowledge.getPersonalBrandingPrinciples();
                break;
            case 'branding_aesthetics':
                knowledge = BrandingKnowledge.explainAestheticsAndVisualStorytelling();
                break;
            case 'branding_positioning_by_size':
                knowledge = BrandingKnowledge.explainPositioningBySize();
                break;
            case 'branding_monetization':
                knowledge = BrandingKnowledge.explainImageAndMonetization();
                break;
            case 'branding_case_studies':
                knowledge = BrandingKnowledge.getBrandingCaseStudies();
                break;
            case 'branding_trends':
                knowledge = BrandingKnowledge.getEmergingBrandingTrends();
                break;

            // --- Methodology knowledge ---
            case 'methodology_shares_retention':
                knowledge = MethodologyKnowledge.explainSharesRetentionImpact();
                break;
            case 'methodology_format_proficiency':
                knowledge = MethodologyKnowledge.explainFormatProficiency();
                break;
            case 'methodology_cadence_quality':
                knowledge = MethodologyKnowledge.explainCadenceQuality();
                break;

            // --- Misc knowledge ---
            case 'best_posting_times':
                knowledge = ExtraKnowledge.getBestPostingTimes();
                break;
            case 'community_inspiration_overview':
                knowledge = ExtraKnowledge.getCommunityInspirationOverview();
                break;

            default:
                logger.warn(`${fnTag} Tópico não mapeado recebido para User ${loggedUser._id}: ${topic}`);
                // CORREÇÃO: Acessando os valores do enum de forma segura.
                const validTopics = ZodSchemas.GetConsultingKnowledgeArgsSchema.shape.topic._def.values;
                if (!validTopics.includes(topic as any)) {
                     return { error: `Tópico de conhecimento inválido ou não reconhecido: "${topic}". Por favor, escolha um dos tópicos válidos.` };
                }
                return { error: `O tópico de conhecimento "${topic}" é reconhecido, mas houve um problema ao buscar a informação. Tente novamente ou contate o suporte se o erro persistir.` };
        }
        logger.info(`${fnTag} Conhecimento sobre "${topic}" encontrado para User ${loggedUser._id}.`);
        return { knowledge: knowledge };

    } catch (err: any) {
        logger.error(`${fnTag} Erro ao buscar conhecimento para o tópico "${topic}" para User ${loggedUser._id}:`, err);
        return { error: "Ocorreu um erro interno ao buscar esta informação. Por favor, tente novamente." };
    }
};


/* ------------------------------------------------------------------ *
 * 3.  Mapa exportado                                                 *
 * ------------------------------------------------------------------ */
export const functionExecutors: Record<string, ExecutorFn> = {
  getAggregatedReport,
  getLatestAccountInsights,
  getLatestAudienceDemographics,
  fetchCommunityInspirations,
  getTopPosts,
  getCategoryRanking, // (NOVO) Garantir que esta linha está aqui
  getUserTrend,
  getFpcTrendHistory,
  getDayPCOStats,
  getMetricDetailsById,
  findPostsByCriteria,
  getDailyMetricHistory,
  getMetricsHistory,
  getConsultingKnowledge,
};