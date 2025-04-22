// @/app/lib/aiFunctions.ts – v0.5.4-FC (Mapeamento Branding)
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';

import { DailyMetric, IDailyMetric } from '@/app/models/DailyMetric';
import { Metric, IMetric } from '@/app/models/Metric';
import { IUser } from '@/app/models/User';

import {
  fetchAndPrepareReportData,
} from './dataService';

// Imports dos arquivos de conhecimento
import * as PricingKnowledge from './knowledge/pricingKnowledge'; // Ajuste o caminho se necessário
import * as AlgorithmKnowledge from './knowledge/algorithmKnowledge'; // Ajuste o caminho se necessário
import * as MetricsKnowledge from './knowledge/metricsKnowledge'; // Ajuste o caminho se necessário
import * as BrandingKnowledge from './knowledge/personalBrandingKnowledge'; // Ajuste o caminho se necessário
import * as MethodologyKnowledge from './knowledge/methodologyDeepDive'; // Ajuste o caminho se necessário


/* ------------------------------------------------------------------ *
 * 1.  JSON-schemas expostos ao LLM                                   *
 * ------------------------------------------------------------------ */
export const functionSchemas = [
  // Funções existentes...
  {
    name: 'getAggregatedReport',
    description: 'Retorna um relatório completo com métricas agregadas e enriquecidas dos últimos 180 dias do usuário. Use para análises gerais, planos, rankings, etc.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getTopPosts',
    description: 'Retorna os N posts com melhor desempenho em uma métrica específica (compartilhamentos ou salvamentos). Use APENAS se o usuário pedir explicitamente por "top posts".',
    parameters: {
      type: 'object',
      properties: {
        metric: { type: 'string', enum: ['shares', 'saves'], default: 'shares', description: "Métrica para ordenar (padrão: 'shares')." },
        limit: { type: 'integer', minimum: 1, maximum: 10, default: 3, description: "Número de posts a retornar (padrão: 3)." }
      },
      required: []
    }
  },
  {
    name: 'getDayPCOStats',
    description: 'Retorna dados de desempenho médio agrupados por Dia da Semana, Proposta e Contexto. Use APENAS se o usuário perguntar sobre melhor dia/horário para nichos específicos.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  // Schema da função de conhecimento ATUALIZADO
  {
    name: 'getConsultingKnowledge',
    description: 'Busca informações e explicações detalhadas sobre algoritmos do Instagram, estratégias de precificação, análise de métricas, personal branding ou a metodologia de consultoria.',
    parameters: {
        type: 'object',
        properties: {
            topic: {
                type: 'string',
                description: 'O tópico específico sobre o qual buscar conhecimento ou explicação.',
                // --- ENUM ATUALIZADO com tópicos de branding ---
                enum: [
                    // Algoritmo
                    'algorithm_overview', 'algorithm_feed', 'algorithm_stories', 'algorithm_reels',
                    'algorithm_explore', 'engagement_signals', 'account_type_differences',
                    'format_treatment', 'ai_ml_role', 'recent_updates', 'best_practices',
                    // Precificação
                    'pricing_overview_instagram', 'pricing_overview_tiktok',
                    'pricing_benchmarks_sector', 'pricing_negotiation_contracts', 'pricing_trends',
                    // Métricas
                    'metrics_analysis', 'metrics_retention_rate',
                    'metrics_avg_watch_time', 'metrics_reach_ratio',
                    // Branding
                    'personal_branding_principles', // <-- Mantido para princípios gerais
                    'branding_aesthetics', // <-- NOVO
                    'branding_positioning_by_size', // <-- NOVO
                    'branding_monetization', // <-- NOVO
                    'branding_case_studies', // <-- NOVO
                    'branding_trends', // <-- NOVO
                    // Metodologia
                    'methodology_shares_retention', 'methodology_format_proficiency', 'methodology_cadence_quality',
                ]
                // --- FIM ATUALIZAÇÃO ---
            }
        },
        required: ['topic']
    }
  }
] as const;

// Tipo para os executores
type ExecutorFn = (args: any, user: IUser) => Promise<unknown>;

/* ------------------------------------------------------------------ *
 * 2.  Executores das Funções                                         *
 * ------------------------------------------------------------------ */

/* 2.1 getAggregatedReport */
const getAggregatedReport: ExecutorFn = async (_args, loggedUser) => {
  const fnTag = '[fn:getAggregatedReport]';
  try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
    const { enrichedReport } = await fetchAndPrepareReportData({
      user: loggedUser,
      dailyMetricModel: DailyMetric,
      contentMetricModel: Metric
    });
    logger.info(`${fnTag} Relatório agregado gerado com sucesso.`);
    return enrichedReport;
  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    return { error: `Erro ao gerar relatório agregado: ${err instanceof Error ? err.message : String(err)}` };
  }
};

