// @/app/lib/aiFunctions.ts – v0.8.0 (Adiciona getDailyMetricHistory)
// - Adicionada função getDailyMetricHistory para buscar histórico diário.

import { Types, Model } from 'mongoose';
import { logger } from '@/app/lib/logger';

import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric'; // USA MetricModel e IMetricStats
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot'; // <<< NOVO IMPORT
import { IUser } from '@/app/models/User';

import {
  fetchAndPrepareReportData,
} from './dataService'; // Supondo que dataService existe

// Imports dos arquivos de conhecimento (mantidos)
import * as PricingKnowledge from './knowledge/pricingKnowledge';
import * as AlgorithmKnowledge from './knowledge/algorithmKnowledge';
import * as MetricsKnowledge from './knowledge/metricsKnowledge';
import * as BrandingKnowledge from './knowledge/personalBrandingKnowledge';
import * as MethodologyKnowledge from './knowledge/methodologyDeepDive';


/* ------------------------------------------------------------------ *
 * 1.  JSON-schemas expostos ao LLM (ATUALIZADO v0.8.0)               *
 * ------------------------------------------------------------------ */
export const functionSchemas = [
  {
    name: 'getAggregatedReport',
    description: 'Retorna um relatório completo com métricas agregadas e enriquecidas dos últimos 180 dias do usuário (usando nomes padronizados como likes, reach, shares, etc.). Use para análises gerais, planos, rankings, etc. **É o ponto de partida usual para a maioria das análises.**',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getTopPosts',
    description: 'Retorna os N posts com melhor desempenho em uma métrica específica (shares ou saved). Use APENAS se o usuário pedir explicitamente por "top posts" e após ter o relatório geral.',
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
    description: 'Retorna dados de desempenho médio agrupados por Dia da Semana, Proposta e Contexto (usando nomes padronizados). Use APENAS se o usuário perguntar sobre melhor dia/horário para nichos específicos e após ter o relatório geral.',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'getMetricDetailsById',
    description: 'Busca e retorna os detalhes completos (incluindo métricas) de um único post específico, dado o seu ID. Use para aprofundar a análise de um post mencionado.',
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
    description: 'Busca posts que correspondem a critérios específicos como formato, proposta, contexto ou data. Use para encontrar exemplos de posts sobre um tema ou de um tipo específico.',
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
                    // Adicionar outros filtros se necessário
                },
                additionalProperties: false // Evita filtros não definidos
            },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 5, description: "Número máximo de posts a retornar (padrão: 5)." },
            sortBy: {
                type: 'string',
                enum: ['postDate', 'stats.shares', 'stats.saved', 'stats.likes', 'stats.reach'], // Campos permitidos para ordenação
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
        required: ['criteria'] // Pelo menos um critério é necessário
    }
  },
  // <<< NOVA FUNÇÃO v0.8.0 >>>
  {
    name: 'getDailyMetricHistory',
    description: 'Busca o histórico de métricas diárias (visualizações, curtidas, compartilhamentos, etc.) e cumulativas para um post específico (Metric ID), limitado aos primeiros 30 dias após a publicação. Use para analisar crescimento, viralização e identificar picos de engajamento.',
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
                enum: [ /* ... lista de tópicos mantida ... */
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

// Tipo para os executores (mantido)
type ExecutorFn = (args: any, user: IUser) => Promise<unknown>;

/* ------------------------------------------------------------------ *
 * 2.  Executores das Funções (ATUALIZADO v0.8.0)                     *
 * ------------------------------------------------------------------ */

/* 2.1 getAggregatedReport (Mantido) */
const getAggregatedReport: ExecutorFn = async (_args, loggedUser) => {
  const fnTag = '[fn:getAggregatedReport v0.8.0]'; // Atualiza tag
  try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
    // Supondo que fetchAndPrepareReportData existe e funciona
    const { enrichedReport } = await fetchAndPrepareReportData({
      user: loggedUser,
      contentMetricModel: MetricModel // Passa o modelo
    });
    logger.info(`${fnTag} Relatório agregado gerado com sucesso.`);
    // Retorna apenas a parte relevante para a IA (ou o objeto completo se necessário)
    return enrichedReport;
  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    return { error: `Erro ao gerar relatório agregado: ${err instanceof Error ? err.message : String(err)}` };
  }
};

/* 2.2 getTopPosts (Mantido) */
const getTopPosts: ExecutorFn = async (args, loggedUser) => {
  const fnTag = '[fn:getTopPosts v0.8.0]'; // Atualiza tag
  try {
    const userId = new Types.ObjectId(loggedUser._id);
    const { metric = 'shares', limit = 3 } = args;
    logger.info(`${fnTag} Executando para user ${userId}. Métrica: ${metric}, Limite: ${limit}`);

    // Valida a métrica permitida para evitar injeção de campo
    const validMetrics = ['shares', 'saved'];
    if (!validMetrics.includes(metric)) {
        logger.warn(`${fnTag} Métrica inválida solicitada: ${metric}`);
        return { error: `Métrica inválida. Use 'shares' ou 'saved'.` };
    }
    const sortField = `stats.${metric}`; // Constrói o campo de ordenação

    // Busca os posts ordenados pela métrica especificada
    const topPosts: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[] = await MetricModel.find({
        user: userId,
        postDate: { $exists: true }, // Garante que tem data
        [sortField]: { $exists: true, $ne: null } // Garante que a métrica existe
      })
      .select(`_id description postLink stats.${metric}`) // Seleciona campos necessários
      .sort({ [sortField]: -1 }) // Ordena decrescente
      .limit(limit) // Limita o número de resultados
      .lean()
      .exec();

    if (topPosts.length === 0) {
        logger.warn(`${fnTag} Nenhum post encontrado para o ranking com a métrica ${metric}.`);
        return { metric, limit, posts: [] }; // Retorna array vazio se nada encontrado
    }

    // Formata a resposta para a IA
    const formattedPosts = topPosts.map(post => {
        // Acessa o valor da métrica dinamicamente
        const metricValue = post.stats?.[metric as keyof IMetricStats] ?? 0;
        return {
            _id: post._id.toString(), // Retorna ID como string
            description: post.description ?? 'Sem descrição',
            postLink: post.postLink,
            metricValue: metricValue // Retorna o valor da métrica solicitada
        };
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
   const fnTag = '[fn:getDayPCOStats v0.8.0]'; // Atualiza tag
   try {
    logger.info(`${fnTag} Executando para usuário ${loggedUser._id}`);
    // Supondo que fetchAndPrepareReportData retorna a estrutura esperada
    const { enrichedReport } = await fetchAndPrepareReportData({
      user: loggedUser,
      contentMetricModel: MetricModel
    });
    logger.info(`${fnTag} Dados Dia/P/C obtidos.`);
    // Retorna apenas a parte do relatório relevante
    return enrichedReport.performanceByDayPCO ?? {};
  } catch (err) {
    logger.error(`${fnTag} Erro:`, err);
    return { error: `Erro ao buscar dados Dia/Proposta/Contexto: ${err instanceof Error ? err.message : String(err)}` };
  }
};

/* 2.4 getMetricDetailsById (Mantido da v0.7.0) */
const getMetricDetailsById: ExecutorFn = async (args, loggedUser) => {
    const fnTag = '[fn:getMetricDetailsById v0.8.0]'; // Atualiza tag
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const { metricId } = args;

        if (!metricId || !Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} ID da métrica inválido: ${metricId}`);
            return { error: "ID da métrica inválido." };
        }
        const objectMetricId = new Types.ObjectId(metricId);
        logger.info(`${fnTag} Buscando detalhes para Metric ID: ${metricId} para User: ${userId}`);

        // Busca o documento, garantindo que pertence ao usuário logado
        const metricDoc = await MetricModel.findOne({ _id: objectMetricId, user: userId })
            .select('-rawData -__v') // Exclui campos desnecessários/internos
            .lean()
            .exec();

        if (!metricDoc) {
            logger.warn(`${fnTag} Métrica com ID ${metricId} não encontrada para User ${userId}.`);
            // Informa que não foi encontrado, pode ser permissão ou inexistência
            return { error: "Métrica não encontrada ou acesso negado." };
        }

        logger.info(`${fnTag} Detalhes da Métrica ${metricId} encontrados.`);
        // Converte ObjectIds para string para serialização JSON antes de retornar
        const result = {
             ...metricDoc,
             _id: metricDoc._id.toString(),
             user: metricDoc.user.toString()
        };
        return result;

    } catch (err) {
        logger.error(`${fnTag} Erro:`, err);
        return { error: `Erro ao buscar detalhes da métrica: ${err instanceof Error ? err.message : String(err)}` };
    }
};

/* 2.5 findPostsByCriteria (Mantido da v0.7.0) */
const findPostsByCriteria: ExecutorFn = async (args, loggedUser) => {
    const fnTag = '[fn:findPostsByCriteria v0.8.0]'; // Atualiza tag
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        // Desestrutura argumentos com valores padrão
        const { criteria, limit = 5, sortBy = 'postDate', sortOrder = 'desc' } = args;

        logger.info(`${fnTag} Executando busca para User ${userId} com critérios:`, criteria);

        // 1. Construir Filtro (Query) Mongoose
        const filter: any = { user: userId }; // Sempre filtra pelo usuário logado
        if (criteria) {
            if (criteria.format) filter.format = criteria.format;
            if (criteria.proposal) filter.proposal = criteria.proposal;
            if (criteria.context) filter.context = criteria.context;
            if (criteria.dateRange) {
                filter.postDate = {};
                if (criteria.dateRange.start) {
                    const startDate = new Date(criteria.dateRange.start);
                    if (!isNaN(startDate.getTime())) filter.postDate.$gte = startDate;
                }
                if (criteria.dateRange.end) {
                     const endDate = new Date(criteria.dateRange.end);
                     // Adiciona 1 dia e pega menor que para incluir a data final
                     endDate.setDate(endDate.getDate() + 1);
                     if (!isNaN(endDate.getTime())) filter.postDate.$lt = endDate;
                }
                // Remove o filtro de data se ficou inválido
                if (Object.keys(filter.postDate).length === 0) delete filter.postDate;
            }
            // Filtros por métricas mínimas
            if (criteria.minLikes && criteria.minLikes > 0) filter['stats.likes'] = { $gte: criteria.minLikes };
            if (criteria.minShares && criteria.minShares > 0) filter['stats.shares'] = { $gte: criteria.minShares };
            // Adicionar outros filtros de métricas aqui se necessário (ex: minReach)
        }
         // Garante que pelo menos um critério de filtro foi fornecido além do usuário
        if (Object.keys(filter).length <= 1) {
             logger.warn(`${fnTag} Nenhum critério de filtro válido fornecido além do usuário.`);
             return { error: "Por favor, forneça pelo menos um critério de busca (formato, proposta, contexto, data, etc.)." };
        }

        // 2. Construir Opções de Ordenação
        const allowedSortFields = ['postDate', 'stats.shares', 'stats.saved', 'stats.likes', 'stats.reach'];
        const sortFieldValidated = allowedSortFields.includes(sortBy) ? sortBy : 'postDate'; // Default seguro
        const sortDirection = sortOrder === 'asc' ? 1 : -1;
        const sortOptions: any = { [sortFieldValidated]: sortDirection };

        // 3. Executar Query
        logger.debug(`${fnTag} Filtro MQL:`, JSON.stringify(filter));
        logger.debug(`${fnTag} Ordenação MQL:`, sortOptions);

        const posts = await MetricModel.find(filter)
            .select('_id description postLink postDate stats.likes stats.shares stats.saved stats.reach format proposal context') // Seleciona campos chave
            .sort(sortOptions)
            .limit(limit) // Aplica limite
            .lean()
            .exec();

        logger.info(`${fnTag} Encontrados ${posts.length} posts para os critérios.`);

        // 4. Formatar Resposta para a IA
        const formattedPosts = posts.map(post => ({
            _id: post._id.toString(),
            description: post.description ?? 'Sem descrição',
            postLink: post.postLink,
            postDate: post.postDate?.toISOString().split('T')[0], // Formata data YYYY-MM-DD
            format: post.format,
            proposal: post.proposal,
            context: post.context,
            likes: post.stats?.likes ?? 0,
            shares: post.stats?.shares ?? 0,
            saved: post.stats?.saved ?? 0,
            reach: post.stats?.reach ?? 0,
        }));

        return { count: formattedPosts.length, posts: formattedPosts };

    } catch (err) {
        logger.error(`${fnTag} Erro:`, err);
        return { error: `Erro ao buscar posts por critério: ${err instanceof Error ? err.message : String(err)}` };
    }
};

// <<< NOVA FUNÇÃO v0.8.0 >>>
/* 2.6 getDailyMetricHistory */
const getDailyMetricHistory: ExecutorFn = async (args, loggedUser) => {
    const fnTag = '[fn:getDailyMetricHistory v0.8.0]';
    try {
        const userId = new Types.ObjectId(loggedUser._id);
        const { metricId } = args;

        // Validação do Input
        if (!metricId || !Types.ObjectId.isValid(metricId)) {
            logger.warn(`${fnTag} ID da métrica inválido fornecido: ${metricId}`);
            return { error: "ID da métrica inválido." };
        }
        const objectMetricId = new Types.ObjectId(metricId);
        logger.info(`${fnTag} Buscando histórico diário para Metric ID: ${metricId} para User: ${userId}`);

        // Autorização: Verificar se a Métrica pertence ao Usuário
        const metricOwnerCheck = await MetricModel.findOne({ _id: objectMetricId, user: userId })
            .select('_id')
            .lean();

        if (!metricOwnerCheck) {
            // Verifica se a métrica realmente não existe para retornar 404
            const metricExists = await MetricModel.findById(objectMetricId).select('_id').lean();
            if (!metricExists) {
                logger.warn(`${fnTag} Métrica ${metricId} não encontrada.`);
                return { error: "Métrica não encontrada." }; // Erro para IA
            } else {
                logger.warn(`${fnTag} Tentativa de acesso não autorizado à Metric ${metricId} por User ${userId}.`);
                return { error: "Acesso negado a esta métrica." }; // Erro para IA
            }
        }

        // Busca os Snapshots Diários no DB
        const snapshots = await DailyMetricSnapshotModel.find({ metric: objectMetricId })
            .sort({ date: 1 }) // Ordena por data ascendente
            .select( // Seleciona os campos necessários para a IA
                'date ' +
                'dailyViews dailyLikes dailyComments dailyShares dailySaved dailyReach dailyFollows dailyProfileVisits ' +
                'cumulativeViews cumulativeLikes cumulativeComments cumulativeShares cumulativeSaved cumulativeReach cumulativeFollows cumulativeProfileVisits cumulativeTotalInteractions ' +
                '-_id' // Exclui o _id de cada snapshot
            )
            .lean();

        if (snapshots.length === 0) {
            logger.info(`${fnTag} Nenhum snapshot diário encontrado para Metric ${metricId}.`);
            // Retorna um array vazio, indicando que não há histórico (pode ser post > 30d ou recente sem snapshot ainda)
            return { history: [] };
        }

        logger.info(`${fnTag} Encontrados ${snapshots.length} snapshots diários para Metric ${metricId}.`);

        // Formata a data para YYYY-MM-DD para consistência na resposta para a IA
        const formattedHistory = snapshots.map(snap => ({
            ...snap,
            date: snap.date.toISOString().split('T')[0] // Formata a data
        }));

        return { history: formattedHistory }; // Retorna o histórico formatado

    } catch (err) {
        logger.error(`${fnTag} Erro ao buscar histórico diário da métrica ${args.metricId}:`, err);
        return { error: `Erro interno ao buscar histórico diário: ${err instanceof Error ? err.message : String(err)}` };
    }
};


/* 2.7 getConsultingKnowledge (Mantido como estava, agora é 2.7) */
const getConsultingKnowledge: ExecutorFn = async (args, _loggedUser) => {
    const fnTag = '[fn:getConsultingKnowledge v0.8.0]'; // Atualiza tag
    const { topic } = args;
    if (!topic || typeof topic !== 'string') {
        logger.warn(`${fnTag} Tópico inválido ou ausente:`, topic);
        return { error: "Tópico inválido ou não fornecido." };
    }
    logger.info(`${fnTag} Buscando conhecimento sobre o tópico: ${topic}`);
    try {
        let knowledge = '';
        // O switch case permanece o mesmo da v0.7.0
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
                // Busca a lista de tópicos válidos do schema para a mensagem de erro
                const validTopics = functionSchemas.find(s => s.name === 'getConsultingKnowledge')?.parameters.properties.topic.enum ?? ['N/A'];
                knowledge = `Desculpe, não encontrei informações específicas sobre "${topic}". Tópicos disponíveis: ${validTopics.join(', ')}.`;
        }
        logger.info(`${fnTag} Conhecimento sobre "${topic}" encontrado.`);
        // Retorna o conhecimento dentro de um objeto
        return { knowledge: knowledge };
    } catch (err) {
        logger.error(`${fnTag} Erro ao buscar conhecimento para o tópico "${topic}":`, err);
        return { error: `Erro interno ao buscar conhecimento sobre ${topic}.` };
    }
};


/* ------------------------------------------------------------------ *
 * 3.  Mapa exportado (ATUALIZADO v0.8.0)                             *
 * ------------------------------------------------------------------ */
export const functionExecutors: Record<string, ExecutorFn> = {
  getAggregatedReport,
  getTopPosts,
  getDayPCOStats,
  getMetricDetailsById,
  findPostsByCriteria,
  getDailyMetricHistory, // <<< ADICIONADO >>>
  getConsultingKnowledge,
};
