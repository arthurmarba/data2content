// @/app/lib/aiFunctions.ts – v0.9.0 (Otimização Sob Demanda)
// - ATUALIZADO: Descrição e executor de getAggregatedReport para incluir AdDealInsights.
// - Mantém função getDailyMetricHistory e outras.

import { Types, Model } from 'mongoose';
import { logger } from '@/app/lib/logger';

import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric';
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot';
import { IUser } from '@/app/models/User';

// Importação corrigida: Adicionando MetricsNotFoundError
import { MetricsNotFoundError } from '@/app/lib/errors'; // <<< CORREÇÃO APLICADA AQUI

import {
  fetchAndPrepareReportData,
  getAdDealInsights, // <<< Importa getAdDealInsights
  AdDealInsights,     // <<< Importa o tipo AdDealInsights
  IEnrichedReport,    // <<< Importa o tipo IEnrichedReport (para retorno)
} from './dataService'; // Supondo que dataService existe e exporta as funções/tipos

// Imports dos arquivos de conhecimento (mantidos)
import * as PricingKnowledge from './knowledge/pricingKnowledge';
import * as AlgorithmKnowledge from './knowledge/algorithmKnowledge';
import * as MetricsKnowledge from './knowledge/metricsKnowledge';
import * as BrandingKnowledge from './knowledge/personalBrandingKnowledge';
import * as MethodologyKnowledge from './knowledge/methodologyDeepDive';


/* ------------------------------------------------------------------ *
 * 1.  JSON-schemas expostos ao LLM (ATUALIZADO v0.9.0)               *
 * ------------------------------------------------------------------ */