/* 2.2 getTopPosts */
const getTopPosts: ExecutorFn = async (args, loggedUser) => {
  const fnTag = '[fn:getTopPosts]';
  try {
    const userId = new Types.ObjectId(loggedUser._id);
    const { metric = 'shares', limit = 3 } = args;
    logger.info(`${fnTag} Executando para user ${userId}. Métrica: ${metric}, Limite: ${limit}`);
    const sortField = metric === 'saves' ? 'stats.salvamentos' : 'stats.compartilhamentos';
    const dailyTop: IDailyMetric[] = await DailyMetric.find({ user: userId, postId: { $exists: true, $ne: null } })
      .select('postId stats.' + (metric === 'saves' ? 'salvamentos' : 'compartilhamentos'))
      .sort({ [sortField]: -1 })
      .limit(limit)
      .lean()
      .exec();
    const postIds = dailyTop.map(d => d.postId).filter((id): id is Types.ObjectId => !!id);
    if (postIds.length === 0) {
        logger.warn(`${fnTag} Nenhum post encontrado para o ranking.`);
        return { metric, limit, posts: [] };
    }
    const postsData: Pick<IMetric, '_id' | 'description' | 'postLink'>[] =
      await Metric.find({ _id: { $in: postIds } })
                  .select('_id description postLink')
                  .lean()
                  .exec();
    const postsMap = new Map(postsData.map(p => [p._id.toString(), p]));
    const sortedPosts = dailyTop.map(dm => {
        const postDetail = dm.postId ? postsMap.get(dm.postId.toString()) : undefined;
        return {
            _id: dm.postId,
            description: postDetail?.description ?? 'Sem descrição',
            postLink: postDetail?.postLink,
            metricValue: metric === 'saves' ? dm.stats?.salvamentos : dm.stats?.compartilhamentos
        };
    }).filter(p => p._id);
    logger.info(`${fnTag} Top ${sortedPosts.length} posts encontrados.`);
    return { metric, limit, posts: sortedPosts };
  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    return { error: `Erro ao buscar top posts: ${err instanceof Error ? err.message : String(err)}` };
  }
};

/* 2.3 getDayPCOStats */
const getDayPCOStats: ExecutorFn = async (_args, loggedUser) => {
   const fnTag = '[fn:getDayPCOStats]';
   try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
    const { enrichedReport } = await fetchAndPrepareReportData({
      user: loggedUser,
      dailyMetricModel: DailyMetric,
      contentMetricModel: Metric
    });
    logger.info(`${fnTag} Dados Dia/P/C obtidos.`);
    return enrichedReport.performanceByDayPCO ?? {};
  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    return { error: `Erro ao buscar dados Dia/Proposta/Contexto: ${err instanceof Error ? err.message : String(err)}` };
  }
};


