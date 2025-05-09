// @/app/lib/aiFunctions.ts – v0.9.6 (Multiple Knowledge Function Call Fixes)
// - ATUALIZADO: Correctly access enum options from Zod schemas wrapped with .optional() or .default()
//   using .removeDefault().unwrap()._def.values.
// - ATUALIZADO: Corrected multiple knowledge function calls in getConsultingKnowledge.
// - Ensures getAggregatedReport still accepts 'analysisPeriod'.

import { Types, Model } from 'mongoose';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';

// Importa os Schemas Zod (aiFunctionSchemas.zod.ts v1.1.0)
import * as ZodSchemas from './aiFunctionSchemas.zod';

import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { IUser } from '@/app/models/User';

import { MetricsNotFoundError } from '@/app/lib/errors';

import {
  fetchAndPrepareReportData,
  getAdDealInsights,
  AdDealInsights,
  IEnrichedReport,
} from './dataService';
import { subDays, subYears } from 'date-fns';

// Imports dos arquivos de conhecimento
import * as PricingKnowledge from './knowledge/pricingKnowledge';
import * as AlgorithmKnowledge from './knowledge/algorithmKnowledge';
import * as MetricsKnowledge from './knowledge/metricsKnowledge';
import * as BrandingKnowledge from './knowledge/personalBrandingKnowledge';
import * as MethodologyKnowledge from './knowledge/methodologyDeepDive';


/* ------------------------------------------------------------------ *
 * 1.  JSON-schemas expostos ao LLM (Manually defined parameters)     *
 * ------------------------------------------------------------------ */