export const functionSchemas = [
  {
    name: 'getAggregatedReport',
    // <<< DESCRIÇÃO ATUALIZADA >>>
    description: 'Retorna um relatório completo com métricas agregadas de posts dos últimos 180 dias (likes, reach, shares, etc.) E TAMBÉM os insights sobre parcerias publicitárias recentes do usuário. Use para análises gerais, planos, rankings, perguntas sobre performance e publicidade. **É o ponto de partida OBRIGATÓRIO para a maioria das análises.**',
    parameters: { type: 'object', properties: {}, required: [] } // Sem parâmetros de entrada
  },
  {
    name: 'getTopPosts',
    description: 'Retorna os N posts com melhor desempenho em uma métrica específica (shares ou saved). Use APENAS se o usuário pedir explicitamente por "top posts" e após ter o relatório geral via getAggregatedReport.', // Reforça dependência
    parameters: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: ['shares', 'saved'], default: 'shares', description: "Métrica para ordenar ('shares' ou 'saved', padrão: 'shares')." },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 3, description: "Número de posts a retornar (padrão: 3)." }
      },
      required: []
    }
  },
  {
    name: 'getDayPCOStats',
    description: 'Retorna dados de desempenho médio agrupados por Dia da Semana, Proposta e Contexto (usando nomes padronizados). Use APENAS se o usuário perguntar sobre melhor dia/horário para nichos específicos e após ter o relatório geral via getAggregatedReport.', // Reforça dependência
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getMetricDetailsById',
    description: 'Busca e retorna os detalhes completos (incluindo métricas) de um único post específico, dado o seu ID. Use para aprofundar a análise de um post mencionado (ex: um post do top 3, ou um post encontrado por busca).',
    parameters: {
        type: 'object',
        properties: {
            metricId: { type: 'string', description: "O ID único do post (Metric) a ser buscado." }
        },
        required: ['metricId']
    }
  },
  {
    name: 'findPostsByCriteria',
    description: 'Busca posts que correspondem a critérios específicos como formato, proposta, contexto ou data. Use para encontrar exemplos de posts sobre um tema ou de um tipo específico, APÓS ter a visão geral do relatório (getAggregatedReport), se necessário para aprofundar.', // Reforça dependência
    parameters: {
        type: 'object',
        properties: {
            criteria: {
                type: 'object',
                description: 'Objeto contendo os filtros a aplicar.',
                properties: {
                    format: { type: 'string', description: "Filtrar por formato específico (ex: 'Reel', 'Story', 'Post Fixo')." },
                    proposal: { type: 'string', description: "Filtrar por proposta específica (ex: 'Dicas', 'Humor', 'Venda')." },
                    context: { type: 'string', description: "Filtrar por contexto específico (ex: 'Beleza', 'Fitness', 'Produto X')." },
                    dateRange: {
                        type: 'object',
                        description: 'Filtrar por um intervalo de datas.',
                        properties: {
                            start: { type: 'string', format: 'date', description: 'Data de início (YYYY-MM-DD).' },
                            end: { type: 'string', format: 'date', description: 'Data de fim (YYYY-MM-DD).' }
                        },
                        required: ['start', 'end']
                    },
                    minLikes: { type: 'integer', description: 'Número mínimo de curtidas.'},
                    minShares: { type: 'integer', description: 'Número mínimo de compartilhamentos.'}
                },
                additionalProperties: false
            },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: "Número máximo de posts a retornar (padrão: 5)." },
            sortBy: {
                type: 'string',
                enum: ['postDate', 'stats.shares', 'stats.saved', 'stats.likes', 'stats.reach'],
                default: 'postDate',
                description: "Campo para ordenar os resultados."
            },
            sortOrder: {
                type: 'string',
                enum: ['asc', 'desc'],
                default: 'desc',
                description: "Ordem da ordenação ('asc' ou 'desc')."
            }
        },
        required: ['criteria']
    }
  },
  {
    name: 'getDailyMetricHistory',
    description: 'Busca o histórico de métricas diárias (visualizações, curtidas, compartilhamentos, etc.) e cumulativas para um post específico (Metric ID), limitado aos primeiros 30 dias após a publicação. Use para analisar crescimento, viralização e identificar picos de engajamento, APÓS identificar um post de interesse.', // Reforça dependência
    parameters: {
        type: 'object',
        properties: {
            metricId: { type: 'string', description: 'O ID único do post (Metric) cujo histórico diário deve ser buscado.' }
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
                description: 'O tópico específico sobre o qual buscar conhecimento ou explicação.',
                enum: [
                    'algorithm_overview', 'algorithm_feed', 'algorithm_stories', 'algorithm_reels',
                    'algorithm_explore', 'engagement_signals', 'account_type_differences',
                    'format_treatment', 'ai_ml_role', 'recent_updates', 'best_practices',
                    'pricing_overview_instagram', 'pricing_overview_tiktok',
                    'pricing_benchmarks_sector', 'pricing_negotiation_contracts', 'pricing_trends',
                    'metrics_analysis', 'metrics_retention_rate',
                    'metrics_avg_watch_time', 'metrics_reach_ratio',
                    'personal_branding_principles', 'branding_aesthetics',
                    'branding_positioning_by_size', 'branding_monetization',
                    'branding_case_studies', 'branding_trends',
                    'methodology_shares_retention', 'methodology_format_proficiency', 'methodology_cadence_quality',
                ]
            }
        },
        required: ['topic']
    }
  }
] as const;

// Tipo para os executores
type ExecutorFn = (args: any, user: IUser) => Promise<unknown>;

/* ------------------------------------------------------------------ *
 * 2.  Executores das Funções (ATUALIZADO v0.9.0)                     *
 * ------------------------------------------------------------------ */

