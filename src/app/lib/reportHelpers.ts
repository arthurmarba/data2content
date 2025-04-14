// @/app/lib/reportHelpers.ts - v3.6 MODIFICADO (Com Passo 2 da Priorização Dinâmica e Correções de Tipo v3)

import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import { Types, Model } from "mongoose";
import { formatISO } from 'date-fns';
import { logger } from '@/app/lib/logger'; // Certifique-se que o caminho está correto
import { IMetric, Metric } from "@/app/models/Metric"; // Import IMetric e o Modelo Metric

const TOP_EXAMPLES_PER_GROUP_LIMIT = 3;

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
// Interfaces Atualizadas (v3.6 + Priorização Dinâmica Passo 2)
// ======================================================================================

export interface OverallStats {
  _id: null;
  totalCurtidas: number; totalComentarios: number; totalCompartilhamentos: number;
  totalVisualizacoes: number; totalSalvamentos: number; totalAlcance: number;
  avgCurtidas: number; avgComentarios: number; avgCompartilhamentos: number;
  avgVisualizacoes: number; avgSalvamentos: number; avgAlcance: number;
  count: number;
}

export interface DayOfWeekStat {
    dayName: string; averageShares: number; totalPosts: number;
}

export interface DurationStat {
    range: string; contentCount: number; averageShares: number; averageSaves?: number;
}

// Interface BASE comum para enriquecimento
export interface BaseStat {
    _id: object;
    avgCompartilhamentos: number;
    avgSalvamentos: number;
    avgCurtidas: number;
    avgAlcance: number;
    avgComentarios: number;
    count: number;
    shareDiffPercentage?: number | null;
    saveDiffPercentage?: number | null;
    reachDiffPercentage?: number | null;
    commentDiffPercentage?: number | null;
    likeDiffPercentage?: number | null;
    bestPostInGroup?: { _id: Types.ObjectId; description?: string; postLink?: string; shares?: number; saves?: number; };
    avgVisualizacoes?: number;
}

export interface StatId {
  format?: string;
  proposal?: string;
  context?: string;
}

// Interface Detalhada (F/P/C)
export interface DetailedContentStat extends BaseStat {
  _id: { format: string; proposal: string; context: string; };
  // <<< CORREÇÃO DE TIPO v3 >>> Define explicitamente o tipo do array, permitindo opcionais
  topExamplesInGroup?: {
      _id: Types.ObjectId; // Assumindo que _id sempre vem de IMetric
      description?: string; // Permite undefined
      postLink?: string;    // Permite undefined
  }[];
}

// Interface para Stats por Proposta
export interface ProposalStat extends BaseStat {
  _id: { proposal: string; };
}

// Interface para Stats por Contexto
export interface ContextStat extends BaseStat {
  _id: { context: string; };
}

// Interface para o relatório agregado final
export interface AggregatedReport {
    top3: IDailyMetric[];
    bottom3: IDailyMetric[];
    dayOfWeekStats: DayOfWeekStat[];
    durationStats: DurationStat[];
    detailedContentStats: DetailedContentStat[];
    proposalStats?: ProposalStat[];
    contextStats?: ContextStat[];
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

/** Calcula as estatísticas gerais (OverallStats) - já inclui as médias necessárias. */
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
        avgCurtidas: sum.totalCurtidas / sum.count,
        avgComentarios: sum.totalComentarios / sum.count,
        avgCompartilhamentos: sum.totalCompartilhamentos / sum.count,
        avgVisualizacoes: sum.totalVisualizacoes / sum.count,
        avgSalvamentos: sum.totalSalvamentos / sum.count,
        avgAlcance: sum.totalAlcance / sum.count,
    };
}