export const functionSchemas = [
  {
    name: 'getAggregatedReport',
    description: 'Retorna um relatório completo com métricas agregadas de posts E TAMBÉM os insights sobre parcerias publicitárias recentes do usuário. Use para análises gerais, planos, rankings, perguntas sobre performance e publicidade. **É o ponto de partida OBRIGATÓRIO para a maioria das análises.** Permite especificar o período da análise.',
    parameters: {
      type: 'object',
      properties: {
        analysisPeriod: {
          type: 'string',
          enum: ZodSchemas.GetAggregatedReportArgsSchema.shape.analysisPeriod.removeDefault().unwrap()._def.values,
          default: 'last180days',
          description: "O período a ser considerado para a análise do relatório. 'last180days' (padrão) para os últimos 180 dias, 'last365days' para o último ano, 'allTime' para todo o histórico disponível.",
        }
      },
      required: []
    }
  },
  {
    name: 'getTopPosts',
    description: 'Retorna os N posts com melhor desempenho em uma métrica específica (shares ou saved). Use APENAS se o usuário pedir explicitamente por "top posts" e após ter o relatório geral via getAggregatedReport.',
    parameters: {
        type: 'object',
        properties: {
            metric: {
                type: 'string',
                enum: ZodSchemas.GetTopPostsArgsSchema.shape.metric.removeDefault().unwrap()._def.values,
                default: 'shares',
                description: "Métrica para ordenar os posts (compartilhamentos ou salvamentos)."
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
 * 2.  Executores das Funções (v0.9.6)                                  *
 * ---------------------------------------------------------------------- */

/* 2.1 getAggregatedReport */
const getAggregatedReport: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetAggregatedReportArgsSchema>, loggedUser) => {
  const fnTag = '[fn:getAggregatedReport v0.9.6]';
  try {
    const analysisPeriod = args.analysisPeriod;
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id} com período de análise: ${analysisPeriod}`);

    let sinceDate: Date;
    const now = new Date();
    if (analysisPeriod === 'last365days') {
      sinceDate = subYears(now, 1);
    } else if (analysisPeriod === 'allTime') {
      sinceDate = new Date('1970-01-01T00:00:00.000Z');
      logger.info(`${fnTag} Período 'allTime' definido para buscar desde o início dos tempos.`);
    } else { // 'last180days' (padrão)
      sinceDate = subDays(now, 180);
    }
    logger.debug(`${fnTag} Data de início da análise calculada: ${sinceDate.toISOString()} para período ${analysisPeriod}`);

    const [reportResult, adDealResult] = await Promise.allSettled([
        fetchAndPrepareReportData({
            user: loggedUser,
            contentMetricModel: MetricModel,
            analysisSinceDate: sinceDate
        }),
        getAdDealInsights(loggedUser._id.toString(), analysisPeriod === 'allTime' ? 'all' : (analysisPeriod === 'last365days' ? 'last90d' : 'last90d'))
    ]);

    let enrichedReportData: IEnrichedReport | null = null;
    let reportError: string | null = null;
    if (reportResult.status === 'fulfilled') {
        enrichedReportData = reportResult.value.enrichedReport;
        logger.info(`${fnTag} Relatório agregado de métricas gerado com sucesso para o período ${analysisPeriod}. Posts no relatório: ${enrichedReportData?.overallStats?.totalPosts ?? 'N/A'}`);
    } else {
        reportError = `Falha ao gerar parte do relatório (métricas) para o período ${analysisPeriod}: ${reportResult.reason?.message || 'Erro desconhecido'}`;
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
        logger.warn(`${fnTag} Nenhum dado de relatório ou publicidade retornado para ${loggedUser._id} no período ${analysisPeriod}. Erro principal: ${primaryError}`);
        return { error: primaryError, message: "Não foi possível obter dados para o relatório no período especificado." };
    }
    
    return {
        analysisPeriodUsed: analysisPeriod,
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

/* 2.2 getTopPosts */
const getTopPosts: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetTopPostsArgsSchema>, loggedUser) => {
  const fnTag = '[fn:getTopPosts v0.9.6]';
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

/* 2.3 getDayPCOStats */
const getDayPCOStats: ExecutorFn = async (_args: z.infer<typeof ZodSchemas.GetDayPCOStatsArgsSchema>, loggedUser) => {
   const fnTag = '[fn:getDayPCOStats v0.9.6]';
   try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
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

/* 2.4 getMetricDetailsById */
const getMetricDetailsById: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetMetricDetailsByIdArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getMetricDetailsById v0.9.6]';
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

/* 2.5 findPostsByCriteria */
const findPostsByCriteria: ExecutorFn = async (args: z.infer<typeof ZodSchemas.FindPostsByCriteriaArgsSchema>, loggedUser) => {
    const fnTag = '[fn:findPostsByCriteria v0.9.6]';
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

/* 2.6 getDailyMetricHistory */
const getDailyMetricHistory: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetDailyMetricHistoryArgsSchema>, loggedUser) => {
    const fnTag = '[fn:getDailyMetricHistory v0.9.6]';
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
            .select('date dailyViews dailyLikes dailyComments dailyShares dailySaved dailyReach dailyFollows dailyProfileVisits cumulativeViews cumulativeLikes cumulativeComments cumulativeShares cumulativeSaved cumulativeReach cumulativeFollows cumulativeProfileVisits cumulativeTotalInteractions -_id')
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


/* 2.7 getConsultingKnowledge */
const getConsultingKnowledge: ExecutorFn = async (args: z.infer<typeof ZodSchemas.GetConsultingKnowledgeArgsSchema>, _loggedUser) => {
    const fnTag = '[fn:getConsultingKnowledge v0.9.6]';
    const topic = args.topic;

    logger.info(`${fnTag} Buscando conhecimento sobre o tópico: ${topic}`);
    try {
        let knowledge = '';
        switch (topic) {
             case 'algorithm_overview': knowledge = AlgorithmKnowledge.getAlgorithmOverview(); break;
             case 'algorithm_feed': knowledge = AlgorithmKnowledge.explainFeedAlgorithm(); break;
             case 'algorithm_stories': knowledge = AlgorithmKnowledge.explainStoriesAlgorithm(); break;
             case 'algorithm_reels': knowledge = AlgorithmKnowledge.explainReelsAlgorithm(); break;
             case 'algorithm_explore': knowledge = AlgorithmKnowledge.explainExploreAlgorithm(); break;
             case 'engagement_signals': knowledge = AlgorithmKnowledge.listEngagementSignals(); break;
             case 'account_type_differences': knowledge = AlgorithmKnowledge.explainAccountTypeDifferences(); break;
             case 'format_treatment': knowledge = AlgorithmKnowledge.explainFormatTreatment(); break;
             case 'ai_ml_role': knowledge = AlgorithmKnowledge.explainAI_ML_Role(); break;
             case 'recent_updates': knowledge = AlgorithmKnowledge.getRecentAlgorithmUpdates(); break;
             case 'best_practices': knowledge = AlgorithmKnowledge.getBestPractices(); break;
             
             case 'pricing_overview_instagram': knowledge = PricingKnowledge.getInstagramPricingRanges(); break;
             case 'pricing_overview_tiktok': knowledge = PricingKnowledge.getTikTokPricingRanges(); break;
             case 'pricing_benchmarks_sector': knowledge = PricingKnowledge.getSectorBenchmarks(); break;
             case 'pricing_negotiation_contracts': knowledge = PricingKnowledge.getNegotiationStructureInfo(); break;
             case 'pricing_trends': knowledge = PricingKnowledge.getPricingTrends(); break;
             
             case 'metrics_analysis': knowledge = MetricsKnowledge.getCoreMetricsAnalysis(); break;
             case 'metrics_retention_rate': knowledge = MetricsKnowledge.explainRetentionRate(); break;
             case 'metrics_avg_watch_time': knowledge = MetricsKnowledge.explainAvgWatchTimeVsDuration(); break;
             case 'metrics_reach_ratio': knowledge = MetricsKnowledge.explainFollowerVsNonFollowerReach(); break;
             
             case 'personal_branding_principles': knowledge = BrandingKnowledge.getPersonalBrandingPrinciples(); break;
             case 'branding_aesthetics': knowledge = BrandingKnowledge.explainAestheticsAndVisualStorytelling(); break;
             case 'branding_positioning_by_size': knowledge = BrandingKnowledge.explainPositioningBySize(); break;
             case 'branding_monetization': knowledge = BrandingKnowledge.explainImageAndMonetization(); break;
             case 'branding_case_studies': knowledge = BrandingKnowledge.getBrandingCaseStudies(); break;
             case 'branding_trends': knowledge = BrandingKnowledge.getEmergingBrandingTrends(); break;
             
             case 'methodology_shares_retention': knowledge = MethodologyKnowledge.explainSharesRetentionImpact(); break;
             case 'methodology_format_proficiency': knowledge = MethodologyKnowledge.explainFormatProficiency(); break;
             case 'methodology_cadence_quality': knowledge = MethodologyKnowledge.explainCadenceQuality(); break;
             
             // case 'best_posting_times': knowledge = AlgorithmKnowledge.getBestPostingTimesGeneral(); break; // NOTA: getBestPostingTimesGeneral não existe em algorithmKnowledge.ts v1.2
            default:
                logger.warn(`${fnTag} Tópico não mapeado recebido (apesar da validação Zod?): ${topic}`);
                // Adicionar aqui uma verificação se `topic` é um dos valores esperados pelo Zod Schema para evitar erros inesperados
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
 * 3.  Mapa exportado (Mantido)                                       *
 * ------------------------------------------------------------------ */
export const functionExecutors: Record<string, ExecutorFn> = {
  getAggregatedReport,
  getTopPosts,
  getDayPCOStats,
  getMetricDetailsById,
  findPostsByCriteria,
  getDailyMetricHistory,
  getConsultingKnowledge,
};