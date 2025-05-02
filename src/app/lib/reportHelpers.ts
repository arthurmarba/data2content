// @/app/lib/reportHelpers.ts - v4.4 (Completo e Corrigido FINAL)

import { Types, Model, PipelineStage } from "mongoose";
import { subDays } from 'date-fns';
import { logger } from '@/app/lib/logger'; // Ajuste o caminho se necessário
import MetricModel, { IMetric, IMetricStats } from "@/app/models/Metric"; // Ajuste o caminho se necessário

const TOP_EXAMPLES_PER_GROUP_LIMIT = 3;

// ======================================================================================
// Erros Customizados
// ======================================================================================
class ReportError extends Error {
    constructor(message: string, public cause?: Error | unknown) {
        super(message);
        this.name = 'ReportError';
        if (cause instanceof Error && cause.stack) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }
    }
}
export class ReportAggregationError extends ReportError { constructor(message: string, cause?: Error | unknown) { super(message, cause); this.name = 'ReportAggregationError'; } }
export class DetailedStatsError extends ReportError { constructor(message: string, cause?: Error | unknown) { super(message, cause); this.name = 'DetailedStatsError'; } }


// ======================================================================================
// Interfaces Atualizadas (v4.1)
// ======================================================================================
export interface OverallStats {
  _id: null; totalPosts: number; avgLikes?: number; avgComments?: number;
  avgShares?: number; avgSaved?: number; avgReach?: number; avgImpressions?: number;
  avgViews?: number; avgFollows?: number; avgProfileVisits?: number;
  avgEngagementRate?: number; avgRetentionRate?: number;
  avgFollowerConversionRate?: number; avgPropagationIndex?: number;
}
export interface DayOfWeekStat {
  _id: number; dayName: string; avgShares: number; avgLikes: number;
  avgReach: number; totalPosts: number;
}
export interface DurationStat {
  _id: string | number; range: string; avgShares: number; avgSaved: number;
  avgRetentionRate?: number; totalPosts: number;
}
export interface BaseStat {
  _id: object; avgLikes?: number; avgComments?: number; avgShares?: number;
  avgSaved?: number; avgReach?: number; avgImpressions?: number; avgViews?: number;
  avgFollows?: number; avgProfileVisits?: number; avgEngagementRate?: number;
  avgRetentionRate?: number; totalPosts: number; shareDiffPercentage?: number | null;
  saveDiffPercentage?: number | null; reachDiffPercentage?: number | null;
  commentDiffPercentage?: number | null; likeDiffPercentage?: number | null;
  bestPostInGroup?: { _id: Types.ObjectId; description?: string; postLink?: string; shares?: number; saved?: number; }; // <-- 'saved' aqui
}
export interface DetailedContentStat extends BaseStat {
  _id: { format: string; proposal: string; context: string; };
  topExamplesInGroup?: { _id: Types.ObjectId; description?: string; postLink?: string; }[];
}
export interface ProposalStat extends BaseStat { _id: { proposal: string; }; }
export interface ContextStat extends BaseStat { _id: { context: string; }; }
export interface DayPCOPerformanceStats {
    avgShares?: number; avgSaved?: number; avgReach?: number; avgComments?: number;
    avgLikes?: number; avgViews?: number; avgImpressions?: number; avgFollows?: number;
    avgProfileVisits?: number; avgEngagementRate?: number; avgRetentionRate?: number;
    totalPosts: number;
}
export interface PerformanceByContextDay { [context: string]: DayPCOPerformanceStats; }
export interface PerformanceByProposalDay { [proposal: string]: PerformanceByContextDay; }
export interface PerformanceByDayPCO { [dayOfWeek: number]: PerformanceByProposalDay; }
export interface AggregatedReport {
    top3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[];
    bottom3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[];
    overallStats?: OverallStats; dayOfWeekStats?: DayOfWeekStat[]; durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[]; proposalStats?: ProposalStat[];
    contextStats?: ContextStat[]; performanceByDayPCO?: PerformanceByDayPCO;
}

// ======================================================================================
// Funções Auxiliares
// ======================================================================================
/**
 * Mapeia o número do dia da semana (0-6) para o nome em português.
 */
function mapDayOfWeek(dow: number): string {
    const names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return (dow >= 0 && dow <= 6) ? names[dow]! : "Desconhecido";
}

/**
 * Função auxiliar para adicionar cálculos de média comuns ao estágio $group.
 * Usa chaves canônicas de IMetricStats.
 */
