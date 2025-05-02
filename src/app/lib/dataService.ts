/**
 * @fileoverview Serviço de acesso a dados (Usuários, Métricas, Relatórios, Publicidades).
 * ATUALIZADO v2.10: fetchAndPrepareReportData refatorado para usar buildAggregatedReport v4.0.
 * @version 2.10
 */

import mongoose, { Model, Types } from 'mongoose'; // Importa mongoose completo
import { subDays, differenceInDays } from 'date-fns'; // Importa funções de data
import { logger } from '@/app/lib/logger'; // Logger da aplicação

// Modelos do Mongoose
import User, { IUser } from '@/app/models/User';
// import { DailyMetric, IDailyMetric } from '@/app/models/DailyMetric'; // <<< REMOVIDO: Não usado diretamente por fetchAndPrepareReportData >>>
import Metric, { IMetric } from '@/app/models/Metric'; // Modelo Metric é necessário
import AdDeal, { IAdDeal } from '@/app/models/AdDeal'; // Modelo AdDeal

// Funções e tipos de reportHelpers (v4.0 refatorado)
import {
    buildAggregatedReport, // <<< Importa buildAggregatedReport v4.0 >>>
    AggregatedReport,
    DurationStat,
    OverallStats,
    DetailedContentStat,
    ProposalStat,
    ContextStat,
    PerformanceByDayPCO,
    ReportAggregationError,
    DetailedStatsError
} from '@/app/lib/reportHelpers'; // <<< Importa de reportHelpers v4.0 >>>

// Erros customizados
import {
    BaseError,
    UserNotFoundError,
    MetricsNotFoundError,
    DatabaseError
} from '@/app/lib/errors';

/* ------------------------------------------------------------------ *
 * Constantes internas                                                *
 * ------------------------------------------------------------------ */
const METRICS_FETCH_DAYS_LIMIT = 180; // Limite de dias para buscar métricas
const NEW_USER_THRESHOLD_DAYS = 90; // Limite para considerar usuário como novo

/* ------------------------------------------------------------------ *
 * Tipos públicos exportados                                          *
 * ------------------------------------------------------------------ */

// Interface para o relatório enriquecido (ajustada para refletir retorno de buildAggregatedReport v4.0)
export interface IEnrichedReport {
    overallStats?: OverallStats;
    profileSegment: string;
    multimediaSuggestion: string;
    top3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[]; // Inclui stats
    bottom3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink' | 'stats'>[]; // Inclui stats
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[];
    proposalStats?: ProposalStat[];
    contextStats?: ContextStat[];
    historicalComparisons?: IGrowthComparisons; // Mantido (placeholder)
    longTermComparisons?: IGrowthComparisons; // Mantido (placeholder)
    performanceByDayPCO?: PerformanceByDayPCO;
}

// Interface para os dados preparados retornados por fetchAndPrepareReportData
interface PreparedData {
    enrichedReport: IEnrichedReport;
}

// Tipos para busca de referência de post (mantido)
export type ReferenceSearchResult =
    | { status: 'found'; post: { _id: Types.ObjectId; description: string; proposal?: string; context?: string } }
    | { status: 'clarify'; message: string }
    | { status: 'error'; message: string };

// Tipos para dados de crescimento (mantido)
interface IGrowthComparisons {
    weeklyFollowerChange?: number;
    monthlyReachTrend?: 'up' | 'down' | 'stable';
}
interface IGrowthDataResult {
    historical?: IGrowthComparisons;
    longTerm?: IGrowthComparisons;
}

// Interface para AdDeal Insights (mantida)
export interface AdDealInsights {
    period: 'last30d' | 'last90d' | 'all';
    totalDeals: number;
    totalRevenueBRL: number;
    averageDealValueBRL?: number;
    commonBrandSegments: string[];
    avgValueByCompensation?: { [key: string]: number };
    commonDeliverables: string[];
    commonPlatforms: string[];
    dealsFrequency?: number;
}


/* ------------------------------------------------------------------ *
 * Funções auxiliares (mantidas)                                      *
 * ------------------------------------------------------------------ */

function getUserProfileSegment(user: IUser): string {
    if (user.createdAt instanceof Date && !isNaN(+user.createdAt)) {
        const ageInDays = differenceInDays(new Date(), user.createdAt);
        return ageInDays < NEW_USER_THRESHOLD_DAYS ? 'Novo Usuário' : 'Usuário Veterano';
    }
    logger.warn(`[getUserProfileSegment] Data de criação inválida para usuário ${user._id}`);
    return 'Geral';
}

