import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
// <<< CORREÇÃO: Removido 'models' pois não estava sendo usado >>>
import { Types, Model /*, models */ } from "mongoose";
import { formatISO } from 'date-fns';
import { logger } from '@/app/lib/logger'; // <-- VERIFIQUE SE ESTE CAMINHO ESTÁ CORRETO
import { IMetric, Metric } from "@/app/models/Metric"; // Import IMetric e o Modelo Metric

// ======================================================================================
// Erros Customizados para o Módulo de Relatórios
// ======================================================================================

/**
 * Erro base para falhas relacionadas à geração de relatórios.
 */
class ReportError extends Error {
    constructor(message: string, public cause?: Error | unknown) {
        super(message);
        this.name = 'ReportError';
        if (cause instanceof Error && cause.stack) {
            this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
        }
    }
}

/**
 * Erro específico para falhas na agregação principal do relatório.
 */
export class ReportAggregationError extends ReportError {
    constructor(message: string, public cause?: Error | unknown) {
        super(message, cause);
        this.name = 'ReportAggregationError';
    }
}

/**
 * Erro específico para falhas na busca das estatísticas detalhadas (Formato/Proposta/Contexto).
 */
export class DetailedStatsError extends ReportError {
    constructor(message: string, public cause?: Error | unknown) {
        super(message, cause);
        this.name = 'DetailedStatsError';
    }
}


// ======================================================================================
// Interfaces (Mantidas como no seu original, mas idealmente centralizadas)
// ======================================================================================

export interface OverallStats {
    _id: null;
    totalCurtidas: number;
    totalComentarios: number;
    totalCompartilhamentos: number;
    totalVisualizacoes: number;
    totalSalvamentos: number;
    avgCurtidas: number;
    avgComentarios: number;
    avgCompartilhamentos: number;
    avgVisualizacoes: number;
    avgSalvamentos: number;
    count: number;
}

export interface DayOfWeekStat {
    dayName: string;
    averageShares: number;
    totalPosts: number;
}

export interface DurationStat {
    range: string;
    contentCount: number;
    averageShares: number;
}

export interface DetailedContentStat {
    _id: {
        format: string;
        proposal: string;
        context: string;
    };
    avgCompartilhamentos: number;
    avgSalvamentos: number;
    avgCurtidas?: number;
    count: number;
}

export interface AggregatedReport {
    top3: IDailyMetric[];
    bottom3: IDailyMetric[];
    dayOfWeekStats: DayOfWeekStat[];
    durationStats: DurationStat[];
    detailedContentStats: DetailedContentStat[];
    overallStats?: OverallStats;
}

// ======================================================================================
// Funções Auxiliares (Mantidas)
// ======================================================================================

function mapDayOfWeek(dow: number): string {
    const names = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    return (dow >= 0 && dow <= 6) ? names[dow]! : "Desconhecido";
}

// Helper interno para calcular OverallStats (para organização)
function calculateOverallStats(metrics: IDailyMetric[]): OverallStats | undefined {
    const initial = { totalCurtidas: 0, totalComentarios: 0, totalCompartilhamentos: 0, totalVisualizacoes: 0, totalSalvamentos: 0, count: 0 };
    const sum = metrics.reduce((acc, metric) => {
        acc.totalCurtidas += metric.stats?.curtidas ?? 0;
        acc.totalComentarios += metric.stats?.comentarios ?? 0;
        acc.totalCompartilhamentos += metric.stats?.compartilhamentos ?? 0;
        acc.totalVisualizacoes += metric.stats?.visualizacoes ?? 0;
        acc.totalSalvamentos += metric.stats?.salvamentos ?? 0;
        acc.count += 1;
        return acc;
    }, initial);

    if (sum.count === 0) return undefined;

    return {
        _id: null,
        ...sum,
        avgCurtidas: sum.totalCurtidas / sum.count,
        avgComentarios: sum.totalComentarios / sum.count,
        avgCompartilhamentos: sum.totalCompartilhamentos / sum.count,
        avgVisualizacoes: sum.totalVisualizacoes / sum.count,
        avgSalvamentos: sum.totalSalvamentos / sum.count
    };
}


