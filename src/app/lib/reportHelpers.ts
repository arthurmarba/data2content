// @/app/lib/reportHelpers.ts - v4.5.8 (Aplica tipos Enum para F/P/C em interfaces e lógica)
// - ATUALIZADO: Interfaces e lógica interna para usar FormatType, ProposalType, ContextType onde aplicável.
// - Baseado na v4.5.7.

import { Types, Model, PipelineStage } from "mongoose";
import { subDays } from 'date-fns';
import { logger } from '@/app/lib/logger';
import { IMetric, IMetricStats } from "@/app/models/Metric";
// Importando os tipos Enum
import { FormatType, ProposalType, ContextType, DEFAULT_FORMAT_ENUM, DEFAULT_PROPOSAL_ENUM, DEFAULT_CONTEXT_ENUM } from "@/app/lib/constants/communityInspirations.constants";

const TOP_EXAMPLES_PER_GROUP_LIMIT = 3;
const REPORT_HELPERS_TAG = '[ReportHelpers v4.5.8]'; // Versão atualizada

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
// Interfaces Atualizadas
// ======================================================================================
export interface OverallStats {
  _id: null;
  totalPosts: number;
  avgLikes?: number;
  avgComments?: number;
  avgShares?: number;
  avgSaved?: number;
  avgReach?: number;
  avgImpressions?: number;
  avgViews?: number;
  avgFollows?: number;
  avgProfileVisits?: number;
  avgEngagementRate?: number;
  avgRetentionRate?: number;
  avgFollowerConversionRate?: number;
  avgPropagationIndex?: number;
  totalReelsInPeriod?: number;
  avgReelAvgWatchTimeSeconds?: number;
  avgReelVideoViewTotalTimeSeconds?: number;
  avgTotalInteractions?: number;
}

export interface DayOfWeekStat {
  _id: number; // 0 para Domingo, 1 para Segunda, etc.
  dayName: string;
  avgShares?: number;
  avgLikes?: number;
  avgComments?: number;
  avgTotalInteractions?: number;
  avgReach?: number;
  totalPosts: number;
}

export interface DurationStat {
  _id: string | number; // ID do bucket (ex: 0, 15, 30, 60 ou "Outro")
  range: string; // Faixa de duração legível (ex: "0-15s")
  avgShares: number;
  avgSaved: number;
  avgRetentionRate?: number;
  totalPosts: number;
}

export interface BaseStat {
  _id: object; // A estrutura do _id varia conforme o agrupamento
  avgLikes?: number;
  avgComments?: number;
  avgShares?: number;
  avgSaved?: number;
  avgReach?: number;
  avgImpressions?: number;
  avgViews?: number;
  avgFollows?: number;
  avgProfileVisits?: number;
  avgEngagementRate?: number;
  avgTotalInteractions?: number;
  avgRetentionRate?: number;
  totalPosts: number;
  shareDiffPercentage?: number | null;
  saveDiffPercentage?: number | null;
  reachDiffPercentage?: number | null;
  commentDiffPercentage?: number | null;
  likeDiffPercentage?: number | null;
  bestPostInGroup?: {
    _id: Types.ObjectId;
    description?: string;
    postLink?: string;
    shares?: number;
    saved?: number;
    type?: string; // Tipo de mídia do post IMetric (IMAGE, VIDEO, etc)
    format?: FormatType;   // ATUALIZADO
    proposal?: ProposalType; // ATUALIZADO
    context?: ContextType;  // ATUALIZADO
  };
}
export interface DetailedContentStat extends BaseStat {
  _id: { format: FormatType; proposal: ProposalType; context: ContextType; }; // ATUALIZADO
  topExamplesInGroup?: {
    _id: Types.ObjectId;
    description?: string;
    postLink?: string;
    type?: string; // Tipo de mídia do post IMetric
    format?: FormatType;   // ATUALIZADO
    proposal?: ProposalType; // ATUALIZADO
    context?: ContextType;  // ATUALIZADO
  }[];
}
export interface ProposalStat extends BaseStat { _id: { proposal: ProposalType; }; } // ATUALIZADO
export interface ContextStat extends BaseStat { _id: { context: ContextType; }; }   // ATUALIZADO

