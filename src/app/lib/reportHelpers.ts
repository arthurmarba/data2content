// @/app/lib/reportHelpers.ts - v3.4 Completo (Inclui Enriquecimento F/P/C, Proposta, Contexto)

import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import { Types, Model } from "mongoose";
import { formatISO } from 'date-fns';
import { logger } from '@/app/lib/logger'; // Certifique-se que o caminho está correto
import { IMetric, Metric } from "@/app/models/Metric"; // Import IMetric e o Modelo Metric

// ======================================================================================
// Erros Customizados para o Módulo de Relatórios
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
export class ReportAggregationError extends ReportError { /* ... */ }
export class DetailedStatsError extends ReportError { /* ... */ }


// ======================================================================================
// Interfaces Atualizadas (v3.4 - Inclui Proposta/Contexto)
// ======================================================================================

export interface OverallStats {
  _id: null;
  totalCurtidas: number; totalComentarios: number; totalCompartilhamentos: number;
  totalVisualizacoes: number; totalSalvamentos: number; totalAlcance: number; // Inclui Alcance
  avgCurtidas: number; avgComentarios: number; avgCompartilhamentos: number;
  avgVisualizacoes: number; avgSalvamentos: number; avgAlcance: number; // Inclui Alcance
  count: number;
}

export interface DayOfWeekStat {
    dayName: string; averageShares: number; totalPosts: number;
}

export interface DurationStat {
    range: string; contentCount: number; averageShares: number; averageSaves?: number; // Inclui Saves
}

// Interface BASE comum para enriquecimento
interface BaseStat {
    _id: object; // {format, proposal, context}, {proposal}, ou {context}
    avgCompartilhamentos: number; avgSalvamentos: number; avgCurtidas: number; avgAlcance: number; count: number;
    shareDiffPercentage?: number; saveDiffPercentage?: number; reachDiffPercentage?: number;
    bestPostInGroup?: { _id: Types.ObjectId; description?: string; postLink?: string; shares?: number; saves?: number; };
}

// Interface Detalhada (F/P/C)
export interface DetailedContentStat extends BaseStat {
  _id: { format: string; proposal: string; context: string; };
}

// Interface para Stats por Proposta
export interface ProposalStat extends BaseStat {
  _id: { proposal: string; };
}

// Interface para Stats por Contexto
export interface ContextStat extends BaseStat {
  _id: { context: string; };
}

// Interface para o relatório agregado final (v3.4)
export interface AggregatedReport {
    top3: IDailyMetric[];
    bottom3: IDailyMetric[];
    dayOfWeekStats: DayOfWeekStat[];
    durationStats: DurationStat[];
    detailedContentStats: DetailedContentStat[]; // F/P/C stats ENRIQUECIDOS
    proposalStats?: ProposalStat[]; // <-- NOVO: Stats por Proposta ENRIQUECIDOS
    contextStats?: ContextStat[];   // <-- NOVO: Stats por Contexto ENRIQUECIDOS
    overallStats?: OverallStats;
}

// ======================================================================================
// Funções Auxiliares
// ======================================================================================

/** Mapeia o número do dia da semana (0-6) para o nome em português. */
function mapDayOfWeek(dow: number): string {
    const names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return (dow >= 0 && dow <= 6) ? names[dow]! : "Desconhecido";
}

/** Calcula as estatísticas gerais (OverallStats) - já inclui alcance. */
function calculateOverallStats(metrics: IDailyMetric[]): OverallStats | undefined {
    const initial = { totalCurtidas: 0, totalComentarios: 0, totalCompartilhamentos: 0, totalVisualizacoes: 0, totalSalvamentos: 0, totalAlcance: 0, count: 0 };
    const sum = metrics.reduce((acc, metric) => {
        acc.totalCurtidas += metric.stats?.curtidas ?? 0;
        acc.totalComentarios += metric.stats?.comentarios ?? 0;
        acc.totalCompartilhamentos += metric.stats?.compartilhamentos ?? 0;
        acc.totalVisualizacoes += metric.stats?.visualizacoes ?? 0;
        acc.totalSalvamentos += metric.stats?.salvamentos ?? 0;
        acc.totalAlcance += metric.stats?.contasAlcancadas ?? 0;
        acc.count += 1;
        return acc;
    }, initial);
    if (sum.count === 0) return undefined;
    return {
        _id: null, ...sum,
        avgCurtidas: sum.totalCurtidas / sum.count, avgComentarios: sum.totalComentarios / sum.count,
        avgCompartilhamentos: sum.totalCompartilhamentos / sum.count, avgVisualizacoes: sum.totalVisualizacoes / sum.count,
        avgSalvamentos: sum.totalSalvamentos / sum.count, avgAlcance: sum.totalAlcance / sum.count,
    };
}