function addCommonAveragesToGroupStage(groupStage: any): any {
    // Garante que $group exista
    if (!groupStage.$group) {
        groupStage.$group = {};
    }
    // Médias básicas
    groupStage.$group.avgLikes = { $avg: { $ifNull: ["$stats.likes", 0] } };
    groupStage.$group.avgComments = { $avg: { $ifNull: ["$stats.comments", 0] } };
    groupStage.$group.avgShares = { $avg: { $ifNull: ["$stats.shares", 0] } };
    groupStage.$group.avgSaved = { $avg: { $ifNull: ["$stats.saved", 0] } };
    groupStage.$group.avgReach = { $avg: { $ifNull: ["$stats.reach", 0] } };
    groupStage.$group.avgImpressions = { $avg: { $ifNull: ["$stats.impressions", 0] } };
    groupStage.$group.avgViews = { $avg: { $ifNull: ["$stats.views", 0] } };
    groupStage.$group.avgFollows = { $avg: { $ifNull: ["$stats.follows", 0] } };
    groupStage.$group.avgProfileVisits = { $avg: { $ifNull: ["$stats.profile_visits", 0] } };
    // Médias calculadas (assumindo que existem em stats)
    groupStage.$group.avgEngagementRate = { $avg: { $ifNull: ["$stats.engagement_rate", 0] } };
    groupStage.$group.avgRetentionRate = { $avg: { $ifNull: ["$stats.retention_rate", 0] } };
    groupStage.$group.avgFollowerConversionRate = { $avg: { $ifNull: ["$stats.follower_conversion_rate", 0] } };
    groupStage.$group.avgPropagationIndex = { $avg: { $ifNull: ["$stats.propagation_index", 0] } };
    // Contagem
    groupStage.$group.totalPosts = { $sum: 1 };
    return groupStage;
}

/**
 * Define as faixas de duração e retorna o estágio $bucket para agregação.
 * Usa a chave canônica para duração.
 */
function getDurationBucketStage(): PipelineStage.Bucket {
    const durationBoundaries = [0, 15, 30, 60, Infinity]; // Limites em segundos
    return {
        $bucket: {
            groupBy: "$stats.video_duration_seconds", // Chave canônica
            boundaries: durationBoundaries,
            default: "Outro", // Para valores fora dos limites ou nulos
            output: {
                totalPosts: { $sum: 1 },
                // Acumuladores para cálculo de médias
                sumShares: { $sum: { $ifNull: ["$stats.shares", 0] } },
                sumSaved: { $sum: { $ifNull: ["$stats.saved", 0] } },
                sumRetentionRate: { $sum: { $ifNull: ["$stats.retention_rate", 0] } },
            }
        }
    };
}

/**
 * Mapeia o limite inferior do bucket de duração para a string de faixa.
 */
function mapDurationBucketIdToRange(bucketId: number | string): string {
    if (typeof bucketId !== 'number') return "Desconhecido/Outro";
    if (bucketId === 0) return "0-15s";
    if (bucketId === 15) return "15-30s";
    if (bucketId === 30) return "30-60s";
    if (bucketId === 60) return "60s+";
    return "Desconhecido";
}

// ======================================================================================
// Funções para buscar Stats Detalhados BASE (Agregação MQL) - REFATORADAS v4.0
// ======================================================================================
/**
 * Busca stats BASE agrupados por Formato, Proposta e Contexto.
 */
async function getDetailedContentStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<DetailedContentStat[]> {
    const fnTag = '[getDetailedContentStatsBase v4.4]'; // Atualiza tag
    logger.debug(`${fnTag} Buscando por F/P/C para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        addCommonAveragesToGroupStage({
            $group: {
                _id: {
                    format: { $ifNull: ["$format", "Desconhecido"] },
                    proposal: { $ifNull: ["$proposal", "Outro"] },
                    context: { $ifNull: ["$context", "Geral"] }
                },
                // Médias adicionadas por addCommonAveragesToGroupStage
            }
        }),
        { $sort: { totalPosts: -1, avgShares: -1 } }
    ];
    try {
        const results: DetailedContentStat[] = await metricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} F/P/C retornou ${results.length} grupos.`);
        return results;
     }
    catch (error) {
        logger.error(`${fnTag} Erro ao agregar por F/P/C para User ${userId}.`, error);
        throw new DetailedStatsError(`Falha ao agregar por F/P/C para User ${userId}`, error);
    }
}