// ======================================================================================
// Função Principal de Agregação (Otimizada)
// ======================================================================================

/**
 * Gera o relatório agregado principal, incluindo estatísticas detalhadas v3.2.
 * Orquestra os cálculos de Overall, Top/Bottom, DayOfWeek, Duration e Detailed Stats.
 *
 * @param dailyMetrics Array de métricas diárias base. Deve ser pré-filtrado pelo período desejado.
 * @param userId ID do usuário para quem o relatório está sendo gerado.
 * @param startDate Data de início do período considerado para as `detailedContentStats`.
 * @param dailyMetricModel O modelo Mongoose `DailyMetric` inicializado.
 * @param metricModel O modelo Mongoose `Metric` inicializado.
 * @returns Uma Promise que resolve com o `AggregatedReport` completo.
 * @throws {ReportAggregationError} Se ocorrer um erro inesperado durante a agregação geral.
 * @throws {Error} Se os modelos Mongoose fornecidos forem inválidos.
 * @throws {DetailedStatsError} Lançado por `getDetailedContentStats` se a agregação detalhada falhar (esta função captura e loga).
 */
export async function buildAggregatedReport(
    dailyMetrics: IDailyMetric[],
    userId: Types.ObjectId,
    startDate: Date,
    dailyMetricModel: Model<IDailyMetric>,
    metricModel: Model<IMetric>
): Promise<AggregatedReport> { // Retorna Promise

    // --- Validação de Input Essencial ---
    if (!dailyMetricModel?.aggregate || typeof dailyMetricModel.aggregate !== 'function') {
        throw new Error('Modelo Mongoose DailyMetric inválido ou não fornecido para buildAggregatedReport.');
    }
    if (!metricModel?.collection?.name || typeof metricModel.collection.name !== 'string') {
        throw new Error('Modelo Mongoose Metric inválido ou não fornecido para buildAggregatedReport.');
    }
    if (!userId || !startDate) {
         throw new Error('userId ou startDate inválidos fornecidos para buildAggregatedReport.');
    }
    // --- Fim Validação ---

    // Retorno padrão para input vazio (mantido)
    if (!dailyMetrics || dailyMetrics.length === 0) {
        logger.warn('[buildAggregatedReport v3.2] Recebeu array de dailyMetrics vazio. Retornando relatório padrão.');
        return {
            top3: [],
            bottom3: [],
            dayOfWeekStats: [],
            durationStats: [],
            detailedContentStats: [],
            overallStats: undefined
        };
    }

    logger.debug(`[buildAggregatedReport v3.2] Iniciando agregação para ${dailyMetrics.length} métricas. User: ${userId}`);

    let overallStats: OverallStats | undefined;
    let top3: IDailyMetric[] = [];
    let bottom3: IDailyMetric[] = [];
    let dayOfWeekStats: DayOfWeekStat[] = [];
    let durationStats: DurationStat[] = [];
    let detailedContentStats: DetailedContentStat[] = []; // Inicializa como vazio

    try {
        // --- Cálculos Síncronos ---
        // 1. Calcular Overall Stats
        overallStats = calculateOverallStats(dailyMetrics);

        // 2. Calcular Top 3 / Bottom 3 (Exemplo por compartilhamentos)
        const sortedByShares = [...dailyMetrics].sort((a, b) => (b.stats?.compartilhamentos ?? 0) - (a.stats?.compartilhamentos ?? 0));
        top3 = sortedByShares.slice(0, 3);
        bottom3 = sortedByShares.slice(-3).reverse(); // Mantém a ordem original dos piores

        // 3. Calcular DayOfWeek Stats
        const dayMap: { [key: string]: { totalShares: number, count: number } } = {};
        const dayOrder = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        dailyMetrics.forEach(metric => {
            try {
                if (metric.postDate instanceof Date && !isNaN(metric.postDate.getTime())) {
                    const dayName = mapDayOfWeek(metric.postDate.getUTCDay());
                    if (!dayMap[dayName]) { dayMap[dayName] = { totalShares: 0, count: 0 }; }
                    dayMap[dayName].totalShares += metric.stats?.compartilhamentos ?? 0;
                    dayMap[dayName].count += 1;
                } else { logger.warn(`[buildAggregatedReport v3.2] Data inválida para DayOfWeek: ${metric.postDate}, ID: ${metric._id}`); }
            } catch (e) { logger.warn(`[buildAggregatedReport v3.2] Erro processando DayOfWeek para ID ${metric._id}`, e); }
        });
        dayOfWeekStats = Object.entries(dayMap).map(([dayName, data]) => ({
            dayName, averageShares: data.count > 0 ? data.totalShares / data.count : 0, totalPosts: data.count,
        })).sort((a, b) => dayOrder.indexOf(a.dayName) - dayOrder.indexOf(b.dayName));

        // 4. Calcular Duration Stats
        const finalDurations = [
            { range: '0-15s', min: 0, max: 15 }, { range: '15-29s', min: 15, max: 29 },
            { range: '30-59s', min: 30, max: 59 }, { range: '60s+', min: 60, max: Infinity },
        ];
        const finalDurationMap: { [range: string]: { totalShares: number, count: number } } = {};
        finalDurations.forEach(d => { finalDurationMap[d.range] = { totalShares: 0, count: 0 }; });
        dailyMetrics.forEach(metric => {
             const duration = metric.stats?.duracao;
             if (typeof duration === 'number' && isFinite(duration) && duration >= 0) {
                 const foundRange = finalDurations.find(d => duration >= d.min && duration < d.max);

                 // <<< CORREÇÃO: Refatorado para evitar "Object is possibly 'undefined'" >>>
                 const lastRange = finalDurations.length > 0 ? finalDurations[finalDurations.length - 1] : undefined;
                 const targetRange = foundRange ? foundRange.range : (lastRange && duration >= lastRange.min ? lastRange.range : null);
                 // <<< FIM DA CORREÇÃO >>>

                 if (targetRange && finalDurationMap[targetRange]) {
                     // Acessa o mapa usando a chave targetRange garantida
                     finalDurationMap[targetRange]!.totalShares += metric.stats?.compartilhamentos ?? 0;
                     finalDurationMap[targetRange]!.count += 1;
                 } else if (targetRange) {
                     // Esta condição `else if` pode ser redundante agora, pois se targetRange existe, finalDurationMap[targetRange] também deveria existir
                     logger.warn(`[buildAggregatedReport v3.2] Chave de duração (${targetRange}) não encontrada no mapa interno. ID: ${metric._id}`);
                 }
             } else if (duration !== undefined) {
                 logger.warn(`[buildAggregatedReport v3.2] Duração inválida encontrada: ${duration}. ID: ${metric._id}`);
             }
         });
        durationStats = finalDurations.map(d => {
            const statsForRange = finalDurationMap[d.range];
            const count = statsForRange?.count ?? 0;
            return { range: d.range, contentCount: count, averageShares: count > 0 ? (statsForRange!.totalShares / count) : 0 };
        });
        // --- Fim Cálculos Síncronos ---

        // --- Busca Assíncrona das Estatísticas Detalhadas (com tratamento de erro específico) ---
        try {
            detailedContentStats = await getDetailedContentStats(
                userId,
                startDate,
                dailyMetricModel,
                metricModel
            );
            logger.debug(`[buildAggregatedReport v3.2] detailedContentStats buscados com sucesso: ${detailedContentStats.length} itens.`);
        } catch (error) {
            // Se getDetailedContentStats falhar, loga o erro específico mas continua
            logger.error(`[buildAggregatedReport v3.2] Falha ao buscar detailedContentStats. O relatório será gerado sem esta seção. User: ${userId}`, error);
            // detailedContentStats já foi inicializado como []
            // Não relança o erro aqui para permitir relatório parcial, mas o erro original foi logado.
        }
        // --- Fim Busca Assíncrona ---

        logger.debug(`[buildAggregatedReport v3.2] Agregação concluída para User: ${userId}`);

        // Retorna o relatório agregado completo
        return {
            top3,
            bottom3,
            dayOfWeekStats,
            durationStats,
            detailedContentStats, // Inclui os resultados (ou [] se falhou)
            overallStats,
        };

    } catch (error) {
        // Captura qualquer outro erro inesperado durante os cálculos síncronos
        logger.error(`[buildAggregatedReport v3.2] Erro inesperado durante agregação geral para User ${userId}.`, error);
        throw new ReportAggregationError(`Falha na agregação geral do relatório para User ${userId}`, error);
    }
}


