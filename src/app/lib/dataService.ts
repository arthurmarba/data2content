// @/app/lib/dataService.ts - v2.2 (Passa performanceByDayPCO + Placeholders)

import { Model, Types } from "mongoose";
import User, { IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";
import { subDays, differenceInDays } from "date-fns"; // Importa differenceInDays
import { logger } from '@/app/lib/logger';

// Importa funções e tipos de reportHelpers
import {
    buildAggregatedReport,
    AggregatedReport,
    DurationStat,
    OverallStats,
    DetailedContentStat,
    ProposalStat,
    ContextStat,
    PerformanceByDayPCO, // <<< Importa a nova interface
    ReportAggregationError,
    DetailedStatsError
} from "@/app/lib/reportHelpers"; // Assume que PerformanceByDayPCO está exportada aqui

// Importa tipos de erro personalizados
import {
    BaseError, UserNotFoundError, MetricsNotFoundError,
    DatabaseError
} from "@/app/lib/errors";

// --- Constantes Usadas Internamente ---
const METRICS_FETCH_DAYS_LIMIT = 180;
const SCRIPT_KEYWORDS = ["roteiro", "script", "estrutura", "outline", "sequencia", "escreve pra mim", "como fazer video sobre", "estrutura de post", "roteiriza"];
const NEW_USER_THRESHOLD_DAYS = 90; // Exemplo: Usuários com menos de 90 dias são "Novos"

// --- Interfaces e Tipos Relacionados a Dados ---

interface ReportDataInput {
    user: IUser;
    dailyMetricModel: Model<IDailyMetric>;
    contentMetricModel: Model<IMetric>;
}

// Interface principal para o relatório enriquecido que este serviço produz
// <<< ATUALIZADA v2.2 >>> Inclui performanceByDayPCO opcional
export interface IEnrichedReport {
    overallStats?: OverallStats;
    profileSegment: string;
    multimediaSuggestion: string;
    top3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    bottom3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[];
    proposalStats?: ProposalStat[];
    contextStats?: ContextStat[];
    historicalComparisons?: IGrowthComparisons; // Placeholder
    longTermComparisons?: IGrowthComparisons;  // Placeholder
    performanceByDayPCO?: PerformanceByDayPCO; // <<< NOVO CAMPO OPCIONAL
}

interface PreparedData {
    enrichedReport: IEnrichedReport; // Usa a interface atualizada
}

export type ReferenceSearchResult =
    | { status: 'found'; post: { _id: Types.ObjectId; description: string; proposal?: string; context?: string; } }
    | { status: 'clarify'; message: string }
    | { status: 'error'; message: string };

// Interface para comparações de crescimento (Exemplos)
interface IGrowthComparisons {
    weeklyFollowerChange?: number;
    monthlyReachTrend?: 'up' | 'down' | 'stable';
    // Adicionar outras comparações relevantes
}

// Interface para o resultado de getCombinedGrowthData (Exemplos)
interface IGrowthDataResult {
    historical?: IGrowthComparisons;
    longTerm?: IGrowthComparisons;
    // Adicionar outros dados de crescimento
}


// --- Funções Placeholder Implementadas (Relacionadas a Dados/Perfil) ---

/**
 * Obtém segmento do perfil (Exemplo básico baseado na data de criação).
 */
const getUserProfileSegment = (user: IUser): string => {
    const fnTag = "[getUserProfileSegment]";
    try {
        if (user.createdAt && user.createdAt instanceof Date && !isNaN(user.createdAt.getTime())) {
            const daysSinceCreation = differenceInDays(new Date(), user.createdAt);
            logger.debug(`${fnTag} - Dias desde criação: ${daysSinceCreation}`);
            if (daysSinceCreation < NEW_USER_THRESHOLD_DAYS) {
                return "Novo Usuário";
            } else {
                return "Usuário Veterano";
            }
        } else {
             logger.warn(`${fnTag} - user.createdAt inválido ou ausente. Usando segmento 'Geral'. User ID: ${user._id}`);
             return "Geral";
        }
    } catch (error) {
        logger.error(`${fnTag} - Erro ao calcular segmento:`, error);
        return "Geral"; // Fallback em caso de erro
    }
};

/**
 * Obtém sugestão de multimídia (Exemplo básico baseado em desempenho de duração).
 */
const getMultimediaSuggestion = (report: AggregatedReport | null): string => {
     const fnTag = "[getMultimediaSuggestion]";
     if (!report?.durationStats || report.durationStats.length === 0) {
         logger.debug(`${fnTag} - Sem dados de duração para gerar sugestão.`);
         return ""; // Retorna vazio se não há dados
     }
     try {
        const sortedBySaves = [...report.durationStats].sort((a, b) => (b.averageSaves ?? -Infinity) - (a.averageSaves ?? -Infinity));
        const bestDuration = sortedBySaves[0];

        if (bestDuration && (bestDuration.averageSaves ?? 0) > (report.overallStats?.avgSalvamentos ?? 0)) {
             logger.debug(`${fnTag} - Sugestão gerada baseada na melhor duração por salvamentos: ${bestDuration.range}`);
             if (bestDuration.range.includes('s') && !bestDuration.range.includes('60s+')) {
                 return `Vídeos na faixa de ${bestDuration.range} parecem gerar bons salvamentos. Considere explorar mais esse formato!`;
             } else if (bestDuration.range.includes('60s+')) {
                 return `Vídeos mais longos (+60s) estão com boa média de salvamentos. Pode ser um formato interessante para aprofundar conteúdo!`;
             }
        }
        logger.debug(`${fnTag} - Nenhuma sugestão clara gerada a partir dos dados de duração.`);
        return ""; // Retorna vazio se nenhuma sugestão clara for encontrada
     } catch (error) {
         logger.error(`${fnTag} - Erro ao gerar sugestão:`, error);
         return ""; // Fallback em caso de erro
     }
};


// --- Funções Auxiliares de Busca de Dados ---

/**
 * Placeholder para buscar dados de crescimento combinados.
 */
async function getCombinedGrowthData(userId: Types.ObjectId, dailyMetricModel: Model<IDailyMetric>): Promise<IGrowthDataResult> {
    const fnTag = "[getCombinedGrowthData]";
    logger.debug(`${fnTag} chamado para ${userId} (Placeholder - Implementação Real Necessária)`);
    try {
        // Retorna placeholder enquanto não implementado
        return {
             historical: { weeklyFollowerChange: undefined },
             longTerm: { monthlyReachTrend: undefined }
        };
    } catch (error) {
        logger.error(`${fnTag} - Erro ao buscar dados de crescimento para ${userId}:`, error);
        return { historical: undefined, longTerm: undefined };
    }
}

async function fetchContentDetailsForMetrics(
    metricsToFetch: IDailyMetric[] | undefined,
    contentMetricModel: Model<IMetric>
): Promise<Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined> {
    if (!metricsToFetch || metricsToFetch.length === 0) { logger.debug("[Data Service] fetchContentDetailsForMetrics: Sem métricas para buscar detalhes."); return undefined; }
    const postIds = metricsToFetch .map(dm => dm.postId) .filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));
    if (postIds.length === 0) { logger.debug("[Data Service] fetchContentDetailsForMetrics: Sem postIds válidos nas métricas."); return []; }
    logger.debug(`[Data Service] fetchContentDetailsForMetrics: Buscando detalhes para ${postIds.length} postIds.`);
    try {
        const contentMetrics = await contentMetricModel.find( { _id: { $in: postIds } } ).select('_id description postLink').lean().exec();
        const contentMap = new Map(contentMetrics.map(cm => [cm._id.toString(), cm]));
        const results = metricsToFetch .map(dm => dm.postId ? contentMap.get(dm.postId.toString()) : undefined) .filter(Boolean) as Pick<IMetric, '_id' | 'description' | 'postLink'>[];
        logger.debug(`[Data Service] fetchContentDetailsForMetrics: Encontrados ${results.length} detalhes.`);
        return results;
    } catch (error) { logger.error(`[Data Service] Erro em fetchContentDetailsForMetrics:`, error); throw new DatabaseError(`Falha ao buscar detalhes de conteúdo para ${postIds.length} posts`, error as Error); }
}