function getMultimediaSuggestion(report?: AggregatedReport | null): string {
    // Ordena por taxa de retenção para encontrar a melhor faixa
    const bestDurationStat = report?.durationStats?.sort((a, b) => (b.avgRetentionRate ?? 0) - (a.avgRetentionRate ?? 0))[0];
    if (!bestDurationStat) {
        return '';
    }
    if (bestDurationStat.range.includes('60s')) {
        return 'Vídeos acima de 60 segundos têm mostrado boa retenção média para você. Vale a pena experimentar formatos um pouco mais longos!';
    }
    // Inclui a taxa de retenção na sugestão
    const retentionPercent = ((bestDurationStat.avgRetentionRate ?? 0) * 100).toFixed(0); // Formata como inteiro
    return `Vídeos na faixa de ${bestDurationStat.range} tiveram um ótimo desempenho recente (${retentionPercent}% retenção média). Teste produzir mais conteúdos nessa duração!`;
}

// Placeholder para dados de crescimento (mantido)
async function getCombinedGrowthData(
    userId: Types.ObjectId
): Promise<IGrowthDataResult> {
    logger.debug(`[getCombinedGrowthData] Placeholder para usuário ${userId}`);
    return { historical: {}, longTerm: {} };
}

// Função fetchContentDetailsForMetrics removida, pois buildAggregatedReport v4.0 já busca os detalhes.


/* ------------------------------------------------------------------ *
 * Funções públicas Exportadas                                        *
 * ------------------------------------------------------------------ */

// lookupUser (mantida sem alterações)
export async function lookupUser(fromPhone: string): Promise<IUser> {
    const maskedPhone = fromPhone.slice(0, -4) + '****';
    logger.debug(`[lookupUser v2.10] Buscando usuário para telefone ${maskedPhone}`);
    try {
        const user = await User.findOne({ whatsappPhone: fromPhone }).lean();
        if (!user) {
            logger.warn(`[lookupUser v2.10] Usuário não encontrado para telefone ${maskedPhone}`);
            throw new UserNotFoundError(`Usuário não encontrado (${maskedPhone})`);
        }
        logger.info(`[lookupUser v2.10] Usuário ${user._id} encontrado para telefone ${maskedPhone}`);
        return user as IUser;
    } catch (error: any) {
        if (error instanceof UserNotFoundError) throw error;
        logger.error(`[lookupUser v2.10] Erro de banco de dados ao buscar usuário ${maskedPhone}:`, error);
        throw new DatabaseError(`Erro ao buscar usuário: ${error.message}`);
    }
}

