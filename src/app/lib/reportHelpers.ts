// @/app/lib/reportHelpers.ts - v4.5.1 (Revisão confirma que OverallStats já inclui campos de média como avgLikes, avgComments)
// - Nenhuma alteração funcional necessária em relação a OverallStats para o erro reportado.
// - Baseado na v4.5.

import { Types, Model, PipelineStage } from "mongoose";
import { subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import MetricModel, { IMetric, IMetricStats } from "@/app/models/Metric";

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
// Interfaces Atualizadas (v4.5.1)
// ======================================================================================
export interface OverallStats {
  _id: null; totalPosts: number; avgLikes?: number; avgComments?: number;
  avgShares?: number; avgSaved?: number; avgReach?: number; avgImpressions?: number;
  avgViews?: number; avgFollows?: number; avgProfileVisits?: number;
  avgEngagementRate?: number; avgRetentionRate?: number; 
  avgFollowerConversionRate?: number; avgPropagationIndex?: number;
  totalReelsInPeriod?: number; 
  avgReelAvgWatchTimeSeconds?: number; 
  avgReelVideoViewTotalTimeSeconds?: number; 
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
  bestPostInGroup?: { _id: Types.ObjectId; description?: string; postLink?: string; shares?: number; saved?: number; };
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
function mapDayOfWeek(dow: number): string {
    const names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return (dow >= 0 && dow <= 6) ? names[dow]! : "Desconhecido";
}

function addCommonAveragesToGroupStage(groupStage: any): any {
    if (!groupStage.$group) {
        groupStage.$group = {};
    }
    groupStage.$group.avgLikes = { $avg: { $ifNull: ["$stats.likes", 0] } };
    groupStage.$group.avgComments = { $avg: { $ifNull: ["$stats.comments", 0] } };
    groupStage.$group.avgShares = { $avg: { $ifNull: ["$stats.shares", 0] } };
    groupStage.$group.avgSaved = { $avg: { $ifNull: ["$stats.saved", 0] } };
    groupStage.$group.avgReach = { $avg: { $ifNull: ["$stats.reach", 0] } };
    groupStage.$group.avgImpressions = { $avg: { $ifNull: ["$stats.impressions", 0] } }; 
    groupStage.$group.avgViews = { $avg: { $ifNull: ["$stats.views", 0] } }; 
    groupStage.$group.avgFollows = { $avg: { $ifNull: ["$stats.follows", 0] } };
    groupStage.$group.avgProfileVisits = { $avg: { $ifNull: ["$stats.profile_visits", 0] } };
    
    groupStage.$group.avgRetentionRate = { $avg: { $ifNull: ["$stats.retention_rate", 0] } }; 
    
    groupStage.$group.avgEngagementRate = { $avg: { $ifNull: ["$stats.engagement_rate_on_reach", "$stats.engagement_rate", 0] } }; 
    groupStage.$group.avgFollowerConversionRate = { $avg: { $ifNull: ["$stats.follower_conversion_rate", 0] } };
    groupStage.$group.avgPropagationIndex = { $avg: { $ifNull: ["$stats.propagation_index", 0] } };
    
    groupStage.$group.totalPosts = { $sum: 1 };
    return groupStage;
}

function getDurationBucketStage(): PipelineStage.Bucket {
    const durationBoundaries = [0, 15, 30, 60, Infinity];
    return {
        $bucket: {
            groupBy: "$stats.video_duration_seconds",
            boundaries: durationBoundaries,
            default: "Outro",
            output: {
                totalPosts: { $sum: 1 },
                sumShares: { $sum: { $ifNull: ["$stats.shares", 0] } },
                sumSaved: { $sum: { $ifNull: ["$stats.saved", 0] } },
                sumRetentionRate: { $sum: { $ifNull: ["$stats.retention_rate", 0] } }, 
            }
        }
    };
}

function mapDurationBucketIdToRange(bucketId: number | string): string {
    if (typeof bucketId !== 'number') return "Desconhecido/Outro";
    if (bucketId === 0) return "0-15s";
    if (bucketId === 15) return "15-30s";
    if (bucketId === 30) return "30-60s";
    if (bucketId === 60) return "60s+";
    return "Desconhecido";
}

// ======================================================================================
// Funções para buscar Stats Detalhados BASE
// ======================================================================================
async function getDetailedContentStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<DetailedContentStat[]> {
    const fnTag = '[getDetailedContentStatsBase v4.5.1]';
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

async function getProposalStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<ProposalStat[]> {
    const fnTag = '[getProposalStatsBase v4.5.1]';
    logger.debug(`${fnTag} Buscando por Proposta para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        addCommonAveragesToGroupStage({
            $group: {
                _id: { proposal: { $ifNull: ["$proposal", "Outro"] } },
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

async function getContextStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<ContextStat[]> {
    const fnTag = '[getContextStatsBase v4.5.1]';
    logger.debug(`${fnTag} Buscando por Contexto para User ${userId}`);
    const pipeline: PipelineStage[] = [
         { $match: { user: userId, postDate: { $gte: startDate } } },
         addCommonAveragesToGroupStage({
            $group: {
                _id: { context: { $ifNull: ["$context", "Geral"] } },
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
// Agregações Gerais (Overall, Dia da Semana, Duração) - ATUALIZADO v4.5.1
// ======================================================================================
/**
 * Calcula as estatísticas gerais (OverallStats) e as métricas específicas de Reels.
 */
async function getOverallStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<OverallStats | undefined> {
    const fnTag = '[getOverallStatsBase v4.5.1]';
    logger.debug(`${fnTag} Calculando OverallStats para User ${userId}`);
    
    const generalPipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        addCommonAveragesToGroupStage({
            $group: { _id: null } // _id: null é crucial para agregar todos os documentos
        })
    ];

    const reelStatsPipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate }, type: "REEL" } }, // Usar 'type' em vez de 'format' para ser mais preciso com a API
        {
            $group: {
                _id: null,
                totalReelsInPeriod: { $sum: 1 },
                sumReelAvgWatchTimeMs: { $sum: { $ifNull: ["$stats.ig_reels_avg_watch_time", 0] } },
                sumReelVideoViewTotalTimeMs: { $sum: { $ifNull: ["$stats.ig_reels_video_view_total_time", 0] } },
            }
        }
    ];

    try {
        const [generalResults, reelResults] = await Promise.all([
            metricModel.aggregate(generalPipeline).exec(),
            metricModel.aggregate(reelStatsPipeline).exec()
        ]);

        let overallStats: OverallStats | undefined = undefined;

        if (generalResults && generalResults.length > 0 && generalResults[0]) {
            // Remove _id: null do resultado da agregação antes de fazer o cast para OverallStats
            const { _id, ...statsFromResult } = generalResults[0];
            overallStats = statsFromResult as OverallStats; 
            logger.debug(`${fnTag} OverallStats gerais calculados com sucesso.`);
        } else {
            logger.warn(`${fnTag} Nenhum dado encontrado para calcular OverallStats gerais para User ${userId}.`);
            overallStats = { totalPosts: 0 } as OverallStats; // Inicializa com totalPosts: 0
        }

        if (reelResults && reelResults.length > 0 && reelResults[0]) {
            const reelData = reelResults[0] as { 
                totalReelsInPeriod: number; 
                sumReelAvgWatchTimeMs: number; 
                sumReelVideoViewTotalTimeMs: number 
            };
            
            overallStats.totalReelsInPeriod = reelData.totalReelsInPeriod;
            if (reelData.totalReelsInPeriod > 0) {
                overallStats.avgReelAvgWatchTimeSeconds = (reelData.sumReelAvgWatchTimeMs / reelData.totalReelsInPeriod) / 1000;
                overallStats.avgReelVideoViewTotalTimeSeconds = (reelData.sumReelVideoViewTotalTimeMs / reelData.totalReelsInPeriod) / 1000;
            } else {
                overallStats.avgReelAvgWatchTimeSeconds = 0;
                overallStats.avgReelVideoViewTotalTimeSeconds = 0;
            }
            logger.debug(`${fnTag} Métricas de Reels adicionadas ao OverallStats. Total Reels: ${reelData.totalReelsInPeriod}`);
        } else {
            logger.warn(`${fnTag} Nenhum dado de Reel encontrado para calcular estatísticas específicas de Reels para User ${userId}.`);
            overallStats.totalReelsInPeriod = 0;
            overallStats.avgReelAvgWatchTimeSeconds = 0;
            overallStats.avgReelVideoViewTotalTimeSeconds = 0;
        }
        
        if (overallStats.totalPosts === 0 && overallStats.totalReelsInPeriod === 0 ) {
            logger.warn(`${fnTag} Nenhum post ou Reel encontrado no período para User ${userId}. Retornando undefined para OverallStats.`);
            return undefined;
        }

        return overallStats;

    } catch (error) {
        logger.error(`${fnTag} Erro ao calcular OverallStats para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha ao calcular estatísticas gerais para User ${userId}`, error);
    }
}

async function getDayOfWeekStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<DayOfWeekStat[]> {
    const fnTag = '[getDayOfWeekStatsBase v4.5.1]';
    logger.debug(`${fnTag} Calculando DayOfWeekStats para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        {
            $group: {
                _id: { $subtract: [{ $dayOfWeek: "$postDate" }, 1] }, // MongoDB $dayOfWeek: 1 (Sun) - 7 (Sat)
                avgShares: { $avg: { $ifNull: ["$stats.shares", 0] } },
                avgLikes: { $avg: { $ifNull: ["$stats.likes", 0] } },
                avgReach: { $avg: { $ifNull: ["$stats.reach", 0] } },
                totalPosts: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ];
    try {
        const results: DayOfWeekStat[] = await metricModel.aggregate(pipeline).exec();
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

async function getDurationStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<DurationStat[]> {
    const fnTag = '[getDurationStatsBase v4.5.1]';
    logger.debug(`${fnTag} Calculando DurationStats para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate }, "stats.video_duration_seconds": { $exists: true, $ne: null, $gt: 0 } } },
        getDurationBucketStage(),
        {
            $project: {
                _id: 1, 
                totalPosts: 1,
                avgShares: { $cond: [{ $gt: ["$totalPosts", 0] }, { $divide: ["$sumShares", "$totalPosts"] }, 0] },
                avgSaved: { $cond: [{ $gt: ["$totalPosts", 0] }, { $divide: ["$sumSaved", "$totalPosts"] }, 0] },
                avgRetentionRate: { $cond: [{ $gt: ["$totalPosts", 0] }, { $divide: ["$sumRetentionRate", "$totalPosts"] }, 0] },
            }
        },
        { $sort: { _id: 1 } }
    ];
    try {
        const results: DurationStat[] = await metricModel.aggregate(pipeline).exec();
        results.forEach(stat => {
            stat.range = mapDurationBucketIdToRange(stat._id);
        });
        logger.debug(`${fnTag} DurationStats calculados: ${results.length} faixas encontradas para User ${userId}.`);
        return results;
    } catch (error) {
        logger.error(`${fnTag} Erro ao calcular DurationStats para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha ao calcular estatísticas por duração para User ${userId}`, error);
    }
}

// ======================================================================================
// Agregação Dia/Proposta/Contexto
// ======================================================================================
async function getDayPCOStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<PerformanceByDayPCO> {
    const fnTag = "[getDayPCOStatsBase v4.5.1]";
    logger.debug(`${fnTag} Buscando por Dia/P/C para User ${userId}`);

    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        { $addFields: { dayOfWeek: { $subtract: [{ $dayOfWeek: "$postDate" }, 1] } } }, // Consistent dayOfWeek 0-6
        addCommonAveragesToGroupStage({
            $group: {
                _id: {
                  dayOfWeek: "$dayOfWeek",
                  proposal: { $ifNull: ["$proposal", "Outro"] },
                  context: { $ifNull: ["$context", "Geral"] }
                },
            }
        })
    ];

    try {
        const aggregationResults: (BaseStat & { _id: { dayOfWeek: number; proposal: string; context: string; } })[] = await metricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} Agregação Dia/P/C retornou ${aggregationResults.length} resultados brutos para User ${userId}.`);

        const performanceByDayPCO: PerformanceByDayPCO = {};
        for (const result of aggregationResults) {
            const { dayOfWeek, proposal, context } = result._id;

            if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
                logger.warn(`${fnTag} Resultado com dayOfWeek inválido para User ${userId}:`, result._id);
                continue;
            }
            if (!performanceByDayPCO[dayOfWeek]) { performanceByDayPCO[dayOfWeek] = {}; }
            if (!performanceByDayPCO[dayOfWeek]![proposal]) { performanceByDayPCO[dayOfWeek]![proposal] = {}; }

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
// Função Genérica para Enriquecer Stats
// ======================================================================================
async function enrichStats<T extends BaseStat>(
    statsBase: T[],
    overallStats: OverallStats | undefined,
    userId: Types.ObjectId,
    metricModel: Model<IMetric>,
    groupingType: 'detailed' | 'proposal' | 'context'
): Promise<T[]> {
    const fnTag = '[enrichStats v4.5.1]';

    if (!overallStats) {
        logger.warn(`${fnTag} OverallStats não disponíveis para User ${userId}, pulando cálculo de DiffPercentages.`);
        if (groupingType === 'detailed') {
             const topExamplesResult = await addTopExamplesOnly(statsBase as DetailedContentStat[], userId, metricModel);
             return topExamplesResult as T[];
        }
        return statsBase;
    }

    logger.debug(`${fnTag} Enriquecendo ${statsBase.length} grupos do tipo ${groupingType} para User ${userId}.`);

    const enrichedResults: T[] = [];
    for (const statBase of statsBase) {
        const enrichedStat = { ...statBase }; 

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

        if (groupingType === 'detailed') {
            const detailedStat = enrichedStat as DetailedContentStat;
            const groupId = detailedStat._id as DetailedContentStat['_id']; // Explicit cast for clarity
            try {
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

                detailedStat.topExamplesInGroup = topPosts.map(post => ({
                    _id: post._id,
                    description: post.description ?? undefined,
                    postLink: (post.postLink && post.postLink.startsWith('http')) ? post.postLink : undefined
                }));

                const bestPost = topPosts[0];
                if (bestPost) {
                    detailedStat.bestPostInGroup = {
                        _id: bestPost._id,
                        description: bestPost.description ?? undefined,
                        postLink: (bestPost.postLink && bestPost.postLink.startsWith('http')) ? bestPost.postLink : undefined,
                        shares: bestPost.stats?.shares,
                        saved: bestPost.stats?.saved
                    };
                } else {
                    detailedStat.bestPostInGroup = undefined;
                }
            } catch(error) {
                 logger.error(`${fnTag} Erro ao buscar top posts para grupo ${JSON.stringify(groupId)} User ${userId}:`, error);
                 detailedStat.topExamplesInGroup = [];
                 detailedStat.bestPostInGroup = undefined;
            }
        }
        enrichedResults.push(enrichedStat);
    }
    return enrichedResults;
}

async function addTopExamplesOnly(
    statsBase: DetailedContentStat[],
    userId: Types.ObjectId,
    metricModel: Model<IMetric>
): Promise<DetailedContentStat[]> {
    const fnTag = '[addTopExamplesOnly v4.5.1]';
    logger.debug(`${fnTag} Adicionando apenas Top N exemplos para User ${userId} pois OverallStats estão ausentes.`);
    const enrichedResults: DetailedContentStat[] = [];
    for (const statBase of statsBase) {
        const enrichedStat = { ...statBase };
        const groupId = enrichedStat._id as DetailedContentStat['_id']; // Explicit cast
        try {
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

            enrichedStat.topExamplesInGroup = topPosts.map(post => ({
                _id: post._id,
                description: post.description ?? undefined,
                postLink: (post.postLink && post.postLink.startsWith('http')) ? post.postLink : undefined
            }));

            const bestPost = topPosts[0];
            if (bestPost) {
                enrichedStat.bestPostInGroup = {
                    _id: bestPost._id,
                    description: bestPost.description ?? undefined,
                    postLink: (bestPost.postLink && bestPost.postLink.startsWith('http')) ? bestPost.postLink : undefined,
                    shares: bestPost.stats?.shares,
                    saved: bestPost.stats?.saved
                };
            } else {
                enrichedStat.bestPostInGroup = undefined;
            }
        } catch(error) {
             logger.error(`${fnTag} Erro ao buscar top posts para grupo ${JSON.stringify(groupId)} User ${userId}:`, error);
             enrichedStat.topExamplesInGroup = [];
             enrichedStat.bestPostInGroup = undefined;
        }
        enrichedResults.push(enrichedStat);
    }
    return enrichedResults;
}


// ======================================================================================
// Função Principal de Agregação e Enriquecimento - ATUALIZADO v4.5.1
// ======================================================================================
export async function buildAggregatedReport(
    userId: Types.ObjectId,
    startDate: Date,
    metricModel: Model<IMetric>
): Promise<AggregatedReport> {
    const fnTag = '[buildAggregatedReport v4.5.1]';
    logger.info(`${fnTag} Iniciando para User: ${userId}, desde: ${startDate.toISOString()}`);
    if (!metricModel?.aggregate || !userId || !startDate) {
        throw new Error('Input inválido para buildAggregatedReport v4.5.1.');
    }

    let overallStats: OverallStats | undefined,
        dayOfWeekStatsBase: DayOfWeekStat[] = [],
        durationStatsBase: DurationStat[] = [],
        detailedStatsBase: DetailedContentStat[] = [],
        proposalStatsBase: ProposalStat[] = [],
        contextStatsBase: ContextStat[] = [],
        performanceByDayPCOData: PerformanceByDayPCO | undefined;

    try {
        logger.debug(`${fnTag} Buscando agregações para User ${userId}...`);
        const results = await Promise.allSettled([
            getOverallStatsBase(userId, startDate, metricModel), 
            getDayOfWeekStatsBase(userId, startDate, metricModel),
            getDurationStatsBase(userId, startDate, metricModel),
            getDetailedContentStatsBase(userId, startDate, metricModel),
            getProposalStatsBase(userId, startDate, metricModel),
            getContextStatsBase(userId, startDate, metricModel),
            getDayPCOStatsBase(userId, startDate, metricModel)
        ]);

        if (results[0].status === 'fulfilled' && results[0].value) overallStats = results[0].value; // Check for value existence
        else logger.error(`${fnTag} Falha ao buscar OverallStats para User ${userId}.`, results[0].status === 'rejected' ? results[0].reason : 'Valor nulo/undefined');

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

        if (results[6].status === 'fulfilled' && results[6].value) performanceByDayPCOData = results[6].value; // Check for value existence
        else logger.error(`${fnTag} Falha ao buscar Dia/P/C Base para User ${userId}.`, results[6].status === 'rejected' ? results[6].reason : 'Valor nulo/undefined');

        logger.debug(`${fnTag} Agregações base e gerais concluídas para User ${userId}.`);

    } catch (error) {
        logger.error(`${fnTag} Erro crítico durante busca de agregações para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha na busca inicial de agregações para User ${userId}`, error);
    }

    let detailedContentStatsEnriched: DetailedContentStat[] = [],
        proposalStatsEnriched: ProposalStat[] = [],
        contextStatsEnriched: ContextStat[] = [];

    try {
        logger.debug(`${fnTag} Enriquecendo estatísticas detalhadas para User ${userId}...`);
        const enrichPromises = await Promise.allSettled([
             enrichStats(detailedStatsBase, overallStats, userId, metricModel, 'detailed'),
             enrichStats(proposalStatsBase, overallStats, userId, metricModel, 'proposal'),
             enrichStats(contextStatsBase, overallStats, userId, metricModel, 'context')
        ]);

        if (enrichPromises[0].status === 'fulfilled') {
            detailedContentStatsEnriched = enrichPromises[0].value;
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
         logger.error(`${fnTag} Erro crítico durante enriquecimento de stats para User ${userId}.`, error);
    }

    let top3Posts: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[] = [],
        bottom3Posts: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[] = [];
    try {
        logger.debug(`${fnTag} Buscando top/bottom 3 posts para User ${userId}...`);
        const sortField = 'stats.shares'; 
        const posts = await metricModel.find({
                user: userId,
                postDate: { $gte: startDate },
                [sortField]: { $exists: true }
            })
            .select(`_id description postLink stats.shares stats.saved stats.likes stats.comments`) // Removido stats.reach, stats.video_views que podem não estar no top3Posts
            .sort({ [sortField]: -1 })
            .lean();

        if (posts.length > 0) {
            top3Posts = posts.slice(0, 3);
            bottom3Posts = posts.length >= 3 ? posts.slice(-3).reverse() : [...posts].reverse();
        }
        logger.debug(`${fnTag} Top 3: ${top3Posts.length} posts. Bottom 3: ${bottom3Posts.length} posts para User ${userId}.`);

    } catch (error) {
         logger.error(`${fnTag} Erro ao buscar top/bottom posts para User ${userId}.`, error);
    }

    logger.info(`${fnTag} Montando relatório final para User ${userId}.`);
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

    return finalReport;
}
