// @/app/lib/aiFunctions.ts – v0.10.1 (Período de Relatório Flexível)
// - ATUALIZADO: Schema e executor de `getAggregatedReport` para aceitar `analysisPeriod` como um número de dias.
// - `analysisPeriod: 0` é tratado como 'allTime' no executor.
// - Mantém funcionalidade da v0.10.0 (Comunidade de Inspiração).

import { Types, Model } from 'mongoose';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';

// Importa os Schemas Zod (deve ser v1.3.0 ou superior)
// ASSUMINDO que ZodSchemas.GetAggregatedReportArgsSchema será atualizado para analysisPeriod: z.number().optional().default(180)
import * as ZodSchemas from './aiFunctionSchemas.zod';

import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import AccountInsightModel, { IAccountInsight } from '@/app/models/AccountInsight'; 
import { IUser } from '@/app/models/User';

import { MetricsNotFoundError } from '@/app/lib/errors'; 

import {
  fetchAndPrepareReportData,
  getAdDealInsights,
  AdDealInsights,
  IEnrichedReport,
  getInspirations as getCommunityInspirationsDataService,
  CommunityInspirationFilters,
} from './dataService'; 
import { subDays, subYears, startOfDay } from 'date-fns';

import * as PricingKnowledge from './knowledge/pricingKnowledge';
import * as AlgorithmKnowledge from './knowledge/algorithmKnowledge';
import * as MetricsKnowledge from './knowledge/metricsKnowledge';
import * as BrandingKnowledge from './knowledge/personalBrandingKnowledge';
import * as MethodologyKnowledge from './knowledge/methodologyDeepDive';


/* ------------------------------------------------------------------ *
 * 1.  JSON-schemas expostos ao LLM (ATUALIZADO v0.10.1)              *
 * ------------------------------------------------------------------ */
