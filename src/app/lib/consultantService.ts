// <<< IMPORTANTE: Backfill de Dados Históricos >>>
// Lembre-se que para a análise histórica por formato funcionar corretamente,
// você precisará executar um processo para preencher o campo 'format'
// nos documentos Metric existentes no seu banco de dados.
// =======================================================

import { Model, Types } from "mongoose";
import User, { IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";

import {
    buildAggregatedReport,
    AggregatedReport,
    DurationStat,
    OverallStats,
    DetailedContentStat,
    ReportAggregationError,
    // <<< Adicionando tipos com comparação - Defina-os em reportHelpers.ts >>>
    // DetailedContentStatWithComparison, // Descomente se/quando implementar
    // DurationStatWithComparison // Descomente se/quando implementar
} from "@/app/lib/reportHelpers"; // Ajuste o caminho

import {
    BaseError,
    UserNotFoundError,
    MetricsNotFoundError,
    AIError,
    CacheError,
    DatabaseError
} from "@/app/lib/errors";

import { callOpenAIForQuestion } from "@/app/lib/aiService";
import { subDays } from "date-fns";
import opossum from "opossum";
import { logger } from '@/app/lib/logger';
import { createClient } from "redis";

// Tipos auxiliares para os dados comparativos (TEMP - Definidos aqui localmente)
// TODO: Mover para reportHelpers.ts quando a lógica de cálculo for implementada lá
interface DetailedContentStatWithComparison extends DetailedContentStat {
    avgSharesVsOverall?: number;
}
interface DurationStatWithComparison extends DurationStat {
    avgSharesVsOverall?: number;
}

// ====================================================
// Função Auxiliar de Normalização de Texto
// ====================================================
function normalizeText(text: string | undefined | null): string {
    if (!text) return "";
    return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ====================================================
// Constantes de Configuração e Palavras-chave
// ====================================================
const METRICS_FETCH_DAYS_LIMIT = 180;
const CONTENT_METRICS_LIMIT = 10;
const GREETING_RECENCY_THRESHOLD_MINUTES = 15;
const HISTORY_RAW_LINES_LIMIT = 10;
const REDIS_CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const REDIS_STATE_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;

// ====================================================
// Constantes de Palavras-chave
// ====================================================
const POSITIVE_SENTIMENT_KEYWORDS = ["bom", "ótimo", "legal", "gostei", "excelente", "feliz", "aumentou", "cresceu", "sim", "curti", "ajudou", "obrigado", "obrigada", "aplicável", "útil", "util"];
const NEGATIVE_SENTIMENT_KEYWORDS = ["ruim", "péssimo", "triste", "problema", "difícil", "caiu", "diminuiu", "preocupado", "não", "nao", "confuso", "perdi", "piorou", "inválido", "genérico"];
const GREETING_KEYWORDS = ["oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite", "e aí", "eae"];
const REQUEST_KEYWORDS = ["métrica", "dado", "ajuda", "info", "relatório", "resumo", "plano", "performance", "número", "analisa", "analise", "visão geral", "detalhado", "completo", "estratégia", "postar", "ideia", "conteúdo", "sugestão", "justifica", "explica", "detalha", "métricas", "por que", "melhor dia", "melhor hora", "formato", "proposta", "contexto"];
const CONTENT_IDEAS_KEYWORDS = [ "ideia", "conteúdo", "sugestão de post", "sugestões de post", "sugere", "sugestão", "o que postar", "inspiração", "exemplos de posts", "dicas de conteúdo", "ideias criativas" ];
const BEST_TIME_KEYWORDS = ["melhor dia", "melhor hora", "melhor horário", "qual dia", "qual hora", "qual horário", "quando postar", "frequência", "cadência"];
const JUSTIFICATION_KEYWORDS = ["por que", "porque", "pq", "justifica", "explica", "baseado em", "como assim", "detalha", "qual a lógica", "fundamento", "embase", "embasar"];
const REPORT_KEYWORDS = ["relatório", "relatorio", "plano", "estratégia", "detalhado", "completo"];
const FEEDBACK_POSITIVE_KEYWORDS = ["sim", "gostei", "útil", "util", "aplicável", "ajudou", "boa"];
const FEEDBACK_NEGATIVE_KEYWORDS = ["não", "nao"];
const FEEDBACK_NEUTRAL_RESPONSE_WORDS = ["não", "nao"];

// Normalizadas
const NORMALIZED_REQUEST_KEYWORDS = REQUEST_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_IDEAS_KEYWORDS = CONTENT_IDEAS_KEYWORDS.map(normalizeText);
const NORMALIZED_BEST_TIME_KEYWORDS = BEST_TIME_KEYWORDS.map(normalizeText);
const NORMALIZED_JUSTIFICATION_KEYWORDS = JUSTIFICATION_KEYWORDS.map(normalizeText);
const NORMALIZED_REPORT_KEYWORDS = REPORT_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS = FEEDBACK_POSITIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS = FEEDBACK_NEGATIVE_KEYWORDS.map(normalizeText);

// ====================================================
// Interfaces e Tipos
// ====================================================
type IAggregatedStats = object;
interface IGrowthComparisons { curtidasGrowth: string; comentariosGrowth: string; compartilhamentosGrowth: string; visualizacoesGrowth: string; salvamentosGrowth: string; }
interface IEnrichedReport {
    overallStats?: OverallStats;
    contentDetails: Pick<IMetric, 'description' | 'postLink'>[];
    historicalComparisons?: IGrowthComparisons;
    longTermComparisons?: IGrowthComparisons;
    profileSegment: string;
    multimediaSuggestion: string;
    top3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    bottom3Posts?: Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    durationStats?: DurationStat[];
    detailedContentStats?: DetailedContentStat[];
}
interface IGrowthDataResult { historicalAverages?: OverallStats, recent90Averages?: OverallStats, previous90Averages?: OverallStats }
interface ReportDataInput { user: IUser; dailyMetricModel: Model<IDailyMetric>; contentMetricModel: Model<IMetric>; }
interface PreparedData { enrichedReport: IEnrichedReport; }
interface IDialogueState { lastInteraction?: number; lastGreetingSent?: number; /* ... */ }

// ====================================================
// Redis: Inicialização e Funções de Cache
// ====================================================
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
let redisInitialized = false; let isConnecting = false;
redisClient.on('error', (err: Error) => { logger.error('[Redis] Erro:', err); redisInitialized = false; });
redisClient.on('connect', () => { logger.info('[Redis] Conectando...'); });
redisClient.on('ready', () => { logger.info('[Redis] Conectado.'); redisInitialized = true; isConnecting = false; });
redisClient.on('end', () => { logger.warn('[Redis] Conexão encerrada.'); redisInitialized = false; });
const initializeRedis = async (): Promise<void> => { if (!redisInitialized && !isConnecting) { isConnecting = true; logger.info('[Redis] Tentando conectar...'); try { await redisClient.connect(); } catch (err) { logger.error('[Redis] Falha inicial:', err); isConnecting = false; } } };
initializeRedis();
const ensureRedisConnection = async <T>( operation: () => Promise<T>, operationName: string, key?: string ): Promise<T> => { if (!redisInitialized) { logger.warn(`[Redis] Operação '${operationName}'${key ? ` para key '${key}'` : ''} sem conexão. Tentando reconectar...`); await initializeRedis(); if (!redisInitialized) throw new CacheError(`Redis indisponível para ${operationName}`); logger.info(`[Redis] Reconectado, continuando '${operationName}'...`) } try { return await Promise.race([ operation(), new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Redis operation timed out')), 5000)) ]); } catch (error) { const errMsg = `Falha na operação Redis '${operationName}'${key ? ` para key '${key}'` : ''}`; logger.error(`[Redis] ${errMsg}`, error); throw new CacheError(errMsg, error instanceof Error ? error : undefined); } };
const getFromCache = async (key: string): Promise<string | null> => { try { return await ensureRedisConnection<string | null>(() => redisClient.get(key), 'getFromCache', key); } catch (error) { if (error instanceof CacheError) { logger.warn(`[Cache] Falha GET (key: ${key}).`, error.message); return null; } throw error; } };
const setInCache = async (key: string, value: string, ttlSeconds: number): Promise<string | null> => { try { return await ensureRedisConnection<string | null>(() => redisClient.set(key, value, { EX: ttlSeconds }), 'setInCache', key); } catch (error) { if (error instanceof CacheError) { logger.warn(`[Cache] Falha SET (key: ${key}).`, error.message); return null; } throw error; } };

// ====================================================
// Funções Auxiliares Básicas
// ====================================================
const selectRandom = <T>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];
const getRandomGreeting = (userName: string): string => selectRandom([`Oi ${userName}!`, `Olá ${userName}!`, `E aí ${userName}, tudo certo?`]) ?? `Olá ${userName}!`;

// ====================================================
// Análise de Sentimento
// ====================================================
// <<< CORPO DA FUNÇÃO VERIFICADO/RESTAURADO >>>
const advancedAnalyzeSentiment = (text: string): "positive" | "negative" | "neutral" => {
    const lowerText = text.toLowerCase();
    const hasPositive = POSITIVE_SENTIMENT_KEYWORDS.some(kw => lowerText.includes(kw));
    const hasNegative = NEGATIVE_SENTIMENT_KEYWORDS.some(kw => lowerText.includes(kw));
    if (hasPositive && !hasNegative) return "positive";
    if (hasNegative && !hasPositive) return "negative";
    return "neutral";
 };

// ====================================================
// Gerenciamento de Diálogo e Histórico
// ====================================================
// <<< CORPO DA FUNÇÃO VERIFICADO/RESTAURADO >>>
const getDialogueState = async (userId: string): Promise<IDialogueState> => {
    const stateJson = await ensureRedisConnection<string | null>(() => redisClient.get(`state:${userId}`), 'getDialogueState', userId);
    if (stateJson) {
        try { return JSON.parse(stateJson); }
        catch (e) { logger.error(`[Dialogue] Erro parse estado ${userId}`, e); return {} as IDialogueState; }
    }
    return {} as IDialogueState;
};
const updateDialogueState = async (userId: string, newState: IDialogueState): Promise<string | null> => {
     try {
         const stateJson = JSON.stringify(newState);
         return await ensureRedisConnection<string | null>(() => redisClient.set(`state:${userId}`, stateJson, { EX: REDIS_STATE_TTL_SECONDS }), 'updateDialogueState', userId);
     } catch (e) { logger.error(`[Dialogue] Erro save estado ${userId}`, e); if (e instanceof CacheError) throw e; throw new BaseError("Falha ao salvar estado do diálogo.", e as Error); }
};
const getConversationHistory = async (userId: string): Promise<string> => {
     const historyLines = await ensureRedisConnection<string[]>(() => redisClient.lRange(`history:${userId}`, -HISTORY_RAW_LINES_LIMIT, -1), 'getConversationHistory (lRange)', userId);
     return historyLines.join('\n');
 };
const updateConversationHistory = async (userId: string, newEntry: string): Promise<'OK'> => {
     try {
          await ensureRedisConnection<number>(() => redisClient.rPush(`history:${userId}`, newEntry),'updateConversationHistory (rPush)', userId);
          await ensureRedisConnection<string>(() => redisClient.lTrim(`history:${userId}`, -100, -1), 'updateConversationHistory (lTrim)', userId);
          await ensureRedisConnection<boolean>(() => redisClient.expire(`history:${userId}`, REDIS_HISTORY_TTL_SECONDS), 'updateConversationHistory (expire)', userId);
          return 'OK';
     } catch (error) { logger.error(`[History] Erro ao atualizar histórico ${userId}:`, error); throw error; }
 };

// ====================================================
// Sumarização de Histórico
// ====================================================
async function summarizeConversationHistory(historyText: string): Promise<string> {
    const lines = historyText.split('\n');
    if (lines.length > HISTORY_RAW_LINES_LIMIT * 2) {
        logger.warn(`[Summarize] Histórico (${lines.length} linhas) > ${HISTORY_RAW_LINES_LIMIT * 2}, usando truncado.`);
        // TODO: Implementar sumarização real com IA aqui, se necessário
        return lines.slice(-HISTORY_RAW_LINES_LIMIT * 2).join('\n');
    }
    return historyText;
}

// ====================================================
// Feedback, Personalização, Grafo (Placeholders)
// ====================================================
const updateUserFeedback = async (userId: string): Promise<number | null> => { logger.warn(`[Feedback] updateUserFeedback não implementado ${userId}.`); return null; };
const getUserProfileSegment = (/* user: IUser */): string => { return "Geral"; };
const getMultimediaSuggestion = (): string => { return ""; };
const adjustTone = (tone: string): string => { return tone; };
const persistDialogueGraph = async (): Promise<void> => { logger.warn("[Graph] persistDialogueGraph não implementado."); };
const getGraphSummary = async (): Promise<string> => { return ""; };

// ====================================================
// Funções de Busca de Dados
// ====================================================
/** @throws {DatabaseError} */
// <<< CORPO DA FUNÇÃO VERIFICADO/RESTAURADO (com cast) >>>
async function getCombinedGrowthData(userId: Types.ObjectId, dailyMetricModel: Model<IDailyMetric>): Promise<IGrowthDataResult> {
    try {
        logger.warn(`[DB:Facet] getCombinedGrowthData não implementado ${userId}.`);
        return {} as IGrowthDataResult; // Afirmação de tipo
    } catch(error) {
        logger.error(`[DB:Facet] Erro $facet ${userId}:`, error);
        throw new DatabaseError(`Falha crescimento agregado ${userId}`, error as Error);
    }
}
/** @throws {DatabaseError} */
// <<< CORPO DA FUNÇÃO VERIFICADO/RESTAURADO >>>
async function fetchContentDetailsForMetrics(metricsToFetch: IDailyMetric[] | undefined, contentMetricModel: Model<IMetric>): Promise<Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined> {
    if (!metricsToFetch || metricsToFetch.length === 0) return undefined;
    const postIdsToFetch = metricsToFetch.map(dm => dm.postId).filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));
    if (postIdsToFetch.length === 0) return [];
    try {
        const contentMetrics = await contentMetricModel.find({ _id: { $in: postIdsToFetch } }).select('_id description postLink').lean().exec();
        const contentMap = new Map(contentMetrics.map(cm => [cm._id.toString(), { _id: cm._id, description: cm.description, postLink: cm.postLink }]));
        return metricsToFetch.map(dm => contentMap.get(dm.postId?.toString() ?? '')).filter(Boolean) as Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    } catch (error) {
        logger.error(`[fetchContentDetails] Erro PostIDs:`, error);
        throw new DatabaseError(`Falha detalhes conteúdo`, error as Error);
    }
}

// ====================================================
// Preparação de Dados
// ====================================================
/** @throws {MetricsNotFoundError|DatabaseError|ReportAggregationError} */
async function fetchAndPrepareReportData({ user, dailyMetricModel, contentMetricModel }: ReportDataInput): Promise<PreparedData> {
    const userId = user._id; const userIdStr = userId.toString();
    logger.debug(`[fetchData] Iniciando para ${userIdStr}`);
    const metricsStartDate = subDays(new Date(), METRICS_FETCH_DAYS_LIMIT);
    let dailyMetricsRaw: IDailyMetric[] = []; let contentMetricsRaw: Pick<IMetric, 'description' | 'postLink'>[] = [];
    let growthData: IGrowthDataResult = {}; let aggregatedReportResult: AggregatedReport | null = null;
    try {
        logger.debug(`[fetchData] Buscando dados brutos...`);
        [ dailyMetricsRaw, contentMetricsRaw, growthData ] = await Promise.all([
            dailyMetricModel.find({ user: userId, postDate: { $gte: metricsStartDate } }).select('postDate stats user postId _id').sort({ postDate: -1 }).lean().exec(),
            contentMetricModel.find({ user: userId }).select('description postLink').sort({ postDate: -1 }).limit(CONTENT_METRICS_LIMIT).lean().exec(),
            getCombinedGrowthData(userId, dailyMetricModel),
        ]);
        logger.debug(`[fetchData] Brutos: ${dailyMetricsRaw.length} Daily, ${contentMetricsRaw.length} Content.`);
        if (dailyMetricsRaw.length === 0) throw new MetricsNotFoundError(`Sem métricas diárias (${METRICS_FETCH_DAYS_LIMIT}d)`);
        logger.debug(`[fetchData] Executando buildAggregatedReport...`);
        aggregatedReportResult = await buildAggregatedReport(dailyMetricsRaw, userId, metricsStartDate, dailyMetricModel, contentMetricModel as Model<IMetric>);
        logger.debug(`[fetchData] buildAggregatedReport OK.`);
        logger.debug(`[fetchData] Buscando detalhes top/bottom...`);
        const [top3Simplified, bottom3Simplified] = await Promise.all([ fetchContentDetailsForMetrics(aggregatedReportResult.top3, contentMetricModel), fetchContentDetailsForMetrics(aggregatedReportResult.bottom3, contentMetricModel) ]);
        let historicalComparisons: IGrowthComparisons | undefined = undefined; let longTermComparisons: IGrowthComparisons | undefined = undefined;
        logger.warn("[fetchData] Cálculos de comparação não implementados.");
        if (!aggregatedReportResult?.overallStats) { logger.error(`[fetchData] overallStats ausentes.`); if (growthData.recent90Averages) { logger.warn(`[fetchData] Usando recent90Averages como fallback.`); aggregatedReportResult = { ...aggregatedReportResult, overallStats: growthData.recent90Averages as unknown as OverallStats }; } else { throw new MetricsNotFoundError(`Não foi possível calcular overallStats para ${userIdStr}`); } }
        const profileSegment = getUserProfileSegment(/* user */);
        const enrichedReport: IEnrichedReport = {
            overallStats: aggregatedReportResult.overallStats, contentDetails: contentMetricsRaw, historicalComparisons, longTermComparisons,
            profileSegment: profileSegment, multimediaSuggestion: getMultimediaSuggestion(), top3Posts: top3Simplified, bottom3Posts: bottom3Simplified,
            durationStats: aggregatedReportResult.durationStats, detailedContentStats: aggregatedReportResult.detailedContentStats,
        };
        logger.debug(`[fetchData] Relatório enriquecido montado.`);
        return { enrichedReport };
    } catch (error: unknown) { const errorMessage = error instanceof Error ? error.message : String(error); logger.error(`[fetchData] Falha para ${userIdStr}: ${errorMessage}`, { error }); if (error instanceof MetricsNotFoundError || error instanceof DatabaseError || error instanceof ReportAggregationError) throw error; if (error instanceof Error && error.name === 'MongoServerError') throw new DatabaseError(`DB error: ${error.message}`, error); throw new DatabaseError(`Falha desconhecida preparar relatório: ${errorMessage}`, error as Error); }
}


// ==================================================================
// Geração de Prompts (REFATORADO V4.2 - CORRIGIDO SYNTAX ERROR)
// ==================================================================

/**
 * Formata os dados do relatório de forma concisa para o prompt da IA.
 */
function formatReportDataForPromptV4_2(report: IEnrichedReport, maxDetailedStats: number = 5): string {
    let dataString = "\n# Dados Analisados (Resumo):\n";
    let durationStatsString = "";
    const comparisonPlaceholder = "";
    const overallAvgSharesNum = report.overallStats?.avgCompartilhamentos;

    if (report.overallStats) {
        dataString += `## Métricas Gerais (Médias):\n- Comp.: ${report.overallStats.avgCompartilhamentos?.toFixed(1) ?? 'N/A'} | Salv.: ${report.overallStats.avgSalvamentos?.toFixed(1) ?? 'N/A'} | Curt.: ${report.overallStats.avgCurtidas?.toFixed(1) ?? 'N/A'} (Base: ${report.overallStats.count} posts)\n`;
    } else { dataString += "\n- Dados gerais indisponíveis.\n"; }

    if (report.detailedContentStats && report.detailedContentStats.length > 0) {
        dataString += `\n## Desempenho Detalhado (Top ${maxDetailedStats} Combinações F/P/C por Compartilhamentos):\n`;
        const sortedDetailedStats = [...report.detailedContentStats]
            .sort((a, b) => (b.avgCompartilhamentos ?? 0) - (a.avgCompartilhamentos ?? 0))
            .slice(0, maxDetailedStats);

        sortedDetailedStats.forEach(stat => {
            const format = stat._id.format !== 'Desconhecido' ? `F:${stat._id.format}` : '';
            const proposal = stat._id.proposal !== 'Outro' ? `P:${stat._id.proposal}` : '';
            const context = stat._id.context !== 'Geral' ? `C:${stat._id.context}` : '';
            const labels = [format, proposal, context].filter(Boolean).join('/');
            const avgShares = stat.avgCompartilhamentos?.toFixed(1) ?? 'N/A';
            const avgSaves = stat.avgSalvamentos?.toFixed(1) ?? 'N/A';
            let comparisonSharesStr = comparisonPlaceholder;
            // Tentativa de acessar avgSharesVsOverall (precisa ser calculado no backend)
            // const statComp = (stat as DetailedContentStatWithComparison);
            // if (typeof statComp.avgSharesVsOverall === 'number') {
            //     comparisonSharesStr = ` (${statComp.avgSharesVsOverall > 0 ? '+' : ''}${(statComp.avgSharesVsOverall * 100).toFixed(0)}% vs média)`;
            // }

            dataString += `- ${labels || 'Geral'} (${stat.count} p): Comp=${avgShares}${comparisonSharesStr}, Salv=${avgSaves}\n`;
        });
         if(report.detailedContentStats.length > maxDetailedStats) dataString += "- ... (outras combinações omitidas)\n";
    } else { dataString += "\n- Não há dados detalhados por F/P/C disponíveis.\n"; }

     if (report.durationStats && report.durationStats.length > 0) {
        durationStatsString = "\n## Desempenho por Duração (Comp. Médio):\n";
        report.durationStats.forEach(stat => {
            const avgShares = stat.averageShares.toFixed(2);
             let comparisonSharesStr = comparisonPlaceholder;
             // Tentativa de acessar avgSharesVsOverall (precisa ser calculado no backend)
            //  const statComp = (stat as DurationStatWithComparison);
            //  if (typeof statComp.avgSharesVsOverall === 'number') {
            //      comparisonSharesStr = ` (${statComp.avgSharesVsOverall > 0 ? '+' : ''}${(statComp.avgSharesVsOverall * 100).toFixed(0)}% vs média)`;
            //  }
            durationStatsString += `- ${stat.range}(${stat.contentCount}p): ${avgShares}${comparisonSharesStr} | `;
         });
         durationStatsString = durationStatsString.slice(0, -3);
         durationStatsString += "\n";
         dataString += durationStatsString;
     } else { dataString += "\n- Não há dados de desempenho por duração disponíveis.\n"; }

    return dataString.trim();
}


/**
 * Constrói a base de instruções para a IA V4.2, focando na metodologia,
 * inclusão de NÚMEROS, ideia ÚNICA e CONCRETA, e pergunta final.
 */
function generateAIInstructionsV4_2(userName: string, report: IEnrichedReport, history: string, tone: string): string {
    const profileSegment = report.profileSegment || "Geral";
    const formattedReportData = formatReportDataForPromptV4_2(report);

    const instructions = `
# Persona e Contexto
Você é o 'InsightAI', um consultor especialista em mídias sociais (${tone}) para ${userName}. Seu objetivo é traduzir métricas em um **plano de conteúdo acionável**, facilitando a criação focada no nicho (${profileSegment}).

# Dados Disponíveis (Resumo Fornecido)
${formattedReportData}
*Use esses dados, especialmente o Desempenho Detalhado F/P/C e por Duração.*

# Sua Metodologia de Análise (Interna) e Resposta (Externa - SIGA ESTRITAMENTE):

## Análise Interna (O que você deve pensar):
1.  **Foco:** Priorize **Compartilhamentos** e **Salvamentos**.
2.  **Análise F/P/C:** Identifique a **principal combinação** F/P/C com MAIOR média de Comp./Salv. (e melhor % vs média, se disponível). Note outras combinações relevantes.
3.  **Análise de Formato (Regra 2):** Compare **explicitamente** o desempenho (Comp./Salv. médio) dos 'format' presentes nos dados. Qual foi o melhor relativo *para ${userName}*?
4.  **Análise de Duração (Regra 1):** Qual faixa de duração teve mais Comp. Médio?
5.  **Análise Dia/Semana (Cautelosa):** Os 'top3Posts' (se fornecidos e relevantes) sugerem algum dia melhor para o combo principal? (Seja breve e cauteloso).
6.  **Geração de Ideia:** Baseado na **principal combinação F/P/C de sucesso**, olhe as descrições nos 'top3Posts' ou 'contentDetails' recentes. Se alguma descrição *parecer* relacionada ao combo de sucesso, use o tema/ângulo como inspiração. Gere **UMA ideia de post hyper-específica e criativa**, detalhando o que ${userName} poderia fazer/falar/mostrar.

## Resposta para o Usuário (Como Escrever):
1.  **CONCISÃO:** Apresente **1-2 insights MAIS IMPORTANTES** (incluindo a comparação de formatos se relevante) e a **UMA ideia de post** gerada.
2.  **ACIONÁVEL:** Sugestões práticas.
3.  **JUSTIFICADO COM NÚMEROS:** **SEMPRE inclua os números específicos** das métricas chave (ex: Comp. Médio=X.X, Salv. Médio=Y.Y) que justificam seus insights/sugestões. Mencione a comparação (% vs média) **SE** ela estiver disponível nos dados formatados.
4.  **COMPARAÇÃO DE FORMATO (Regra 2):** Mencione a comparação explícita feita na análise interna (passo 3) como um dos insights se for relevante (ex: "Notei que seus Reels tiveram Comp. Médio de Z, enquanto Fotos tiveram W..."). **SEMPRE** use linguagem **condicional** ao *sugerir* um formato ("Considere...", "Talvez...").
5.  **IDEIA CONCRETA:** Apresente claramente a ideia hyper-específica gerada (passo 6 interno).
6.  **CADÊNCIA (Regra 3 - Se relevante):** Se perguntarem, **explique brevemente** o método 48-72h. **NÃO calcule**. Reforce qualidade > quantidade.
7.  **REFERÊNCIAS (Opcional):** Sugira *tipos* de referências ("Busque por...").
8.  **PERGUNTA FINAL ESTRATÉGICA:** **SEMPRE termine** com uma pergunta aberta focada na metodologia. Exemplos:
    * "Este insight sobre [Melhor Combo F/P/C com NÚMEROS] e a ideia de post fazem sentido para você? Quer detalhar [Outro Formato/Proposta/Contexto]?"
    * "Podemos refinar essa ideia de post ou prefere focar no planejamento semanal com base nesses dados?"
    * "Gostaria de analisar as métricas de um post específico ou buscar referências?"

# Histórico Recente:
${history}
`;
    return instructions;
}


/**
 * Seleciona e constrói o prompt final para a IA.
 */
function selectAndBuildPromptV4_2(
    intent: string,
    userName: string,
    report: IEnrichedReport,
    userMessage: string,
    tone: string,
    sentiment: string,
    history: string,
    hobbies: string[]
): string {
    const baseInstructionsAndData = generateAIInstructionsV4_2(userName, report, history, tone);
    logger.debug(`[Prompt Build V4.2] Intent: ${intent}, Tone: ${tone}, Sentiment: ${sentiment}, Hobbies: ${hobbies.join(',')}`);

    let finalInstruction = "# Sua Resposta CONCISA (1-2 insights com NÚMEROS + 1 ideia específica) com Pergunta Final Estratégica:"; // Padrão V4.2
    if (intent === 'report') { finalInstruction = "# Sua Análise ESTRATÉGICA CONCISA (highlights com NÚMEROS + 1 ideia) com Pergunta Final:"; }
    else if (intent === 'content_ideas') { finalInstruction = "# Sua Principal Ideia de Conteúdo CONCRETA e DETALHADA com Pergunta Final:"; }

    const finalPrompt = `${baseInstructionsAndData}\n# Mensagem Atual do Usuário:\n${userMessage}\n\n${finalInstruction}`;
    logger.info(`[Prompt Construído V4.2] Para User: ${userName}, Intent: ${intent}, Tamanho: ${finalPrompt.length}`);
    // logger.debug(`[Prompt Construído V4.2] Conteúdo:\n${finalPrompt}`);

    return finalPrompt;
}


// ====================================================
// Circuit Breaker, Retry, Usage Counter
// ====================================================
/** @throws {AIError} */
// <<< CORPO DA FUNÇÃO VERIFICADO/RESTAURADO >>>
const openAICallWithRetry = async (prompt: string): Promise<string> => {
     try {
         logger.debug(`[AI Call] Executando chamada real OpenAI (Tamanho: ${prompt.length})`);
         const response = await callOpenAIForQuestion(prompt, { temperature: 0.7 });
         if (!response || response.trim() === "") { logger.error("[AI Call] Resposta vazia OpenAI."); throw new Error("Resposta vazia da IA"); }
         logger.debug("[AI Call] Resposta recebida OpenAI.");
         return response;
     } catch (error) { logger.error("[AI Call] Erro OpenAI:", error); throw new AIError("Falha ao chamar OpenAI", error instanceof Error ? error : new Error(String(error))); }
};
const breakerOptions = { timeout: 20000, errorThresholdPercentage: 50, resetTimeout: 30000 } as opossum.Options;
const openAIBreaker = new opossum(openAICallWithRetry, breakerOptions);
openAIBreaker.on('failure', (error) => logger.error(`[Opossum] OpenAI Breaker falhou: ${error.message}`));
openAIBreaker.on('open', () => logger.warn('[Opossum] OpenAI Breaker ABERTO'));
openAIBreaker.on('close', () => logger.info('[Opossum] OpenAI Breaker FECHADO'));
const incrementUsageCounter = async (userId: string): Promise<number> => {
    // A correção do erro WRONGTYPE é feita deletando a chave antiga no Redis.
    // Esta função agora deve funcionar se a chave for criada corretamente como hash.
    const count = await ensureRedisConnection<number>(() => redisClient.hIncrBy(`usage:${userId}`, 'count', 1), 'incrementUsageCounter', userId);
    // TODO: Lógica de expiração do contador
    return count; // Retorna o contador (número)
};

// ====================================================
// Funções Helper para o Fluxo Principal
// ====================================================
/** @throws {AIError} */
// <<< CORPO DA FUNÇÃO VERIFICADO/RESTAURADO >>>
async function callAIWithResilience(prompt: string): Promise<string> {
     logger.debug(`[AI Call] Via Opossum... Prompt size: ${prompt.length}`);
     try {
         const response = await openAIBreaker.fire(prompt);
         if (typeof response !== 'string' || response.trim() === "") {
             logger.error("[AI Call] Resposta vazia/inválida Opossum.");
             throw new AIError("Resposta vazia ou inesperada da IA.");
         }
         logger.debug(`[AI Call] Sucesso via Opossum.`);
         return response;
     } catch (error) {
         logger.error('[AI Call] Erro Opossum/wrapper:', error);
         if (error instanceof AIError) throw error;
         throw new AIError("Falha chamada resiliente IA.", error as Error);
     }
}
/** @throws {CacheError|BaseError} */
async function updateConversationContext(userId: string, incomingText: string, aiCoreResponse: string, dialogueState: IDialogueState): Promise<void> { /* ... (código mantido) ... */ }
/** @throws {UserNotFoundError|DatabaseError} */
/** @throws {UserNotFoundError|DatabaseError} */
async function lookupUser(fromPhone: string): Promise<IUser> {
    logger.debug(`[User Lookup] Buscando ${fromPhone.slice(0, -4)}****`);
    try {
        // Busca pelo campo correto 'whatsappPhone'
        const user = await User.findOne({ whatsappPhone: fromPhone }).lean().exec();
        if (!user) {
             // Lança erro específico se não encontrar
             throw new UserNotFoundError(`Usuário não encontrado: ${fromPhone.slice(0, -4)}****`);
        }
        logger.debug(`[User Lookup] Encontrado: ${user._id}`);
        // Retorna o usuário encontrado (compatível com IUser)
        return user as IUser;
    } catch (error) {
         // Se o erro já for UserNotFoundError, apenas relança
         if (error instanceof UserNotFoundError) throw error;
         // Outros erros (ex: DB fora do ar) são encapsulados
         logger.error(`[User Lookup] Erro DB ${fromPhone.slice(0,-4)}****:`, error);
         throw new DatabaseError(`Erro ao buscar usuário`, error as Error);
    }
}
/** @throws {CacheError|BaseError} */
async function loadContext(userIdStr: string): Promise<{ dialogueState: IDialogueState, conversationHistory: string }> {
    logger.debug(`[Context Load] Carregando ${userIdStr}`);
    try {
        // Executa em paralelo, mas se um falhar, o Promise.all rejeita
        const [state, rawHistory] = await Promise.all([
            getDialogueState(userIdStr), // Pode lançar CacheError ou BaseError (parse)
            getConversationHistory(userIdStr) // Pode lançar CacheError
        ]);
        // Sumariza o histórico ANTES de retornar
        const summarizedHistory = await summarizeConversationHistory(rawHistory);
        logger.debug(`[Context Load] Carregado ${userIdStr}. History summarized: ${rawHistory.length !== summarizedHistory.length}`);
        // Retorna o objeto esperado
        return { dialogueState: state, conversationHistory: summarizedHistory };
    } catch (error) {
         // Log já deve ocorrer nas funções internas ou ensureRedisConnection
         logger.error(`[Context Load] Falha ${userIdStr}.`, error);
         // Relança o erro (CacheError ou BaseError)
         throw error;
    }
}
/** @throws {CacheError|BaseError} */ // BaseError pode vir de updateDialogueState
async function addGreetingAndGraph(baseResponse: string, userIdStr: string, greeting: string, dialogueState: IDialogueState): Promise<string> {
    let finalResponse = baseResponse;
    const now = Date.now();
    const minutesSinceLastInteraction = dialogueState.lastInteraction ? (now - dialogueState.lastInteraction) / (1000 * 60) : Infinity;
    const minutesSinceLastGreeting = dialogueState.lastGreetingSent ? (now - dialogueState.lastGreetingSent) / (1000 * 60) : Infinity;

    if (minutesSinceLastInteraction > GREETING_RECENCY_THRESHOLD_MINUTES || minutesSinceLastGreeting > GREETING_RECENCY_THRESHOLD_MINUTES * 2) {
         finalResponse = `<span class="math-inline">\{greeting\}\\n\\n</span>{baseResponse}`;
         // Atualiza o estado com try-catch isolado para não quebrar o fluxo principal se falhar
         updateDialogueState(userIdStr, { ...dialogueState, lastGreetingSent: now })
           .catch(err => logger.error(`[addGreeting] Falha ao atualizar lastGreetingSent para ${userIdStr}`, err));
    }

    try {
       // Chama getGraphSummary (que é um placeholder atualmente)
       const graphSummary = await getGraphSummary(); // Note: Params foram removidos na limpeza anterior
       finalResponse += graphSummary; // Adiciona string vazia se não houver resumo
    }
    catch (err) {
        // Loga o erro mas continua sem o resumo do grafo
        logger.error(`[addGreeting] Falha ao obter graphSummary para ${userIdStr}`, err);
    }
    // Sempre retorna a string final (modificada ou não)
    return finalResponse;
}
/** Trata casos especiais que não precisam da IA principal */
async function handleSpecialCases(user: IUser, incomingText: string, normalizedQuery: string, dialogueState: IDialogueState, greeting: string, userIdStr: string): Promise<string | null> {
    if (GREETING_KEYWORDS.includes(normalizedQuery)) {
         // Retorna saudação + pergunta se for só um "oi"
         return `${greeting} Em que posso ajudar com suas métricas ou estratégia de conteúdo hoje?`;
    }
    if (NORMALIZED_BEST_TIME_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
         // Explica a Regra 3 diretamente se perguntarem de melhor hora/dia
         return "Sobre melhor hora/dia e frequência: qualidade e consistência são mais importantes que a hora exata! 😉 Uma boa tática é olhar os Insights do seu post na plataforma. Veja o alcance entre seguidores nas primeiras 48-72h. Se ainda estiver crescendo bem, talvez espere mais antes do próximo post. Se estabilizou ou caiu muito, pode ser hora de postar de novo. Isso ajuda a não 'atropelar' um post que ainda está performando!";
    }
    const isPositiveFeedback = NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS.some(p => normalizedQuery.includes(p));
    const isNegativeFeedback = NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS.some(n => normalizedQuery.includes(n) && !FEEDBACK_NEUTRAL_RESPONSE_WORDS.some(w=> normalizedQuery === w));

    if (isPositiveFeedback || isNegativeFeedback) {
         // TODO: Implementar updateUserFeedback de verdade se quiser usar o feedback
         updateUserFeedback(userIdStr).catch(e => logger.error("Falha ao salvar feedback", e));
         if (isPositiveFeedback) return selectRandom(["Que bom que gostou!", "Ótimo! Fico feliz em ajudar.", "Legal! Precisando de mais algo, é só chamar."]) ?? "Legal!";
         if (isNegativeFeedback) return selectRandom(["Entendido.", "Ok, obrigado pelo feedback.", "Vou registrar sua opinião."]) ?? "Ok.";
    }
    // Se nenhum caso especial foi atendido, retorna null para continuar o fluxo principal
    return null;
}
/** Formata lista de posts (Helper) */
function formatPostListWithLinks(posts: Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined, title: string): string {
    // Se não houver posts, retorna string vazia
    if (!posts || posts.length === 0) return "";

    let list = `\n${title}`; // Inicia a lista com o título
    posts.forEach((post, index) => {
        // Cria uma prévia da descrição ou usa o ID
        const descriptionPreview = post.description ? `"${post.description.substring(0, 50)}..."` : `(Post ${post._id?.toString().slice(-4) ?? index + 1})`;
        // Adiciona o link se existir
        const link = post.postLink ? ` ([ver](${post.postLink}))` : "";
        // Adiciona item à lista
        list += `\n- <span class="math-inline">\{descriptionPreview\}</span>{link}`;
    });
    // Retorna a lista formatada como string
    return list;
}

// ====================================================
// Processamento Principal da IA (Atualizado para usar V4.2 do prompt)
// ====================================================
async function processMainAIRequest(
    user: IUser,
    incomingText: string,
    normalizedQuery: string,
    conversationHistory: string,
    dialogueState: IDialogueState,
    greeting: string,
    userIdStr: string,
    cacheKey: string
): Promise<string> {
    logger.debug(`[processMainAIRequest] Iniciando para ${userIdStr}`);
    const dataPrepStartTime = Date.now();

    const { enrichedReport } = await fetchAndPrepareReportData({ user, dailyMetricModel: DailyMetric as Model<IDailyMetric>, contentMetricModel: Metric as Model<IMetric> });
    logger.debug(`[processMainAIRequest] Preparação dados OK (${Date.now() - dataPrepStartTime}ms)`);

    let tone = user.profileTone || "amigável e analítico";
    const hobbies: string[] = (user.hobbies && Array.isArray(user.hobbies)) ? user.hobbies : [];
    tone = adjustTone(tone);

    const sentiment = advancedAnalyzeSentiment(incomingText);
    logger.debug(`[processMainAIRequest] Dados pré-prompt: Sentiment=${sentiment}, Tone=${tone}`);

    let intent: 'report' | 'metrics_summary' | 'content_ideas' | 'general' = 'general';
    if (NORMALIZED_REPORT_KEYWORDS.some(kw => normalizedQuery.includes(kw))) intent = 'report';
    else if (NORMALIZED_CONTENT_IDEAS_KEYWORDS.some(kw => normalizedQuery.includes(kw))) intent = 'content_ideas';
    else if (NORMALIZED_REQUEST_KEYWORDS.some(kw => normalizedQuery.includes(kw) && !NORMALIZED_JUSTIFICATION_KEYWORDS.some(jkw => normalizedQuery.includes(jkw)))) intent = 'metrics_summary';
    logger.debug(`[processMainAIRequest] Intenção Detectada: ${intent}`);

    // <<< ATUALIZADO: Chama a V4.2 da função de construção de prompt >>>
    const prompt = selectAndBuildPromptV4_2( // <--- MUDOU AQUI para V4.2
        intent, user.name || "usuário", enrichedReport,
        incomingText, tone, sentiment, conversationHistory, hobbies
    );

    const aiCoreResponse = await callAIWithResilience(prompt);
    logger.debug(`[processMainAIRequest] Resposta CORE da IA recebida.`);
    const originalAICoreResponseForContext = aiCoreResponse;

    let postsInfo = "";
     if (intent !== 'content_ideas' && intent !== 'metrics_summary') {
         const topPostsFormatted = formatPostListWithLinks(enrichedReport.top3Posts, "📈 Posts que se destacaram:");
         const bottomPostsFormatted = formatPostListWithLinks(enrichedReport.bottom3Posts, "📉 Posts com menor desempenho:");
         if (topPostsFormatted || bottomPostsFormatted) { postsInfo = `\n\n---\n**Posts que usei como referência:**${topPostsFormatted}${topPostsFormatted && bottomPostsFormatted ? '\n' : ''}${bottomPostsFormatted}`; }
     }
    const responseWithPosts = aiCoreResponse + postsInfo;

    const finalResponse = await addGreetingAndGraph(responseWithPosts, userIdStr, greeting, dialogueState);

    logger.debug(`[processMainAIRequest] Agendando atualizações finais async...`);
    Promise.allSettled([
        setInCache(cacheKey, finalResponse, REDIS_CACHE_TTL_SECONDS),
        updateConversationContext(userIdStr, incomingText, originalAICoreResponseForContext, dialogueState),
        incrementUsageCounter(userIdStr),
        persistDialogueGraph()
    ]).then(results => { /* Log de falhas */ });

    return finalResponse;
}

// ====================================================
// Tratamento Global de Erros (Mantido)
// ====================================================
function handleError(error: unknown, fromPhone: string, userId: string | 'N/A', startTime: number): string {
    const duration = Date.now() - startTime;
    let userMessage = `Ops! 😅 Encontrei um problema inesperado (${error instanceof Error ? error.constructor.name : 'Unknown'}). Tente novamente em instantes. Se persistir, contacte o suporte.`;
    let errorType = "UnknownError";

    // Log Detalhado
    if (error instanceof Error) {
        errorType = error.constructor.name;
        const cause = error.cause instanceof Error ? error.cause : error.cause;
        logger.error(`[handleError] Erro Capturado! Tipo: ${errorType}, User: ${userId}, Phone: ${fromPhone}, Duração: ${duration}ms`, { errorMessage: error.message, stack: error.stack, cause: cause });
    } else {
        errorType = typeof error;
        logger.error(`[handleError] Erro Não-Padrão! User: ${userId}, Phone: ${fromPhone}, Duração: ${duration}ms`, { error });
    }

    // Mensagens amigáveis específicas
    if (error instanceof UserNotFoundError) userMessage = "Olá! Não encontrei seu cadastro. Verifique o número ou contacte o suporte.";
    else if (error instanceof MetricsNotFoundError) userMessage = `🤔 Não encontrei dados recentes (${error.message}). Verifique se suas métricas estão sendo enviadas.`;
    else if (error instanceof AIError) userMessage = `Estou com dificuldade para conectar com a IA agora 🧠 (${error.message}). Tente de novo daqui a pouco!`;
    else if (error instanceof ReportAggregationError) userMessage = `Tive um problema ao processar seus dados para o relatório (${error.message}) 📊. Tente novamente mais tarde.`;
    else if (error instanceof DatabaseError) userMessage = `Houve uma falha ao acessar o banco de dados (${error.message}) 💾. Por favor, tente novamente mais tarde.`;
    else if (error instanceof CacheError) userMessage = `Estou com uma lentidão temporária (${error.message}) 🐢. Pode tentar de novo?`;

    // Sempre retorna a mensagem final para o usuário
    return userMessage;
}

// ====================================================
// Função Exportada para Resumo Semanal (Placeholder)
// ====================================================
export async function generateStrategicWeeklySummary(userName: string, aggregatedReport: AggregatedReport): Promise<string> {
    logger.warn("[generateWeeklySummary] Função não totalmente implementada.");
    // TODO: Construir prompt específico para resumo semanal
    // Exemplo simples de prompt:
    const prompt = `Gere um resumo estratégico semanal curto e direto (2-3 pontos principais) para ${userName} baseado nestes dados agregados de desempenho: ${JSON.stringify(aggregatedReport.overallStats)}. Foque nos maiores Ganhos ou Perdas.`;
    try {
        // Chama a IA para gerar o resumo
        return await callAIWithResilience(prompt);
    } catch(error) {
        // Trata erros da chamada da IA
        logger.error(`[generateWeeklySummary] Falha para ${userName}`, error);
        if (error instanceof AIError) return "Desculpe, não consegui falar com a IA para gerar o resumo semanal agora.";
        // Retorna mensagem genérica para outros erros
        return "Desculpe, ocorreu um erro inesperado ao gerar o resumo semanal.";
    }
}

// ====================================================
// Função Principal Exportada (Atualizada para usar V4.2 do prompt)
// ====================================================
export async function getConsultantResponse(fromPhone: string, incomingText: string): Promise<string> {
    const startTime = Date.now();
    logger.info(`[getConsultantResponse] INÍCIO: Chamada de ${fromPhone}.`);

    const normalizedQueryForCache = normalizeText(incomingText).trim().replace(/\s+/g, '_').substring(0, 100);
    const cacheKey = `response:${fromPhone}:${normalizedQueryForCache}`;

    let user: IUser | null = null;
    let userIdStr: string | 'N/A' = 'N/A';
    let dialogueState: IDialogueState = {};

    try {
        const cachedResponse = await getFromCache(cacheKey);
        if (cachedResponse) { logger.info(`[Cache] HIT ${cacheKey}. T: ${Date.now() - startTime}ms`); return cachedResponse; }
        logger.debug(`[Cache] MISS ${cacheKey}`);

        user = await lookupUser(fromPhone);
        userIdStr = user._id.toString();

        let conversationHistory: string;
        ({ dialogueState, conversationHistory } = await loadContext(userIdStr));

        const greeting = getRandomGreeting(user.name || 'usuário');
        const normalizedQuery = normalizeText(incomingText.trim());
        if (!normalizedQuery) { logger.warn(`[GetResp] Msg vazia ${fromPhone}.`); return `${greeting} Como posso te ajudar hoje? 😊`; }

        const specialCaseResponse = await handleSpecialCases(user, incomingText, normalizedQuery, dialogueState, greeting, userIdStr);
        if (specialCaseResponse !== null) {
            logger.info(`[Flow] Resp. caso especial ${fromPhone}. T: ${Date.now() - startTime}ms`);
            Promise.allSettled([ setInCache(cacheKey, specialCaseResponse, REDIS_CACHE_TTL_SECONDS), incrementUsageCounter(userIdStr) ]).then(results => { /* log falhas */ });
            return specialCaseResponse;
        }

        logger.debug(`[GetResp] Iniciando fluxo principal IA...`);
        // <<< ATUALIZADO: Chama V4.2 >>>
        const aiResponse = await processMainAIRequest( user, incomingText, normalizedQuery, conversationHistory, dialogueState, greeting, userIdStr, cacheKey );

        const totalDuration = Date.now() - startTime;
        logger.info(`[GetResp] FIM: Resposta gerada ${fromPhone}. Tam: ${aiResponse.length}. Tempo: ${totalDuration}ms`);
        return aiResponse;

    } catch (error: unknown) {
        const errorName = error instanceof Error ? error.constructor.name : "UnknownErrorType";
        logger.error(`[GetResp] ERRO CAPTURADO (${errorName}) fluxo principal ${fromPhone}. UserID: ${userIdStr}.`, error);
        const errorResponse = handleError(error, fromPhone, userIdStr, startTime);
        const totalErrorDuration = Date.now() - startTime;
        logger.info(`[GetResp] ERRO HANDLED: Finalizado com erro ${fromPhone}. Tipo: ${errorName}. Tempo: ${totalErrorDuration}ms`);
        return errorResponse;
    }
}
// ====================================================
// FIM
// ====================================================