/** Busca detalhes essenciais de Metrics para enriquecimento. */
async function fetchMetricDetailsForEnrichment(
    dailyMetrics: IDailyMetric[], metricModel: Model<IMetric>
): Promise<Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>> {
    const postIds = dailyMetrics.map(dm => dm.postId).filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));
    const uniquePostIds = [...new Set(postIds.map(id => id.toString()))].map(idStr => new Types.ObjectId(idStr));
    if (uniquePostIds.length === 0) { logger.debug("[fetchMetricDetailsForEnrichment] Nenhum postId válido."); return new Map(); }
    try {
        // Seleciona apenas os campos que existem em IMetric e são necessários
        const metrics = await metricModel.find({ _id: { $in: uniquePostIds } })
            .select('_id description postLink format proposal context') // Remove 'shares', 'saves'
            .lean().exec();
        // Ajusta o tipo do Map para refletir os campos realmente selecionados
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
            avgCompartilhamentos: { $avg: { $ifNull: ["$stats.compartilhamentos", 0] } },
            avgSalvamentos: { $avg: { $ifNull: ["$stats.salvamentos", 0] } },
            avgCurtidas: { $avg: { $ifNull: ["$stats.curtidas", 0] } },
            avgComentarios: { $avg: { $ifNull: ["$stats.comentarios", 0] } },
            avgAlcance: { $avg: { $ifNull: ["$stats.contasAlcancadas", 0] } },
            avgVisualizacoes: { $avg: { $ifNull: ["$stats.visualizacoes", 0] } }, // Adicionado avgVisualizacoes
            count: { $sum: 1 }
        }},
        { $sort: { count: -1, avgCompartilhamentos: -1 } }
    ];
    try {
        // Ajusta o tipo esperado da agregação para incluir avgVisualizacoes
        const results: Omit<DetailedContentStat, 'topExamplesInGroup' | 'bestPostInGroup' | 'shareDiffPercentage' | 'saveDiffPercentage' | 'reachDiffPercentage' | 'commentDiffPercentage' | 'likeDiffPercentage' | 'taxaRetencao' | 'taxaEngajamento'>[] = await dailyMetricModel.aggregate(pipeline).exec();
        logger.debug(`[getDetailedContentStatsBase v3.4] F/P/C retornou ${results.length} grupos.`);
        return results as DetailedContentStat[];
     }
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
            avgCompartilhamentos: { $avg: { $ifNull: ["$stats.compartilhamentos", 0] } },
            avgSalvamentos: { $avg: { $ifNull: ["$stats.salvamentos", 0] } },
            avgCurtidas: { $avg: { $ifNull: ["$stats.curtidas", 0] } },
            avgComentarios: { $avg: { $ifNull: ["$stats.comentarios", 0] } },
            avgAlcance: { $avg: { $ifNull: ["$stats.contasAlcancadas", 0] } },
            avgVisualizacoes: { $avg: { $ifNull: ["$stats.visualizacoes", 0] } }, // Adicionado avgVisualizacoes
            count: { $sum: 1 }
        }},
        { $sort: { count: -1, avgCompartilhamentos: -1 } }
    ];
    try {
        const results: Omit<ProposalStat, 'bestPostInGroup' | 'shareDiffPercentage' | 'saveDiffPercentage' | 'reachDiffPercentage' | 'commentDiffPercentage' | 'likeDiffPercentage' | 'taxaRetencao' | 'taxaEngajamento'>[] = await dailyMetricModel.aggregate(pipeline).exec();
        logger.debug(`[getProposalStatsBase v3.4] Proposta retornou ${results.length} grupos.`);
        return results as ProposalStat[];
    }
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
             avgCompartilhamentos: { $avg: { $ifNull: ["$stats.compartilhamentos", 0] } },
             avgSalvamentos: { $avg: { $ifNull: ["$stats.salvamentos", 0] } },
             avgCurtidas: { $avg: { $ifNull: ["$stats.curtidas", 0] } },
             avgComentarios: { $avg: { $ifNull: ["$stats.comentarios", 0] } },
             avgAlcance: { $avg: { $ifNull: ["$stats.contasAlcancadas", 0] } },
             avgVisualizacoes: { $avg: { $ifNull: ["$stats.visualizacoes", 0] } }, // Adicionado avgVisualizacoes
             count: { $sum: 1 }
         }},
         { $sort: { count: -1, avgCompartilhamentos: -1 } }
    ];
    try {
        const results: Omit<ContextStat, 'bestPostInGroup' | 'shareDiffPercentage' | 'saveDiffPercentage' | 'reachDiffPercentage' | 'commentDiffPercentage' | 'likeDiffPercentage' | 'taxaRetencao' | 'taxaEngajamento'>[] = await dailyMetricModel.aggregate(pipeline).exec();
        logger.debug(`[getContextStatsBase v3.4] Contexto retornou ${results.length} grupos.`);
        return results as ContextStat[];
     }
    catch (error) { logger.error(`[getContextStatsBase v3.4] Erro.`, error); throw new DetailedStatsError(`Falha ao agregar por Contexto para User ${userId}`, error); }
}