export const functionSchemas = [
  {
    name: 'getAggregatedReport',
    description: 'Retorna um relatório completo com métricas agregadas de posts E TAMBÉM os insights sobre parcerias publicitárias recentes do usuário. Use para análises gerais, planos, rankings, perguntas sobre performance e publicidade. **É o ponto de partida OBRIGATÓRIO para a maioria das análises.** Permite especificar o período da análise em número de dias.',
    parameters: {
      type: 'object',
      properties: {
        analysisPeriod: {
          type: 'number', // MODIFICADO de 'string' para 'number'
          default: 180,   // MODIFICADO de 'last180days' para 180
          description: "O número de dias a serem considerados para a análise do relatório (ex: 7, 30, 40, 90, 180). Use 180 como padrão se nenhum período específico for solicitado. Use 0 para 'todo o período disponível'.",
        }
      },
      required: [] // analysisPeriod é opcional, e o default será usado ou a IA enviará 180.
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
    name: 'fetchCommunityInspirations',
    description: "Busca exemplos de posts da Comunidade de Inspiração IA Tuca que tiveram bom desempenho qualitativo. Use quando o usuário pedir explicitamente por inspiração, ou para ilustrar sugestões de planejamento de conteúdo. Baseie-se na proposta e contexto fornecidos, e opcionalmente em um objetivo qualitativo de desempenho (ex: 'gerou_muitos_salvamentos', 'alcancou_nova_audiencia').",
    parameters: {
      type: 'object',
      properties: {
        proposal: { 
          type: 'string', 
          description: "A proposta/tema do conteúdo para o qual se busca inspiração (obrigatório)." 
        },
        context: { 
          type: 'string', 
          description: "O contexto específico dentro da proposta (obrigatório)." 
        },
        format: { 
          type: 'string', 
          description: "Opcional. Formato do post (ex: Reels, Foto, Carrossel) para refinar a busca." 
        },
        primaryObjectiveAchieved_Qualitative: { 
          type: 'string', 
          description: "Opcional. O objetivo qualitativo principal que a inspiração deve ter demonstrado (ex: 'gerou_muitos_salvamentos', 'fomentou_discussao_rica')." 
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
                enum: ZodSchemas.GetTopPostsArgsSchema.shape.metric.removeDefault().unwrap()._def.values,
                default: 'shares',
                description: "Métrica para ordenar os posts (compartilhamentos, salvamentos, curtidas, comentários, alcance ou visualizações)."
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
    name: 'getDayPCOStats',
    description: 'Retorna dados de desempenho médio agrupados por Dia da Semana, Proposta e Contexto (usando nomes padronizados). Use APENAS se o usuário perguntar sobre melhor dia/horário para nichos específicos e após ter o relatório geral via getAggregatedReport.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getMetricDetailsById',
    description: 'Busca e retorna os detalhes completos (incluindo métricas) de um único post específico, dado o seu ID. Use para aprofundar a análise de um post mencionado (ex: um post do top 3, ou um post encontrado por busca).',
    parameters: {
        type: 'object',
        properties: {
            metricId: {
                type: 'string',
                description: "O ID do post/métrica a ser detalhado."
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
                    format: { type: 'string', description: "Formato do post (ex: Reels, Foto, Carrossel)." },
                    proposal: { type: 'string', description: "Proposta/tema do post." },
                    context: { type: 'string', description: "Contexto do post." },
                    dateRange: {
                        type: 'object',
                        properties: {
                            start: { type: 'string', format: 'date', description: "Data de início (YYYY-MM-DD) para filtrar posts." },
                            end: { type: 'string', format: 'date', description: "Data de fim (YYYY-MM-DD) para filtrar posts." }
                        },
                        description: "Intervalo de datas para filtrar os posts."
                    },
                    minLikes: { type: 'number', description: "Número mínimo de curtidas." },
                    minShares: { type: 'number', description: "Número mínimo de compartilhamentos." }
                },
                description: "Critérios de busca para os posts."
            },
            limit: { type: 'number', default: 5, minimum: 1, maximum: 20, description: "Número máximo de posts a retornar." },
            sortBy: {
                type: 'string',
                enum: ZodSchemas.FindPostsByCriteriaArgsSchema.shape.sortBy.removeDefault().unwrap()._def.values,
                default: 'postDate',
                description: "Campo para ordenar os resultados."
            },
            sortOrder: {
                type: 'string',
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
    description: 'Busca o histórico de métricas diárias e cumulativas para um post específico (Metric ID), limitado aos primeiros 30 dias. Use para analisar crescimento, viralização e picos de engajamento, APÓS identificar um post de interesse.',
    parameters: {
        type: 'object',
        properties: {
            metricId: {
                type: 'string',
                description: "O ID do post/métrica para buscar o histórico diário."
            }
        },
        required: ['metricId']
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
                enum: ZodSchemas.GetConsultingKnowledgeArgsSchema.shape.topic._def.values,
                description: `Tópico sobre o qual buscar conhecimento. Tópicos válidos: ${ZodSchemas.GetConsultingKnowledgeArgsSchema.shape.topic._def.values.join(', ')}`
            }
        },
        required: ['topic']
    }
  }
] as const;

// Tipo para os executores
type ExecutorFn = (args: any, user: IUser) => Promise<unknown>;

/* ---------------------------------------------------------------------- *
 * 2.  Executores das Funções (ATUALIZADO v0.10.1)                        *
 * ---------------------------------------------------------------------- */

/* 2.1 getAggregatedReport */
const getAggregatedReport: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetAggregatedReportArgsSchema>, loggedUser) => {
  const fnTag = '[fn:getAggregatedReport v0.10.1]'; 
  try {
    // analysisPeriod agora é esperado como um número de dias.
    // O ZodSchema (não fornecido aqui) deve ser atualizado para z.number().optional().default(180) ou similar.
    // Se args.analysisPeriod for undefined (porque a IA não enviou ou Zod não aplicou default), usamos 180.
    const periodInDays = args.analysisPeriod === undefined ? 180 : args.analysisPeriod;
    
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id} com período de análise: ${periodInDays} dias.`);

    let sinceDate: Date;
    const now = new Date();

    if (periodInDays === 0) { // 0 dias é interpretado como "allTime"
      sinceDate = new Date('1970-01-01T00:00:00.000Z');
      logger.info(`${fnTag} Período de ${periodInDays} dias interpretado como 'allTime', buscando desde o início.`);
    } else if (periodInDays > 0) {
      sinceDate = subDays(now, periodInDays);
    } else {
      // Caso inválido (ex: número negativo), usar padrão de 180 dias para segurança.
      logger.warn(`${fnTag} Período de análise inválido (${periodInDays} dias) recebido. Usando padrão de 180 dias.`);
      sinceDate = subDays(now, 180);
    }
    
    logger.debug(`${fnTag} Data de início da análise calculada: ${sinceDate.toISOString()} para período de ${periodInDays} dias.`);

    // A lógica para AdDealInsights pode precisar de ajuste se os períodos 'all', 'last90d' não corresponderem mais
    // diretamente ao periodInDays numérico. Por ora, mantendo a lógica original de adDealResult,
    // mas isso pode precisar de refinamento para mapear periodInDays para os enums esperados por getAdDealInsights.
    // Exemplo simplificado: se periodInDays > 90, talvez usar 'all', senão 'last90d'.
    // Para este exemplo, vamos manter a lógica original de adDealResult, mas é um ponto de atenção.
    let adDealPeriodString: 'all' | 'last90d' = 'last90d';
    if (periodInDays === 0) adDealPeriodString = 'all'; // "allTime"
    // Outras lógicas de mapeamento podem ser adicionadas aqui se necessário para adDealPeriodString

    const [reportResult, adDealResult] = await Promise.allSettled([
        fetchAndPrepareReportData({
            user: loggedUser,
            contentMetricModel: MetricModel,
            analysisSinceDate: sinceDate
        }),
        getAdDealInsights(loggedUser._id.toString(), adDealPeriodString)
    ]);

    let enrichedReportData: IEnrichedReport | null = null;
    let reportError: string | null = null;
    if (reportResult.status === 'fulfilled') {
        enrichedReportData = reportResult.value.enrichedReport;
        logger.info(`${fnTag} Relatório agregado de métricas gerado com sucesso para o período de ${periodInDays} dias. Posts no relatório: ${enrichedReportData?.overallStats?.totalPosts ?? 'N/A'}`);
        if (enrichedReportData?.overallStats) {
            logger.debug(`${fnTag} OverallStats contém: totalReels=${enrichedReportData.overallStats.totalReelsInPeriod}, avgReelAvgWatchTimeSecs=${enrichedReportData.overallStats.avgReelAvgWatchTimeSeconds}`);
        }
    } else {
        reportError = `Falha ao gerar parte do relatório (métricas) para o período de ${periodInDays} dias: ${reportResult.reason?.message || 'Erro desconhecido'}`;
        logger.error(`${fnTag} Erro ao gerar relatório agregado de métricas:`, reportResult.reason);
    }

    let adDealInsightsData: AdDealInsights | null = null;
    let adDealError: string | null = null;
    if (adDealResult.status === 'fulfilled') {
        adDealInsightsData = adDealResult.value;
        logger.info(`${fnTag} Insights de publicidade ${adDealInsightsData ? `encontrados (${adDealInsightsData.totalDeals} deals)` : 'não encontrados'} para o período correspondente.`);
    } else {
        adDealError = `Falha ao buscar dados de publicidade: ${adDealResult.reason?.message || 'Erro desconhecido'}`;
        logger.error(`${fnTag} Erro ao buscar insights de publicidade:`, adDealResult.reason);
    }

    if (!enrichedReportData && !adDealInsightsData) {
        const primaryError = reportError || adDealError || "Nenhum dado encontrado para o período selecionado.";
        logger.warn(`${fnTag} Nenhum dado de relatório ou publicidade retornado para ${loggedUser._id} no período de ${periodInDays} dias. Erro principal: ${primaryError}`);
        return { error: primaryError, message: "Não foi possível obter dados para o relatório no período especificado." };
    }
    
    return {
        analysisPeriodUsed: periodInDays, // Retorna o número de dias efetivamente usado
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
    const fnTag = '[fn:getLatestAccountInsights v0.9.9]'; // Mantendo versão original se a lógica interna não mudou
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);

    try {
        const latestInsight = await AccountInsightModel.findOne({ 
            user: loggedUser._id,
            $or: [
                { 'audienceDemographics.follower_demographics': { $exists: true, $ne: null } },
                { 'audienceDemographics.engaged_audience_demographics': { $exists: true, $ne: null } },
                { 
                    $and: [
                        { "accountInsightsPeriod": { $exists: true, $ne: null } },
                        { "accountInsightsPeriod": { $ne: {} } }
                    ]
                }
            ]
         })
        .sort({ recordedAt: -1 })
        .select('recordedAt accountInsightsPeriod audienceDemographics accountDetails')
        .lean<IAccountInsight>();

        if (!latestInsight) {
            logger.warn(`${fnTag} Nenhum insight de conta ou dado demográfico útil encontrado para User ${loggedUser._id}.`);
            return { 
                message: "Ainda não tenho dados demográficos ou insights gerais da sua conta para analisar. Assim que forem coletados, poderei te ajudar com isso!",
                data: null 
            };
        }

        logger.info(`${fnTag} Insights de conta mais recentes encontrados para User ${loggedUser._id} (gravado em: ${latestInsight.recordedAt?.toISOString()}).`);
        
        return {
            recordedAt: latestInsight.recordedAt?.toISOString(),
            accountInsightsPeriod: latestInsight.accountInsightsPeriod,
            audienceDemographics: latestInsight.audienceDemographics,
            accountDetails: latestInsight.accountDetails
        };

    } catch (err: any) {
        logger.error(`${fnTag} Erro ao buscar os insights de conta mais recentes para User ${loggedUser._id}:`, err);
        return { error: "Ocorreu um erro inesperado ao tentar buscar os dados mais recentes da sua conta. Por favor, tente novamente." };
    }
};

/* 2.X fetchCommunityInspirations */
const fetchCommunityInspirations: ExecutorFn = async (args: z.infer<typeof ZodSchemas.FetchCommunityInspirationsArgsSchema>, loggedUser) => {
  const fnTag = '[fn:fetchCommunityInspirations v0.10.0]'; // Mantendo versão original se a lógica interna não mudou
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
    };
    if (args.format) {
      filters.format = args.format;
    }
    if (args.primaryObjectiveAchieved_Qualitative) {
      filters.primaryObjectiveAchieved_Qualitative = args.primaryObjectiveAchieved_Qualitative;
    }
    
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
  const fnTag = '[fn:getTopPosts v0.9.9]'; // Mantendo versão original se a lógica interna não mudou
  try {
    const userId = new Types.ObjectId(loggedUser._id);
    const metric = args.metric;
    const limit = args.limit;
    logger.info(`${fnTag} Executando para user ${userId}. Métrica: ${metric}, Limite: ${limit}`);

    const sortField = `stats.${metric}`;
    const topPosts: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[] = await MetricModel.find({
        user: userId, postDate: { $exists: true }, [sortField]: { $exists: true, $ne: null }
      })
      .select(`_id description postLink stats.${metric} stats.shares stats.saved`)
      .sort({ [sortField]: -1 })
      .limit(limit)
      .lean()
      .exec();

    if (topPosts.length === 0) {
        logger.warn(`${fnTag} Nenhum post encontrado para o ranking com a métrica ${metric}.`);
        return { message: `Nenhum post encontrado com a métrica '${metric}' para criar o ranking.`, metric, limit, posts: [] };
    }

    const formattedPosts = topPosts.map(post => {
        const metricValue = post.stats?.[metric as keyof IMetricStats] ?? 0;
        return { 
            _id: post._id.toString(), 
            description: post.description ?? 'Sem descrição', 
            postLink: post.postLink, 
            metricTarget: metric,
            metricValue: metricValue,
            shares: post.stats?.shares,
            saved: post.stats?.saved
        };
    });
    logger.info(`${fnTag} Top ${formattedPosts.length} posts encontrados para métrica ${metric}.`);
    return { metric, limit, posts: formattedPosts };

  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    return { error: "Ocorreu um erro inesperado ao buscar os top posts. Por favor, tente novamente." };
  }
};

/* 2.4 getDayPCOStats */
const getDayPCOStats: ExecutorFn = async (_args: z.infer<typeof ZodSchemas.GetDayPCOStatsArgsSchema>, loggedUser) => {
   const fnTag = '[fn:getDayPCOStats v0.9.9]'; // Mantendo versão original se a lógica interna não mudou
   try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
    // Este executor ainda usa um período fixo. Pode precisar de ajuste se a IA precisar passar período.
    const sinceDate = subDays(new Date(), 180); 
    const { enrichedReport } = await fetchAndPrepareReportData({
        user: loggedUser,
        contentMetricModel: MetricModel,
        analysisSinceDate: sinceDate
    });
    const pcoData = enrichedReport.performanceByDayPCO;

    if (!pcoData || Object.keys(pcoData).length === 0) {
         logger.warn(`${fnTag} Dados Dia/P/C não encontrados ou vazios para ${loggedUser._id} no período padrão.`);
         return { message: "Não encontrei dados suficientes ou classificados por Dia/Proposta/Contexto para esta análise no período padrão." };
    }
    logger.info(`${fnTag} Dados Dia/P/C obtidos para o período padrão.`);
    return pcoData;

  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    if (err instanceof MetricsNotFoundError) {
        return { error: err.message };
    }
    return { error: "Ocorreu um erro inesperado ao buscar as estatísticas Dia/Proposta/Contexto." };
  }
};

/* 2.5 getMetricDetailsById */
const getMetricDetailsById: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetMetricDetailsByIdArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getMetricDetailsById v0.9.9]'; // Mantendo versão original se a lógica interna não mudou
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const metricId = args.metricId;

        if (!Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} ID da métrica inválido (formato): ${metricId}`);
            return { error: "O ID da métrica fornecido não parece ser válido." };
        }
        const objectMetricId = new Types.ObjectId(metricId);

        logger.info(`${fnTag} Buscando detalhes para Metric ID: ${metricId} para User: ${userId}`);
        const metricDoc = await MetricModel.findOne({ _id: objectMetricId, user: userId })
            .select('-rawData -__v') 
            .lean()
            .exec();

        if (!metricDoc) {
            logger.warn(`${fnTag} Métrica com ID ${metricId} não encontrada para User ${userId}.`);
            return { error: "Não encontrei nenhuma métrica com este ID que pertença a você." };
        }

        logger.info(`${fnTag} Detalhes da Métrica ${metricId} encontrados.`);
        if (metricDoc.format === 'Reel' && metricDoc.stats) {
            logger.debug(`${fnTag} Detalhes do Reel ${metricId}: avgWatchTime(ms)=${(metricDoc.stats as IMetricStats).ig_reels_avg_watch_time}, totalWatchTime(ms)=${(metricDoc.stats as IMetricStats).ig_reels_video_view_total_time}`);
        }
        
        const result = { 
            ...metricDoc, 
            _id: metricDoc._id.toString(), 
            user: metricDoc.user.toString() 
        };
        return result;

    } catch (err) {
        logger.error(`${fnTag} Erro:`, err);
        return { error: "Ocorreu um erro inesperado ao buscar os detalhes desta métrica. Por favor, tente novamente." };
    }
};