// <<< EXECUTOR ATUALIZADO v0.9.0 >>>
/* 2.1 getAggregatedReport */
const getAggregatedReport: ExecutorFn = async (_args, loggedUser) => {
  const fnTag = '[fn:getAggregatedReport v0.9.0]'; // Atualiza tag
  try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);

    // Chama as funções para buscar dados de métricas e publicidade em paralelo
    const [reportResult, adDealResult] = await Promise.allSettled([
        fetchAndPrepareReportData({ user: loggedUser, contentMetricModel: MetricModel }),
        getAdDealInsights(loggedUser._id.toString()) // Busca insights de publicidade
    ]);

    // Processa o resultado do relatório de métricas
    let enrichedReportData: IEnrichedReport | null = null;
    if (reportResult.status === 'fulfilled') {
        enrichedReportData = reportResult.value.enrichedReport;
        logger.info(`${fnTag} Relatório agregado de métricas gerado com sucesso.`);
    } else {
        // Loga o erro mas não necessariamente impede o retorno dos dados de publicidade
        logger.error(`${fnTag} Erro ao gerar relatório agregado de métricas:`, reportResult.reason);
        // Pode-se optar por retornar um erro aqui se o relatório for essencial
        // return { error: `Erro ao gerar relatório de métricas: ${reportResult.reason?.message}` };
    }

    // Processa o resultado dos insights de publicidade
    let adDealInsightsData: AdDealInsights | null = null;
    if (adDealResult.status === 'fulfilled') {
        adDealInsightsData = adDealResult.value;
        logger.info(`${fnTag} Insights de publicidade ${adDealInsightsData ? 'encontrados' : 'não encontrados'}.`);
    } else {
        logger.error(`${fnTag} Erro ao buscar insights de publicidade:`, adDealResult.reason);
        // Loga o erro mas continua, retornando null para adDealInsights
    }

    // Retorna um objeto combinado para a IA
    // A IA foi instruída no prompt a lidar com dados ausentes (null)
    return {
        reportData: enrichedReportData, // Pode ser null se fetchAndPrepareReportData falhar
        adDealInsights: adDealInsightsData // Pode ser null se getAdDealInsights falhar ou não houver dados
    };

  } catch (err) { // Captura erros inesperados gerais
    logger.error(`${fnTag} Erro inesperado:`, err);
    return { error: `Erro ao gerar relatório combinado: ${err instanceof Error ? err.message : String(err)}` };
  }
};

/* 2.2 getTopPosts (Mantido) */
const getTopPosts: ExecutorFn = async (args, loggedUser) => {
  const fnTag = '[fn:getTopPosts v0.9.0]'; // Atualiza tag
  try {
    const userId = new Types.ObjectId(loggedUser._id);
    const { metric = 'shares', limit = 3 } = args;
    logger.info(`${fnTag} Executando para user ${userId}. Métrica: ${metric}, Limite: ${limit}`);
    const validMetrics = ['shares', 'saved'];
    if (!validMetrics.includes(metric)) {
        logger.warn(`${fnTag} Métrica inválida solicitada: ${metric}`);
        return { error: `Métrica inválida. Use 'shares' ou 'saved'.` };
    }
    const sortField = `stats.${metric}`;
    const topPosts: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[] = await MetricModel.find({
        user: userId, postDate: { $exists: true }, [sortField]: { $exists: true, $ne: null }
      })
      .select(`_id description postLink stats.${metric}`)
      .sort({ [sortField]: -1 })
      .limit(limit)
      .lean()
      .exec();
    if (topPosts.length === 0) {
        logger.warn(`${fnTag} Nenhum post encontrado para o ranking com a métrica ${metric}.`);
        return { metric, limit, posts: [] };
    }
    const formattedPosts = topPosts.map(post => {
        const metricValue = post.stats?.[metric as keyof IMetricStats] ?? 0;
        return { _id: post._id.toString(), description: post.description ?? 'Sem descrição', postLink: post.postLink, metricValue: metricValue };
    });
    logger.info(`${fnTag} Top ${formattedPosts.length} posts encontrados para métrica ${metric}.`);
    return { metric, limit, posts: formattedPosts };
  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    return { error: `Erro ao buscar top posts: ${err instanceof Error ? err.message : String(err)}` };
  }
};