// lookupUserById (mantida sem alterações)
export async function lookupUserById(userId: string): Promise<IUser> {
    logger.debug(`[lookupUserById v2.10] Buscando usuário por ID ${userId}`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`[lookupUserById v2.10] ID de usuário inválido fornecido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }
    try {
        const user = await User.findById(userId).lean();
        if (!user) {
            logger.warn(`[lookupUserById v2.10] Usuário não encontrado para ID ${userId}`);
            throw new UserNotFoundError(`Usuário não encontrado para ID: ${userId}`);
        }
        logger.info(`[lookupUserById v2.10] Usuário ${userId} encontrado.`);
        return user as IUser;
    } catch (error: any) {
        if (error instanceof UserNotFoundError) throw error;
        logger.error(`[lookupUserById v2.10] Erro de banco de dados ao buscar usuário ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar usuário por ID: ${error.message}`);
    }
}


/**
 * Busca as métricas recentes, gera o relatório agregado e enriquece com detalhes.
 * ATUALIZADO v2.10:
 * - Remove parâmetro `dailyMetricModel`.
 * - Chama a versão refatorada de `buildAggregatedReport` (v4.0) passando `MetricModel`.
 * - Não busca mais `dailyMetrics` separadamente.
 * - Assume que `buildAggregatedReport` já retorna top/bottom posts.
 */
export async function fetchAndPrepareReportData(
    {
        user,
        contentMetricModel // <<< Este é o MetricModel >>>
    }: {
        user: IUser;
        // dailyMetricModel: Model<IDailyMetric>; // <<< TIPO REMOVIDO >>>
        contentMetricModel: Model<IMetric>; // <<< TIPO MANTIDO >>>
    }
): Promise<PreparedData> {
    // Converte user._id para ObjectId se não for
    const userId = user._id instanceof Types.ObjectId ? user._id : new Types.ObjectId(user._id);
    const TAG = '[fetchAndPrepareReportData v2.10]'; // Atualiza tag
    logger.info(`${TAG} Iniciando para usuário ${userId}`);

    // Define a data limite para buscar métricas
    const sinceDate = subDays(new Date(), METRICS_FETCH_DAYS_LIMIT);
    logger.debug(`${TAG} Período de busca: desde ${sinceDate.toISOString()}`);

    /* --- 1. Busca Dados de Crescimento (em paralelo com relatório) --- */
    let growthData: IGrowthDataResult;
    try {
        growthData = await getCombinedGrowthData(userId);
        logger.debug(`${TAG} Dados de crescimento (placeholder) obtidos.`);
    } catch (error: any) {
        logger.error(`${TAG} Erro ao buscar dados de crescimento para ${userId}:`, error);
        growthData = { historical: {}, longTerm: {} }; // Define como vazio em caso de erro
    }

    /* --- 2. Gera o Relatório Agregado (usando a função refatorada) --- */
    let aggregatedReport: AggregatedReport;
    try {
        logger.debug(`${TAG} Gerando relatório agregado (v4.0) para ${userId}...`);
        // <<< CHAMA A VERSÃO REFATORADA com 3 argumentos >>>
        aggregatedReport = await buildAggregatedReport(
            userId,             // 1. userId (ObjectId)
            sinceDate,          // 2. startDate (Date)
            contentMetricModel  // 3. metricModel (MetricModel)
        );
        logger.info(`${TAG} Relatório agregado gerado com sucesso para ${userId}.`);

        // Verifica se o relatório tem dados (buildAggregatedReport pode retornar vazio)
        if (!aggregatedReport || !aggregatedReport.overallStats) {
             logger.warn(`${TAG} Nenhum dado encontrado nos últimos ${METRICS_FETCH_DAYS_LIMIT} dias para gerar relatório para ${userId}.`);
             throw new MetricsNotFoundError(
                 `Você ainda não tem métricas suficientes nos últimos ${METRICS_FETCH_DAYS_LIMIT} dias para gerar este relatório.`
             );
        }

    } catch (error: any) {
        logger.error(`${TAG} Erro ao gerar relatório agregado para ${userId}:`, error);
        // Relança erros específicos conhecidos
        if (error instanceof MetricsNotFoundError || error instanceof ReportAggregationError || error instanceof DetailedStatsError) {
            throw error;
        }
        // Lança erro genérico se não for um dos tipos esperados
        throw new ReportAggregationError(`Falha ao processar suas métricas para gerar o relatório: ${error.message}`);
    }

    /* --- 3. Busca Detalhes dos Top/Bottom Posts (REMOVIDO) --- */
    // A função buildAggregatedReport v4.0 já inclui top3Posts e bottom3Posts
    logger.debug(`${TAG} Detalhes Top/Bottom posts incluídos diretamente em aggregatedReport.`);

    /* --- 4. Monta o Objeto Final Enriquecido --- */
    logger.debug(`${TAG} Montando relatório enriquecido final para ${userId}`);
    const enrichedReport: IEnrichedReport = {
        overallStats: aggregatedReport.overallStats,
        profileSegment: getUserProfileSegment(user),
        multimediaSuggestion: getMultimediaSuggestion(aggregatedReport),
        top3Posts: aggregatedReport.top3Posts, // Pega diretamente do relatório
        bottom3Posts: aggregatedReport.bottom3Posts, // Pega diretamente do relatório
        durationStats: aggregatedReport.durationStats,
        detailedContentStats: aggregatedReport.detailedContentStats,
        proposalStats: aggregatedReport.proposalStats,
        contextStats: aggregatedReport.contextStats,
        historicalComparisons: growthData.historical,
        longTermComparisons: growthData.longTerm,
        performanceByDayPCO: aggregatedReport.performanceByDayPCO
    };

    // Retorna o objeto preparado
    return { enrichedReport };
}

// extractReferenceAndFindPost (mantida sem alterações)
export async function extractReferenceAndFindPost(
    text: string,
    userId: Types.ObjectId
): Promise<ReferenceSearchResult> {
    logger.debug(`[extractReferenceAndFindPost v2.10] Buscando referência "${text}" para usuário ${userId}`);
    const quotedText = text.match(/["“”'](.+?)["“”']/)?.[1];
    const aboutText = text.match(/(?:sobre|referente a)\s+(.+)/i)?.[1]?.trim();
    const reference = quotedText || aboutText || text.trim();

    if (!reference) {
        logger.warn(`[extractReferenceAndFindPost v2.10] Referência vazia ou inválida: "${text}"`);
        return { status: 'clarify', message: 'Hum, não consegui entender a referência do post. 🤔 Poderia me dizer uma parte única da descrição ou o link dele?' };
    }
    logger.debug(`[extractReferenceAndFindPost v2.10] Referência extraída: "${reference}"`);

    try {
        const escapedReference = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedReference, 'i');

        const posts = await Metric.find({ user: userId, description: regex })
            .select('_id description proposal context')
            .limit(5)
            .lean();

        if (!posts.length) {
            logger.info(`[extractReferenceAndFindPost v2.10] Nenhum post encontrado para referência "${reference}" e usuário ${userId}`);
            return { status: 'clarify', message: `Não achei nenhum post com a descrição parecida com "${reference}". Pode tentar descrever de outra forma ou me mandar o link?` };
        }

        if (posts.length === 1) {
            const post = posts[0]!;
            logger.info(`[extractReferenceAndFindPost v2.10] Post único encontrado para referência "${reference}" (ID: ${post._id})`);
            return { status: 'found', post: { _id: post._id, description: post.description || '', proposal: post.proposal, context: post.context } };
        }

        logger.info(`[extractReferenceAndFindPost v2.10] ${posts.length} posts encontrados para referência "${reference}", pedindo clarificação.`);
        const postList = posts.map((p, i) => `${i + 1}. "${(p.description || 'Sem descrição').slice(0, 60)}…"`) .join('\n');
        return { status: 'clarify', message: `Encontrei ${posts.length} posts com descrição parecida:\n${postList}\n\nQual deles você quer analisar? (Digite o número)` };

    } catch (error: any) {
        logger.error(`[extractReferenceAndFindPost v2.10] Erro ao buscar post por referência "${reference}" para usuário ${userId}:`, error);
        return { status: 'error', message: `Ocorreu um erro ao buscar o post. Tente novamente mais tarde. (Detalhe: ${error.message})` };
    }
}

// getLatestAggregatedReport (mantida sem alterações - ainda é placeholder)
export async function getLatestAggregatedReport(userId: string): Promise<AggregatedReport | null> {
    const TAG = '[getLatestAggregatedReport v2.10]'; // Atualiza tag
    logger.debug(`${TAG} Buscando último relatório agregado para usuário ${userId}`);
     if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido fornecido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }
    try {
        // --- LÓGICA PLACEHOLDER ---
        const reportDocument: AggregatedReport | null = null; // Simula não encontrar
        // --- SUBSTITUA PELA SUA LÓGICA REAL ---
        if (reportDocument) {
            logger.info(`${TAG} Último relatório encontrado para ${userId}.`);
            return reportDocument;
        } else {
            logger.info(`${TAG} Nenhum relatório agregado encontrado para ${userId}.`);
            return null;
        }
    } catch (error: any) {
        logger.error(`${TAG} Erro de banco de dados ao buscar último relatório para ${userId}:`, error);
        throw new DatabaseError(`Erro ao buscar último relatório: ${error.message}`);
    }
}

// getAdDealInsights (mantida sem alterações)
export async function getAdDealInsights(
    userId: string,
    period: 'last30d' | 'last90d' | 'all' = 'last90d'
): Promise<AdDealInsights | null> {
    const TAG = '[getAdDealInsights v2.10]'; // Atualiza tag
    logger.debug(`${TAG} Calculando insights de AdDeals para User ${userId}, período: ${period}`);
    if (!mongoose.isValidObjectId(userId)) {
        logger.error(`${TAG} ID de usuário inválido: ${userId}`);
        throw new DatabaseError(`ID de usuário inválido: ${userId}`);
    }
    const userIdObj = new Types.ObjectId(userId);
    let dateFilter = {};
    const now = new Date();
    if (period === 'last30d') { dateFilter = { $gte: subDays(now, 30) }; }
    else if (period === 'last90d') { dateFilter = { $gte: subDays(now, 90) }; }

    try {
        const baseQuery = { userId: userIdObj, dealDate: dateFilter };
        const totalDeals = await AdDeal.countDocuments(baseQuery);
        logger.debug(`${TAG} Total de deals no período: ${totalDeals}`);
        if (totalDeals === 0) {
            logger.info(`${TAG} Nenhum AdDeal encontrado para User ${userId} no período ${period}.`);
            return null;
        }

        const [revenueStats, segmentStats, compensationStats, deliverableStats, platformStats, frequencyStats] = await Promise.all([
            // ... (agregações mantidas) ...
             AdDeal.aggregate([ { $match: { ...baseQuery, compensationType: { $in: ['Valor Fixo', 'Misto'] }, compensationCurrency: 'BRL' } }, { $group: { _id: null, totalRevenueBRL: { $sum: '$compensationValue' }, countPaid: { $sum: 1 } } } ]),
             AdDeal.aggregate([ { $match: { ...baseQuery, brandSegment: { $nin: [null, ""] } } }, { $group: { _id: '$brandSegment', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 3 } ]),
             AdDeal.aggregate([ { $match: { ...baseQuery, compensationValue: { $ne: null }, compensationCurrency: 'BRL' } }, { $group: { _id: '$compensationType', avgValueBRL: { $avg: '$compensationValue' }, count: { $sum: 1 } } } ]),
             AdDeal.aggregate([ { $match: { ...baseQuery, deliverables: { $ne: null, $exists: true } } }, { $unwind: '$deliverables' }, { $match: { deliverables: { $nin: [null, ""] } } }, { $group: { _id: '$deliverables', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 } ]),
             AdDeal.aggregate([ { $match: { ...baseQuery, platform: { $nin: [null, ""] } } }, { $group: { _id: '$platform', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 3 } ]),
             AdDeal.aggregate([ { $match: baseQuery }, { $group: { _id: null, firstDealDate: { $min: "$dealDate" }, lastDealDate: { $max: "$dealDate" }, totalDeals: { $sum: 1 } } }, { $project: { _id: 0, totalDeals: 1, periodInDays: { $max: [ { $divide: [ { $subtract: ["$lastDealDate", "$firstDealDate"] }, 1000 * 60 * 60 * 24 ] }, 1 ] } } } ])
        ]);

        // ... (processamento dos resultados mantido) ...
        const revenueResult = revenueStats[0] || { totalRevenueBRL: 0, countPaid: 0 };
        const avgDealValueBRL = revenueResult.countPaid > 0 ? revenueResult.totalRevenueBRL / revenueResult.countPaid : undefined;
        const commonBrandSegments = segmentStats.map(s => s._id).filter(s => s);
        const avgValueByCompensation = compensationStats.reduce((acc, curr) => { if (curr._id) { acc[curr._id] = curr.avgValueBRL; } return acc; }, {} as { [key: string]: number });
        const commonDeliverables = deliverableStats.map(d => d._id).filter(d => d);
        const commonPlatforms = platformStats.map(p => p._id).filter(p => p);
        let dealsFrequency: number | undefined = undefined;
        if (frequencyStats.length > 0 && frequencyStats[0].periodInDays >= 1 && frequencyStats[0].totalDeals > 0) { const days = frequencyStats[0].periodInDays; const deals = frequencyStats[0].totalDeals; dealsFrequency = (deals / days) * 30.44; }

        const insights: AdDealInsights = {
            period, totalDeals, totalRevenueBRL: revenueResult.totalRevenueBRL ?? 0,
            averageDealValueBRL: avgDealValueBRL, commonBrandSegments, avgValueByCompensation,
            commonDeliverables, commonPlatforms, dealsFrequency
        };

        logger.info(`${TAG} Insights de AdDeals calculados com sucesso para User ${userId}.`);
        logger.debug(`${TAG} Insights:`, insights);
        return insights;

    } catch (error: any) {
        logger.error(`${TAG} Erro ao calcular insights de AdDeals para User ${userId}:`, error);
        throw new DatabaseError(`Erro ao calcular insights de publicidade: ${error.message}`);
    }
}