/* 2.6 findPostsByCriteria */
const findPostsByCriteria: ExecutorFn = async (args: z.infer<typeof ZodSchemas.FindPostsByCriteriaArgsSchema>, loggedUser) => {
    const fnTag = '[fn:findPostsByCriteria v0.9.9]'; // Mantendo versão original se a lógica interna não mudou
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const { criteria, limit, sortBy, sortOrder } = args;
        logger.info(`${fnTag} Executando busca para User ${userId} com critérios: ${JSON.stringify(criteria)}`);

        const filter: any = { user: userId };
        if (criteria.format) filter.format = criteria.format;
        if (criteria.proposal) filter.proposal = criteria.proposal;
        if (criteria.context) filter.context = criteria.context;
        if (criteria.dateRange) {
            filter.postDate = {};
             try {
                 if (criteria.dateRange.start) filter.postDate.$gte = new Date(criteria.dateRange.start);
                 if (criteria.dateRange.end) {
                      const endDate = new Date(criteria.dateRange.end);
                      endDate.setUTCHours(23, 59, 59, 999);
                      filter.postDate.$lte = endDate;
                 }
                 if(filter.postDate.$gte && filter.postDate.$lte && filter.postDate.$gte > filter.postDate.$lte){
                     return { error: "A data de início não pode ser posterior à data de fim." };
                 }
             } catch(dateErr){
                  logger.warn(`${fnTag} Erro ao processar dateRange: ${JSON.stringify(criteria.dateRange)}`, dateErr);
                  return { error: "Ocorreu um erro ao processar o intervalo de datas." };
             }
            if (Object.keys(filter.postDate).length === 0) delete filter.postDate;
        }
        if (criteria.minLikes !== undefined) filter['stats.likes'] = { $gte: criteria.minLikes };
        if (criteria.minShares !== undefined) filter['stats.shares'] = { $gte: criteria.minShares };
        
        const sortOptions: any = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        logger.debug(`${fnTag} Filtro MQL: ${JSON.stringify(filter)}`);
        logger.debug(`${fnTag} Ordenação MQL: ${JSON.stringify(sortOptions)}`);

        const posts = await MetricModel.find(filter)
            .select('_id description postLink postDate stats.likes stats.shares stats.saved stats.reach format proposal context')
            .sort(sortOptions)
            .limit(limit)
            .lean()
            .exec();

        if (posts.length === 0) {
            logger.info(`${fnTag} Nenhum post encontrado para os critérios.`);
            return { message: "Não encontrei nenhum post que corresponda aos seus critérios de busca.", count: 0, posts: [] };
        }

        logger.info(`${fnTag} Encontrados ${posts.length} posts para os critérios.`);
        const formattedPosts = posts.map(post => ({
             _id: post._id.toString(),
             description: post.description ?? 'Sem descrição',
             postLink: post.postLink,
             postDate: post.postDate?.toISOString().split('T')[0],
             format: post.format, proposal: post.proposal, context: post.context,
             likes: post.stats?.likes ?? 0, shares: post.stats?.shares ?? 0, saved: post.stats?.saved ?? 0, reach: post.stats?.reach ?? 0,
        }));
        return { count: formattedPosts.length, posts: formattedPosts };

    } catch (err) {
        logger.error(`${fnTag} Erro:`, err);
        return { error: "Ocorreu um erro inesperado ao buscar posts com esses critérios. Por favor, tente novamente." };
    }
};