/**
 * Busca stats BASE agrupados APENAS por Proposta.
 */
async function getProposalStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<ProposalStat[]> {
    const fnTag = '[getProposalStatsBase v4.4]'; // Atualiza tag
    logger.debug(`${fnTag} Buscando por Proposta para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        addCommonAveragesToGroupStage({
            $group: {
                _id: { proposal: { $ifNull: ["$proposal", "Outro"] } },
                 // Médias adicionadas por addCommonAveragesToGroupStage
            }
        }),
        { $sort: { totalPosts: -1, avgShares: -1 } }
    ];
    try {
        const results: ProposalStat[] = await metricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} Proposta retornou ${results.length} grupos.`);
        return results;
    }
    catch (error) {
        logger.error(`${fnTag} Erro ao agregar por Proposta para User ${userId}.`, error);
        throw new DetailedStatsError(`Falha ao agregar por Proposta para User ${userId}`, error);
    }
}

/**
 * Busca stats BASE agrupados APENAS por Contexto.
 */
async function getContextStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<ContextStat[]> {
    const fnTag = '[getContextStatsBase v4.4]'; // Atualiza tag
    logger.debug(`${fnTag} Buscando por Contexto para User ${userId}`);
    const pipeline: PipelineStage[] = [
         { $match: { user: userId, postDate: { $gte: startDate } } },
         addCommonAveragesToGroupStage({
            $group: {
                _id: { context: { $ifNull: ["$context", "Geral"] } },
                 // Médias adicionadas por addCommonAveragesToGroupStage
            }
        }),
         { $sort: { totalPosts: -1, avgShares: -1 } }
    ];
    try {
        const results: ContextStat[] = await metricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} Contexto retornou ${results.length} grupos.`);
        return results;
     }
    catch (error) {
        logger.error(`${fnTag} Erro ao agregar por Contexto para User ${userId}.`, error);
        throw new DetailedStatsError(`Falha ao agregar por Contexto para User ${userId}`, error);
    }
}

// ======================================================================================
// Agregações Gerais (Overall, Dia da Semana, Duração) - REFATORADAS v4.0
// ======================================================================================
/**
 * Calcula as estatísticas gerais (OverallStats) via agregação no MetricModel.
 */
async function getOverallStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<OverallStats | undefined> {
    const fnTag = '[getOverallStatsBase v4.4]'; // Atualiza tag
    logger.debug(`${fnTag} Calculando OverallStats para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        addCommonAveragesToGroupStage({ // Reutiliza a função para calcular médias
            $group: {
                _id: null, // Agrupa todos os documentos
                // Médias serão adicionadas aqui
            }
        })
    ];
    try {
        const results = await metricModel.aggregate(pipeline).exec();
        if (results && results.length > 0) {
            logger.debug(`${fnTag} OverallStats calculado com sucesso.`);
            return results[0] as OverallStats; // Retorna o primeiro (e único) resultado
        } else {
            logger.warn(`${fnTag} Nenhum dado encontrado para calcular OverallStats para User ${userId}.`);
            return undefined;
        }
    } catch (error) {
        logger.error(`${fnTag} Erro ao calcular OverallStats para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha ao calcular estatísticas gerais para User ${userId}`, error);
    }
}

/**
 * Calcula as estatísticas por dia da semana via agregação no MetricModel.
 */