// Executor da função de conhecimento ATUALIZADO
/* 2.4 getConsultingKnowledge */
const getConsultingKnowledge: ExecutorFn = async (args, _loggedUser) => {
    const fnTag = '[fn:getConsultingKnowledge]';
    const { topic } = args;

    if (!topic || typeof topic !== 'string') {
        logger.warn(`${fnTag} Tópico inválido ou ausente:`, topic);
        return { error: "Tópico inválido ou não fornecido." };
    }

    logger.info(`${fnTag} Buscando conhecimento sobre o tópico: ${topic}`);

    try {
        let knowledge = '';
        // --- SWITCH ATUALIZADO com novos cases de branding ---
        switch (topic) {
            // Algoritmo
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

            // Precificação
            case 'pricing_overview_instagram': knowledge = PricingKnowledge.getInstagramPricingRanges(); break;
            case 'pricing_overview_tiktok': knowledge = PricingKnowledge.getTikTokPricingRanges(); break;
            case 'pricing_benchmarks_sector': knowledge = PricingKnowledge.getSectorBenchmarks(); break;
            case 'pricing_negotiation_contracts': knowledge = PricingKnowledge.getNegotiationStructureInfo(); break;
            case 'pricing_trends': knowledge = PricingKnowledge.getPricingTrends(); break;
            // case 'pricing_strategies': knowledge = PricingKnowledge.getPricingStrategies(); break; // Mantido ou removido
            // case 'negotiation_tips': knowledge = PricingKnowledge.getNegotiationTips(); break; // Mantido ou removido

            // Métricas
            case 'metrics_analysis': knowledge = MetricsKnowledge.getCoreMetricsAnalysis(); break;
            case 'metrics_retention_rate': knowledge = MetricsKnowledge.explainRetentionRate(); break;
            case 'metrics_avg_watch_time': knowledge = MetricsKnowledge.explainAvgWatchTimeVsDuration(); break;
            case 'metrics_reach_ratio': knowledge = MetricsKnowledge.explainFollowerVsNonFollowerReach(); break;

            // Branding
            case 'personal_branding_principles': knowledge = BrandingKnowledge.getPersonalBrandingPrinciples(); break;
            case 'branding_aesthetics': // <-- NOVO
                knowledge = BrandingKnowledge.explainAestheticsAndVisualStorytelling();
                break;
            case 'branding_positioning_by_size': // <-- NOVO
                knowledge = BrandingKnowledge.explainPositioningBySize();
                break;
            case 'branding_monetization': // <-- NOVO
                knowledge = BrandingKnowledge.explainImageAndMonetization();
                break;
            case 'branding_case_studies': // <-- NOVO
                knowledge = BrandingKnowledge.getBrandingCaseStudies();
                break;
            case 'branding_trends': // <-- NOVO
                knowledge = BrandingKnowledge.getEmergingBrandingTrends();
                break;

            // Metodologia Detalhada
            case 'methodology_shares_retention': knowledge = MethodologyKnowledge.explainSharesRetentionImpact(); break;
            case 'methodology_format_proficiency': knowledge = MethodologyKnowledge.explainFormatProficiency(); break;
            case 'methodology_cadence_quality': knowledge = MethodologyKnowledge.explainCadenceQuality(); break;

            default:
                logger.warn(`${fnTag} Tópico não mapeado: ${topic}`);
                const validTopics = functionSchemas.find(s => s.name === 'getConsultingKnowledge')?.parameters.properties.topic.enum ?? ['N/A'];
                knowledge = `Desculpe, não encontrei informações específicas sobre "${topic}". Tópicos disponíveis: ${validTopics.join(', ')}.`;
        }
        // --- FIM ATUALIZAÇÃO SWITCH ---

        logger.info(`${fnTag} Conhecimento sobre "${topic}" encontrado.`);
        return { knowledge: knowledge };

    } catch (err) {
        logger.error(`${fnTag} Erro ao buscar conhecimento para o tópico "${topic}":`, err);
        return { error: `Erro interno ao buscar conhecimento sobre ${topic}.` };
    }
};


/* ------------------------------------------------------------------ *
 * 3.  Mapa exportado (com a nova função)                             *
 * ------------------------------------------------------------------ */
export const functionExecutors: Record<string, ExecutorFn> = {
  getAggregatedReport,
  getTopPosts,
  getDayPCOStats,
  getConsultingKnowledge,
};