export interface DayPCOPerformanceStats {
    avgShares?: number; avgSaved?: number; avgReach?: number; avgComments?: number;
    avgLikes?: number; avgViews?: number; avgImpressions?: number; avgFollows?: number;
    avgProfileVisits?: number; avgEngagementRate?: number; avgRetentionRate?: number;
    avgTotalInteractions?: number;
    totalPosts: number;
}

// ATUALIZADO: Usando Record com Tipos Enum para chaves
export type PerformanceByContextDay = Record<ContextType, DayPCOPerformanceStats>;
export type PerformanceByProposalDay = Record<ProposalType, PerformanceByContextDay>;
export interface PerformanceByDayPCO { [dayOfWeek: number]: PerformanceByProposalDay; } // dayOfWeek (0-6) como chave

/**
 * Interface para o relatório agregado completo.
 * ATUALIZADO v4.5.7: top3Posts e bottom3Posts incluem type, format, proposal, context.
 */
export interface AggregatedReport {
    // ATUALIZADO: Tipos de F/P/C agora usam Enums
    top3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats' | 'type' | 'format' | 'proposal' | 'context'>[];
    bottom3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats' | 'type' | 'format' | 'proposal' | 'context'>[];
    overallStats?: OverallStats;
    dayOfWeekStats?: DayOfWeekStat[];
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[]; // Já usa _id com Enums
    proposalStats?: ProposalStat[];               // Já usa _id com Enum
    contextStats?: ContextStat[];                 // Já usa _id com Enum
    performanceByDayPCO?: PerformanceByDayPCO;    // Já usa Enums nas chaves aninhadas
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
    groupStage.$group.avgViews = { $avg: { $ifNull: ["$stats.views", 0] } }; // Note: IMetricStats.views, não video_views
    groupStage.$group.avgFollows = { $avg: { $ifNull: ["$stats.follows", 0] } };
    groupStage.$group.avgProfileVisits = { $avg: { $ifNull: ["$stats.profile_visits", 0] } };
    groupStage.$group.avgTotalInteractions = { $avg: { $ifNull: ["$stats.total_interactions", 0] } };
    groupStage.$group.avgRetentionRate = { $avg: { $ifNull: ["$stats.retention_rate", 0] } };
    groupStage.$group.avgEngagementRate = { $avg: { $ifNull: ["$stats.engagement_rate_on_reach", "$stats.engagement_rate", 0] } }; // Considera fallback se um não existir
    groupStage.$group.avgFollowerConversionRate = { $avg: { $ifNull: ["$stats.follower_conversion_rate", 0] } };
    groupStage.$group.avgPropagationIndex = { $avg: { $ifNull: ["$stats.propagation_index", 0] } };
    groupStage.$group.totalPosts = { $sum: 1 };
    return groupStage;
}