async function getDayOfWeekStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<DayOfWeekStat[]> {
    const fnTag = '[getDayOfWeekStatsBase v4.4]'; // Atualiza tag
    logger.debug(`${fnTag} Calculando DayOfWeekStats para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        {
            $group: {
                _id: { $subtract: [{ $dayOfWeek: "$postDate" }, 1] }, // 0=Dom, 1=Seg,...
                // Calcula médias relevantes para análise por dia
                avgShares: { $avg: { $ifNull: ["$stats.shares", 0] } },
                avgLikes: { $avg: { $ifNull: ["$stats.likes", 0] } },
                avgReach: { $avg: { $ifNull: ["$stats.reach", 0] } },
                totalPosts: { $sum: 1 } // Conta posts por dia
            }
        },
        { $sort: { _id: 1 } } // Ordena por dia da semana (0 a 6)
    ];
    try {
        const results: DayOfWeekStat[] = await metricModel.aggregate(pipeline).exec();
        // Adiciona o nome do dia em português
        results.forEach(stat => {
            stat.dayName = mapDayOfWeek(stat._id);
        });
        logger.debug(`${fnTag} DayOfWeekStats calculados: ${results.length} dias encontrados para User ${userId}.`);
        return results;
    } catch (error) {
        logger.error(`${fnTag} Erro ao calcular DayOfWeekStats para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha ao calcular estatísticas por dia da semana para User ${userId}`, error);
    }
}

/**
 * Calcula as estatísticas por faixa de duração via agregação no MetricModel.
 */
async function getDurationStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<DurationStat[]> {
    const fnTag = '[getDurationStatsBase v4.4]'; // Atualiza tag
    logger.debug(`${fnTag} Calculando DurationStats para User ${userId}`);
    const pipeline: PipelineStage[] = [
        // Filtra documentos com duração definida e maior que 0
        { $match: { user: userId, postDate: { $gte: startDate }, "stats.video_duration_seconds": { $exists: true, $ne: null, $gt: 0 } } },
        // Agrupa em buckets de duração
        getDurationBucketStage(),
        // Calcula as médias para cada bucket
        {
            $project: {
                _id: 1, // Mantém o ID do bucket (limite inferior)
                totalPosts: 1,
                avgShares: { $cond: [{ $gt: ["$totalPosts", 0] }, { $divide: ["$sumShares", "$totalPosts"] }, 0] },
                avgSaved: { $cond: [{ $gt: ["$totalPosts", 0] }, { $divide: ["$sumSaved", "$totalPosts"] }, 0] },
                avgRetentionRate: { $cond: [{ $gt: ["$totalPosts", 0] }, { $divide: ["$sumRetentionRate", "$totalPosts"] }, 0] },
            }
        },
        { $sort: { _id: 1 } } // Ordena pelas faixas
    ];
    try {
        const results: DurationStat[] = await metricModel.aggregate(pipeline).exec();
        // Adiciona a string 'range' com base no _id do bucket
        results.forEach(stat => {
            stat.range = mapDurationBucketIdToRange(stat._id); // Passa o _id diretamente
        });
        logger.debug(`${fnTag} DurationStats calculados: ${results.length} faixas encontradas para User ${userId}.`);
        return results;
    } catch (error) {
        logger.error(`${fnTag} Erro ao calcular DurationStats para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha ao calcular estatísticas por duração para User ${userId}`, error);
    }
}

// ======================================================================================
// Agregação Dia/Proposta/Contexto (REFATORADA v4.1)
// ======================================================================================
/**
 * Busca e processa estatísticas agrupadas por Dia da Semana, Proposta e Contexto.
 */
async function getDayPCOStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<PerformanceByDayPCO> {
    const fnTag = "[getDayPCOStatsBase v4.4]"; // Atualiza tag
    logger.debug(`${fnTag} Buscando por Dia/P/C para User ${userId}`);

    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        // Adiciona o campo dayOfWeek (0=Dom, 1=Seg,...)
        { $addFields: { dayOfWeek: { $subtract: [{ $dayOfWeek: "$postDate" }, 1] } } },
        // Agrupa por dia, proposta e contexto, calculando médias
        addCommonAveragesToGroupStage({
            $group: {
                _id: {
                  dayOfWeek: "$dayOfWeek",
                  proposal: { $ifNull: ["$proposal", "Outro"] }, // Campo direto
                  context: { $ifNull: ["$context", "Geral"] }   // Campo direto
                },
                // Médias serão adicionadas aqui por addCommonAveragesToGroupStage
            }
        })
    ];

    try {
        // O resultado da agregação já tem as médias com chaves canônicas
        const aggregationResults: (BaseStat & { _id: { dayOfWeek: number; proposal: string; context: string; } })[] = await metricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} Agregação Dia/P/C retornou ${aggregationResults.length} resultados brutos para User ${userId}.`);

        // Processa os resultados para a estrutura aninhada
        const performanceByDayPCO: PerformanceByDayPCO = {};
        for (const result of aggregationResults) {
            const { dayOfWeek, proposal, context } = result._id;

            if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
                logger.warn(`${fnTag} Resultado com dayOfWeek inválido para User ${userId}:`, result._id);
                continue;
            }
            // Inicializa estruturas aninhadas se necessário
            if (!performanceByDayPCO[dayOfWeek]) { performanceByDayPCO[dayOfWeek] = {}; }
            if (!performanceByDayPCO[dayOfWeek]![proposal]) { performanceByDayPCO[dayOfWeek]![proposal] = {}; }

            // Atribui TODAS as stats calculadas (usando chaves canônicas/descritivas)
            performanceByDayPCO[dayOfWeek]![proposal]![context] = {
                avgLikes: result.avgLikes,
                avgComments: result.avgComments,
                avgShares: result.avgShares,
                avgSaved: result.avgSaved,
                avgReach: result.avgReach,
                avgImpressions: result.avgImpressions,
                avgViews: result.avgViews,
                avgFollows: result.avgFollows,
                avgProfileVisits: result.avgProfileVisits,
                avgEngagementRate: result.avgEngagementRate,
                avgRetentionRate: result.avgRetentionRate,
                // Adicione outras médias aqui se foram incluídas em addCommonAveragesToGroupStage
                totalPosts: result.totalPosts
            };
        }

        logger.debug(`${fnTag} Estrutura PerformanceByDayPCO processada para User ${userId}.`);
        return performanceByDayPCO;

     } catch (error) {
        logger.error(`${fnTag} Erro durante agregação ou processamento Dia/P/C para User ${userId}.`, error);
        throw new DetailedStatsError(`Falha ao agregar por Dia/P/C para User ${userId}`, error);
     }
}