/** Busca detalhes essenciais de Metrics para enriquecimento - já inclui F/P/C. */
async function fetchMetricDetailsForEnrichment(
    dailyMetrics: IDailyMetric[], metricModel: Model<IMetric>
): Promise<Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>> {
    const postIds = dailyMetrics.map(dm => dm.postId).filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));
    const uniquePostIds = [...new Set(postIds.map(id => id.toString()))].map(idStr => new Types.ObjectId(idStr));
    if (uniquePostIds.length === 0) { logger.debug("[fetchMetricDetailsForEnrichment] Nenhum postId válido."); return new Map(); }
    try {
        const metrics = await metricModel.find({ _id: { $in: uniquePostIds } }).select('_id description postLink format proposal context').lean().exec();
        const map = new Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>();
        metrics.forEach(m => map.set(m._id.toString(), m));
        logger.debug(`[fetchMetricDetailsForEnrichment] Detalhes buscados para ${map.size} Metrics.`);
        return map;
    } catch (error) { logger.error(`[fetchMetricDetailsForEnrichment] Erro:`, error); return new Map(); }
}

// ======================================================================================
// Funções para buscar Stats Detalhados BASE (Agregação MQL)
// ======================================================================================

/** Busca stats BASE agrupados por Formato, Proposta e Contexto. */
async function getDetailedContentStatsBase(
    userId: Types.ObjectId, startDate: Date, dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<DetailedContentStat[]> {
    logger.debug(`[getDetailedContentStatsBase v3.4] Buscando por F/P/C para User ${userId}`);
    const pipeline: any[] = [
        { $match: { user: userId, postDate: { $gte: startDate }, postId: { $exists: true, $ne: null }}},
        { $lookup: { from: metricModel.collection.name, localField: "postId", foreignField: "_id", as: "metricInfo" }},
        { $unwind: { path: "$metricInfo", preserveNullAndEmptyArrays: false }},
        { $group: {
            _id: { format: { $ifNull: ["$metricInfo.format", "Desconhecido"] }, proposal: { $ifNull: ["$metricInfo.proposal", "Outro"] }, context: { $ifNull: ["$metricInfo.context", "Geral"] } },
            avgCompartilhamentos: { $avg: { $ifNull: ["$stats.compartilhamentos", 0] } }, avgSalvamentos: { $avg: { $ifNull: ["$stats.salvamentos", 0] } },
            avgCurtidas: { $avg: { $ifNull: ["$stats.curtidas", 0] } }, avgAlcance: { $avg: { $ifNull: ["$stats.contasAlcancadas", 0] } }, count: { $sum: 1 }
        }},
        { $sort: { count: -1, avgCompartilhamentos: -1 } }
    ];
    try { const results: DetailedContentStat[] = await dailyMetricModel.aggregate(pipeline).exec(); logger.debug(`[getDetailedContentStatsBase v3.4] F/P/C retornou ${results.length} grupos.`); return results; }
    catch (error) { logger.error(`[getDetailedContentStatsBase v3.4] Erro.`, error); throw new DetailedStatsError(`Falha ao agregar por F/P/C para User ${userId}`, error); }
}

/** Busca stats BASE agrupados APENAS por Proposta. */
async function getProposalStatsBase(
    userId: Types.ObjectId, startDate: Date, dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<ProposalStat[]> {
    logger.debug(`[getProposalStatsBase v3.4] Buscando por Proposta para User ${userId}`);
    const pipeline: any[] = [
        { $match: { user: userId, postDate: { $gte: startDate }, postId: { $exists: true, $ne: null }}},
        { $lookup: { from: metricModel.collection.name, localField: "postId", foreignField: "_id", as: "metricInfo" }},
        { $unwind: { path: "$metricInfo", preserveNullAndEmptyArrays: false }},
        { $group: {
            _id: { proposal: { $ifNull: ["$metricInfo.proposal", "Outro"] } },
            avgCompartilhamentos: { $avg: { $ifNull: ["$stats.compartilhamentos", 0] } }, avgSalvamentos: { $avg: { $ifNull: ["$stats.salvamentos", 0] } },
            avgCurtidas: { $avg: { $ifNull: ["$stats.curtidas", 0] } }, avgAlcance: { $avg: { $ifNull: ["$stats.contasAlcancadas", 0] } }, count: { $sum: 1 }
        }},
        { $sort: { count: -1, avgCompartilhamentos: -1 } }
    ];
    try { const results: ProposalStat[] = await dailyMetricModel.aggregate(pipeline).exec(); logger.debug(`[getProposalStatsBase v3.4] Proposta retornou ${results.length} grupos.`); return results; }
    catch (error) { logger.error(`[getProposalStatsBase v3.4] Erro.`, error); throw new DetailedStatsError(`Falha ao agregar por Proposta para User ${userId}`, error); }
}

/** Busca stats BASE agrupados APENAS por Contexto. */
async function getContextStatsBase(
    userId: Types.ObjectId, startDate: Date, dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<ContextStat[]> {
    logger.debug(`[getContextStatsBase v3.4] Buscando por Contexto para User ${userId}`);
    const pipeline: any[] = [
         { $match: { user: userId, postDate: { $gte: startDate }, postId: { $exists: true, $ne: null }}},
         { $lookup: { from: metricModel.collection.name, localField: "postId", foreignField: "_id", as: "metricInfo" }},
         { $unwind: { path: "$metricInfo", preserveNullAndEmptyArrays: false }},
         { $group: {
             _id: { context: { $ifNull: ["$metricInfo.context", "Geral"] } },
             avgCompartilhamentos: { $avg: { $ifNull: ["$stats.compartilhamentos", 0] } }, avgSalvamentos: { $avg: { $ifNull: ["$stats.salvamentos", 0] } },
             avgCurtidas: { $avg: { $ifNull: ["$stats.curtidas", 0] } }, avgAlcance: { $avg: { $ifNull: ["$stats.contasAlcancadas", 0] } }, count: { $sum: 1 }
         }},
         { $sort: { count: -1, avgCompartilhamentos: -1 } }
    ];
    try { const results: ContextStat[] = await dailyMetricModel.aggregate(pipeline).exec(); logger.debug(`[getContextStatsBase v3.4] Contexto retornou ${results.length} grupos.`); return results; }
    catch (error) { logger.error(`[getContextStatsBase v3.4] Erro.`, error); throw new DetailedStatsError(`Falha ao agregar por Contexto para User ${userId}`, error); }
}

// ======================================================================================
// Função Genérica para Enriquecer Stats (Adiciona % e Best Post)
// ======================================================================================

/** Adiciona diferenças percentuais vs geral e o melhor post do grupo. */
function enrichStats<T extends BaseStat>(
    statsBase: T[], overallStats: OverallStats, dailyMetrics: IDailyMetric[],
    metricDetailsMap: Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>,
    groupingType: 'detailed' | 'proposal' | 'context'
): T[] {
    const { avgCompartilhamentos: overallAvgShares = 0, avgSalvamentos: overallAvgSaves = 0, avgAlcance: overallAvgReach = 0 } = overallStats;

    return statsBase.map(statBase => {
        const enrichedStat: T = { ...statBase }; // Copia para não mutar

        // 1. Calcular Percentuais
        if (overallAvgShares > 0) enrichedStat.shareDiffPercentage = ((enrichedStat.avgCompartilhamentos / overallAvgShares) - 1) * 100;
        if (overallAvgSaves > 0) enrichedStat.saveDiffPercentage = ((enrichedStat.avgSalvamentos / overallAvgSaves) - 1) * 100;
        if (overallAvgReach > 0) enrichedStat.reachDiffPercentage = ((enrichedStat.avgAlcance / overallAvgReach) - 1) * 100;

        // 2. Encontrar Best Post In Group
        let bestPost: { _id: Types.ObjectId | null, shares: number, saves: number } = { _id: null, shares: -1, saves: -1 };

        dailyMetrics.forEach(dm => {
            if (!dm.postId) return;
            const metricDetail = metricDetailsMap.get(dm.postId.toString());
            if (!metricDetail) return;

            let match = false;
            const proposalId = (enrichedStat._id as { proposal?: string }).proposal;
            const contextId = (enrichedStat._id as { context?: string }).context;
            const detailedId = (enrichedStat._id as DetailedContentStat['_id']);

            if (groupingType === 'proposal' && proposalId && (metricDetail.proposal ?? 'Outro') === proposalId) match = true;
            else if (groupingType === 'context' && contextId && (metricDetail.context ?? 'Geral') === contextId) match = true;
            else if (groupingType === 'detailed' &&
                     (metricDetail.format ?? 'Desconhecido') === detailedId.format &&
                     (metricDetail.proposal ?? 'Outro') === detailedId.proposal &&
                     (metricDetail.context ?? 'Geral') === detailedId.context) match = true;

            if (match) {
                const currentShares = dm.stats?.compartilhamentos ?? 0;
                const currentSaves = dm.stats?.salvamentos ?? 0;
                if (currentShares > bestPost.shares || (currentShares === bestPost.shares && currentSaves > bestPost.saves)) {
                     bestPost = { _id: dm.postId, shares: currentShares, saves: currentSaves };
                }
            }
        });

        if (bestPost._id) {
            const bestMetricDetails = metricDetailsMap.get(bestPost._id.toString());
            if (bestMetricDetails) {
                enrichedStat.bestPostInGroup = {
                    _id: bestPost._id, description: bestMetricDetails.description, postLink: bestMetricDetails.postLink,
                    shares: bestPost.shares, saves: bestPost.saves
                };
            }
        }
        return enrichedStat;
    });
}


// ======================================================================================
// Função Principal de Agregação e Enriquecimento (v3.4)
// ======================================================================================

/**
 * Gera o relatório agregado principal, incluindo estatísticas ENRIQUECIDAS para
 * F/P/C, Proposta e Contexto.
 */
export async function buildAggregatedReport(
    dailyMetrics: IDailyMetric[], userId: Types.ObjectId, startDate: Date,
    dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<AggregatedReport> {

    // --- Validações ---
    if (!dailyMetricModel?.aggregate || !metricModel?.find || !userId || !startDate) { throw new Error('Input inválido para buildAggregatedReport.'); }
    if (!dailyMetrics || dailyMetrics.length === 0) {
        logger.warn('[buildAggregatedReport v3.4] Array de dailyMetrics vazio.');
        return { top3: [], bottom3: [], dayOfWeekStats: [], durationStats: [], detailedContentStats: [], proposalStats: [], contextStats: [], overallStats: undefined };
    }
    // --- Fim Validações ---

    logger.debug(`[buildAggregatedReport v3.4] Iniciando para ${dailyMetrics.length} métricas. User: ${userId}`);

    let overallStats: OverallStats | undefined;
    let top3: IDailyMetric[] = []; let bottom3: IDailyMetric[] = [];
    let dayOfWeekStats: DayOfWeekStat[] = []; let durationStats: DurationStat[] = [];
    let detailedContentStatsEnriched: DetailedContentStat[] = [];
    let proposalStatsEnriched: ProposalStat[] = [];
    let contextStatsEnriched: ContextStat[] = [];

    // Pré-busca detalhes Metrics
    const metricDetailsMap = await fetchMetricDetailsForEnrichment(dailyMetrics, metricModel);

    try {
        // Calcular Overall Stats
        overallStats = calculateOverallStats(dailyMetrics);
        // ... (Logs e Cálculos de Top/Bottom, DayOfWeek, Duration como antes) ...
        const sortedByShares = [...dailyMetrics].sort((a, b) => (b.stats?.compartilhamentos ?? 0) - (a.stats?.compartilhamentos ?? 0));
        top3 = sortedByShares.slice(0, 3); bottom3 = sortedByShares.slice(-3).reverse();
        const dayMap: { [key: string]: { totalShares: number, count: number } } = {}; const dayOrder = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        dailyMetrics.forEach(metric => { try { if (metric.postDate instanceof Date && !isNaN(metric.postDate.getTime())) { const dayName = mapDayOfWeek(metric.postDate.getUTCDay()); if (!dayMap[dayName]) { dayMap[dayName] = { totalShares: 0, count: 0 }; } dayMap[dayName]!.totalShares += metric.stats?.compartilhamentos ?? 0; dayMap[dayName]!.count += 1; } } catch (e) { /* log */ } });
        dayOfWeekStats = Object.entries(dayMap).map(([dayName, data]) => ({ dayName, averageShares: data.count > 0 ? data.totalShares / data.count : 0, totalPosts: data.count, })).sort((a, b) => dayOrder.indexOf(a.dayName) - dayOrder.indexOf(b.dayName));
        const finalDurations = [ { range: '0-15s', min: 0, max: 15 }, { range: '15-29s', min: 15, max: 29 }, { range: '30-59s', min: 30, max: 59 }, { range: '60s+', min: 60, max: Infinity }, ]; const finalDurationMap = new Map<string, { totalShares: number, totalSaves: number, count: number }>(); finalDurations.forEach(d => { finalDurationMap.set(d.range, { totalShares: 0, totalSaves: 0, count: 0 }); });
        dailyMetrics.forEach(metric => { const duration = metric.stats?.duracao; if (typeof duration === 'number' && isFinite(duration) && duration >= 0) { const foundRange = finalDurations.find(d => duration >= d.min && (duration < d.max || d.max === Infinity)); if (foundRange) { const statsForRange = finalDurationMap.get(foundRange.range); if (statsForRange) { statsForRange.totalShares += metric.stats?.compartilhamentos ?? 0; statsForRange.totalSaves += metric.stats?.salvamentos ?? 0; statsForRange.count += 1; } } } });
        durationStats = finalDurations.map(d => { const stats = finalDurationMap.get(d.range); const count = stats?.count ?? 0; return { range: d.range, contentCount: count, averageShares: count > 0 ? (stats!.totalShares / count) : 0, averageSaves: count > 0 ? (stats!.totalSaves / count) : 0, }; });


        // --- Buscar Stats Detalhados BASE em paralelo ---
        const [detailedStatsResult, proposalStatsResult, contextStatsResult] = await Promise.allSettled([
            getDetailedContentStatsBase(userId, startDate, dailyMetricModel, metricModel),
            getProposalStatsBase(userId, startDate, dailyMetricModel, metricModel),
            getContextStatsBase(userId, startDate, dailyMetricModel, metricModel)
        ]);

        // --- Enriquecer cada conjunto de stats ---
        if (overallStats) {
            if (detailedStatsResult.status === 'fulfilled') {
                detailedContentStatsEnriched = enrichStats(detailedStatsResult.value, overallStats, dailyMetrics, metricDetailsMap, 'detailed');
                detailedContentStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
                logger.debug(`[buildAggregatedReport v3.4] F/P/C enriquecidos: ${detailedContentStatsEnriched.length}.`);
            } else { logger.error(`[buildAggregatedReport v3.4] Falha F/P/C.`, detailedStatsResult.reason); }

            if (proposalStatsResult.status === 'fulfilled') {
                proposalStatsEnriched = enrichStats(proposalStatsResult.value, overallStats, dailyMetrics, metricDetailsMap, 'proposal');
                proposalStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
                logger.debug(`[buildAggregatedReport v3.4] Proposta enriquecidos: ${proposalStatsEnriched.length}.`);
            } else { logger.error(`[buildAggregatedReport v3.4] Falha Proposta.`, proposalStatsResult.reason); }

            if (contextStatsResult.status === 'fulfilled') {
                contextStatsEnriched = enrichStats(contextStatsResult.value, overallStats, dailyMetrics, metricDetailsMap, 'context');
                contextStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
                logger.debug(`[buildAggregatedReport v3.4] Contexto enriquecidos: ${contextStatsEnriched.length}.`);
            } else { logger.error(`[buildAggregatedReport v3.4] Falha Contexto.`, contextStatsResult.reason); }
        } else {
             logger.warn(`[buildAggregatedReport v3.4] OverallStats indisponíveis, pulando enriquecimento.`);
             if (detailedStatsResult.status === 'fulfilled') detailedContentStatsEnriched = detailedStatsResult.value; // Usa base se disponível
             if (proposalStatsResult.status === 'fulfilled') proposalStatsEnriched = proposalStatsResult.value;
             if (contextStatsResult.status === 'fulfilled') contextStatsEnriched = contextStatsResult.value;
        }
        // --- Fim Busca e Enriquecimento ---

        logger.info(`[buildAggregatedReport v3.4] Processo concluído. User: ${userId}.`);

        return { // Retorna o relatório final completo
            top3, bottom3, dayOfWeekStats, durationStats, overallStats,
            detailedContentStats: detailedContentStatsEnriched,
            proposalStats: proposalStatsEnriched,
            contextStats: contextStatsEnriched,
        };

    } catch (error) {
        logger.error(`[buildAggregatedReport v3.4] Erro inesperado no processo geral. User: ${userId}.`, error);
        throw new ReportAggregationError(`Falha no processo geral v3.4. User: ${userId}`, error);
    }
}