function getDurationBucketStage(): PipelineStage.Bucket {
    const durationBoundaries = [0, 15, 30, 60, Infinity]; // Segundos
    return {
        $bucket: {
            groupBy: "$stats.video_duration_seconds", // Campo que armazena a duração do vídeo em segundos
            boundaries: durationBoundaries,
            default: "Outro", // Bucket para vídeos sem duração ou fora das faixas
            output: {
                totalPosts: { $sum: 1 },
                sumShares: { $sum: { $ifNull: ["$stats.shares", 0] } },
                sumSaved: { $sum: { $ifNull: ["$stats.saved", 0] } },
                sumRetentionRate: { $sum: { $ifNull: ["$stats.retention_rate", 0] } }, // Assumindo que retention_rate é numérico (0 a 1)
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
    const fnTag = `${REPORT_HELPERS_TAG}[getDetailedContentStatsBase]`;
    logger.debug(`${fnTag} Buscando por F/P/C para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        addCommonAveragesToGroupStage({
            $group: {
                _id: {
                    format: { $ifNull: ["$format", DEFAULT_FORMAT_ENUM] },
                    proposal: { $ifNull: ["$proposal", DEFAULT_PROPOSAL_ENUM] },
                    context: { $ifNull: ["$context", DEFAULT_CONTEXT_ENUM] }
                },
            }
        }),
        { $sort: { totalPosts: -1, "avgShares": -1 } }
    ];
    try {
        // O resultado da agregação já deve ter os tipos Enum corretos para format, proposal, context
        // devido aos defaults e validação no MetricModel.
        const results = await metricModel.aggregate(pipeline).exec() as DetailedContentStat[];
        logger.debug(`${fnTag} F/P/C retornou ${results.length} grupos.`);
        return results;
     }
    catch (error) {
        logger.error(`${fnTag} Erro ao agregar por F/P/C para User ${userId}.`, error);
        throw new DetailedStatsError(`Falha ao agregar por F/P/C para User ${userId}`, error);
    }
}

async function getProposalStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<ProposalStat[]> {
    const fnTag = `${REPORT_HELPERS_TAG}[getProposalStatsBase]`;
    logger.debug(`${fnTag} Buscando por Proposta para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        addCommonAveragesToGroupStage({
            $group: {
                _id: { proposal: { $ifNull: ["$proposal", DEFAULT_PROPOSAL_ENUM] } },
            }
        }),
        { $sort: { totalPosts: -1, "avgShares": -1 } }
    ];
    try {
        const results = await metricModel.aggregate(pipeline).exec() as ProposalStat[];
        logger.debug(`${fnTag} Proposta retornou ${results.length} grupos.`);
        return results;
    }
    catch (error) {
        logger.error(`${fnTag} Erro ao agregar por Proposta para User ${userId}.`, error);
        throw new DetailedStatsError(`Falha ao agregar por Proposta para User ${userId}`, error);
    }
}

async function getContextStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<ContextStat[]> {
    const fnTag = `${REPORT_HELPERS_TAG}[getContextStatsBase]`;
    logger.debug(`${fnTag} Buscando por Contexto para User ${userId}`);
    const pipeline: PipelineStage[] = [
         { $match: { user: userId, postDate: { $gte: startDate } } },
         addCommonAveragesToGroupStage({
            $group: {
                _id: { context: { $ifNull: ["$context", DEFAULT_CONTEXT_ENUM] } },
            }
        }),
         { $sort: { totalPosts: -1, "avgShares": -1 } }
    ];
    try {
        const results = await metricModel.aggregate(pipeline).exec() as ContextStat[];
        logger.debug(`${fnTag} Contexto retornou ${results.length} grupos.`);
        return results;
     }
    catch (error) {
        logger.error(`${fnTag} Erro ao agregar por Contexto para User ${userId}.`, error);
        throw new DetailedStatsError(`Falha ao agregar por Contexto para User ${userId}`, error);
    }
}

// ======================================================================================
// Agregações Gerais (Overall, Dia da Semana, Duração)
// ======================================================================================
async function getOverallStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<OverallStats | undefined> {
    const fnTag = `${REPORT_HELPERS_TAG}[getOverallStatsBase]`;
    logger.debug(`${fnTag} Calculando OverallStats para User ${userId}`);

    const generalPipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        addCommonAveragesToGroupStage({
            $group: { _id: null }
        })
    ];

    const reelStatsPipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate }, type: "REEL" } },
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

        let overallStatsResult: Partial<OverallStats> = { totalPosts: 0 };

        if (generalResults && generalResults.length > 0 && generalResults[0]) {
            const { _id, ...statsFromResult } = generalResults[0] as any; // Cast to any to access dynamic props
            overallStatsResult = { ...overallStatsResult, ...statsFromResult };
            logger.debug(`${fnTag} OverallStats gerais calculados com sucesso.`);
        } else {
            logger.warn(`${fnTag} Nenhum dado encontrado para calcular OverallStats gerais para User ${userId}.`);
        }

        if (reelResults && reelResults.length > 0 && reelResults[0]) {
            const reelData = reelResults[0] as {
                totalReelsInPeriod: number;
                sumReelAvgWatchTimeMs: number;
                sumReelVideoViewTotalTimeMs: number
            };

            overallStatsResult.totalReelsInPeriod = reelData.totalReelsInPeriod;
            if (reelData.totalReelsInPeriod > 0) {
                overallStatsResult.avgReelAvgWatchTimeSeconds = (reelData.sumReelAvgWatchTimeMs / reelData.totalReelsInPeriod) / 1000;
                overallStatsResult.avgReelVideoViewTotalTimeSeconds = (reelData.sumReelVideoViewTotalTimeMs / reelData.totalReelsInPeriod) / 1000;
            } else {
                overallStatsResult.avgReelAvgWatchTimeSeconds = 0;
                overallStatsResult.avgReelVideoViewTotalTimeSeconds = 0;
            }
            logger.debug(`${fnTag} Métricas de Reels adicionadas ao OverallStats. Total Reels: ${reelData.totalReelsInPeriod}`);
        } else {
            overallStatsResult.totalReelsInPeriod = 0;
            overallStatsResult.avgReelAvgWatchTimeSeconds = 0;
            overallStatsResult.avgReelVideoViewTotalTimeSeconds = 0;
            logger.warn(`${fnTag} Nenhum dado de Reel encontrado para calcular estatísticas específicas de Reels para User ${userId}.`);
        }

        if (overallStatsResult.totalPosts === 0 && (overallStatsResult.totalReelsInPeriod === undefined || overallStatsResult.totalReelsInPeriod === 0) ) {
            logger.warn(`${fnTag} Nenhum post ou Reel encontrado no período para User ${userId}. Retornando undefined para OverallStats.`);
            return undefined;
        }

        return overallStatsResult as OverallStats;

    } catch (error) {
        logger.error(`${fnTag} Erro ao calcular OverallStats para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha ao calcular estatísticas gerais para User ${userId}`, error);
    }
}