// ======================================================================================
// Função Genérica para Enriquecer Stats
// ======================================================================================

/** Adiciona diferenças percentuais vs geral e os TOP N posts de exemplo do grupo. */
function enrichStats<T extends BaseStat>(
    statsBase: T[],
    overallStats: OverallStats | undefined,
    dailyMetrics: IDailyMetric[],
    metricDetailsMap: Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>, // Usa o tipo corrigido do Map
    groupingType: 'detailed' | 'proposal' | 'context'
): T[] {
    if (!overallStats) {
        logger.warn("[enrichStats] OverallStats não disponíveis, pulando cálculo de DiffPercentages.");
        if (groupingType === 'detailed') {
             // <<< CORREÇÃO DE TIPO GENÉRICO >>> Cast do resultado para T[]
             return addTopExamplesOnly(statsBase as DetailedContentStat[], dailyMetrics, metricDetailsMap) as T[];
        }
        return statsBase;
    }

    // Garante que as médias gerais existem antes de desestruturar
    const {
        avgCompartilhamentos: overallAvgShares = 0,
        avgSalvamentos: overallAvgSaves = 0,
        avgAlcance: overallAvgReach = 0,
        avgComentarios: overallAvgComments = 0,
        avgCurtidas: overallAvgLikes = 0
        // avgVisualizacoes: overallAvgViews = 0 // Adicionar se for calcular viewDiffPercentage
    } = overallStats;

    logger.debug(`[enrichStats] Médias Gerais para Cálculo de Diff: Shares=${overallAvgShares.toFixed(1)}, Saves=${overallAvgSaves.toFixed(1)}, Reach=${overallAvgReach.toFixed(0)}, Comments=${overallAvgComments.toFixed(1)}, Likes=${overallAvgLikes.toFixed(1)}`);

    return statsBase.map(statBase => {
        const enrichedStat = { ...statBase };

        // 1. Calcular Percentuais
        if (overallAvgShares > 0) enrichedStat.shareDiffPercentage = ((enrichedStat.avgCompartilhamentos / overallAvgShares) - 1) * 100; else enrichedStat.shareDiffPercentage = null;
        if (overallAvgSaves > 0) enrichedStat.saveDiffPercentage = ((enrichedStat.avgSalvamentos / overallAvgSaves) - 1) * 100; else enrichedStat.saveDiffPercentage = null;
        if (overallAvgReach > 0) enrichedStat.reachDiffPercentage = ((enrichedStat.avgAlcance / overallAvgReach) - 1) * 100; else enrichedStat.reachDiffPercentage = null;

        // <<< NOVOS CÁLCULOS (Passo 2) >>>
        // Verifica se avgComentarios/avgCurtidas existem no statBase antes de calcular
        if (overallAvgComments > 0 && enrichedStat.avgComentarios !== undefined && enrichedStat.avgComentarios !== null) {
            enrichedStat.commentDiffPercentage = ((enrichedStat.avgComentarios / overallAvgComments) - 1) * 100;
        } else {
            enrichedStat.commentDiffPercentage = null;
        }

        if (overallAvgLikes > 0 && enrichedStat.avgCurtidas !== undefined && enrichedStat.avgCurtidas !== null) {
            enrichedStat.likeDiffPercentage = ((enrichedStat.avgCurtidas / overallAvgLikes) - 1) * 100;
        } else {
            enrichedStat.likeDiffPercentage = null;
        }
        // Exemplo: Adicionar viewDiffPercentage se necessário
        // if (overallAvgViews > 0 && enrichedStat.avgVisualizacoes !== undefined && enrichedStat.avgVisualizacoes !== null) {
        //     enrichedStat.viewDiffPercentage = ((enrichedStat.avgVisualizacoes / overallAvgViews) - 1) * 100;
        // } else {
        //     enrichedStat.viewDiffPercentage = null;
        // }
        // <<< FIM NOVOS CÁLCULOS >>>

        // 2. Encontrar e Processar Top N exemplos (APENAS para 'detailed')
        if (groupingType === 'detailed') {
            // Cast seguro para DetailedContentStat dentro deste bloco
            const detailedStat = enrichedStat as DetailedContentStat;
            let groupCandidates: { dm: IDailyMetric, metricDetail: Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'> }[] = [];
            const detailedId = detailedStat._id as DetailedContentStat['_id'];

            dailyMetrics.forEach(dm => {
                if (!dm.postId) return;
                const metricDetail = metricDetailsMap.get(dm.postId.toString());
                if (!metricDetail) return;

                if ((metricDetail.format ?? 'Desconhecido') === detailedId.format &&
                    (metricDetail.proposal ?? 'Outro') === detailedId.proposal &&
                    (metricDetail.context ?? 'Geral') === detailedId.context)
                {
                    groupCandidates.push({ dm, metricDetail });
                }
            });

            groupCandidates.sort((a, b) =>
                (b.dm.stats?.compartilhamentos ?? 0) - (a.dm.stats?.compartilhamentos ?? 0) ||
                (b.dm.stats?.salvamentos ?? 0) - (a.dm.stats?.salvamentos ?? 0)
            );

            const topNCandidates = groupCandidates.slice(0, TOP_EXAMPLES_PER_GROUP_LIMIT);

            // Atribui ao campo correto e garante tipo compatível
            detailedStat.topExamplesInGroup = topNCandidates.map(candidate => {
                // Cria o objeto com o tipo esperado { _id, description?, postLink? }
                const example: { _id: Types.ObjectId; description?: string; postLink?: string; } = {
                    _id: candidate.metricDetail._id,
                    description: candidate.metricDetail.description ?? undefined, // Garante string | undefined
                    postLink: (candidate.metricDetail.postLink && candidate.metricDetail.postLink.startsWith('http'))
                               ? candidate.metricDetail.postLink
                               : undefined // Garante string | undefined
                };
                return example;
            }).filter(example => example._id); // Mantém filtro por _id se necessário

            const bestCandidate = topNCandidates[0];
            if (bestCandidate) {
                detailedStat.bestPostInGroup = {
                    _id: bestCandidate.metricDetail._id,
                    description: bestCandidate.metricDetail.description ?? undefined,
                    postLink: (bestCandidate.metricDetail.postLink && bestCandidate.metricDetail.postLink.startsWith('http'))
                               ? bestCandidate.metricDetail.postLink
                               : undefined,
                    shares: bestCandidate.dm.stats?.compartilhamentos,
                    saves: bestCandidate.dm.stats?.salvamentos
                };
            } else {
                detailedStat.bestPostInGroup = undefined;
            }
        } // Fim do if (groupingType === 'detailed')

        return enrichedStat; // Retorna o tipo genérico original T
    });
}

// Função auxiliar separada para adicionar apenas TopExamples (caso OverallStats falhe)
function addTopExamplesOnly(
    statsBase: DetailedContentStat[],
    dailyMetrics: IDailyMetric[],
    metricDetailsMap: Map<string, Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'>>
): DetailedContentStat[] {
     logger.debug("[addTopExamplesOnly] Adicionando apenas Top N exemplos pois OverallStats estão ausentes.");
     return statsBase.map(statBase => {
         const enrichedStat = { ...statBase };
         let groupCandidates: { dm: IDailyMetric, metricDetail: Pick<IMetric, '_id' | 'description' | 'postLink' | 'format' | 'proposal' | 'context'> }[] = [];
         const detailedId = enrichedStat._id;

         dailyMetrics.forEach(dm => {
             if (!dm.postId) return;
             const metricDetail = metricDetailsMap.get(dm.postId.toString());
             if (!metricDetail) return;
             if ((metricDetail.format ?? 'Desconhecido') === detailedId.format &&
                 (metricDetail.proposal ?? 'Outro') === detailedId.proposal &&
                 (metricDetail.context ?? 'Geral') === detailedId.context)
             {
                 groupCandidates.push({ dm, metricDetail });
             }
         });

         groupCandidates.sort((a, b) =>
             (b.dm.stats?.compartilhamentos ?? 0) - (a.dm.stats?.compartilhamentos ?? 0) ||
             (b.dm.stats?.salvamentos ?? 0) - (a.dm.stats?.salvamentos ?? 0)
         );
         const topNCandidates = groupCandidates.slice(0, TOP_EXAMPLES_PER_GROUP_LIMIT);

         // Atribui ao campo correto e garante tipo compatível
         enrichedStat.topExamplesInGroup = topNCandidates.map(candidate => {
             const example: { _id: Types.ObjectId; description?: string; postLink?: string; } = {
                 _id: candidate.metricDetail._id,
                 description: candidate.metricDetail.description ?? undefined,
                 postLink: (candidate.metricDetail.postLink && candidate.metricDetail.postLink.startsWith('http')) ? candidate.metricDetail.postLink : undefined
             };
             return example;
         }).filter(example => example._id);

         const bestCandidate = topNCandidates[0];
         if (bestCandidate) {
             enrichedStat.bestPostInGroup = {
                 _id: bestCandidate.metricDetail._id,
                 description: bestCandidate.metricDetail.description ?? undefined,
                 postLink: (bestCandidate.metricDetail.postLink && bestCandidate.metricDetail.postLink.startsWith('http')) ? bestCandidate.metricDetail.postLink : undefined,
                 shares: bestCandidate.dm.stats?.compartilhamentos,
                 saves: bestCandidate.dm.stats?.salvamentos
             };
         } else {
             enrichedStat.bestPostInGroup = undefined;
         }
         return enrichedStat;
     });
}


// ======================================================================================
// Função Principal de Agregação e Enriquecimento
// ======================================================================================

/**
 * Gera o relatório agregado principal, incluindo estatísticas ENRIQUECIDAS para
 * F/P/C (com Top N exemplos), Proposta e Contexto, agora com mais diffs%.
 */
export async function buildAggregatedReport(
    dailyMetrics: IDailyMetric[], userId: Types.ObjectId, startDate: Date,
    dailyMetricModel: Model<IDailyMetric>, metricModel: Model<IMetric>
): Promise<AggregatedReport> {

    if (!dailyMetricModel?.aggregate || !metricModel?.find || !userId || !startDate) {
        throw new Error('Input inválido para buildAggregatedReport.');
    }
    if (!dailyMetrics || dailyMetrics.length === 0) {
        logger.warn('[buildAggregatedReport v3.6+] Array de dailyMetrics vazio.');
        return { top3: [], bottom3: [], dayOfWeekStats: [], durationStats: [], detailedContentStats: [], proposalStats: [], contextStats: [], overallStats: undefined };
    }

    logger.debug(`[buildAggregatedReport v3.6+] Iniciando para ${dailyMetrics.length} métricas. User: ${userId}`);

    let overallStats: OverallStats | undefined;
    let top3: IDailyMetric[] = []; let bottom3: IDailyMetric[] = [];
    let dayOfWeekStats: DayOfWeekStat[] = []; let durationStats: DurationStat[] = [];
    let detailedContentStatsEnriched: DetailedContentStat[] = [];
    let proposalStatsEnriched: ProposalStat[] = [];
    let contextStatsEnriched: ContextStat[] = [];

    // Pré-busca detalhes Metrics (agora sem shares/saves)
    const metricDetailsMap = await fetchMetricDetailsForEnrichment(dailyMetrics, metricModel);

    try {
        // Calcular Overall Stats (já inclui avgComentarios, avgCurtidas)
        overallStats = calculateOverallStats(dailyMetrics);

        // Cálculos simples (mantidos)
        const sortedByShares = [...dailyMetrics].sort((a, b) => (b.stats?.compartilhamentos ?? 0) - (a.stats?.compartilhamentos ?? 0));
        top3 = sortedByShares.slice(0, 3);
        bottom3 = sortedByShares.slice(-3).reverse();
        // ... (cálculo de dayOfWeekStats mantido) ...
        const dayMap: { [key: string]: { totalShares: number, count: number } } = {}; const dayOrder = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        dailyMetrics.forEach(metric => { try { if (metric.postDate instanceof Date && !isNaN(metric.postDate.getTime())) { const dayName = mapDayOfWeek(metric.postDate.getUTCDay()); if (!dayMap[dayName]) { dayMap[dayName] = { totalShares: 0, count: 0 }; } dayMap[dayName]!.totalShares += metric.stats?.compartilhamentos ?? 0; dayMap[dayName]!.count += 1; } } catch (e) { /* log */ } });
        dayOfWeekStats = Object.entries(dayMap).map(([dayName, data]) => ({ dayName, averageShares: data.count > 0 ? data.totalShares / data.count : 0, totalPosts: data.count, })).sort((a, b) => dayOrder.indexOf(a.dayName) - dayOrder.indexOf(b.dayName));
        // ... (cálculo de durationStats mantido) ...
        const finalDurations = [ { range: '0-15s', min: 0, max: 15 }, { range: '15-29s', min: 15, max: 29 }, { range: '30-59s', min: 30, max: 59 }, { range: '60s+', min: 60, max: Infinity }, ]; const finalDurationMap = new Map<string, { totalShares: number, totalSaves: number, count: number }>(); finalDurations.forEach(d => { finalDurationMap.set(d.range, { totalShares: 0, totalSaves: 0, count: 0 }); });
        dailyMetrics.forEach(metric => { const duration = metric.stats?.duracao; if (typeof duration === 'number' && isFinite(duration) && duration >= 0) { const foundRange = finalDurations.find(d => duration >= d.min && (duration < d.max || d.max === Infinity)); if (foundRange) { const statsForRange = finalDurationMap.get(foundRange.range); if (statsForRange) { statsForRange.totalShares += metric.stats?.compartilhamentos ?? 0; statsForRange.totalSaves += metric.stats?.salvamentos ?? 0; statsForRange.count += 1; } } } });
        durationStats = finalDurations.map(d => { const stats = finalDurationMap.get(d.range); const count = stats?.count ?? 0; return { range: d.range, contentCount: count, averageShares: count > 0 ? (stats!.totalShares / count) : 0, averageSaves: count > 0 ? (stats!.totalSaves / count) : 0, }; });


        // --- Buscar Stats Detalhados BASE em paralelo ---
        // Assegure que $group inclua $avg para comentarios e curtidas
        const [detailedStatsResult, proposalStatsResult, contextStatsResult] = await Promise.allSettled([
            getDetailedContentStatsBase(userId, startDate, dailyMetricModel, metricModel),
            getProposalStatsBase(userId, startDate, dailyMetricModel, metricModel),
            getContextStatsBase(userId, startDate, dailyMetricModel, metricModel)
        ]);

        // --- Enriquecer cada conjunto de stats ---
        // A função enrichStats agora calcula os diffs adicionais
        if (detailedStatsResult.status === 'fulfilled') {
            detailedContentStatsEnriched = enrichStats(detailedStatsResult.value, overallStats, dailyMetrics, metricDetailsMap, 'detailed');
            // Ordenação final pode ser feita aqui ou na formatação do prompt
            detailedContentStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
            logger.debug(`[buildAggregatedReport v3.6+] F/P/C enriquecidos (com diffs e Top N): ${detailedContentStatsEnriched.length}.`);
        } else { logger.error(`[buildAggregatedReport v3.6+] Falha F/P/C.`, detailedStatsResult.reason); }

        if (proposalStatsResult.status === 'fulfilled') {
            proposalStatsEnriched = enrichStats(proposalStatsResult.value, overallStats, dailyMetrics, metricDetailsMap, 'proposal');
            proposalStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
            logger.debug(`[buildAggregatedReport v3.6+] Proposta enriquecidos: ${proposalStatsEnriched.length}.`);
        } else { logger.error(`[buildAggregatedReport v3.6+] Falha Proposta.`, proposalStatsResult.reason); }

        if (contextStatsResult.status === 'fulfilled') {
            contextStatsEnriched = enrichStats(contextStatsResult.value, overallStats, dailyMetrics, metricDetailsMap, 'context');
            contextStatsEnriched.sort((a, b) => (b.shareDiffPercentage ?? -Infinity) - (a.shareDiffPercentage ?? -Infinity));
            logger.debug(`[buildAggregatedReport v3.6+] Contexto enriquecidos: ${contextStatsEnriched.length}.`);
        } else { logger.error(`[buildAggregatedReport v3.6+] Falha Contexto.`, contextStatsResult.reason); }
        // --- Fim Busca e Enriquecimento ---

        logger.info(`[buildAggregatedReport v3.6+] Processo concluído. User: ${userId}.`);

        return {
            top3, bottom3, dayOfWeekStats, durationStats, overallStats,
            detailedContentStats: detailedContentStatsEnriched,
            proposalStats: proposalStatsEnriched,
            contextStats: contextStatsEnriched,
        };

    } catch (error) {
        logger.error(`[buildAggregatedReport v3.6+] Erro inesperado no processo geral. User: ${userId}.`, error);
        // Garante que erros específicos de agregação sejam relançados corretamente
        if (error instanceof ReportAggregationError || error instanceof DetailedStatsError) throw error;
        throw new ReportAggregationError(`Falha no processo geral v3.6+. User: ${userId}`, error);
    }
}