/* 2.3 getDayPCOStats (Mantido) */
const getDayPCOStats: ExecutorFn = async (_args, loggedUser) => {
   const fnTag = '[fn:getDayPCOStats v0.9.0]'; // Atualiza tag
   try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
    const { enrichedReport } = await fetchAndPrepareReportData({ user: loggedUser, contentMetricModel: MetricModel });
    logger.info(`${fnTag} Dados Dia/P/C obtidos.`);
    return enrichedReport.performanceByDayPCO ?? {}; // Retorna objeto vazio se não existir
  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    // Retorna erro específico se for MetricsNotFoundError (AGORA DEVE FUNCIONAR)
    if (err instanceof MetricsNotFoundError) {
        return { error: err.message };
    }
    return { error: `Erro ao buscar dados Dia/Proposta/Contexto: ${err instanceof Error ? err.message : String(err)}` };
  }
};

/* 2.4 getMetricDetailsById (Mantido) */
const getMetricDetailsById: ExecutorFn = async (args, loggedUser) => {
    const fnTag = '[fn:getMetricDetailsById v0.9.0]'; // Atualiza tag
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const { metricId } = args;
        if (!metricId || !Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} ID da métrica inválido: ${metricId}`);
            return { error: "ID da métrica inválido." };
        }
        const objectMetricId = new Types.ObjectId(metricId);
        logger.info(`${fnTag} Buscando detalhes para Metric ID: ${metricId} para User: ${userId}`);
        const metricDoc = await MetricModel.findOne({ _id: objectMetricId, user: userId })
            .select('-rawData -__v')
            .lean()
            .exec();
        if (!metricDoc) {
            logger.warn(`${fnTag} Métrica com ID ${metricId} não encontrada para User ${userId}.`);
            return { error: "Métrica não encontrada ou acesso negado." };
        }
        logger.info(`${fnTag} Detalhes da Métrica ${metricId} encontrados.`);
        const result = { ...metricDoc, _id: metricDoc._id.toString(), user: metricDoc.user.toString() };
        return result;
    } catch (err) {
        logger.error(`${fnTag} Erro:`, err);
        return { error: `Erro ao buscar detalhes da métrica: ${err instanceof Error ? err.message : String(err)}` };
    }
};

/* 2.5 findPostsByCriteria (Mantido) */
const findPostsByCriteria: ExecutorFn = async (args, loggedUser) => {
    const fnTag = '[fn:findPostsByCriteria v0.9.0]'; // Atualiza tag
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const { criteria, limit = 5, sortBy = 'postDate', sortOrder = 'desc' } = args;
        logger.info(`${fnTag} Executando busca para User ${userId} com critérios:`, criteria);
        const filter: any = { user: userId };
        if (criteria) {
            if (criteria.format) filter.format = criteria.format;
            if (criteria.proposal) filter.proposal = criteria.proposal;
            if (criteria.context) filter.context = criteria.context;
            if (criteria.dateRange) {
                filter.postDate = {};
                if (criteria.dateRange.start) { const startDate = new Date(criteria.dateRange.start); if (!isNaN(startDate.getTime())) filter.postDate.$gte = startDate; }
                if (criteria.dateRange.end) { const endDate = new Date(criteria.dateRange.end); endDate.setDate(endDate.getDate() + 1); if (!isNaN(endDate.getTime())) filter.postDate.$lt = endDate; }
                if (Object.keys(filter.postDate).length === 0) delete filter.postDate;
            }
            if (criteria.minLikes && criteria.minLikes > 0) filter['stats.likes'] = { $gte: criteria.minLikes };
            if (criteria.minShares && criteria.minShares > 0) filter['stats.shares'] = { $gte: criteria.minShares };
        }
        if (Object.keys(filter).length <= 1) {
             logger.warn(`${fnTag} Nenhum critério de filtro válido fornecido além do usuário.`);
             return { error: "Por favor, forneça pelo menos um critério de busca (formato, proposta, contexto, data, etc.)." };
        }
        const allowedSortFields = ['postDate', 'stats.shares', 'stats.saved', 'stats.likes', 'stats.reach'];
        const sortFieldValidated = allowedSortFields.includes(sortBy) ? sortBy : 'postDate';
        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        const sortOptions: any = { [sortFieldValidated]: sortDirection };
        logger.debug(`${fnTag} Filtro MQL:`, JSON.stringify(filter));
        logger.debug(`${fnTag} Ordenação MQL:`, sortOptions);
        const posts = await MetricModel.find(filter)
            .select('_id description postLink postDate stats.likes stats.shares stats.saved stats.reach format proposal context')
            .sort(sortOptions)
            .limit(limit)
            .lean()
            .exec();
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
        return { error: `Erro ao buscar posts por critério: ${err instanceof Error ? err.message : String(err)}` };
    }
};

/* 2.6 getDailyMetricHistory (Mantido) */
const getDailyMetricHistory: ExecutorFn = async (args, loggedUser) => {
    const fnTag = '[fn:getDailyMetricHistory v0.9.0]'; // Atualiza tag
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const { metricId } = args;
        if (!metricId || !Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} ID da métrica inválido fornecido: ${metricId}`);
            return { error: "ID da métrica inválido." };
        }
        const objectMetricId = new Types.ObjectId(metricId);
        logger.info(`${fnTag} Buscando histórico diário para Metric ID: ${metricId} para User: ${userId}`);
        const metricOwnerCheck = await MetricModel.findOne({ _id: objectMetricId, user: userId }).select('_id').lean();
        if (!metricOwnerCheck) {
            const metricExists = await MetricModel.findById(objectMetricId).select('_id').lean();
            if (!metricExists) { logger.warn(`${fnTag} Métrica ${metricId} não encontrada.`); return { error: "Métrica não encontrada." }; }
            else { logger.warn(`${fnTag} Tentativa de acesso não autorizado à Metric ${metricId} por User ${userId}.`); return { error: "Acesso negado a esta métrica." }; }
        }
        const snapshots = await DailyMetricSnapshotModel.find({ metric: objectMetricId })
            .sort({ date: 1 })
            .select('date dailyViews dailyLikes dailyComments dailyShares dailySaved dailyReach dailyFollows dailyProfileVisits cumulativeViews cumulativeLikes cumulativeComments cumulativeShares cumulativeSaved cumulativeReach cumulativeFollows cumulativeProfileVisits cumulativeTotalInteractions -_id')
            .lean();
        if (snapshots.length === 0) {
            logger.info(`${fnTag} Nenhum snapshot diário encontrado para Metric ${metricId}.`);
            return { history: [] };
        }
        logger.info(`${fnTag} Encontrados ${snapshots.length} snapshots diários para Metric ${metricId}.`);
        const formattedHistory = snapshots.map(snap => ({ ...snap, date: snap.date.toISOString().split('T')[0] }));
        return { history: formattedHistory };
    } catch (err) {
        logger.error(`${fnTag} Erro ao buscar histórico diário da métrica ${args.metricId}:`, err);
        return { error: `Erro interno ao buscar histórico diário: ${err instanceof Error ? err.message : String(err)}` };
    }
};


/* 2.7 getConsultingKnowledge (Mantido) */
const getConsultingKnowledge: ExecutorFn = async (args, _loggedUser) => {
    const fnTag = '[fn:getConsultingKnowledge v0.9.0]'; // Atualiza tag
    const { topic } = args;
    if (!topic || typeof topic !== 'string') {
        logger.warn(`${fnTag} Tópico inválido ou ausente:`, topic);
        return { error: "Tópico inválido ou não fornecido." };
    }
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
            default:
                logger.warn(`${fnTag} Tópico não mapeado: ${topic}`);
                const validTopics = functionSchemas.find(s => s.name === 'getConsultingKnowledge')?.parameters.properties.topic.enum ?? ['N/A'];
                knowledge = `Desculpe, não encontrei informações específicas sobre "${topic}". Tópicos disponíveis: ${validTopics.join(', ')}.`;
        }
        logger.info(`${fnTag} Conhecimento sobre "${topic}" encontrado.`);
        return { knowledge: knowledge };
    } catch (err) {
        logger.error(`${fnTag} Erro ao buscar conhecimento para o tópico "${topic}":`, err);
        return { error: `Erro interno ao buscar conhecimento sobre ${topic}.` };
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