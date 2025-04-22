// @/app/lib/reportHelpers.ts - v3.8 (Métricas Agregadas Adicionais)

import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import { Types, Model } from "mongoose";
// Removido import não utilizado de date-fns: formatISO, getDay
import { logger } from '@/app/lib/logger';
import { IMetric } from "@/app/models/Metric"; // Removido import não utilizado: Metric

const TOP_EXAMPLES_PER_GROUP_LIMIT = 3;

// ======================================================================================
// Erros Customizados
// ======================================================================================
class ReportError extends Error {
    // ... (código existente sem alterações) ...
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
// Interfaces Atualizadas (v3.8 - Adiciona Métricas Calculadas Médias)
// ======================================================================================

export interface OverallStats {
  _id: null;
  totalCurtidas: number; totalComentarios: number; totalCompartilhamentos: number;
  totalVisualizacoes: number; totalSalvamentos: number; totalAlcance: number;
  avgCurtidas: number; avgComentarios: number; avgCompartilhamentos: number;
  avgVisualizacoes: number; avgSalvamentos: number; avgAlcance: number;
  // --- ADICIONADO v3.8: Médias gerais de métricas calculadas ---
  avgEngagementRate?: number; // Média da taxa de engajamento (calculada no DailyMetric)
  avgRetentionRate?: number; // Média da taxa de retenção (calculada no DailyMetric)
  avgReachFollowerRatio?: number; // Média da proporção de alcance em seguidores
  avgReachNonFollowerRatio?: number; // Média da proporção de alcance em não-seguidores
  // --- FIM ADIÇÃO ---
  count: number;
}

export interface DayOfWeekStat {
    dayName: string; averageShares: number; totalPosts: number;
}

export interface DurationStat {
    range: string; contentCount: number; averageShares: number; averageSaves?: number;
    // --- ADICIONADO v3.8: Métricas por Duração ---
    averageRetentionRate?: number; // Retenção média para vídeos nessa faixa de duração
    // --- FIM ADIÇÃO ---
}

// Interface BASE comum para enriquecimento (ATUALIZADA v3.8)
export interface BaseStat {
    _id: object;
    avgCompartilhamentos: number;
    avgSalvamentos: number;
    avgCurtidas: number;
    avgAlcance: number;
    avgComentarios: number;
    avgVisualizacoes?: number; // Já existia
    count: number;
    // --- ADICIONADO v3.8: Médias de métricas calculadas por grupo ---
    avgEngagementRate?: number;
    avgRetentionRate?: number;
    avgReachFollowerRatio?: number;
    avgReachNonFollowerRatio?: number;
    // --- FIM ADIÇÃO ---
    // Campos de enriquecimento existentes
    shareDiffPercentage?: number | null;
    saveDiffPercentage?: number | null;
    reachDiffPercentage?: number | null;
    commentDiffPercentage?: number | null;
    likeDiffPercentage?: number | null;
    bestPostInGroup?: { _id: Types.ObjectId; description?: string; postLink?: string; shares?: number; saves?: number; };
}

export interface StatId {
  format?: string;
  proposal?: string;
  context?: string;
}

// Interface Detalhada (F/P/C) - Herda BaseStat atualizada
export interface DetailedContentStat extends BaseStat {
  _id: { format: string; proposal: string; context: string; };
  topExamplesInGroup?: {
      _id: Types.ObjectId;
      description?: string;
      postLink?: string;
  }[];
}

// Interface para Stats por Proposta - Herda BaseStat atualizada
export interface ProposalStat extends BaseStat {
  _id: { proposal: string; };
}

// Interface para Stats por Contexto - Herda BaseStat atualizada
export interface ContextStat extends BaseStat {
  _id: { context: string; };
}

// Interfaces para Agregação Dia/Proposta/Contexto (ATUALIZADAS v3.8)
export interface DayPCOPerformanceStats {
    avgCompartilhamentos?: number;
    avgSalvamentos?: number;
    avgAlcance?: number;
    avgComentarios?: number;
    avgCurtidas?: number;
    avgVisualizacoes?: number;
    // --- ADICIONADO v3.8 ---
    avgEngagementRate?: number;
    avgRetentionRate?: number;
    avgReachFollowerRatio?: number;
    avgReachNonFollowerRatio?: number;
    // --- FIM ADIÇÃO ---
    count: number;
}
export interface PerformanceByContextDay {
    [context: string]: DayPCOPerformanceStats;
}
export interface PerformanceByProposalDay {
    [proposal: string]: PerformanceByContextDay;
}
export interface PerformanceByDayPCO {
    [dayOfWeek: number]: PerformanceByProposalDay;
}


// Interface para o relatório agregado final (ATUALIZADA v3.8)
export interface AggregatedReport {
    top3: IDailyMetric[]; // Posts com mais shares
    bottom3: IDailyMetric[]; // Posts com menos shares
    dayOfWeekStats: DayOfWeekStat[];
    durationStats: DurationStat[]; // Inclui agora avgRetentionRate por duração
    detailedContentStats: DetailedContentStat[]; // Inclui novas métricas médias
    proposalStats?: ProposalStat[]; // Inclui novas métricas médias
    contextStats?: ContextStat[]; // Inclui novas métricas médias
    overallStats?: OverallStats; // Inclui novas métricas médias gerais
    performanceByDayPCO?: PerformanceByDayPCO; // Inclui novas métricas médias
}

// ======================================================================================
// Funções Auxiliares
// ======================================================================================

/** Mapeia o número do dia da semana (0-6) para o nome em português. */
function mapDayOfWeek(dow: number): string {
    // ... (código existente sem alterações) ...
    const names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return (dow >= 0 && dow <= 6) ? names[dow]! : "Desconhecido";
}

/** Calcula as estatísticas gerais (OverallStats) - ATUALIZADO v3.8 */
function calculateOverallStats(metrics: IDailyMetric[]): OverallStats | undefined {
    const initial = {
        totalCurtidas: 0, totalComentarios: 0, totalCompartilhamentos: 0,
        totalVisualizacoes: 0, totalSalvamentos: 0, totalAlcance: 0,
        // --- ADICIONADO v3.8: Acumuladores para médias ---
        totalEngagementRateSum: 0, engagementRateCount: 0,
        totalRetentionRateSum: 0, retentionRateCount: 0,
        totalReachFollowerRatioSum: 0, reachFollowerRatioCount: 0,
        totalReachNonFollowerRatioSum: 0, reachNonFollowerRatioCount: 0,
        // --- FIM ADIÇÃO ---
        count: 0
    };

    const sum = metrics.reduce((acc, metric) => {
        acc.totalCurtidas += metric.stats?.curtidas ?? 0;
        acc.totalComentarios += metric.stats?.comentarios ?? 0;
        acc.totalCompartilhamentos += metric.stats?.compartilhamentos ?? 0;
        acc.totalVisualizacoes += metric.stats?.visualizacoes ?? 0;
        acc.totalSalvamentos += metric.stats?.salvamentos ?? 0;
        acc.totalAlcance += metric.stats?.contasAlcancadas ?? 0;
        acc.count += 1;

        // --- ADICIONADO v3.8: Soma para cálculo das médias ---
        if (typeof metric.stats?.taxaEngajamento === 'number') {
            acc.totalEngagementRateSum += metric.stats.taxaEngajamento;
            acc.engagementRateCount += 1;
        }
        if (typeof metric.stats?.taxaRetencao === 'number') {
            acc.totalRetentionRateSum += metric.stats.taxaRetencao;
            acc.retentionRateCount += 1;
        }
        // Calcula proporções apenas se alcance > 0
        const alcance = metric.stats?.contasAlcancadas ?? 0;
        if (alcance > 0) {
            const segReach = metric.stats?.contasAlcancadasSeguidores ?? 0;
            const nonSegReach = metric.stats?.contasAlcancadasNaoSeguidores ?? 0; // Pode ser calculado ou vir direto
            // Garante que estamos usando números válidos
            if (typeof segReach === 'number') {
                 acc.totalReachFollowerRatioSum += (segReach / alcance);
                 acc.reachFollowerRatioCount += 1;
            }
             // Calcula não seguidor se não vier pronto (ou usa o campo se existir)
             const nonSegRatio = (typeof nonSegReach === 'number' && nonSegReach > 0)
                               ? (nonSegReach / alcance)
                               : (1 - (segReach / alcance)); // Calcula a diferença
             if (isFinite(nonSegRatio)) { // Checa se o cálculo é válido
                 acc.totalReachNonFollowerRatioSum += nonSegRatio;
                 acc.reachNonFollowerRatioCount += 1; // Conta mesmo se for calculado
             }
        }
        // --- FIM ADIÇÃO ---

        return acc;
    }, initial);

    if (sum.count === 0) return undefined;

    return {
        _id: null,
        totalCurtidas: sum.totalCurtidas, totalComentarios: sum.totalComentarios,
        totalCompartilhamentos: sum.totalCompartilhamentos, totalVisualizacoes: sum.totalVisualizacoes,
        totalSalvamentos: sum.totalSalvamentos, totalAlcance: sum.totalAlcance,
        avgCurtidas: sum.totalCurtidas / sum.count,
        avgComentarios: sum.totalComentarios / sum.count,
        avgCompartilhamentos: sum.totalCompartilhamentos / sum.count,
        avgVisualizacoes: sum.totalVisualizacoes / sum.count,
        avgSalvamentos: sum.totalSalvamentos / sum.count,
        avgAlcance: sum.totalAlcance / sum.count,
        // --- ADICIONADO v3.8: Cálculo das médias ---
        avgEngagementRate: sum.engagementRateCount > 0 ? sum.totalEngagementRateSum / sum.engagementRateCount : undefined,
        avgRetentionRate: sum.retentionRateCount > 0 ? sum.totalRetentionRateSum / sum.retentionRateCount : undefined,
        avgReachFollowerRatio: sum.reachFollowerRatioCount > 0 ? sum.totalReachFollowerRatioSum / sum.reachFollowerRatioCount : undefined,
        avgReachNonFollowerRatio: sum.reachNonFollowerRatioCount > 0 ? sum.totalReachNonFollowerRatioSum / sum.reachNonFollowerRatioCount : undefined,
        // --- FIM ADIÇÃO ---
        count: sum.count,
    };
}


/** Busca detalhes essenciais de Metrics para enriquecimento. */
async function fetchMetricDetailsForEnrichment(
    dailyMetrics: IDailyMetric[], metricModel: Model<IMetric>
): Promise<Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>> {
   // ... (código existente sem alterações) ...
    const postIds = dailyMetrics.map(dm => dm.postId).filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));
    const uniquePostIds = [...new Set(postIds.map(id => id.toString()))].map(idStr => new Types.ObjectId(idStr));
    if (uniquePostIds.length === 0) { logger.debug("[fetchMetricDetailsForEnrichment] Nenhum postId válido."); return new Map(); }
    try {
        const metrics = await metricModel.find({ _id: { $in: uniquePostIds } })
            .select('_id description postLink format proposal context')
            .lean().exec();
        const map = new Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>();
        metrics.forEach(m => map.set(m._id.toString(), m));
        logger.debug(`[fetchMetricDetailsForEnrichment] Detalhes buscados para ${map.size} Metrics.`);
        return map;
    } catch (error) { logger.error(`[fetchMetricDetailsForEnrichment] Erro:`, error); return new Map(); }
}