// ======================================================================================
// Função Genérica para Enriquecer Stats (REFATORADA v4.3 - Correção Escopo e Typo)
// ======================================================================================
/**
 * Adiciona diferenças percentuais vs geral e os TOP N posts de exemplo do grupo.
 */
async function enrichStats<T extends BaseStat>(
    statsBase: T[],
    overallStats: OverallStats | undefined,
    userId: Types.ObjectId,
    metricModel: Model<IMetric>,
    groupingType: 'detailed' | 'proposal' | 'context'
): Promise<T[]> {
    const fnTag = '[enrichStats v4.4]'; // Atualiza tag

    // Se não há stats gerais, tenta adicionar apenas exemplos para 'detailed'
    if (!overallStats) {
        logger.warn(`${fnTag} OverallStats não disponíveis para User ${userId}, pulando cálculo de DiffPercentages.`);
        if (groupingType === 'detailed') {
             const topExamplesResult = await addTopExamplesOnly(statsBase as DetailedContentStat[], userId, metricModel);
             return topExamplesResult as T[]; // Cast explícito
        }
        return statsBase; // Retorna como está para outros tipos
    }

    logger.debug(`${fnTag} Enriquecendo ${statsBase.length} grupos do tipo ${groupingType} para User ${userId}.`);

    const enrichedResults: T[] = [];
    // Itera sobre cada grupo de estatísticas base (F/P/C, P ou C)
    for (const statBase of statsBase) {
        const enrichedStat = { ...statBase }; // Cria cópia

        // 1. Calcular Percentuais de Diferença vs Geral
        // Acessa propriedades diretamente de overallStats para evitar erro de escopo
        const overallAvgShares = overallStats.avgShares ?? 0;
        const overallAvgSaves = overallStats.avgSaved ?? 0;
        const overallAvgReach = overallStats.avgReach ?? 0;
        const overallAvgComments = overallStats.avgComments ?? 0;
        const overallAvgLikes = overallStats.avgLikes ?? 0;

        enrichedStat.shareDiffPercentage = (overallAvgShares > 0 && enrichedStat.avgShares != null) ? ((enrichedStat.avgShares / overallAvgShares) - 1) * 100 : null;
        enrichedStat.saveDiffPercentage = (overallAvgSaves > 0 && enrichedStat.avgSaved != null) ? ((enrichedStat.avgSaved / overallAvgSaves) - 1) * 100 : null;
        enrichedStat.reachDiffPercentage = (overallAvgReach > 0 && enrichedStat.avgReach != null) ? ((enrichedStat.avgReach / overallAvgReach) - 1) * 100 : null;
        enrichedStat.commentDiffPercentage = (overallAvgComments > 0 && enrichedStat.avgComments != null) ? ((enrichedStat.avgComments / overallAvgComments) - 1) * 100 : null;
        enrichedStat.likeDiffPercentage = (overallAvgLikes > 0 && enrichedStat.avgLikes != null) ? ((enrichedStat.avgLikes / overallAvgLikes) - 1) * 100 : null;

        // 2. Encontrar Top N exemplos (APENAS para agrupamento 'detailed' por F/P/C)
        if (groupingType === 'detailed') {
            const detailedStat = enrichedStat as DetailedContentStat; // Cast para tipo detalhado
            const groupId = detailedStat._id as DetailedContentStat['_id']; // Pega o ID {format, proposal, context}
            try {
                // Busca os posts diretamente no MetricModel que correspondem a este grupo F/P/C
                const topPosts = await metricModel.find({
                    user: userId,
                    format: groupId.format,
                    proposal: groupId.proposal,
                    context: groupId.context
                })
                .select('_id description postLink stats.shares stats.saved') // Seleciona campos necessários
                .sort({ 'stats.shares': -1, 'stats.saved': -1 }) // Ordena por shares, depois saved
                .limit(TOP_EXAMPLES_PER_GROUP_LIMIT) // Limita o número de exemplos
                .lean(); // Usa lean para performance

                // Mapeia os resultados para o formato esperado em topExamplesInGroup
                detailedStat.topExamplesInGroup = topPosts.map(post => ({
                    _id: post._id,
                    description: post.description ?? undefined, // Usa descrição ou undefined
                    postLink: (post.postLink && post.postLink.startsWith('http')) ? post.postLink : undefined // Valida link
                }));

                // Adiciona o melhor post (o primeiro da lista ordenada)
                const bestPost = topPosts[0];
                if (bestPost) {
                    detailedStat.bestPostInGroup = {
                        _id: bestPost._id,
                        description: bestPost.description ?? undefined,
                        postLink: (bestPost.postLink && bestPost.postLink.startsWith('http')) ? bestPost.postLink : undefined,
                        shares: bestPost.stats?.shares, // Pega shares dos stats
                        saved: bestPost.stats?.saved   // <<< CORRIGIDO: Usa 'saved' aqui >>>
                    };
                } else {
                    detailedStat.bestPostInGroup = undefined; // Define como undefined se não houver posts
                }
            } catch(error) {
                 // Em caso de erro na busca, loga e define campos como vazios/undefined
                 logger.error(`${fnTag} Erro ao buscar top posts para grupo ${JSON.stringify(groupId)} User ${userId}:`, error);
                 detailedStat.topExamplesInGroup = [];
                 detailedStat.bestPostInGroup = undefined;
            }
        }
        enrichedResults.push(enrichedStat); // Adiciona o stat enriquecido ao array de resultados
    }
    return enrichedResults; // Retorna o array de stats enriquecidos
}