async function getDayOfWeekStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<DayOfWeekStat[]> {
    const fnTag = `${REPORT_HELPERS_TAG}[getDayOfWeekStatsBase]`;
    logger.debug(`${fnTag} Calculando DayOfWeekStats para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        {
            $group: {
                _id: { $subtract: [{ $dayOfWeek: "$postDate" }, 1] }, // MongoDB $dayOfWeek: Domingo=1, Sábado=7. Subtrai 1 para 0-6.
                avgShares: { $avg: { $ifNull: ["$stats.shares", 0] } },
                avgLikes: { $avg: { $ifNull: ["$stats.likes", 0] } },
                avgComments: { $avg: { $ifNull: ["$stats.comments", 0] } },
                avgTotalInteractions: { $avg: { $ifNull: ["$stats.total_interactions", 0] } },
                avgReach: { $avg: { $ifNull: ["$stats.reach", 0] } },
                totalPosts: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } } // Ordena por dia da semana (0=Domingo, 1=Segunda, ...)
    ];
    try {
        const results = (await metricModel.aggregate(pipeline).exec()) as unknown as DayOfWeekStat[]; // Cast após execução
        results.forEach(stat => {
            stat.dayName = mapDayOfWeek(stat._id); // _id aqui é o número do dia (0-6)
        });
        logger.debug(`${fnTag} DayOfWeekStats calculados: ${results.length} dias encontrados para User ${userId}.`);
        return results;
    } catch (error) {
        logger.error(`${fnTag} Erro ao calcular DayOfWeekStats para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha ao calcular estatísticas por dia da semana para User ${userId}`, error);
    }
}

async function getDurationStatsBase(userId: Types.ObjectId, startDate: Date, metricModel: Model<IMetric>): Promise<DurationStat[]> {
    const fnTag = `${REPORT_HELPERS_TAG}[getDurationStatsBase]`;
    logger.debug(`${fnTag} Calculando DurationStats para User ${userId}`);
    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate }, "stats.video_duration_seconds": { $exists: true, $ne: null, $gt: 0 } } },
        getDurationBucketStage(),
        {
            $project: {
                _id: 1, // Mantém o _id do bucket (ex: 0, 15, 30, 60, "Outro")
                totalPosts: 1,
                avgShares: { $cond: [{ $gt: ["$totalPosts", 0] }, { $divide: ["$sumShares", "$totalPosts"] }, 0] },
                avgSaved: { $cond: [{ $gt: ["$totalPosts", 0] }, { $divide: ["$sumSaved", "$totalPosts"] }, 0] },
                avgRetentionRate: { $cond: [{ $gt: ["$totalPosts", 0] }, { $divide: ["$sumRetentionRate", "$totalPosts"] }, 0] },
            }
        },
        { $sort: { _id: 1 } } // Ordena pelos limites inferiores dos buckets
    ];
    try {
        const results: DurationStat[] = await metricModel.aggregate(pipeline).exec();
        results.forEach(stat => {
            stat.range = mapDurationBucketIdToRange(stat._id); // Converte o _id do bucket para uma string de range
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
    const fnTag = `${REPORT_HELPERS_TAG}[getDayPCOStatsBase]`;
    logger.debug(`${fnTag} Buscando por Dia/P/C para User ${userId}`);

    const pipeline: PipelineStage[] = [
        { $match: { user: userId, postDate: { $gte: startDate } } },
        { $addFields: { dayOfWeek: { $subtract: [{ $dayOfWeek: "$postDate" }, 1] } } }, // 0=Domingo, ..., 6=Sábado
        addCommonAveragesToGroupStage({
            $group: {
                _id: {
                  dayOfWeek: "$dayOfWeek",
                  proposal: { $ifNull: ["$proposal", DEFAULT_PROPOSAL_ENUM] },
                  context: { $ifNull: ["$context", DEFAULT_CONTEXT_ENUM] }
                },
            }
        })
    ];

    try {
        // O resultado da agregação já terá os tipos Enum corretos para proposal e context
        // devido aos defaults e validação no MetricModel.
        const aggregationResults: (BaseStat & { _id: { dayOfWeek: number; proposal: ProposalType; context: ContextType; } })[] = await metricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} Agregação Dia/P/C retornou ${aggregationResults.length} resultados brutos para User ${userId}.`);

        const performanceByDayPCO: PerformanceByDayPCO = {};
        for (const result of aggregationResults) {
            const { dayOfWeek, proposal, context } = result._id;

            if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
                logger.warn(`${fnTag} Resultado com dayOfWeek inválido para User ${userId}:`, result._id);
                continue;
            }
            if (!performanceByDayPCO[dayOfWeek]) { performanceByDayPCO[dayOfWeek] = {} as PerformanceByProposalDay; }
            if (!performanceByDayPCO[dayOfWeek]![proposal]) { (performanceByDayPCO[dayOfWeek]![proposal] as PerformanceByContextDay) = {} as PerformanceByContextDay; }

            (performanceByDayPCO[dayOfWeek]![proposal] as PerformanceByContextDay)[context] = {
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
                avgTotalInteractions: result.avgTotalInteractions,
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
    const fnTag = `${REPORT_HELPERS_TAG}[enrichStats]`;

    if (!overallStats) {
        logger.warn(`${fnTag} OverallStats não disponíveis para User ${userId}, pulando cálculo de DiffPercentages.`);
        // Mesmo sem OverallStats, ainda podemos tentar adicionar os exemplos para 'detailed'
        if (groupingType === 'detailed') {
             const topExamplesResult = await addTopExamplesOnly(statsBase as DetailedContentStat[], userId, metricModel);
             return topExamplesResult as T[];
        }
        return statsBase;
    }

    logger.debug(`${fnTag} Enriquecendo ${statsBase.length} grupos do tipo ${groupingType} para User ${userId}.`);

    // Tipo para os posts retornados pela busca de exemplos (incluindo F/P/C com Enums)
    type ExamplePost = Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats' | 'type' | 'format' | 'proposal' | 'context'>;


    const enrichedResults: T[] = [];
    for (const statBaseItem of statsBase) {
        const enrichedStat = { ...statBaseItem };

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
            const detailedStat = enrichedStat as DetailedContentStat; // DetailedContentStat já tem _id com Enums
            const groupId = detailedStat._id; // groupId é { format: FormatType; proposal: ProposalType; context: ContextType; }
            try {
                const topPostsFromDb: ExamplePost[] = await metricModel.find({
                    user: userId,
                    format: groupId.format,     // Usa FormatType
                    proposal: groupId.proposal, // Usa ProposalType
                    context: groupId.context    // Usa ContextType
                })
                .select('_id description postLink stats.shares stats.saved type format proposal context')
                .sort({ 'stats.shares': -1, 'stats.saved': -1 })
                .limit(TOP_EXAMPLES_PER_GROUP_LIMIT)
                .lean();

                detailedStat.topExamplesInGroup = topPostsFromDb.map(post => ({
                    _id: post._id,
                    description: post.description ?? undefined,
                    postLink: (post.postLink && post.postLink.startsWith('http')) ? post.postLink : undefined,
                    type: post.type,
                    format: post.format,     // Retorna FormatType
                    proposal: post.proposal, // Retorna ProposalType
                    context: post.context,   // Retorna ContextType
                }));

                const bestPost = topPostsFromDb[0];
                if (bestPost) {
                    detailedStat.bestPostInGroup = {
                        _id: bestPost._id,
                        description: bestPost.description ?? undefined,
                        postLink: (bestPost.postLink && bestPost.postLink.startsWith('http')) ? bestPost.postLink : undefined,
                        shares: bestPost.stats?.shares,
                        saved: bestPost.stats?.saved,
                        type: bestPost.type,
                        format: bestPost.format,     // Retorna FormatType
                        proposal: bestPost.proposal, // Retorna ProposalType
                        context: bestPost.context,   // Retorna ContextType
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

// Função auxiliar para adicionar top N exemplos quando OverallStats estão ausentes
async function addTopExamplesOnly(
    statsBase: DetailedContentStat[],
    userId: Types.ObjectId,
    metricModel: Model<IMetric>
): Promise<DetailedContentStat[]> {
    const fnTag = `${REPORT_HELPERS_TAG}[addTopExamplesOnly]`;
    type ExamplePost = Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats' | 'type' | 'format' | 'proposal' | 'context'>;

    logger.debug(`${fnTag} Adicionando apenas Top N exemplos para User ${userId} pois OverallStats estão ausentes.`);
    const enrichedResults: DetailedContentStat[] = [];
    for (const statBaseItem of statsBase) {
        const enrichedStat = { ...statBaseItem };
        const groupId = enrichedStat._id; // groupId é { format: FormatType; proposal: ProposalType; context: ContextType; }
        try {
            const topPostsFromDb: ExamplePost[] = await metricModel.find({
                user: userId,
                format: groupId.format,
                proposal: groupId.proposal,
                context: groupId.context
            })
            .select('_id description postLink stats.shares stats.saved type format proposal context')
            .sort({ 'stats.shares': -1, 'stats.saved': -1 })
            .limit(TOP_EXAMPLES_PER_GROUP_LIMIT)
            .lean();

            enrichedStat.topExamplesInGroup = topPostsFromDb.map(post => ({
                _id: post._id,
                description: post.description ?? undefined,
                postLink: (post.postLink && post.postLink.startsWith('http')) ? post.postLink : undefined,
                type: post.type,
                format: post.format,
                proposal: post.proposal,
                context: post.context,
            }));

            const bestPost = topPostsFromDb[0];
            if (bestPost) {
                enrichedStat.bestPostInGroup = {
                    _id: bestPost._id,
                    description: bestPost.description ?? undefined,
                    postLink: (bestPost.postLink && bestPost.postLink.startsWith('http')) ? bestPost.postLink : undefined,
                    shares: bestPost.stats?.shares,
                    saved: bestPost.stats?.saved,
                    type: bestPost.type,
                    format: bestPost.format,
                    proposal: bestPost.proposal,
                    context: bestPost.context,
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
// Função Principal de Agregação e Enriquecimento
// ======================================================================================
export async function buildAggregatedReport(
    userId: Types.ObjectId,
    startDate: Date,
    metricModel: Model<IMetric>
): Promise<AggregatedReport> {
    const fnTag = `${REPORT_HELPERS_TAG}[buildAggregatedReport]`;
    logger.info(`${fnTag} Iniciando para User: ${userId}, desde: ${startDate.toISOString()}`);
    if (!metricModel?.aggregate || !userId || !startDate) {
        logger.error(`${fnTag} Input inválido: metricModel, userId ou startDate ausente/inválido.`);
        throw new ReportAggregationError('Input inválido para buildAggregatedReport.');
    }

    let overallStats: OverallStats | undefined,
        dayOfWeekStatsBase: DayOfWeekStat[] = [],
        durationStatsBase: DurationStat[] = [],
        detailedStatsBase: DetailedContentStat[] = [], // Tipagem atualizada
        proposalStatsBase: ProposalStat[] = [],       // Tipagem atualizada
        contextStatsBase: ContextStat[] = [],         // Tipagem atualizada
        performanceByDayPCOData: PerformanceByDayPCO | undefined; // Tipagem atualizada

    try {
        logger.debug(`${fnTag} Buscando agregações para User ${userId}...`);
        const results = await Promise.allSettled([
            getOverallStatsBase(userId, startDate, metricModel),
            getDayOfWeekStatsBase(userId, startDate, metricModel),
            getDurationStatsBase(userId, startDate, metricModel),
            getDetailedContentStatsBase(userId, startDate, metricModel), // Retorna DetailedContentStat[]
            getProposalStatsBase(userId, startDate, metricModel),       // Retorna ProposalStat[]
            getContextStatsBase(userId, startDate, metricModel),         // Retorna ContextStat[]
            getDayPCOStatsBase(userId, startDate, metricModel)         // Retorna PerformanceByDayPCO
        ]);

        // Atribuições com verificação de status e valor
        if (results[0].status === 'fulfilled' && results[0].value) overallStats = results[0].value;
        else logger.error(`${fnTag} Falha ao buscar OverallStats para User ${userId}.`, results[0].status === 'rejected' ? results[0].reason : 'Valor nulo/undefined');

        if (results[1].status === 'fulfilled' && results[1].value) dayOfWeekStatsBase = results[1].value;
        else logger.error(`${fnTag} Falha ao buscar DayOfWeekStats para User ${userId}.`, results[1].status === 'rejected' ? results[1].reason : 'Valor nulo/undefined');

        if (results[2].status === 'fulfilled' && results[2].value) durationStatsBase = results[2].value;
        else logger.error(`${fnTag} Falha ao buscar DurationStats para User ${userId}.`, results[2].status === 'rejected' ? results[2].reason : 'Valor nulo/undefined');

        if (results[3].status === 'fulfilled' && results[3].value) detailedStatsBase = results[3].value;
        else logger.error(`${fnTag} Falha ao buscar F/P/C Base para User ${userId}.`, results[3].status === 'rejected' ? results[3].reason : 'Valor nulo/undefined');

        if (results[4].status === 'fulfilled' && results[4].value) proposalStatsBase = results[4].value;
        else logger.error(`${fnTag} Falha ao buscar Proposta Base para User ${userId}.`, results[4].status === 'rejected' ? results[4].reason : 'Valor nulo/undefined');

        if (results[5].status === 'fulfilled' && results[5].value) contextStatsBase = results[5].value;
        else logger.error(`${fnTag} Falha ao buscar Contexto Base para User ${userId}.`, results[5].status === 'rejected' ? results[5].reason : 'Valor nulo/undefined');

        if (results[6].status === 'fulfilled' && results[6].value) performanceByDayPCOData = results[6].value;
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

        if (enrichPromises[0].status === 'fulfilled' && enrichPromises[0].value) {
            detailedContentStatsEnriched = enrichPromises[0].value;
            detailedContentStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
        } else { logger.error(`${fnTag} Falha ao enriquecer F/P/C para User ${userId}.`, enrichPromises[0].status === 'rejected' ? enrichPromises[0].reason : 'Valor nulo/undefined'); }

        if (enrichPromises[1].status === 'fulfilled' && enrichPromises[1].value) {
            proposalStatsEnriched = enrichPromises[1].value;
            proposalStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
        } else { logger.error(`${fnTag} Falha ao enriquecer Proposta para User ${userId}.`, enrichPromises[1].status === 'rejected' ? enrichPromises[1].reason : 'Valor nulo/undefined'); }

        if (enrichPromises[2].status === 'fulfilled' && enrichPromises[2].value) {
            contextStatsEnriched = enrichPromises[2].value;
            contextStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
        } else { logger.error(`${fnTag} Falha ao enriquecer Contexto para User ${userId}.`, enrichPromises[2].status === 'rejected' ? enrichPromises[2].reason : 'Valor nulo/undefined'); }
        logger.debug(`${fnTag} Enriquecimento concluído para User ${userId}.`);

    } catch (error) {
         logger.error(`${fnTag} Erro crítico durante enriquecimento de stats para User ${userId}.`, error);
    }

    // Tipo para os posts buscados do banco de dados, incluindo os novos campos com Enums
    type FetchedPostForReport = Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats' | 'type' | 'format' | 'proposal' | 'context'>;

    let top3Posts: FetchedPostForReport[] = [],
        bottom3Posts: FetchedPostForReport[] = [];
    try {
        logger.debug(`${fnTag} Buscando top/bottom 3 posts para User ${userId}...`);
        const sortField = 'stats.shares'; 
        const posts: FetchedPostForReport[] = await metricModel.find({
                user: userId,
                postDate: { $gte: startDate },
                [sortField]: { $exists: true }
            })
            .select('_id description postLink stats type format proposal context') // Campos já estão alinhados com FetchedPostForReport
            .sort({ [sortField]: -1 })
            .lean() as FetchedPostForReport[]; 

        if (posts.length > 0) {
            top3Posts = posts.slice(0, 3);
            // Garante que bottom3Posts tenha os tipos Enum corretos
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