// ======================================================================================
// Funções para buscar Stats Detalhados BASE (Agregação MQL) - ATUALIZADAS v3.8
// ======================================================================================

// --- Função Auxiliar para adicionar cálculos de média comuns ---
function addCommonAveragesToGroupStage(groupStage: any): any {
    // Médias básicas existentes
    groupStage.$group.avgCompartilhamentos = { $avg: { $ifNull: ["$stats.compartilhamentos", 0] } };
    groupStage.$group.avgSalvamentos = { $avg: { $ifNull: ["$stats.salvamentos", 0] } };
    groupStage.$group.avgCurtidas = { $avg: { $ifNull: ["$stats.curtidas", 0] } };
    groupStage.$group.avgComentarios = { $avg: { $ifNull: ["$stats.comentarios", 0] } };
    groupStage.$group.avgAlcance = { $avg: { $ifNull: ["$stats.contasAlcancadas", 0] } };
    groupStage.$group.avgVisualizacoes = { $avg: { $ifNull: ["$stats.visualizacoes", 0] } };

    // --- ADICIONADO v3.8: Novas médias ---
    groupStage.$group.avgEngagementRate = { $avg: { $ifNull: ["$stats.taxaEngajamento", 0] } };
    groupStage.$group.avgRetentionRate = { $avg: { $ifNull: ["$stats.taxaRetencao", 0] } };
    // Média da proporção de alcance em seguidores (evita divisão por zero)
    groupStage.$group.avgReachFollowerRatio = {
        $avg: {
            $divide: [
                { $ifNull: ["$stats.contasAlcancadasSeguidores", 0] },
                // Garante que o denominador seja no mínimo 1 para evitar erro
                { $max: [{ $ifNull: ["$stats.contasAlcancadas", 0] }, 1] }
            ]
        }
    };
     // Média da proporção de alcance em não-seguidores (calculado se não existir)
     groupStage.$group.avgReachNonFollowerRatio = {
         $avg: {
             $let: {
                 vars: {
                     alcanceTotal: { $ifNull: ["$stats.contasAlcancadas", 0] },
                     alcanceSeg: { $ifNull: ["$stats.contasAlcancadasSeguidores", 0] },
                     // Usa o campo direto se existir, senão calcula
                     alcanceNaoSegDireto: { $ifNull: ["$stats.contasAlcancadasNaoSeguidores", null] }
                 },
                 in: {
                     $cond: [
                         // Se alcanceTotal for 0, a proporção é 0
                         { $eq: ["$$alcanceTotal", 0] },
                         0,
                         {
                             $divide: [
                                 // Se alcanceNaoSegDireto existe e é número, usa ele
                                 { $cond: [
                                     { $ne: ["$$alcanceNaoSegDireto", null] },
                                     "$$alcanceNaoSegDireto",
                                     // Senão, calcula (AlcanceTotal - AlcanceSeg)
                                     { $max: [ { $subtract: ["$$alcanceTotal", "$$alcanceSeg"] }, 0 ] } // Garante não ser negativo
                                 ]},
                                 // Garante denominador >= 1
                                 { $max: ["$$alcanceTotal", 1] }
                             ]
                         }
                     ]
                 }
             }
         }
     };
    // --- FIM ADIÇÃO ---

    groupStage.$group.count = { $sum: 1 };
    return groupStage;
}