/**
 * Função auxiliar separada para adicionar apenas TopExamples (caso OverallStats falhe).
 */
async function addTopExamplesOnly(
    statsBase: DetailedContentStat[],
    userId: Types.ObjectId,
    metricModel: Model<IMetric>
): Promise<DetailedContentStat[]> {
    const fnTag = '[addTopExamplesOnly v4.4]'; // Atualiza tag
    logger.debug(`${fnTag} Adicionando apenas Top N exemplos para User ${userId} pois OverallStats estão ausentes.`);
    const enrichedResults: DetailedContentStat[] = [];
    // Itera sobre cada grupo F/P/C base
    for (const statBase of statsBase) {
        const enrichedStat = { ...statBase }; // Cria cópia
        const groupId = enrichedStat._id; // Pega o ID {format, proposal, context}
        try {
            // Busca os melhores posts diretamente no MetricModel para este grupo F/P/C
            const topPosts = await metricModel.find({
                user: userId,
                format: groupId.format,
                proposal: groupId.proposal,
                context: groupId.context
            })
            .select('_id description postLink stats.shares stats.saved')
            .sort({ 'stats.shares': -1, 'stats.saved': -1 })
            .limit(TOP_EXAMPLES_PER_GROUP_LIMIT)
            .lean();

            // Mapeia para o formato esperado
            enrichedStat.topExamplesInGroup = topPosts.map(post => ({
                _id: post._id,
                description: post.description ?? undefined,
                postLink: (post.postLink && post.postLink.startsWith('http')) ? post.postLink : undefined
            }));

            // Adiciona o melhor post
            const bestPost = topPosts[0];
            if (bestPost) {
                enrichedStat.bestPostInGroup = {
                    _id: bestPost._id,
                    description: bestPost.description ?? undefined,
                    postLink: (bestPost.postLink && bestPost.postLink.startsWith('http')) ? bestPost.postLink : undefined,
                    shares: bestPost.stats?.shares,
                    saved: bestPost.stats?.saved // <<< CORRIGIDO: Usa 'saved' aqui >>>
                };
            } else {
                enrichedStat.bestPostInGroup = undefined;
            }
        } catch(error) {
             logger.error(`${fnTag} Erro ao buscar top posts para grupo ${JSON.stringify(groupId)} User ${userId}:`, error);
             enrichedStat.topExamplesInGroup = [];
             enrichedStat.bestPostInGroup = undefined;
        }
        enrichedResults.push(enrichedStat); // Adiciona ao resultado
    }
    return enrichedResults; // Retorna o array de DetailedContentStat enriquecido
}