// ======================================================================================
// Função para Stats Detalhados (Otimizada com Erro Customizado)
// ======================================================================================

/**
 * Busca estatísticas médias de DailyMetric agrupadas por Formato, Proposta e Contexto
 * do Metric relacionado, usando $lookup a partir da coleção DailyMetric.
 *
 * @param userId ID do usuário para filtrar as métricas.
 * @param startDate Data inicial para considerar as métricas.
 * @param dailyMetricModel O modelo Mongoose `DailyMetric` inicializado.
 * @param metricModel O modelo Mongoose `Metric` inicializado.
 * @returns Promise que resolve com um array de `DetailedContentStat`.
 * @throws {DetailedStatsError} Se a agregação no banco de dados falhar.
 */
export async function getDetailedContentStats(
    userId: Types.ObjectId,
    startDate: Date,
    dailyMetricModel: Model<IDailyMetric>,
    metricModel: Model<IMetric>
): Promise<DetailedContentStat[]> {
    logger.debug(`[getDetailedContentStats v3.2] Iniciando busca detalhada para User ${userId} desde ${formatISO(startDate)}`);

    const pipeline: any[] = [
        // 1. Filtra DailyMetrics relevantes
        { $match: {
            user: userId,
            postDate: { $gte: startDate },
            postId: { $exists: true, $ne: null } // Garante que postId existe para o $lookup
        }},
        // 2. Junta com a coleção Metric
        { $lookup: {
            from: metricModel.collection.name,
            localField: "postId",
            foreignField: "_id",
            as: "metricInfo"
        }},
        // 3. Desconstrói o array metricInfo
        { $unwind: {
            path: "$metricInfo",
            preserveNullAndEmptyArrays: true // Mantém DailyMetric mesmo sem Metric correspondente (temporário)
        }},
        // 4. Filtra documentos sem correspondência no $lookup
        { $match: {
            "metricInfo._id": { $exists: true } // Garante que a junção foi bem-sucedida
        }},
        // 5. Agrupa pelos campos classificados do Metric e calcula médias
        { $group: {
            _id: {
                format: { $ifNull: ["$metricInfo.format", "Desconhecido"] },
                proposal: { $ifNull: ["$metricInfo.proposal", "Outro"] },
                context: { $ifNull: ["$metricInfo.context", "Geral"] }
            },
            avgCompartilhamentos: { $avg: { $ifNull: ["$stats.compartilhamentos", 0] } }, // Usar $ifNull dentro do $avg
            avgSalvamentos: { $avg: { $ifNull: ["$stats.salvamentos", 0] } },
            avgCurtidas: { $avg: { $ifNull: ["$stats.curtidas", 0] } },
            count: { $sum: 1 }
        }},
        // 6. Ordena os resultados
        { $sort: {
            count: -1,
            "avgCompartilhamentos": -1
        }},
        // 7. Limita (Opcional)
        // { $limit: 50 }
    ];

    try {
        // Executa a agregação
        const results: DetailedContentStat[] = await dailyMetricModel.aggregate(pipeline).exec();
        logger.debug(`[getDetailedContentStats v3.2] Agregação detalhada retornou ${results.length} grupos para User ${userId}.`);
        return results;
    } catch (error) {
        logger.error(`[getDetailedContentStats v3.2] Erro na agregação detalhada para User ${userId}.`, { // Pipeline removido do log principal por verbosidade
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });
        // Lança o erro customizado
        throw new DetailedStatsError(`Falha ao executar agregação detalhada para User ${userId}`, error);
    }
}