/** Busca stats BASE agrupados por Formato, Proposta e Contexto. (ATUALIZADO v3.8) */
async function getDetailedContentStatsBase(
    userId: Types.ObjectId, startDate: Date, dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<DetailedContentStat[]> {
    const fnTag = '[getDetailedContentStatsBase v3.8]';
    logger.debug(`${fnTag} Buscando por F/P/C para User ${userId}`);
    const pipeline: any[] = [
        { $match: { user: userId, postDate: { $gte: startDate }, postId: { $exists: true, $ne: null }}},
        { $lookup: { from: metricModel.collection.name, localField: "postId", foreignField: "_id", as: "metricInfo" }},
        { $unwind: { path: "$metricInfo", preserveNullAndEmptyArrays: false }},
        addCommonAveragesToGroupStage({ // Usa a função auxiliar
            $group: {
                _id: {
                    format: { $ifNull: ["$metricInfo.format", "Desconhecido"] },
                    proposal: { $ifNull: ["$metricInfo.proposal", "Outro"] },
                    context: { $ifNull: ["$metricInfo.context", "Geral"] }
                },
                // Médias serão adicionadas pela função auxiliar
            }
        }),
        { $sort: { count: -1, avgCompartilhamentos: -1 } } // Mantém ordenação original
    ];
    try {
        // O tipo de retorno agora inclui os novos campos opcionais
        const results: DetailedContentStat[] = await dailyMetricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} F/P/C retornou ${results.length} grupos.`);
        return results; // Não precisa mais de Omit ou casting
     }
    catch (error) { logger.error(`${fnTag} Erro.`, error); throw new DetailedStatsError(`Falha ao agregar por F/P/C para User ${userId}`, error); }
}

/** Busca stats BASE agrupados APENAS por Proposta. (ATUALIZADO v3.8) */
async function getProposalStatsBase(
    userId: Types.ObjectId, startDate: Date, dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<ProposalStat[]> {
    const fnTag = '[getProposalStatsBase v3.8]';
    logger.debug(`${fnTag} Buscando por Proposta para User ${userId}`);
    const pipeline: any[] = [
        { $match: { user: userId, postDate: { $gte: startDate }, postId: { $exists: true, $ne: null }}},
        { $lookup: { from: metricModel.collection.name, localField: "postId", foreignField: "_id", as: "metricInfo" }},
        { $unwind: { path: "$metricInfo", preserveNullAndEmptyArrays: false }},
         addCommonAveragesToGroupStage({ // Usa a função auxiliar
            $group: {
                _id: { proposal: { $ifNull: ["$metricInfo.proposal", "Outro"] } },
                 // Médias serão adicionadas pela função auxiliar
            }
        }),
        { $sort: { count: -1, avgCompartilhamentos: -1 } }
    ];
    try {
        const results: ProposalStat[] = await dailyMetricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} Proposta retornou ${results.length} grupos.`);
        return results;
    }
    catch (error) { logger.error(`${fnTag} Erro.`, error); throw new DetailedStatsError(`Falha ao agregar por Proposta para User ${userId}`, error); }
}