// --- Funções Principais Exportadas ---

export async function lookupUser(fromPhone: string): Promise<IUser> {
    const phoneForLog = fromPhone.slice(0, -4) + "****"; logger.debug(`[Data Service] lookupUser: Buscando usuário para ${phoneForLog}`); try { const user = await User.findOne({ whatsappPhone: fromPhone }).lean().exec(); if (!user) { logger.warn(`[Data Service] lookupUser: Usuário não encontrado para ${phoneForLog}`); throw new UserNotFoundError(`Usuário não encontrado: ${phoneForLog}`); } logger.debug(`[Data Service] lookupUser: Usuário encontrado - ID ${user._id}`); return user as IUser; } catch (error) { if (error instanceof UserNotFoundError) { throw error; } logger.error(`[Data Service] lookupUser: Erro de DB para ${phoneForLog}:`, error); throw new DatabaseError(`Erro ao buscar usuário ${phoneForLog}`, error as Error); }
}

export async function fetchAndPrepareReportData({
    user,
    dailyMetricModel,
    contentMetricModel
}: ReportDataInput): Promise<PreparedData> {
    const userId = user._id;
    const userIdStr = userId.toString();
    logger.debug(`[Data Service] fetchAndPrepareReportData: Iniciando para user ${userIdStr}`);

    const metricsStartDate = subDays(new Date(), METRICS_FETCH_DAYS_LIMIT);
    let dailyMetricsRaw: IDailyMetric[] = [];
    let growthData: IGrowthDataResult = {};
    let aggregatedReportResult: AggregatedReport | null = null;

    try {
        [ dailyMetricsRaw, growthData ] = await Promise.all([
            dailyMetricModel.find({ user: userId, postDate: { $gte: metricsStartDate } }) .select('postDate stats user postId _id') .sort({ postDate: -1 }) .lean().exec(),
            getCombinedGrowthData(userId, dailyMetricModel),
        ]);

        logger.debug(`[Data Service] fetchAndPrepareReportData: ${dailyMetricsRaw.length} métricas diárias brutas encontradas para ${userIdStr}.`);

        if (dailyMetricsRaw.length === 0) {
            throw new MetricsNotFoundError(`Sem métricas diárias nos últimos ${METRICS_FETCH_DAYS_LIMIT} dias para ${userIdStr}.`);
        }

        logger.debug(`[Data Service] fetchAndPrepareReportData: Executando buildAggregatedReport para ${userIdStr}...`);
        try {
            // buildAggregatedReport agora retorna AggregatedReport (que pode ter performanceByDayPCO)
            aggregatedReportResult = await buildAggregatedReport(
                dailyMetricsRaw, userId, metricsStartDate, dailyMetricModel, contentMetricModel
            );
        } catch (reportError: unknown) {
            logger.error(`[Data Service] Erro durante buildAggregatedReport para ${userIdStr}:`, reportError);
            if (reportError instanceof ReportAggregationError || reportError instanceof DetailedStatsError) { throw reportError; }
            throw new ReportAggregationError(`Falha ao gerar relatório agregado: ${reportError instanceof Error ? reportError.message : String(reportError)}`, reportError as Error);
        }
        logger.debug(`[Data Service] fetchAndPrepareReportData: buildAggregatedReport concluído.`);

        if (!aggregatedReportResult) {
            throw new ReportAggregationError(`Resultado do buildAggregatedReport é nulo ou inválido para ${userIdStr}`);
        }

        logger.debug(`[Data Service] Stats agregados: F/P/C=${aggregatedReportResult.detailedContentStats?.length ?? 0}, P=${aggregatedReportResult.proposalStats?.length ?? 0}, C=${aggregatedReportResult.contextStats?.length ?? 0}, Has DayPCO=${!!aggregatedReportResult.performanceByDayPCO}`); // Log if DayPCO data exists

        logger.debug(`[Data Service] Buscando detalhes para top/bottom 3 posts...`);
        const [top3Simplified, bottom3Simplified] = await Promise.all([
            fetchContentDetailsForMetrics(aggregatedReportResult.top3, contentMetricModel),
            fetchContentDetailsForMetrics(aggregatedReportResult.bottom3, contentMetricModel)
        ]);
        logger.debug(`[Data Service] Detalhes top/bottom posts obtidos.`);

        if (!aggregatedReportResult?.overallStats) {
            logger.error(`[Data Service] OverallStats ausentes no resultado agregado para ${userIdStr}.`);
            throw new MetricsNotFoundError(`Não foi possível calcular estatísticas gerais (overallStats) para ${userIdStr}`);
        }

        const profileSegment = getUserProfileSegment(user);
        const multimediaSuggestion = getMultimediaSuggestion(aggregatedReportResult);

        // Monta o objeto final enriquecido
        // <<< CORREÇÃO v2.2 >>> Inclui performanceByDayPCO no objeto final
        const enrichedReport: IEnrichedReport = {
            overallStats: aggregatedReportResult.overallStats,
            profileSegment: profileSegment,
            multimediaSuggestion: multimediaSuggestion,
            top3Posts: top3Simplified,
            bottom3Posts: bottom3Simplified,
            durationStats: aggregatedReportResult.durationStats,
            detailedContentStats: aggregatedReportResult.detailedContentStats,
            proposalStats: aggregatedReportResult.proposalStats,
            contextStats: aggregatedReportResult.contextStats,
            historicalComparisons: growthData.historical,
            longTermComparisons: growthData.longTerm,
            performanceByDayPCO: aggregatedReportResult.performanceByDayPCO // <<< ADICIONADO AQUI
        };

        logger.debug(`[Data Service] fetchAndPrepareReportData: Relatório enriquecido montado para ${userIdStr}.`);
        return { enrichedReport };

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[Data Service] Falha em fetchAndPrepareReportData para ${userIdStr}: ${msg}`, { error });
        if (error instanceof MetricsNotFoundError || error instanceof DatabaseError || error instanceof ReportAggregationError || error instanceof DetailedStatsError) { throw error; }
        if (error instanceof Error && error.name === 'MongoServerError') { throw new DatabaseError(`Erro no DB durante preparação do relatório: ${msg}`, error); }
        throw new DatabaseError(`Falha desconhecida ao preparar relatório: ${msg}`, error as Error);
    }
}


export async function extractReferenceAndFindPost(
    text: string,
    userId: Types.ObjectId
): Promise<ReferenceSearchResult> {
    const versionTag = "[Data Service v2.1]"; logger.debug(`${versionTag} extractReferenceAndFindPost: Tentando extrair referência de: "${text.substring(0, 50)}..." para user ${userId}`); let referenceText: string | null = null; const quoteMatch = text.match(/["'](.+?)["']/); if (quoteMatch && quoteMatch[1]) { referenceText = quoteMatch[1].trim(); logger.debug(`${versionTag} Referência extraída (aspas): "${referenceText}"`); } if (!referenceText) { const aboutMatch = text.match(/(?:sobre|baseado em)\s+(.+)/i); if (aboutMatch && aboutMatch[1]) { const potentialRef = aboutMatch[1].trim(); const scriptKeywordFound = SCRIPT_KEYWORDS.find(kw => potentialRef.toLowerCase().endsWith(kw)); referenceText = scriptKeywordFound ? potentialRef.substring(0, potentialRef.toLowerCase().lastIndexOf(scriptKeywordFound)).trim() : potentialRef; if (!referenceText) { logger.debug(`${versionTag} Referência após keyword resultou vazia.`); referenceText = null; } else { logger.debug(`${versionTag} Referência extraída (keyword): "${referenceText}"`); } } } if (!referenceText) { logger.debug(`${versionTag} Nenhuma referência textual clara encontrada para roteiro.`); return { status: 'clarify', message: "Entendi que você quer um roteiro! 👍 Para gerar o melhor roteiro, preciso saber exatamente a qual ideia ou post você se refere. Você poderia:\n\n1.  **Colar o link** do post original?\n2.  Me dar uma **descrição curta e única** do post?\n3.  Ou me dizer o **tema principal** E qual o **ângulo específico** ou **mensagem chave** que você quer abordar agora?" }; } try { const escapedReference = referenceText.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'); logger.debug(`${versionTag} Buscando posts para User ${userId} com regex: "${escapedReference}"`); const potentialPosts = await Metric.find({ user: userId, description: { $regex: escapedReference, $options: 'i' } }) .select('_id description proposal context') .limit(5) .sort({ createdAt: -1 }) .lean(); logger.debug(`${versionTag} Encontrados ${potentialPosts.length} posts potenciais para a referência "${referenceText}".`); if (potentialPosts.length === 0) { logger.debug(`${versionTag} Nenhum post encontrado na busca por referência.`); return { status: 'clarify', message: `Hmm, não encontrei nenhum post recente seu sobre "${referenceText}". 😕 Para gerar o roteiro, você poderia:\n\n1.  Tentar **outras palavras-chave** da descrição?\n2.  **Colar o link** do post?\n3.  Ou me dizer o **ângulo específico** ou **mensagem chave** que você quer abordar nesse tema "${referenceText}"?` }; } if (potentialPosts.length === 1) { const foundPost = potentialPosts[0]; if (foundPost) { logger.debug(`${versionTag} Encontrado post único: ${foundPost._id}`); if (!foundPost.description) { logger.warn(`${versionTag} Post ${foundPost._id} encontrado, mas sem descrição.`); return { status: 'error', message: 'Encontrei o post que você mencionou, mas ele parece não ter uma descrição para eu poder analisar e criar o roteiro. 🤔'} } return { status: 'found', post: { _id: foundPost._id, description: foundPost.description, proposal: foundPost.proposal, context: foundPost.context } }; } else { logger.error(`${versionTag} Erro lógico: potentialPosts[0] indefinido mesmo com length === 1`); return { status: 'error', message: 'Erro interno ao processar o post encontrado.'}; } } logger.debug(`${versionTag} Múltiplos posts (${potentialPosts.length}) encontrados para "${referenceText}". Pedindo clarificação.`); let clarifyMsg = `Encontrei ${potentialPosts.length} posts recentes sobre "${referenceText}". Para qual deles você quer o roteiro?\n\n`; potentialPosts.forEach((p, i) => { clarifyMsg += `${i + 1}. "${(p?.description || 'Sem descrição').substring(0, 60)}..."\n`; }); clarifyMsg += `\nResponda com o número correspondente.`; return { status: 'clarify', message: clarifyMsg }; } catch (dbError) { logger.error(`${versionTag} Erro no DB buscando referência de post:`, dbError); return { status: 'error', message: 'Tive um problema ao buscar seus posts para o roteiro. Tente novamente mais tarde, por favor.' }; }
}


// ====================================================
// FIM: dataService.ts (v2.2 - Passa performanceByDayPCO)
// ====================================================