// ======================================================================================
// Função Principal de Agregação e Enriquecimento (REFATORADA v4.1)
// ======================================================================================
/**
 * Gera o relatório agregado principal consultando MetricModel e usando funções refatoradas.
 */
export async function buildAggregatedReport(
    userId: Types.ObjectId,
    startDate: Date,
    metricModel: Model<IMetric> // Recebe o modelo Metric
): Promise<AggregatedReport> {
    const fnTag = '[buildAggregatedReport v4.4]'; // Atualiza tag
    logger.info(`${fnTag} Iniciando para User: ${userId}, desde: ${startDate.toISOString()}`);
    // Valida inputs
    if (!metricModel?.aggregate || !userId || !startDate) {
        throw new Error('Input inválido para buildAggregatedReport v4.4.');
    }

    // --- 1. Buscar Agregações Base e Gerais em Paralelo ---
    // Declara variáveis para armazenar os resultados das agregações
    let overallStats: OverallStats | undefined,
        dayOfWeekStatsBase: DayOfWeekStat[] = [],
        durationStatsBase: DurationStat[] = [],
        detailedStatsBase: DetailedContentStat[] = [],
        proposalStatsBase: ProposalStat[] = [],
        contextStatsBase: ContextStat[] = [],
        performanceByDayPCOData: PerformanceByDayPCO | undefined;

    try {
        logger.debug(`${fnTag} Buscando agregações para User ${userId}...`);
        // Executa todas as agregações base em paralelo para performance
        const results = await Promise.allSettled([
            getOverallStatsBase(userId, startDate, metricModel),
            getDayOfWeekStatsBase(userId, startDate, metricModel),
            getDurationStatsBase(userId, startDate, metricModel),
            getDetailedContentStatsBase(userId, startDate, metricModel),
            getProposalStatsBase(userId, startDate, metricModel),
            getContextStatsBase(userId, startDate, metricModel),
            getDayPCOStatsBase(userId, startDate, metricModel) // v4.1 corrigida
        ]);

        // Processa os resultados de cada agregação, tratando sucessos e falhas
        if (results[0].status === 'fulfilled') overallStats = results[0].value;
        else logger.error(`${fnTag} Falha ao buscar OverallStats para User ${userId}.`, results[0].reason);

        if (results[1].status === 'fulfilled') dayOfWeekStatsBase = results[1].value;
        else logger.error(`${fnTag} Falha ao buscar DayOfWeekStats para User ${userId}.`, results[1].reason);

        if (results[2].status === 'fulfilled') durationStatsBase = results[2].value;
        else logger.error(`${fnTag} Falha ao buscar DurationStats para User ${userId}.`, results[2].reason);

        if (results[3].status === 'fulfilled') detailedStatsBase = results[3].value;
        else logger.error(`${fnTag} Falha ao buscar F/P/C Base para User ${userId}.`, results[3].reason);

        if (results[4].status === 'fulfilled') proposalStatsBase = results[4].value;
        else logger.error(`${fnTag} Falha ao buscar Proposta Base para User ${userId}.`, results[4].reason);

        if (results[5].status === 'fulfilled') contextStatsBase = results[5].value;
        else logger.error(`${fnTag} Falha ao buscar Contexto Base para User ${userId}.`, results[5].reason);

        if (results[6].status === 'fulfilled') performanceByDayPCOData = results[6].value;
        else logger.error(`${fnTag} Falha ao buscar Dia/P/C Base para User ${userId}.`, results[6].reason);

        logger.debug(`${fnTag} Agregações base e gerais concluídas para User ${userId}.`);

    } catch (error) {
        // Captura erro crítico durante a execução do Promise.allSettled (raro)
        logger.error(`${fnTag} Erro crítico durante busca de agregações para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha na busca inicial de agregações para User ${userId}`, error);
    }

    // --- 2. Enriquecer Stats Detalhados (F/P/C, P, C) ---
    // Declara variáveis para armazenar os resultados enriquecidos
    let detailedContentStatsEnriched: DetailedContentStat[] = [],
        proposalStatsEnriched: ProposalStat[] = [],
        contextStatsEnriched: ContextStat[] = [];

    try {
        logger.debug(`${fnTag} Enriquecendo estatísticas detalhadas para User ${userId}...`);
        // Executa o enriquecimento para cada tipo de stat detalhado em paralelo
        const enrichPromises = await Promise.allSettled([
             enrichStats(detailedStatsBase, overallStats, userId, metricModel, 'detailed'),
             enrichStats(proposalStatsBase, overallStats, userId, metricModel, 'proposal'),
             enrichStats(contextStatsBase, overallStats, userId, metricModel, 'context')
        ]);

        // Processa os resultados do enriquecimento, tratando sucessos e falhas
        if (enrichPromises[0].status === 'fulfilled') {
            detailedContentStatsEnriched = enrichPromises[0].value;
            // Ordena os resultados por diferença percentual de compartilhamento (maior primeiro)
            detailedContentStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
        } else { logger.error(`${fnTag} Falha ao enriquecer F/P/C para User ${userId}.`, enrichPromises[0].reason); }

        if (enrichPromises[1].status === 'fulfilled') {
            proposalStatsEnriched = enrichPromises[1].value;
            proposalStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
        } else { logger.error(`${fnTag} Falha ao enriquecer Proposta para User ${userId}.`, enrichPromises[1].reason); }

        if (enrichPromises[2].status === 'fulfilled') {
            contextStatsEnriched = enrichPromises[2].value;
            contextStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
        } else { logger.error(`${fnTag} Falha ao enriquecer Contexto para User ${userId}.`, enrichPromises[2].reason); }
        logger.debug(`${fnTag} Enriquecimento concluído para User ${userId}.`);

    } catch (error) {
         // Captura erro crítico durante o enriquecimento (raro)
         logger.error(`${fnTag} Erro crítico durante enriquecimento de stats para User ${userId}.`, error);
         // Pode optar por continuar sem enriquecimento ou lançar erro
    }


    // --- 3. Buscar Top 3 e Bottom 3 Posts Diretamente ---
    // Declara variáveis para armazenar os posts
    let top3Posts: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[] = [],
        bottom3Posts: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[] = [];
    try {
        logger.debug(`${fnTag} Buscando top/bottom 3 posts para User ${userId}...`);
        const sortField = 'stats.shares'; // Define o campo para ordenar (compartilhamentos)
        // Busca todos os posts do usuário no período que tenham a métrica de ordenação
        const posts = await metricModel.find({
                user: userId,
                postDate: { $gte: startDate },
                [sortField]: { $exists: true } // Garante que o campo de ordenação existe
            })
            .select(`_id description postLink stats.shares stats.saved`) // Seleciona campos necessários
            .sort({ [sortField]: -1 }) // Ordena por compartilhamentos (decrescente)
            .lean(); // Usa lean para performance

        if (posts.length > 0) {
            top3Posts = posts.slice(0, 3); // Pega os 3 primeiros (maior performance)
            // Pega os 3 últimos (menor performance) e inverte a ordem
            bottom3Posts = posts.length >= 3 ? posts.slice(-3).reverse() : [...posts].reverse();
        }
        logger.debug(`${fnTag} Top 3: ${top3Posts.length} posts. Bottom 3: ${bottom3Posts.length} posts para User ${userId}.`);

    } catch (error) {
         logger.error(`${fnTag} Erro ao buscar top/bottom posts para User ${userId}.`, error);
         // Continua sem top/bottom posts em caso de erro
    }

    // --- 4. Montar e Retornar Relatório Final ---
    logger.info(`${fnTag} Montando relatório final para User ${userId}.`);
    // Cria o objeto final do relatório agregado
    const finalReport: AggregatedReport = {
        overallStats: overallStats,
        dayOfWeekStats: dayOfWeekStatsBase,
        durationStats: durationStatsBase,
        detailedContentStats: detailedContentStatsEnriched,
        proposalStats: proposalStatsEnriched,
        contextStats: contextStatsEnriched,
        performanceByDayPCO: performanceByDayPCOData,
        top3Posts: top3Posts,
        bottom3Posts: bottom3Posts
    };

    return finalReport; // Retorna o relatório completo
}