/** Busca stats BASE agrupados APENAS por Contexto. (ATUALIZADO v3.8) */
async function getContextStatsBase(
    userId: Types.ObjectId, startDate: Date, dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<ContextStat[]> {
    const fnTag = '[getContextStatsBase v3.8]';
    logger.debug(`${fnTag} Buscando por Contexto para User ${userId}`);
    const pipeline: any[] = [
         { $match: { user: userId, postDate: { $gte: startDate }, postId: { $exists: true, $ne: null }}},
         { $lookup: { from: metricModel.collection.name, localField: "postId", foreignField: "_id", as: "metricInfo" }},
         { $unwind: { path: "$metricInfo", preserveNullAndEmptyArrays: false }},
          addCommonAveragesToGroupStage({ // Usa a função auxiliar
            $group: {
                _id: { context: { $ifNull: ["$metricInfo.context", "Geral"] } },
                 // Médias serão adicionadas pela função auxiliar
            }
        }),
         { $sort: { count: -1, avgCompartilhamentos: -1 } }
    ];
    try {
        const results: ContextStat[] = await dailyMetricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} Contexto retornou ${results.length} grupos.`);
        return results;
     }
    catch (error) { logger.error(`${fnTag} Erro.`, error); throw new DetailedStatsError(`Falha ao agregar por Contexto para User ${userId}`, error); }
}

// ======================================================================================
// Agregação Dia/Proposta/Contexto (ATUALIZADO v3.8)
// ======================================================================================

/**
 * Busca e processa estatísticas agrupadas por Dia da Semana, Proposta e Contexto.
 */
async function getDayPCOStatsBase(
    userId: Types.ObjectId, startDate: Date, dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<PerformanceByDayPCO> {
    const fnTag = "[getDayPCOStatsBase v1.1]"; // Incrementa versão interna
    logger.debug(`${fnTag} Buscando por Dia/P/C para User ${userId}`);

    const pipeline: any[] = [
        { $match: { user: userId, postDate: { $gte: startDate }, postId: { $exists: true, $ne: null } } },
        { $addFields: { dayOfWeek: { $subtract: [ { $dayOfWeek: "$postDate" }, 1 ] } } },
        { $lookup: { from: metricModel.collection.name, localField: "postId", foreignField: "_id", as: "metricInfo" } },
        { $unwind: { path: "$metricInfo", preserveNullAndEmptyArrays: false } },
        // --- ADICIONADO v3.8: Usa a função auxiliar para adicionar todas as médias ---
        addCommonAveragesToGroupStage({
            $group: {
                _id: {
                  dayOfWeek: "$dayOfWeek",
                  proposal: { $ifNull: ["$metricInfo.proposal", "Outro"] },
                  context: { $ifNull: ["$metricInfo.context", "Geral"] }
                },
                // Médias serão adicionadas aqui
            }
        })
        // --- FIM ADIÇÃO ---
    ];

    try {
        const aggregationResults: (BaseStat & { _id: { dayOfWeek: number; proposal: string; context: string; } })[] = await dailyMetricModel.aggregate(pipeline).exec();
        logger.debug(`${fnTag} Agregação Dia/P/C retornou ${aggregationResults.length} resultados brutos.`);

        const performanceByDayPCO: PerformanceByDayPCO = {};

        for (const result of aggregationResults) {
            const { dayOfWeek, proposal, context } = result._id;

            if (typeof dayOfWeek !== 'number' || dayOfWeek < 0 || dayOfWeek > 6) {
                logger.warn(`${fnTag} Resultado com dayOfWeek inválido:`, result._id);
                continue;
            }

            if (!performanceByDayPCO[dayOfWeek]) {
                performanceByDayPCO[dayOfWeek] = {};
            }
            if (!performanceByDayPCO[dayOfWeek]![proposal]) {
                performanceByDayPCO[dayOfWeek]![proposal] = {};
            }

            // Atribui TODAS as stats calculadas (incluindo as novas)
            performanceByDayPCO[dayOfWeek]![proposal]![context] = {
                avgCompartilhamentos: result.avgCompartilhamentos,
                avgSalvamentos: result.avgSalvamentos,
                avgAlcance: result.avgAlcance,
                avgComentarios: result.avgComentarios,
                avgCurtidas: result.avgCurtidas,
                avgVisualizacoes: result.avgVisualizacoes,
                // --- ADICIONADO v3.8 ---
                avgEngagementRate: result.avgEngagementRate,
                avgRetentionRate: result.avgRetentionRate,
                avgReachFollowerRatio: result.avgReachFollowerRatio,
                avgReachNonFollowerRatio: result.avgReachNonFollowerRatio,
                // --- FIM ADIÇÃO ---
                count: result.count
            };
        }

        logger.debug(`${fnTag} Estrutura PerformanceByDayPCO processada.`);
        return performanceByDayPCO;

     } catch (error) {
        logger.error(`${fnTag} Erro durante agregação ou processamento Dia/P/C.`, error);
        throw new DetailedStatsError(`Falha ao agregar por Dia/P/C para User ${userId}`, error);
     }
}

// ======================================================================================
// Função Genérica para Enriquecer Stats (ATUALIZADA v3.8)
// ======================================================================================

/** Adiciona diferenças percentuais vs geral e os TOP N posts de exemplo do grupo. */
function enrichStats<T extends BaseStat>(
    statsBase: T[],
    overallStats: OverallStats | undefined,
    dailyMetrics: IDailyMetric[],
    metricDetailsMap: Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>,
    groupingType: 'detailed' | 'proposal' | 'context'
): T[] {
    // --- ATUALIZADO v3.8: Lida com overallStats ausente de forma mais robusta ---
    if (!overallStats) {
        logger.warn("[enrichStats v3.8] OverallStats não disponíveis, pulando cálculo de DiffPercentages.");
        // Se for 'detailed', ainda tenta adicionar exemplos
        if (groupingType === 'detailed') {
             return addTopExamplesOnly(statsBase as DetailedContentStat[], dailyMetrics, metricDetailsMap) as T[];
        }
        // Para outros tipos, retorna como está se não há overallStats
        return statsBase;
    }
    // --- FIM ATUALIZAÇÃO ---

    // Desestruturação segura com defaults
    const {
        avgCompartilhamentos: overallAvgShares = 0,
        avgSalvamentos: overallAvgSaves = 0,
        avgAlcance: overallAvgReach = 0,
        avgComentarios: overallAvgComments = 0,
        avgCurtidas: overallAvgLikes = 0
        // Não precisamos das novas médias gerais (avgRetentionRate, etc.) aqui,
        // pois a comparação percentual é feita apenas para as métricas básicas.
    } = overallStats;

    // logger.debug(`[enrichStats v3.8] Médias Gerais para Cálculo de Diff: ...`); // Log pode ser simplificado

    return statsBase.map(statBase => {
        // Cria cópia segura
        const enrichedStat = { ...statBase };

        // 1. Calcular Percentuais (lógica existente mantida)
        enrichedStat.shareDiffPercentage = (overallAvgShares > 0) ? ((enrichedStat.avgCompartilhamentos / overallAvgShares) - 1) * 100 : null;
        enrichedStat.saveDiffPercentage = (overallAvgSaves > 0) ? ((enrichedStat.avgSalvamentos / overallAvgSaves) - 1) * 100 : null;
        enrichedStat.reachDiffPercentage = (overallAvgReach > 0) ? ((enrichedStat.avgAlcance / overallAvgReach) - 1) * 100 : null;
        enrichedStat.commentDiffPercentage = (overallAvgComments > 0 && enrichedStat.avgComentarios != null) ? ((enrichedStat.avgComentarios / overallAvgComments) - 1) * 100 : null;
        enrichedStat.likeDiffPercentage = (overallAvgLikes > 0 && enrichedStat.avgCurtidas != null) ? ((enrichedStat.avgCurtidas / overallAvgLikes) - 1) * 100 : null;

        // 2. Encontrar e Processar Top N exemplos (APENAS para 'detailed')
        if (groupingType === 'detailed') {
            const detailedStat = enrichedStat as DetailedContentStat; // Cast seguro
            // Lógica de encontrar exemplos mantida...
            // ... (código existente sem alterações) ...
            let groupCandidates: { dm: IDailyMetric, metricDetail: Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'> }[] = [];
            const detailedId = detailedStat._id as DetailedContentStat['_id']; // ID detalhado
            dailyMetrics.forEach(dm => {
                if (!dm.postId) return;
                const metricDetail = metricDetailsMap.get(dm.postId.toString());
                if (!metricDetail) return;
                // Compara com os campos do _id detalhado
                if ((metricDetail.format ?? 'Desconhecido') === detailedId.format &&
                    (metricDetail.proposal ?? 'Outro') === detailedId.proposal &&
                    (metricDetail.context ?? 'Geral') === detailedId.context)
                { groupCandidates.push({ dm, metricDetail }); }
            });
            groupCandidates.sort((a, b) =>
                (b.dm.stats?.compartilhamentos ?? 0) - (a.dm.stats?.compartilhamentos ?? 0) ||
                (b.dm.stats?.salvamentos ?? 0) - (a.dm.stats?.salvamentos ?? 0)
            );
            const topNCandidates = groupCandidates.slice(0, TOP_EXAMPLES_PER_GROUP_LIMIT);
            detailedStat.topExamplesInGroup = topNCandidates.map(candidate => ({
                _id: candidate.metricDetail._id,
                description: candidate.metricDetail.description ?? undefined,
                postLink: (candidate.metricDetail.postLink && candidate.metricDetail.postLink.startsWith('http')) ? candidate.metricDetail.postLink : undefined
            })).filter(example => example._id); // Garante que _id existe
            const bestCandidate = topNCandidates[0];
            if (bestCandidate) {
                detailedStat.bestPostInGroup = {
                    _id: bestCandidate.metricDetail._id,
                    description: bestCandidate.metricDetail.description ?? undefined,
                    postLink: (bestCandidate.metricDetail.postLink && bestCandidate.metricDetail.postLink.startsWith('http')) ? bestCandidate.metricDetail.postLink : undefined,
                    shares: bestCandidate.dm.stats?.compartilhamentos,
                    saves: bestCandidate.dm.stats?.salvamentos
                };
            } else { detailedStat.bestPostInGroup = undefined; }
        }

        return enrichedStat;
    });
}

// Função auxiliar separada para adicionar apenas TopExamples (caso OverallStats falhe)
function addTopExamplesOnly(
    statsBase: DetailedContentStat[],
    dailyMetrics: IDailyMetric[],
    metricDetailsMap: Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>
): DetailedContentStat[] {
     // ... (código existente sem alterações) ...
     logger.debug("[addTopExamplesOnly v3.8] Adicionando apenas Top N exemplos pois OverallStats estão ausentes.");
     return statsBase.map(statBase => {
         const enrichedStat = { ...statBase };
         let groupCandidates: { dm: IDailyMetric, metricDetail: Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'> }[] = [];
         const detailedId = enrichedStat._id; // ID já está no formato correto { format, proposal, context }
         dailyMetrics.forEach(dm => {
             if (!dm.postId) return;
             const metricDetail = metricDetailsMap.get(dm.postId.toString());
             if (!metricDetail) return;
             if ((metricDetail.format ?? 'Desconhecido') === detailedId.format &&
                 (metricDetail.proposal ?? 'Outro') === detailedId.proposal &&
                 (metricDetail.context ?? 'Geral') === detailedId.context)
             { groupCandidates.push({ dm, metricDetail }); }
         });
         groupCandidates.sort((a, b) =>
             (b.dm.stats?.compartilhamentos ?? 0) - (a.dm.stats?.compartilhamentos ?? 0) ||
             (b.dm.stats?.salvamentos ?? 0) - (a.dm.stats?.salvamentos ?? 0)
         );
         const topNCandidates = groupCandidates.slice(0, TOP_EXAMPLES_PER_GROUP_LIMIT);
         enrichedStat.topExamplesInGroup = topNCandidates.map(candidate => ({
             _id: candidate.metricDetail._id,
             description: candidate.metricDetail.description ?? undefined,
             postLink: (candidate.metricDetail.postLink && candidate.metricDetail.postLink.startsWith('http')) ? candidate.metricDetail.postLink : undefined
         })).filter(example => example._id);
         const bestCandidate = topNCandidates[0];
         if (bestCandidate) {
             enrichedStat.bestPostInGroup = {
                 _id: bestCandidate.metricDetail._id,
                 description: bestCandidate.metricDetail.description ?? undefined,
                 postLink: (bestCandidate.metricDetail.postLink && bestCandidate.metricDetail.postLink.startsWith('http')) ? bestCandidate.metricDetail.postLink : undefined,
                 shares: bestCandidate.dm.stats?.compartilhamentos,
                 saves: bestCandidate.dm.stats?.salvamentos
             };
         } else { enrichedStat.bestPostInGroup = undefined; }
         return enrichedStat;
     });
}


// ======================================================================================
// Função Principal de Agregação e Enriquecimento (ATUALIZADA v3.8)
// ======================================================================================

/**
 * Gera o relatório agregado principal, incluindo estatísticas ENRIQUECIDAS (com novas médias)
 * e a agregação por Dia/Proposta/Contexto (também com novas médias).
 */
export async function buildAggregatedReport(
    dailyMetrics: IDailyMetric[], userId: Types.ObjectId, startDate: Date,
    dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<AggregatedReport> {

    const fnTag = '[buildAggregatedReport v3.8]'; // Atualiza versão

    if (!dailyMetricModel?.aggregate || !metricModel?.find || !userId || !startDate) {
        throw new Error('Input inválido para buildAggregatedReport.');
    }
    if (!dailyMetrics || dailyMetrics.length === 0) {
        logger.warn(`${fnTag} Array de dailyMetrics vazio.`);
        // Retorna estrutura vazia compatível com AggregatedReport
        return { top3: [], bottom3: [], dayOfWeekStats: [], durationStats: [], detailedContentStats: [], proposalStats: [], contextStats: [], overallStats: undefined, performanceByDayPCO: undefined };
    }

    logger.debug(`${fnTag} Iniciando para ${dailyMetrics.length} métricas. User: ${userId}`);

    let overallStats: OverallStats | undefined;
    let top3: IDailyMetric[] = []; let bottom3: IDailyMetric[] = [];
    let dayOfWeekStats: DayOfWeekStat[] = []; let durationStats: DurationStat[] = [];
    let detailedContentStatsEnriched: DetailedContentStat[] = [];
    let proposalStatsEnriched: ProposalStat[] = [];
    let contextStatsEnriched: ContextStat[] = [];
    let performanceByDayPCOData: PerformanceByDayPCO | undefined = undefined;

    // Pré-busca detalhes Metrics (mantido)
    const metricDetailsMap = await fetchMetricDetailsForEnrichment(dailyMetrics, metricModel);

    try {
        // Calcular Overall Stats (agora inclui novas médias gerais)
        overallStats = calculateOverallStats(dailyMetrics);

        // Cálculos simples (top/bottom, dayOfWeek - mantidos)
        // Ordena por compartilhamentos para top/bottom 3
        const sortedByShares = [...dailyMetrics]
            .filter(m => typeof m.stats?.compartilhamentos === 'number') // Garante que temos o número
            .sort((a, b) => (b.stats!.compartilhamentos!) - (a.stats!.compartilhamentos!));
        top3 = sortedByShares.slice(0, 3);
        bottom3 = sortedByShares.slice(-3).reverse(); // Pega os últimos 3 e inverte

        const dayMap: { [key: string]: { totalShares: number, count: number } } = {};
        const dayOrder = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        dailyMetrics.forEach(metric => {
            // Validação robusta da data
            if (metric.postDate instanceof Date && !isNaN(metric.postDate.getTime())) {
                try {
                    // Usar getUTCDay para consistência, mas mapDayOfWeek já lida com 0-6
                    const dayName = mapDayOfWeek(metric.postDate.getUTCDay());
                    if (!dayMap[dayName]) { dayMap[dayName] = { totalShares: 0, count: 0 }; }
                    dayMap[dayName]!.totalShares += metric.stats?.compartilhamentos ?? 0;
                    dayMap[dayName]!.count += 1;
                } catch (e) {
                    logger.warn(`${fnTag} Erro ao processar dia da semana para métrica:`, metric._id, e);
                }
            }
        });
        dayOfWeekStats = Object.entries(dayMap).map(([dayName, data]) => ({
            dayName,
            averageShares: data.count > 0 ? data.totalShares / data.count : 0,
            totalPosts: data.count,
        })).sort((a, b) => dayOrder.indexOf(a.dayName) - dayOrder.indexOf(b.dayName));


        // --- ATUALIZADO v3.8: Cálculo de Duration Stats ---
        // Inclui agora cálculo de averageRetentionRate por faixa de duração
        const finalDurations = [
            { range: '0-15s', min: 0, max: 15 },
            { range: '15-29s', min: 15, max: 29 },
            { range: '30-59s', min: 30, max: 59 },
            { range: '60s+', min: 60, max: Infinity },
        ];
        // Acumuladores por faixa
        const durationAccumulators = new Map<string, {
            totalShares: number; totalSaves: number; count: number;
            totalRetentionRate: number; retentionCount: number; // Novos acumuladores
        }>();
        finalDurations.forEach(d => {
            durationAccumulators.set(d.range, {
                totalShares: 0, totalSaves: 0, count: 0,
                totalRetentionRate: 0, retentionCount: 0 // Inicializa novos
            });
        });

        dailyMetrics.forEach(metric => {
            const duration = metric.stats?.duracao;
            // Processa apenas se duração for um número válido
            if (typeof duration === 'number' && isFinite(duration) && duration >= 0) {
                const foundRange = finalDurations.find(d => duration >= d.min && (duration < d.max || d.max === Infinity));
                if (foundRange) {
                    const statsForRange = durationAccumulators.get(foundRange.range);
                    if (statsForRange) {
                        statsForRange.totalShares += metric.stats?.compartilhamentos ?? 0;
                        statsForRange.totalSaves += metric.stats?.salvamentos ?? 0;
                        statsForRange.count += 1;
                        // Acumula taxa de retenção se for um número válido
                        const retention = metric.stats?.taxaRetencao;
                        if (typeof retention === 'number' && isFinite(retention)) {
                            statsForRange.totalRetentionRate += retention;
                            statsForRange.retentionCount += 1;
                        }
                    }
                }
            }
        });

        // Calcula as médias finais por faixa de duração
        durationStats = finalDurations.map(d => {
            const stats = durationAccumulators.get(d.range);
            const count = stats?.count ?? 0;
            const retentionCount = stats?.retentionCount ?? 0;
            return {
                range: d.range,
                contentCount: count,
                averageShares: count > 0 ? (stats!.totalShares / count) : 0,
                averageSaves: count > 0 ? (stats!.totalSaves / count) : 0,
                // Calcula a retenção média para a faixa
                averageRetentionRate: retentionCount > 0 ? (stats!.totalRetentionRate / retentionCount) : undefined,
            };
        });
        // --- FIM ATUALIZAÇÃO Duration Stats ---


        // --- Buscar Stats Detalhados BASE e Dia/P/C em paralelo (já incluem novas médias) ---
        const [detailedStatsResult, proposalStatsResult, contextStatsResult, dayPCOStatsResult] = await Promise.allSettled([
            getDetailedContentStatsBase(userId, startDate, dailyMetricModel, metricModel),
            getProposalStatsBase(userId, startDate, dailyMetricModel, metricModel),
            getContextStatsBase(userId, startDate, dailyMetricModel, metricModel),
            getDayPCOStatsBase(userId, startDate, dailyMetricModel, metricModel)
        ]);

        // --- Enriquecer cada conjunto de stats (adiciona diff% e exemplos) ---
        // A função enrichStats não precisa mudar, pois ela opera sobre BaseStat que já foi atualizada
        if (detailedStatsResult.status === 'fulfilled') {
            detailedContentStatsEnriched = enrichStats(detailedStatsResult.value, overallStats, dailyMetrics, metricDetailsMap, 'detailed');
            detailedContentStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
            logger.debug(`${fnTag} F/P/C enriquecidos: ${detailedContentStatsEnriched.length}.`);
        } else { logger.error(`${fnTag} Falha F/P/C.`, detailedStatsResult.reason); }

        if (proposalStatsResult.status === 'fulfilled') {
            proposalStatsEnriched = enrichStats(proposalStatsResult.value, overallStats, dailyMetrics, metricDetailsMap, 'proposal');
            proposalStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
            logger.debug(`${fnTag} Proposta enriquecidos: ${proposalStatsEnriched.length}.`);
        } else { logger.error(`${fnTag} Falha Proposta.`, proposalStatsResult.reason); }

        if (contextStatsResult.status === 'fulfilled') {
            contextStatsEnriched = enrichStats(contextStatsResult.value, overallStats, dailyMetrics, metricDetailsMap, 'context');
            contextStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
            logger.debug(`${fnTag} Contexto enriquecidos: ${contextStatsEnriched.length}.`);
        } else { logger.error(`${fnTag} Falha Contexto.`, contextStatsResult.reason); }

        // --- Processar resultado da agregação Dia/P/C ---
        if (dayPCOStatsResult.status === 'fulfilled') {
            performanceByDayPCOData = dayPCOStatsResult.value; // Já contém as novas médias
            logger.debug(`${fnTag} Dados Dia/P/C processados.`);
        } else {
             logger.error(`${fnTag} Falha ao buscar dados Dia/P/C.`, dayPCOStatsResult.reason);
             performanceByDayPCOData = undefined;
        }
        // --- Fim Busca e Enriquecimento ---

        logger.info(`${fnTag} Processo concluído. User: ${userId}.`);

        // Retorna o relatório completo, agora com as novas métricas médias incluídas em todas as seções relevantes
        return {
            top3, bottom3, dayOfWeekStats, durationStats, overallStats,
            detailedContentStats: detailedContentStatsEnriched,
            proposalStats: proposalStatsEnriched,
            contextStats: contextStatsEnriched,
            performanceByDayPCO: performanceByDayPCOData
        };

    } catch (error) {
        logger.error(`${fnTag} Erro inesperado no processo geral. User: ${userId}.`, error);
        if (error instanceof ReportAggregationError || error instanceof DetailedStatsError) throw error;
        throw new ReportAggregationError(`Falha no processo geral v3.8. User: ${userId}`, error);
    }
}