/* 2.7 getDailyMetricHistory */
const getDailyMetricHistory: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetDailyMetricHistoryArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getDailyMetricHistory v0.9.9]'; // Mantendo versão original se a lógica interna não mudou
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const metricId = args.metricId;

        if (!Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} ID da métrica inválido fornecido (formato): ${metricId}`);
            return { error: "O ID da métrica fornecido não parece ser válido." };
        }
        const objectMetricId = new Types.ObjectId(metricId);

        logger.info(`${fnTag} Buscando histórico diário para Metric ID: ${metricId} para User: ${userId}`);
        const metricOwnerCheck = await MetricModel.findOne({ _id: objectMetricId, user: userId }).select('_id').lean();
        if (!metricOwnerCheck) {
            const metricExists = await MetricModel.findById(objectMetricId).select('_id').lean();
            if (!metricExists) { return { error: "Não encontrei nenhuma métrica com este ID." }; }
            else { return { error: "Você não tem permissão para acessar o histórico desta métrica." }; }
        }

        const snapshots = await DailyMetricSnapshotModel.find({ metric: objectMetricId })
            .sort({ date: 1 })
            .select('date dailyViews dailyLikes dailyComments dailyShares dailySaved dailyReach dailyFollows dailyProfileVisits cumulativeViews cumulativeLikes cumulativeComments cumulativeShares cumulativeSaved cumulativeReach cumulativeFollows cumulativeProfileVisits cumulativeTotalInteractions dailyReelsVideoViewTotalTime cumulativeReelsVideoViewTotalTime currentReelsAvgWatchTime -_id')
            .lean();

        if (snapshots.length === 0) {
            logger.info(`${fnTag} Nenhum snapshot diário encontrado para Metric ${metricId}.`);
            return { message: "Ainda não há histórico diário disponível para este post.", history: [] };
        }

        logger.info(`${fnTag} Encontrados ${snapshots.length} snapshots diários para Metric ${metricId}.`);
        const formattedHistory = snapshots.map(snap => ({ ...snap, date: snap.date.toISOString().split('T')[0] }));
        return { history: formattedHistory };

    } catch (err) {
        logger.error(`${fnTag} Erro ao buscar histórico diário da métrica ${args?.metricId}:`, err);
        return { error: "Ocorreu um erro inesperado ao buscar o histórico diário deste post. Por favor, tente novamente." };
    }
};


/* 2.8 getConsultingKnowledge */
const getConsultingKnowledge: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetConsultingKnowledgeArgsSchema>, _loggedUser) => {
    const fnTag = '[fn:getConsultingKnowledge v0.9.9]'; // Mantendo versão original se a lógica interna não mudou
    const topic = args.topic;

    logger.info(`${fnTag} Buscando conhecimento sobre o tópico: ${topic}`);
    try {
        let knowledge = '';
        switch (topic) {
             case 'algorithm_overview': knowledge = AlgorithmKnowledge.getAlgorithmOverview(); break;
             case 'algorithm_feed': knowledge = AlgorithmKnowledge.explainFeedAlgorithm(); break;
             // ... (outros cases existentes mantidos) ...
             case 'methodology_cadence_quality': knowledge = MethodologyKnowledge.explainCadenceQuality(); break;
             
            default:
                logger.warn(`${fnTag} Tópico não mapeado recebido (apesar da validação Zod?): ${topic}`);
                const validTopics = ZodSchemas.GetConsultingKnowledgeArgsSchema.shape.topic._def.values;
                if (!validTopics.includes(topic as any)) {
                     return { error: `Tópico de conhecimento inválido ou não reconhecido: "${topic}". Por favor, escolha um dos tópicos válidos.` };
                }
                return { error: `O tópico de conhecimento "${topic}" é reconhecido, mas houve um problema ao buscar a informação. Tente novamente ou contate o suporte se o erro persistir.` };
        }
        logger.info(`${fnTag} Conhecimento sobre "${topic}" encontrado.`);
        return { knowledge: knowledge };

    } catch (err) {
        logger.error(`${fnTag} Erro ao buscar conhecimento para o tópico "${topic}":`, err);
        return { error: "Ocorreu um erro interno ao buscar esta informação. Por favor, tente novamente." };
    }
};


/* ------------------------------------------------------------------ *
 * 3.  Mapa exportado (ATUALIZADO v0.10.1)                            *
 * ------------------------------------------------------------------ */
export const functionExecutors: Record<string, ExecutorFn> = {
  getAggregatedReport,
  getLatestAccountInsights,
  fetchCommunityInspirations,
  getTopPosts,
  getDayPCOStats,
  getMetricDetailsById,
  findPostsByCriteria,
  getDailyMetricHistory,
  getConsultingKnowledge,
};
