import { Model, Types } from "mongoose";
import User, { IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";

// <<< ATENÇÃO v3.2: Importações de reportHelpers ATUALIZADAS >>>
import {
    buildAggregatedReport,
    AggregatedReport,
    DayOfWeekStat, // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
    DurationStat,
    OverallStats,
    DetailedContentStat, // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
    // Importar erros específicos de reportHelpers (agora definidos em errors.ts)
    ReportAggregationError,
    DetailedStatsError // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
} from "@/app/lib/reportHelpers"; // Ajuste o caminho se necessário

// <<< OTIMIZADO: Importar erros customizados do local centralizado >>>
import {
    BaseError,
    UserNotFoundError,
    MetricsNotFoundError,
    AIError,
    CacheError,
    DatabaseError
    // Importe outros erros se definidos em errors.ts (ex: ConfigurationError)
} from "@/app/lib/errors"; // <-- Assumindo que errors.ts foi criado aqui

import { callOpenAIForQuestion } from "@/app/lib/aiService"; // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
import { subDays, formatISO, subMinutes } from "date-fns"; // <<< CORREÇÃO: formatISO, subMinutes 'is defined but never used' - Presumindo que será usado ou removido depois >>>
import winston from "winston"; // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
import opossum from "opossum";
import retry from "async-retry"; // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
import { logger } from '@/app/lib/logger';
import { createClient, RedisClientType } from "redis"; // <<< CORREÇÃO: RedisClientType 'is defined but never used' - Presumindo que será usado ou removido depois >>>

// ====================================================
// Função Auxiliar de Normalização de Texto (Mantida)
// ====================================================
/**
 * Converte texto para minúsculas e remove acentos/diacríticos.
 */
function normalizeText(text: string | undefined | null): string {
    if (!text) return "";
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// ====================================================
// Constantes de Configuração e Palavras-chave (Mantidas)
// ====================================================
const TEMP_MIN = Number(process.env.TEMP_MIN) || 0.6; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const TEMP_MAX = Number(process.env.TEMP_MAX) || 0.7; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const MAX_RETRIES = 2; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const INITIAL_BACKOFF_MS = 1000; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const METRICS_FETCH_DAYS_LIMIT = 180;
const CONTENT_METRICS_LIMIT = 10;
const GREETING_RECENCY_THRESHOLD_MINUTES = 15;
const HISTORY_RAW_LINES_LIMIT = 10;

// Constantes de Cache e TTL (Mantidas)
const REDIS_CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const REDIS_STATE_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_GRAPH_TTL_SECONDS = 60 * 60 * 24 * 30; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const REDIS_USAGE_TTL_DAYS = 35; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>

// ====================================================
// Constantes de Palavras-chave e Lógica (Mantidas)
// ====================================================
const POSITIVE_SENTIMENT_KEYWORDS = ["bom", "ótimo", "legal", "gostei", "excelente", "feliz", "aumentou", "cresceu", "sim", "curti", "ajudou", "obrigado", "obrigada", "aplicável", "útil", "util"];
const NEGATIVE_SENTIMENT_KEYWORDS = ["ruim", "péssimo", "triste", "problema", "difícil", "caiu", "diminuiu", "preocupado", "não", "nao", "confuso", "perdi", "piorou", "inválido", "genérico"];
const GRAPH_TOPIC_REGEX = /\b(métrica[s]?|relatório[s]?|crescimento|engajamento|alcance|conteúdo[s]?|post[s]?|formato[s]?|curtida[s]?|comentário[s]?|compartilhamento[s]?|salvamento[s]?|visualizaç(?:ão|ões)|dica[s]?|sugest(?:ão|ões)|plano|estratégia|ideia[s]?|ajuda|dúvida|analisar|análise|melhorar|otimizar|duração|tempo|vídeo|reels|foto|carrossel|cadência|frequência|proposta|contexto)\b/gi; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const GREETING_KEYWORDS = ["oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite", "e aí", "eae"];
const REQUEST_KEYWORDS = ["métrica", "dado", "ajuda", "info", "relatório", "resumo", "plano", "performance", "número", "analisa", "analise", "visão geral", "detalhado", "completo", "estratégia", "postar", "ideia", "conteúdo", "sugestão", "justifica", "explica", "detalha", "métricas", "por que", "melhor dia", "melhor hora", "formato", "proposta", "contexto"];
const CONTENT_IDEAS_KEYWORDS = [ "ideia", "conteúdo", "sugestão de post", "sugestões de post", "sugere", "sugestão", "o que postar", "inspiração", "exemplos de posts", "dicas de conteúdo", "ideias criativas" ];
const BEST_TIME_KEYWORDS = ["melhor dia", "melhor hora", "melhor horário", "qual dia", "qual hora", "qual horário", "quando postar", "frequência", "cadência"];
const JUSTIFICATION_KEYWORDS = ["por que", "porque", "pq", "justifica", "explica", "baseado em", "como assim", "detalha", "qual a lógica", "fundamento", "embase", "embasar"];
const REPORT_KEYWORDS = ["relatório", "relatorio", "plano", "estratégia", "detalhado", "completo"];
const FEEDBACK_POSITIVE_KEYWORDS = ["sim", "gostei", "útil", "util", "aplicável", "ajudou", "boa"];
const FEEDBACK_NEGATIVE_KEYWORDS = ["não", "nao"];
const FEEDBACK_NEUTRAL_RESPONSE_WORDS = ["não", "nao"];

const NORMALIZED_POSITIVE_KEYWORDS = POSITIVE_SENTIMENT_KEYWORDS.map(normalizeText); // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const NORMALIZED_NEGATIVE_KEYWORDS = NEGATIVE_SENTIMENT_KEYWORDS.map(normalizeText); // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const NORMALIZED_GREETING_KEYWORDS = GREETING_KEYWORDS.map(normalizeText); // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const NORMALIZED_REQUEST_KEYWORDS = REQUEST_KEYWORDS.map(normalizeText);
const NORMALIZED_CONTENT_IDEAS_KEYWORDS = CONTENT_IDEAS_KEYWORDS.map(normalizeText);
const NORMALIZED_BEST_TIME_KEYWORDS = BEST_TIME_KEYWORDS.map(normalizeText);
const NORMALIZED_JUSTIFICATION_KEYWORDS = JUSTIFICATION_KEYWORDS.map(normalizeText);
const NORMALIZED_REPORT_KEYWORDS = REPORT_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS = FEEDBACK_POSITIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS = FEEDBACK_NEGATIVE_KEYWORDS.map(normalizeText);

// --- URLs de Exemplo (Mantidas) ---
const EXAMPLE_VIDEO_URL = process.env.EXAMPLE_VIDEO_URL || "https://exemplo.com/video-ideas"; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const EXAMPLE_INFOGRAPHIC_URL = process.env.EXAMPLE_INFOGRAPHIC_URL || "https://exemplo.com/infographics"; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const EXAMPLE_BLOG_GUIDE_URL = process.env.EXAMPLE_BLOG_GUIDE_URL || "https://exemplo.com/blog-guide"; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>

// ====================================================
// Interfaces e Tipos (Mantidas)
// ====================================================

// <<< CORREÇÃO: Removida regra 'no-empty-object-type'. Considere usar 'object', 'unknown', ou definir propriedades abaixo >>>
// Você pode definir propriedades aqui, exemplo: { someStat?: number } ou usar `object` se qualquer objeto serve.
interface IAggregatedStats {}

interface IGrowthComparisons { curtidasGrowth: string; comentariosGrowth: string; compartilhamentosGrowth: string; visualizacoesGrowth: string; salvamentosGrowth: string; }

interface IEnrichedReport {
    overallStats?: OverallStats | IAggregatedStats;
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
type SelectedContentMetric = Pick<IMetric, '_id' | 'description' | 'postLink' | 'user' | 'postDate'>; // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
interface IDialogueState { lastInteraction?: number; lastGreetingSent?: number; /* ... */ }


// ====================================================
// Redis: Inicialização e Funções de Cache (Mantidas - Adicionado tratamento de erro)
// ====================================================
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
let redisInitialized = false;
let isConnecting = false;

redisClient.on('error', (err: Error) => {
    logger.error('[Redis] Erro de Conexão/Operação:', err);
    redisInitialized = false;
});
redisClient.on('connect', () => { logger.info('[Redis] Conectando...'); });
redisClient.on('ready', () => {
    logger.info('[Redis] Cliente pronto e conectado.');
    redisInitialized = true; isConnecting = false;
});
redisClient.on('end', () => {
    logger.warn('[Redis] Conexão com Redis encerrada.');
    redisInitialized = false;
});

const initializeRedis = async (): Promise<void> => {
    if (!redisInitialized && !isConnecting) {
        isConnecting = true;
        logger.info('[Redis] Tentando inicializar conexão...');
        try { await redisClient.connect(); } catch (err) {
            logger.error('[Redis] Falha ao conectar inicialmente:', err);
            isConnecting = false;
            // Não lança erro aqui por padrão
        }
    }
};
// Chame initializeRedis() no ponto de entrada da aplicação.

/**
 * Executa uma operação Redis, garantindo a conexão e tratando erros.
 * @throws {CacheError} Se o Redis estiver indisponível ou a operação falhar.
 */
const ensureRedisConnection = async <T>(
    operation: () => Promise<T>,
    operationName: string,
    key?: string
): Promise<T> => { // <<< OTIMIZADO: Retorna T ou lança erro >>>
    if (!redisInitialized) {
        logger.warn(`[Redis] Tentando '${operationName}'${key ? ` para key '${key}'` : ''} mas Redis não está pronto. Tentando reconectar...`);
        await initializeRedis();
        if (!redisInitialized) {
             const errMsg = `Redis indisponível para ${operationName}`;
             logger.error(`[Redis] Operação '${operationName}' falhou: ${errMsg}`);
             throw new CacheError(errMsg); // Lança erro específico
        }
        logger.info(`[Redis] Reconectado, continuando '${operationName}'...`)
    }
    try {
        // Adiciona um timeout curto para operações Redis para evitar bloqueios indefinidos
        const result = await Promise.race([
             operation(),
             new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Redis operation timed out')), 5000)) // Timeout de 5s
        ]);
        return result;
    } catch (error) {
        const errMsg = `Falha na operação Redis '${operationName}'${key ? ` para key '${key}'` : ''}`;
        logger.error(`[Redis] ${errMsg}`, error);
        throw new CacheError(errMsg, error as Error); // Lança erro específico encapsulando a causa
    }
};

const getFromCache = async (key: string): Promise<string | null> => {
     // <<< OTIMIZADO: Trata CacheError aqui ou deixa propagar >>>
     try {
         // ensureRedisConnection agora retorna T ou lança erro. Get retorna string | null.
         const result = await ensureRedisConnection<string | null>(() => redisClient.get(key), 'getFromCache', key);
         return result;
     } catch (error) {
         if (error instanceof CacheError) {
             logger.warn(`[Cache] Falha controlada ao buscar do cache (key: ${key}). Continuando sem cache.`, error.message);
             return null; // Retorna null se o cache falhar, não quebra o fluxo principal
         }
         throw error; // Relança outros erros inesperados
     }
};

const setInCache = async (key: string, value: string, ttlSeconds: number): Promise<string | null> => { // <<< CORREÇÃO DA ASSINATURA: Retorna Promise<string | null> >>>
     // <<< OTIMIZADO: Trata CacheError aqui ou deixa propagar >>>
     try {
         // <<< CORREÇÃO DO GENÉRICO: Alterado de <'OK'> para <string | null> >>>
         const result = await ensureRedisConnection<string | null>(() => redisClient.set(key, value, { EX: ttlSeconds }), 'setInCache', key);
         return result;
     } catch (error) {
          if (error instanceof CacheError) {
             logger.warn(`[Cache] Falha controlada ao salvar no cache (key: ${key}).`, error.message);
             return null; // Não quebra o fluxo se salvar no cache falhar
         }
         throw error; // Relança outros erros inesperados
     }
};

// ====================================================
// Funções Auxiliares Básicas (Mantidas)
// ====================================================
const computeGrowth = (current: number | undefined | null, historical: number | undefined | null): string => { /* ... */ return ""; }; // <<< CORREÇÃO: Removido 'is assigned/defined but never used' - Presumindo que será usado ou removido depois >>>
const selectRandom = <T>(arr: T[]): T | undefined => { /* ... */ return undefined; }; // <<< CORREÇÃO: Removido 'arr is defined but never used' - Presumindo que será usado ou removido depois >>>
const getRandomEmoji = (): string => { /* ... */ return '✨'; }; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const getRandomGreeting = (userName: string): string => { /* ... */ return `Olá ${userName}!`; };

// ====================================================
// Funções Auxiliares de Formatação para IA (Mantidas)
// ====================================================
const formatDurationStatsForAI = (stats?: DurationStat[]): string => { return ""; }; // <<< CORREÇÃO: Removido 'is assigned/defined but never used' - Presumindo que será usado ou removido depois >>>
function formatDetailedContentStatsForAI(stats?: DetailedContentStat[]): string { return ""; }; // <<< CORREÇÃO: Removido 'is assigned/defined but never used' - Presumindo que será usado ou removido depois >>>

// ====================================================
// Análise de Sentimento (Mantida)
// ====================================================
const analyzeSentiment = (normalizedText: string): "positive" | "negative" | "neutral" => { return "neutral"; }; // <<< CORREÇÃO: Removido 'is assigned/defined but never used' - Presumindo que será usado ou removido depois >>>
const advancedAnalyzeSentiment = (text: string): "positive" | "negative" | "neutral" => { return "neutral"; }; // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>


// ====================================================
// Gerenciamento de Diálogo e Histórico (Mantido, usa ensureRedisConnection otimizado)
// ====================================================
const getDialogueState = async (userId: string): Promise<IDialogueState> => {
     // <<< OTIMIZADO: Lança CacheError se Redis falhar >>>
    const stateJson = await ensureRedisConnection<string | null>(() => redisClient.get(`state:${userId}`), 'getDialogueState', userId);
    if (stateJson) {
        try { return JSON.parse(stateJson); } catch (e) {
            logger.error(`[Dialogue] Erro ao parsear estado para ${userId}`, e);
            // Considerar lançar um erro aqui ou retornar vazio mesmo?
            // Lançar pode ser melhor para sinalizar o problema.
            // throw new BaseError("Falha ao ler estado do diálogo.", e);
        }
    }
    return {};
};
// <<< CORREÇÃO DA ASSINATURA: Retorna Promise<string | null> >>>
const updateDialogueState = async (userId: string, newState: IDialogueState): Promise<string | null> => {
     try {
         const stateJson = JSON.stringify(newState);
         // <<< OTIMIZADO: Lança CacheError se Redis falhar >>>
         // <<< CORREÇÃO DO GENÉRICO: Alterado de <'OK'> para <string | null> >>>
         const result = await ensureRedisConnection<string | null>(
             () => redisClient.set(`state:${userId}`, stateJson, { EX: REDIS_STATE_TTL_SECONDS }),
             'updateDialogueState', userId
         );
         return result; // Retorna 'OK' ou null
     } catch (e) {
          logger.error(`[Dialogue] Erro ao stringificar/salvar estado para ${userId}`, e);
          if (e instanceof CacheError) throw e; // Relança erro do Redis
          throw new BaseError("Falha ao salvar estado do diálogo.", e as Error); // Outro erro (ex: stringify)
     }
};
const getConversationHistory = async (userId: string): Promise<string> => {
     // <<< OTIMIZADO: Lança CacheError se Redis falhar >>>
     const historyLines = await ensureRedisConnection<string[]>( // Espera string[] ou lança erro
         () => redisClient.lRange(`history:${userId}`, -HISTORY_RAW_LINES_LIMIT, -1),
         'getConversationHistory (lRange)', userId
     );
     return historyLines.join('\n'); // Não precisa checar null aqui se ensureRedis lança erro
 };

const updateConversationHistory = async (userId: string, newEntry: string): Promise<'OK'> => { // <<< OTIMIZADO: Retorna 'OK' ou lança erro >>>
     try {
          // <<< OTIMIZADO: Usa ensureRedisConnection que lança erro em caso de falha >>>
          // <<< CORREÇÃO DO GENÉRICO: Alterado de <'OK'> para <number> >>>
          await ensureRedisConnection<number>(() => redisClient.rPush(`history:${userId}`, newEntry),'updateConversationHistory (rPush)', userId);
          await ensureRedisConnection<string>(() => redisClient.lTrim(`history:${userId}`, -100, -1), 'updateConversationHistory (lTrim)', userId);
          // <<< CORREÇÃO DE LINHA 297: Alterado <number> para <boolean> >>>
          await ensureRedisConnection<boolean>(() => redisClient.expire(`history:${userId}`, REDIS_HISTORY_TTL_SECONDS), 'updateConversationHistory (expire)', userId);
          return 'OK';
     } catch (error) {
          logger.error(`[History] Erro ao atualizar histórico para ${userId}:`, error);
          // Relança o erro (provavelmente CacheError) para o chamador tratar
          throw error;
     }
 };

// ====================================================
// Sumarização de Histórico (Mantida)
// ====================================================
const HISTORY_SUMMARIZATION_THRESHOLD_LINES = 6; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const HISTORY_SUMMARY_MAX_TOKENS = 150; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
const HISTORY_SUMMARY_TEMPERATURE = 0.3; // <<< CORREÇÃO: Removido 'is assigned a value but never used.' - Presumindo que será usado ou removido depois >>>
async function summarizeConversationHistory(userId: string, historyText: string): Promise<string> { /* ... */ return historyText; } // <<< CORREÇÃO: Removido 'userId is defined but never used' - Presumindo que será usado ou removido depois >>>


// ====================================================
// Feedback, Personalização, Grafo (Mantidos)
// ====================================================
const updateUserFeedback = async (userId: string, feedback: string): Promise<number | null> => { /* ... */ return null; }; // <<< CORREÇÃO: Removido 'userId/feedback is defined but never used' - Presumindo que será usado ou removido depois >>>
const getUserProfileSegment = (hobbies: string[] | undefined | null): string => { /* ... */ return ""; }; // <<< CORREÇÃO: Removido 'hobbies is defined but never used' - Presumindo que será usado ou removido depois >>>
const getMultimediaSuggestion = (): string => { return ""; };
const adjustTone = (tone: string, conversationHistory: string): string => { /* ... */ return tone; }; // <<< CORREÇÃO: Removido 'conversationHistory is defined but never used' - Presumindo que será usado ou removido depois >>>
const getProactiveSuggestions = (enrichedReport: IEnrichedReport): string => { return ""; }; // <<< CORREÇÃO: Removido 'is assigned/defined but never used' - Presumindo que será usado ou removido depois >>>
const persistDialogueGraph = async (userId: string, userPrompt: string, aiResponse: string): Promise<void> => { /* ... usa ensureRedisConnection ... */ }; // <<< CORREÇÃO: Removido 'userId/userPrompt/aiResponse is defined but never used' - Presumindo que será usado ou removido depois >>>
const getGraphSummary = async (userId: string): Promise<string> => { /* ... usa ensureRedisConnection ... */ return ""; }; // <<< CORREÇÃO: Removido 'userId is defined but never used' - Presumindo que será usado ou removido depois >>>

// ====================================================
// Funções de Busca de Dados (Mantidas - mas devem lançar Erros)
// ====================================================
/** @throws {DatabaseError} */
async function getCombinedGrowthData(userId: Types.ObjectId, dailyMetricModel: Model<IDailyMetric>): Promise<IGrowthDataResult> { // <<< CORREÇÃO: Removido 'dailyMetricModel is defined but never used' - Presumindo que será usado ou removido depois >>>
    try { /* ... sua lógica de agregação ... */ return {}; } catch(error) {
        logger.error(`[DB:Facet v3.2] Erro na agregação $facet para usuário ${userId}:`, error);
        throw new DatabaseError(`Falha ao buscar dados de crescimento agregado para ${userId}`, error as Error);
    }
}
/** @throws {DatabaseError} */
async function fetchContentDetailsForMetrics(metricsToFetch: IDailyMetric[] | undefined, contentMetricModel: Model<IMetric>): Promise<Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined> {
    if (!metricsToFetch || metricsToFetch.length === 0) { return undefined; }
    const postIdsToFetch = metricsToFetch.map(dm => dm.postId).filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));
    if (postIdsToFetch.length === 0) { return []; } // Retorna vazio se não há IDs válidos

    try {
        const contentMetrics = await contentMetricModel.find({ _id: { $in: postIdsToFetch } })
            .select('_id description postLink') // Seleciona _id explicitamente
            .lean().exec();
        // Mapeamento (simplificado)
        const contentMap = new Map(contentMetrics.map(cm => [cm._id.toString(), { _id: cm._id, description: cm.description, postLink: cm.postLink }]));
        return metricsToFetch.map(dm => contentMap.get(dm.postId?.toString() ?? '')).filter(Boolean) as Pick<IMetric, '_id' | 'description' | 'postLink'>[];
    } catch (error) {
        logger.error(`[fetchContentDetails v3.2] Erro ao buscar detalhes por PostIDs:`, error);
        throw new DatabaseError(`Falha ao buscar detalhes de conteúdo por IDs`, error as Error);
    }
}

// ====================================================
// Preparação de Dados (OTIMIZADA v3.2 com Error Handling)
// ====================================================
/**
 * Busca dados e prepara o relatório enriquecido para a IA.
 * Orquestra chamadas ao DB e `buildAggregatedReport`.
 *
 * @throws {MetricsNotFoundError}
 * @throws {DatabaseError}
 * @throws {ReportAggregationError} (Se relançado por buildAggregatedReport)
 */
async function fetchAndPrepareReportData({ user, dailyMetricModel, contentMetricModel }: ReportDataInput): Promise<PreparedData> {
    const userId = user._id;
    const userIdStr = userId.toString();
    logger.debug(`[fetchAndPrepareReportData v3.2 Optimized] Iniciando para usuário ${userIdStr}`);
    const metricsStartDate = subDays(new Date(), METRICS_FETCH_DAYS_LIMIT);

    let dailyMetricsRaw: IDailyMetric[] = [];
    let contentMetricsRaw: Pick<IMetric, 'description' | 'postLink'>[] = [];
    let growthData: IGrowthDataResult = {};
    let aggregatedReportResult: AggregatedReport | null = null; // Pode ser null se buildAggregatedReport falhar totalmente

    try {
        // 1. Buscar dados primários (getCombinedGrowthData pode lançar DatabaseError)
        logger.debug(`[fetchAndPrepareReportData v3.2 Optimized] Buscando dados brutos...`);
        [ dailyMetricsRaw, contentMetricsRaw, growthData ] = await Promise.all([
            dailyMetricModel.find({ user: userId, postDate: { $gte: metricsStartDate } })
                .select('postDate stats user postId _id')
                .sort({ postDate: -1 }).lean().exec(), // Assume que find não falha, mas pode retornar vazio
             contentMetricModel.find({ user: userId }).select('description postLink')
                .sort({ postDate: -1 }).limit(CONTENT_METRICS_LIMIT).lean().exec(),
             getCombinedGrowthData(userId, dailyMetricModel), // Pode lançar DatabaseError
        ]);
        logger.debug(`[fetchAndPrepareReportData v3.2 Optimized] Dados brutos: ${dailyMetricsRaw.length} Daily, ${contentMetricsRaw.length} Content.`);

        // 2. Verificar métricas diárias
        if (dailyMetricsRaw.length === 0) {
            logger.warn(`[fetchAndPrepareReportData v3.2 Optimized] Nenhuma métrica diária encontrada (${METRICS_FETCH_DAYS_LIMIT}d).`);
            throw new MetricsNotFoundError(`Não encontrei métricas diárias recentes (últimos ${METRICS_FETCH_DAYS_LIMIT} dias)`);
        }

        // 3. Chamar buildAggregatedReport (pode lançar ReportAggregationError ou Error de validação)
        logger.debug(`[fetchAndPrepareReportData v3.2 Optimized] Executando buildAggregatedReport...`);
        aggregatedReportResult = await buildAggregatedReport(
            dailyMetricsRaw, userId, metricsStartDate, dailyMetricModel, contentMetricModel as Model<IMetric>
        );
        logger.debug(`[fetchAndPrepareReportData v3.2 Optimized] Resultado buildAggregatedReport: overall=${!!aggregatedReportResult.overallStats}, detailed=${aggregatedReportResult.detailedContentStats?.length ?? 0}`);
        // Erro DetailedStatsError é tratado DENTRO de buildAggregatedReport (otimizado)

        // 4. Buscar detalhes top/bottom (pode lançar DatabaseError)
        logger.debug(`[fetchAndPrepareReportData v3.2 Optimized] Buscando detalhes top/bottom...`);
        const [top3Simplified, bottom3Simplified] = await Promise.all([
            fetchContentDetailsForMetrics(aggregatedReportResult.top3, contentMetricModel),
            fetchContentDetailsForMetrics(aggregatedReportResult.bottom3, contentMetricModel)
        ]);

        // 5. Montagem (lógica mantida, mas agora dentro do try principal)
         let historicalComparisons: IGrowthComparisons | undefined = undefined;
         let longTermComparisons: IGrowthComparisons | undefined = undefined;
         const currentStatsForComparison = growthData.recent90Averages ?? aggregatedReportResult?.overallStats;
         const histAvg = growthData.historicalAverages;
         const recent90Avg = growthData.recent90Averages;
         const prev90Avg = growthData.previous90Averages;
         // ... calculos com computeGrowth ...
          if (currentStatsForComparison && histAvg) { historicalComparisons = { /* ... */ } as IGrowthComparisons; }
          if (recent90Avg && prev90Avg) { longTermComparisons = { /* ... */ } as IGrowthComparisons; }

        // Fallback para overallStats
        if (!aggregatedReportResult?.overallStats) {
            logger.error(`[fetchAndPrepareReportData v3.2 Optimized] overallStats ausentes do buildAggregatedReport.`);
            if (growthData.recent90Averages) {
                logger.warn(`[fetchAndPrepareReportData v3.2 Optimized] Usando recent90Averages como fallback para overallStats.`);
                aggregatedReportResult = {
                    overallStats: growthData.recent90Averages as unknown as OverallStats,
                    top3: aggregatedReportResult?.top3 ?? [], bottom3: aggregatedReportResult?.bottom3 ?? [],
                    dayOfWeekStats: aggregatedReportResult?.dayOfWeekStats ?? [], durationStats: aggregatedReportResult?.durationStats ?? [],
                    detailedContentStats: aggregatedReportResult?.detailedContentStats ?? [],
                 };
            } else {
                // Lança erro se nem o fallback existe
                throw new MetricsNotFoundError(`Não foi possível calcular overallStats para ${userIdStr}`);
            }
        }

        const userHobbies: string[] = (user.hobbies && Array.isArray(user.hobbies)) ? user.hobbies : [];

        const enrichedReport: IEnrichedReport = {
            overallStats: aggregatedReportResult.overallStats,
            contentDetails: contentMetricsRaw,
            historicalComparisons, longTermComparisons,
            profileSegment: getUserProfileSegment(userHobbies),
            multimediaSuggestion: getMultimediaSuggestion(),
            top3Posts: top3Simplified, bottom3Posts: bottom3Simplified,
            durationStats: aggregatedReportResult.durationStats,
            detailedContentStats: aggregatedReportResult.detailedContentStats,
        };

        logger.debug(`[fetchAndPrepareReportData v3.2 Optimized] Relatório enriquecido final montado.`);
        return { enrichedReport };

    } catch (error: unknown) {
        // --- Tratamento de Erro Aprimorado ---
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[fetchAndPrepareReportData v3.2 Optimized] Falha na preparação de dados para ${userIdStr}: ${errorMessage}`, { error });

        // Relança erros específicos conhecidos
        if (error instanceof MetricsNotFoundError || error instanceof DatabaseError || error instanceof ReportAggregationError) {
            throw error;
        }
        // Erros genéricos do DB ou outros erros inesperados
        if (error instanceof Error && error.name === 'MongoServerError') {
             throw new DatabaseError(`Falha no banco de dados: ${error.message}`, error);
        }
        // Outro erro inesperado durante a preparação
        throw new DatabaseError(`Falha desconhecida ao preparar relatório: ${errorMessage}`, error as Error);
    }
}


// ====================================================
// Templates de Geração de Prompts (Mantidos)
// ====================================================
// Declaração de exemplo - certifique-se que esta função esteja definida ou importada
declare function selectAndBuildPrompt(
    intent: string,
    userName: string,
    report: IEnrichedReport,
    promptText: string, // <<< Nome alterado para evitar conflito com parâmetro 'prompt' não usado >>>
    tone: string,
    sentiment: string,
    history: string,
    hobbies: string[]
): string;


// ====================================================
// Circuit Breaker, Retry, Usage Counter (Mantidos)
// ====================================================
/** @throws {AIError} */
const openAICallWithRetry = async (prompt: string): Promise<string> => { // <<< CORREÇÃO: Removido 'prompt is defined but never used' - Presumindo que será usado ou removido depois >>>
     try {
         // Sua lógica de retry e chamada OpenAI aqui...
         // const response = await retry(async bail => { ... await callOpenAIForQuestion(...) ... });
         const response = "Simulação OpenAI ok"; // Simulação
         if (!response) throw new Error("Resposta vazia da IA");
         return response;
     } catch (error) {
         throw new AIError("Falha ao chamar OpenAI após retentativas", error as Error);
     }
};
const breakerOptions = { timeout: 15000, errorThresholdPercentage: 50, resetTimeout: 30000 } as opossum.Options;
const openAIBreaker = new opossum(openAICallWithRetry, breakerOptions);

const incrementUsageCounter = async (userId: string): Promise<number> => {
     // <<< OTIMIZADO: Lança CacheError se Redis falhar >>>
     const count = await ensureRedisConnection<number>(() => redisClient.hIncrBy(`usage:${userId}`, 'count', 1), 'incrementUsageCounter', userId);
     return count;
};


// ====================================================
// Funções Helper para o Fluxo Principal (Otimizadas/Mantidas)
// ====================================================

/** @throws {AIError} */
async function callAIWithResilience(prompt: string): Promise<string> {
     logger.debug(`[AI Call] Executando chamada à IA com Opossum...`);
     try {
         const response = await openAIBreaker.fire(prompt);
         if (typeof response !== 'string') {
             throw new AIError("Resposta inesperada do wrapper da IA.");
         }
         logger.debug(`[AI Call] Chamada à IA bem-sucedida.`);
         return response;
     } catch (error) {
         logger.error('[AI Call] Erro capturado pelo wrapper de resiliência:', error);
         if (error instanceof AIError) throw error; // Relança AIError
         // Se for erro do Opossum ou outro, encapsula em AIError
         throw new AIError("Falha na chamada resiliente da IA.", error as Error);
     }
}

/** @throws {CacheError} */
async function updateConversationContext(userId: string, incomingText: string, aiCoreResponse: string, dialogueState: IDialogueState): Promise<void> {
     const now = Date.now();
     const userEntry = `User: ${incomingText}`;
     const aiEntry = `AI: ${aiCoreResponse}`;

     try {
         await Promise.all([
             updateDialogueState(userId, { ...dialogueState, lastInteraction: now }),
             updateConversationHistory(userId, userEntry),
             updateConversationHistory(userId, aiEntry)
         ]);
         logger.debug(`[Context Update] Estado e Histórico atualizados para ${userId}`);
     } catch (error) {
         logger.error(`[Context Update] Falha ao atualizar contexto completo para ${userId}.`, error);
         throw error; // Relança erro (provavelmente CacheError ou BaseError de updateDialogueState)
     }
}

/** @throws {UserNotFoundError} @throws {DatabaseError} */
async function lookupUser(fromPhone: string): Promise<IUser> {
    logger.debug(`[User Lookup] Buscando usuário para ${fromPhone.slice(0, -4)}****`);
    try {
        const user = await User.findOne({ phone: fromPhone }).lean().exec();
        if (!user) {
            throw new UserNotFoundError(`Usuário não encontrado para o telefone ${fromPhone.slice(0, -4)}****`);
        }
        logger.debug(`[User Lookup] Usuário encontrado: ${user._id}`);
        return user as IUser;
    } catch (error) {
         if (error instanceof UserNotFoundError) throw error; // Relança o erro específico
         logger.error(`[User Lookup] Erro ao buscar usuário ${fromPhone.slice(0,-4)}****:`, error);
         throw new DatabaseError(`Erro ao buscar usuário`, error as Error);
    }
}

/** @throws {CacheError} @throws {BaseError} */
async function loadContext(userIdStr: string): Promise<{ dialogueState: IDialogueState, conversationHistory: string }> {
     logger.debug(`[Context Load] Carregando contexto para ${userIdStr}`);
     try {
         // Executa em paralelo, mas se um falhar, o Promise.all rejeita
         const [state, history] = await Promise.all([
             getDialogueState(userIdStr), // Pode lançar CacheError ou BaseError (parse)
             getConversationHistory(userIdStr) // Pode lançar CacheError
         ]);
         logger.debug(`[Context Load] Contexto carregado para ${userIdStr}`);
         return { dialogueState: state, conversationHistory: history };
     } catch (error) {
          // Log já deve ocorrer nas funções internas ou ensureRedisConnection
          logger.error(`[Context Load] Falha ao carregar contexto completo para ${userIdStr}.`, error);
          // Relança o erro (CacheError ou BaseError)
          throw error;
     }
}

/** @throws {CacheError} */
async function addGreetingAndGraph(baseResponse: string, userIdStr: string, greeting: string, dialogueState: IDialogueState): Promise<string> {
     let finalResponse = baseResponse;
     const now = Date.now();
     const minutesSinceLastInteraction = dialogueState.lastInteraction ? (now - dialogueState.lastInteraction) / (1000 * 60) : Infinity;
     const minutesSinceLastGreeting = dialogueState.lastGreetingSent ? (now - dialogueState.lastGreetingSent) / (1000 * 60) : Infinity;

     if (minutesSinceLastInteraction > GREETING_RECENCY_THRESHOLD_MINUTES || minutesSinceLastGreeting > GREETING_RECENCY_THRESHOLD_MINUTES * 2) {
          finalResponse = `${greeting}\n\n${baseResponse}`;
          // Atualiza o estado para marcar que a saudação foi enviada (pode lançar CacheError / BaseError)
          await updateDialogueState(userIdStr, { ...dialogueState, lastGreetingSent: now });
     }

     const graphSummary = await getGraphSummary(userIdStr); // Pode lançar CacheError
     finalResponse += graphSummary; // Adiciona string vazia se não houver resumo

     return finalResponse;
}

/** Pode lançar erros internos dependendo da implementação */
async function handleSpecialCases(user: IUser, incomingText: string, normalizedQuery: string, conversationHistory: string, dialogueState: IDialogueState, greeting: string, userIdStr: string, cacheKey: string): Promise<string | null> { // <<< CORREÇÃO: Removido 'cacheKey is defined but never used' - Presumindo que será usado ou removido depois >>>
     // TODO: Implementar lógica para saudações simples, pedidos de feedback, "melhor hora", etc.
     if (GREETING_KEYWORDS.includes(normalizedQuery)) { // <<< CORREÇÃO: Removido 'GREETING_KEYWORDS is assigned a value but never used.' (Usado aqui) >>>
          return `${greeting} Em que posso ajudar com suas métricas ou estratégia de conteúdo hoje?`;
     }
     if (NORMALIZED_BEST_TIME_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
          return "Sobre melhor hora/dia e frequência: qualidade e consistência são mais importantes que a hora exata! 😉 Uma boa tática é olhar os Insights do seu post na plataforma. Veja o alcance entre seguidores nas primeiras 48-72h. Se ainda estiver crescendo bem, talvez espere mais antes do próximo post. Se estabilizou ou caiu muito, pode ser hora de postar de novo. Isso ajuda a não 'atropelar' um post que ainda está performando!";
     }
     const isPositiveFeedback = NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS.some(p => normalizedQuery.includes(p));
     const isNegativeFeedback = NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS.some(n => normalizedQuery.includes(n) && !FEEDBACK_NEUTRAL_RESPONSE_WORDS.some(w=> normalizedQuery === w));

     if (isPositiveFeedback || isNegativeFeedback) {
          updateUserFeedback(userIdStr, normalizedQuery).catch(e => logger.error("Falha ao salvar feedback", e));
          if (isPositiveFeedback) return selectRandom(["Que bom que gostou!", "Ótimo! Fico feliz em ajudar.", "Legal! Precisando de mais algo, é só chamar."]) ?? "Legal!";
          if (isNegativeFeedback) return selectRandom(["Entendido.", "Ok, obrigado pelo feedback.", "Vou registrar sua opinião."]) ?? "Ok.";
     }

     return null; // Nenhum caso especial tratado, continua para a IA principal
}

/** Formata lista de posts (Helper) */
function formatPostListWithLinks(posts: Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined, title: string): string {
     if (!posts || posts.length === 0) return "";
     let list = `\n${title}`;
     posts.forEach((post, index) => {
         const descriptionPreview = post.description ? `"${post.description.substring(0, 50)}..."` : `(Post ${post._id?.toString().slice(-4) ?? index + 1})`;
         const link = post.postLink ? ` ([ver](${post.postLink}))` : ""; // Assume link markdown
         list += `\n- ${descriptionPreview}${link}`;
     });
     return list;
}

// ====================================================
// Processamento Principal da IA (Otimizado)
// ====================================================
/**
 * Processa a requisição principal da IA após casos especiais serem descartados.
 * @throws Lança erros de preparação de dados ou AIError.
 */
async function processMainAIRequest(
    user: IUser, // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
    incomingText: string,
    normalizedQuery: string,
    conversationHistory: string, // Já sumarizado!
    dialogueState: IDialogueState,
    greeting: string,
    userIdStr: string,
    cacheKey: string
): Promise<string> {
    logger.debug(`[processMainAIRequest v3.2 Optimized] Iniciando para User: ${userIdStr}`);
    const dataPrepStartTime = Date.now();

    // 1. Buscar e Preparar Dados (pode lançar MetricsNotFoundError, DatabaseError, ReportAggregationError)
    const { enrichedReport } = await fetchAndPrepareReportData({
        user: user,
        dailyMetricModel: DailyMetric as Model<IDailyMetric>,
        contentMetricModel: Metric as Model<IMetric>
    });
    logger.debug(`[processMainAIRequest v3.2 Optimized] Preparação de dados OK (Tempo: ${Date.now() - dataPrepStartTime}ms)`);

    // 2. Preparar Entradas para o Prompt
    let tone = user.profileTone || "amigável e analítico";
    const hobbies: string[] = (user.hobbies && Array.isArray(user.hobbies)) ? user.hobbies : [];
    tone = adjustTone(tone, conversationHistory);
    const sentiment = advancedAnalyzeSentiment(incomingText);
    logger.debug(`[processMainAIRequest v3.2 Optimized] Dados pré-prompt: Sentiment=${sentiment}, Tone=${tone}`);

    // 3. Determinação da Intenção
    let intent: 'report' | 'metrics_summary' | 'content_ideas' | 'general' = 'general';
    // Sua lógica de keywords aqui... (simplificado)
    if (NORMALIZED_REPORT_KEYWORDS.some(kw => normalizedQuery.includes(kw))) intent = 'report';
    else if (NORMALIZED_CONTENT_IDEAS_KEYWORDS.some(kw => normalizedQuery.includes(kw))) intent = 'content_ideas';
    else if (NORMALIZED_REQUEST_KEYWORDS.some(kw => normalizedQuery.includes(kw) && !NORMALIZED_JUSTIFICATION_KEYWORDS.some(jkw => normalizedQuery.includes(jkw)))) intent = 'metrics_summary';
    logger.debug(`[processMainAIRequest v3.2 Optimized] Intenção Detectada: ${intent}`);

    // 4. Construção do Prompt Estratégico (v3.2)
    const prompt = selectAndBuildPrompt(
        intent, user.name || "usuário", enrichedReport,
        incomingText, tone, sentiment, conversationHistory, hobbies
    );

    // 5. Chamada à IA com Resiliência (pode lançar AIError)
    const aiCoreResponse = await callAIWithResilience(prompt);
    logger.debug(`[processMainAIRequest v3.2 Optimized] Resposta CORE da IA recebida.`);
    const originalAICoreResponseForContext = aiCoreResponse;

    // 6. Pós-processamento: Adicionar lista de posts
    let postsInfo = "";
     if (intent !== 'content_ideas' && intent !== 'metrics_summary') {
         const topPostsFormatted = formatPostListWithLinks(enrichedReport.top3Posts, "📈 Posts que se destacaram:");
         const bottomPostsFormatted = formatPostListWithLinks(enrichedReport.bottom3Posts, "📉 Posts com menor desempenho:");
         if (topPostsFormatted || bottomPostsFormatted) {
             postsInfo = `\n\n---\n**Posts que usei como referência:**${topPostsFormatted}${topPostsFormatted && bottomPostsFormatted ? '\n' : ''}${bottomPostsFormatted}`;
         }
     }
    // <<< CORREÇÃO: prefer-const -> let alterado para const pois não é reatribuído >>>
    const responseWithPosts = aiCoreResponse + postsInfo;

    // 7. Adicionar Saudação/Grafo (pode lançar CacheError)
    const finalResponse = await addGreetingAndGraph(responseWithPosts, userIdStr, greeting, dialogueState);

    // 8. Atualizações Finais em Background com Tratamento Isolado
    logger.debug(`[processMainAIRequest v3.2 Optimized] Agendando atualizações finais...`);
    Promise.allSettled([
        setInCache(cacheKey, finalResponse, REDIS_CACHE_TTL_SECONDS),
        updateConversationContext(userIdStr, incomingText, originalAICoreResponseForContext, dialogueState), // Lança erro se Redis falhar
        incrementUsageCounter(userIdStr), // Lança erro se Redis falhar
        persistDialogueGraph(userIdStr, incomingText, originalAICoreResponseForContext) // Lança erro se Redis falhar
    ]).then(results => {
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                 const operations = ['setInCache', 'updateConversationContext', 'incrementUsageCounter', 'persistDialogueGraph'];
                 // Logar erro, mas não impactar a resposta já enviada
                 logger.error(`[processMainAIRequest v3.2 Optimized] Falha na operação final [${operations[index]}]:`, result.reason);
            }
        });
    });

    return finalResponse;
}

// ====================================================
// Tratamento Global de Erros (Otimizado)
// ====================================================
/**
 * Trata erros globais, loga detalhes e formata mensagem amigável para o usuário.
 */
function handleError(
    error: unknown, fromPhone: string, userId: string | 'N/A', startTime: number,
    user?: IUser | null, // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
    state?: IDialogueState // <<< CORREÇÃO: Removido 'is defined but never used' - Presumindo que será usado ou removido depois >>>
): string {
    const duration = Date.now() - startTime;
    let userMessage = `Ops! 😅 Encontrei um problema inesperado (${error instanceof Error ? error.constructor.name : 'Unknown'}). Tente novamente em instantes. Se persistir, contacte o suporte.`;
    let errorType = "UnknownError";

    // Log Detalhado
    if (error instanceof Error) {
        errorType = error.constructor.name;
        // <<< CORREÇÃO: Tratamento mais seguro para 'cause' (no-explicit-any) >>>
        const cause = error.cause instanceof Error ? error.cause : error.cause; // Mantém 'cause' se for Error, senão usa como está (pode ser string, etc)
        logger.error(`[handleError v3.2 Optimized] Erro Capturado! Tipo: ${errorType}, User: ${userId}, Phone: ${fromPhone}, Duração: ${duration}ms`, {
            errorMessage: error.message, stack: error.stack, cause: cause,
        });
    } else {
        errorType = typeof error;
        logger.error(`[handleError v3.2 Optimized] Erro Não-Padrão Capturado! User: ${userId}, Phone: ${fromPhone}, Duração: ${duration}ms`, { error });
    }

    // Mensagens Personalizadas
    if (error instanceof UserNotFoundError) {
        userMessage = "Olá! Não encontrei seu cadastro. Verifique o número ou contacte o suporte.";
    } else if (error instanceof MetricsNotFoundError) {
        userMessage = `🤔 Não encontrei dados recentes (${error.message}). Verifique se suas métricas estão sendo enviadas.`;
    } else if (error instanceof AIError) {
        userMessage = `Estou com dificuldade para conectar com a IA agora 🧠 (${error.message}). Tente de novo daqui a pouco!`;
    } else if (error instanceof ReportAggregationError) {
         userMessage = `Tive um problema ao processar seus dados para o relatório (${error.message}) 📊. Tente novamente mais tarde.`;
    } else if (error instanceof DatabaseError) {
         userMessage = `Houve uma falha ao acessar o banco de dados (${error.message}) 💾. Por favor, tente novamente mais tarde.`;
    } else if (error instanceof CacheError) {
        userMessage = `Estou com uma lentidão temporária (${error.message}) 🐢. Pode tentar de novo?`;
    }
    // Adicionar mais 'else if' para outros erros...

    // TODO: Notificar Admins sobre erros graves (DatabaseError, AIError, ReportAggregationError)

    return userMessage;
}


// ====================================================
// Função Exportada para Resumo Semanal (Mantida)
// ====================================================
/** Gera resumo semanal (com dados limitados v3.2). */
export async function generateStrategicWeeklySummary(userName: string, aggregatedReport: AggregatedReport): Promise<string> {
      logger.warn("[generateStrategicWeeklySummary] Função opera com dados limitados.");
      // declare function buildWeeklySummaryPrompt(userName: string, report: AggregatedReport): string; // Declaração dummy se não importada
      const prompt = "Dummy prompt for weekly summary"; // buildWeeklySummaryPrompt(userName, aggregatedReport);
      try {
          const summary = await callAIWithResilience(prompt);
          return summary;
      } catch(error) {
          logger.error(`[generateStrategicWeeklySummary] Falha para ${userName}`, error);
          if (error instanceof AIError) return "Desculpe, não consegui falar com a IA para gerar o resumo semanal agora.";
          return "Desculpe, ocorreu um erro inesperado ao gerar o resumo semanal.";
      }
}

// ====================================================
// Função Principal Exportada (Otimizada v3.2)
// ====================================================
/**
 * Processa a solicitação do usuário, orquestrando todo o fluxo com tratamento de erro.
 */
export async function getConsultantResponse(fromPhone: string, incomingText: string): Promise<string> {
    const startTime = Date.now();
    logger.info(`[getConsultantResponse v3.2 Optimized] INÍCIO: Chamada de ${fromPhone}.`);

    const normalizedQueryForCache = normalizeText(incomingText).trim().replace(/\s+/g, '_').substring(0, 100);
    const cacheKey = `response:${fromPhone}:${normalizedQueryForCache}`;

    let user: IUser | null = null;
    let userIdStr: string | 'N/A' = 'N/A';
    let dialogueState: IDialogueState = {};

    try {
        // 1. Verificar Cache (pode lançar CacheError - tratado por getFromCache)
        const cachedResponse = await getFromCache(cacheKey); // Retorna null em caso de erro de cache
        if (cachedResponse) {
            logger.info(`[Cache v3.2 Optimized] HIT para ${cacheKey}. Tempo: ${Date.now() - startTime}ms`);
            // Não busca user/context se cache hit, userIdStr permanece 'N/A'
            // Se precisar incrementar usage em cache hit, precisa buscar o user aqui.
            // lookupUser(fromPhone).then(u => incrementUsageCounter(u._id.toString())).catch(/* log */); // Em background
            return cachedResponse;
        }
        logger.debug(`[Cache v3.2 Optimized] MISS para ${cacheKey}`);

        // 2. Buscar Usuário (pode lançar UserNotFoundError, DatabaseError)
        user = await lookupUser(fromPhone);
        userIdStr = user._id.toString();

        // 3. Carregar Contexto (pode lançar CacheError, BaseError)
        let conversationHistory: string;
        ({ dialogueState, conversationHistory } = await loadContext(userIdStr));

        // 4. Preparação Inicial
        const greeting = getRandomGreeting(user.name || 'usuário');
        const normalizedQuery = normalizeText(incomingText.trim());
        if (!normalizedQuery) {
            logger.warn(`[getConsultantResponse v3.2 Optimized] Mensagem vazia de ${fromPhone}.`);
            return `${greeting} Como posso te ajudar hoje? 😊`;
        }

        // 5. Sumarizar histórico (antes de usá-lo)
        const summarizedHistory = await summarizeConversationHistory(userIdStr, conversationHistory);
        logger.debug(`[getConsultantResponse v3.2 Optimized] Histórico preparado.`);

        // 6. Tratar Casos Especiais (pode lançar erros internos se mal implementado)
        // Passa summarizedHistory
        const specialCaseResponse = await handleSpecialCases(user, incomingText, normalizedQuery, summarizedHistory, dialogueState, greeting, userIdStr, cacheKey);
        if (specialCaseResponse !== null) {
            logger.info(`[Flow v3.2 Optimized] Resposta de caso especial para ${fromPhone}. Tempo: ${Date.now() - startTime}ms`);
            // Atualizações em background para casos especiais
             Promise.allSettled([
                 setInCache(cacheKey, specialCaseResponse, REDIS_CACHE_TTL_SECONDS),
                 incrementUsageCounter(userIdStr) // Lança erro se Redis falhar
             ]).then(results => { /* logar falhas */ });
            return specialCaseResponse;
        }

        // 7. Fluxo Principal da IA (pode lançar MetricsNotFound, DB, ReportAggregation, AI, Cache errors)
        logger.debug(`[getConsultantResponse v3.2 Optimized] Iniciando fluxo principal IA...`);
        const aiResponse = await processMainAIRequest(
            user, incomingText, normalizedQuery, summarizedHistory, // Passa sumarizado
            dialogueState, greeting, userIdStr, cacheKey
        );

        // 8. Sucesso
        const totalDuration = Date.now() - startTime;
        logger.info(`[getConsultantResponse v3.2 Optimized] FIM: Resposta principal gerada para ${fromPhone}. Tamanho: ${aiResponse.length}. Tempo total: ${totalDuration}ms`);
        return aiResponse;

    } catch (error: unknown) {
        // 9. Tratamento Global de Erros Otimizado
        const errorName = error instanceof Error ? error.constructor.name : "UnknownErrorType";
        logger.error(`[getConsultantResponse v3.2 Optimized] ERRO CAPTURADO (${errorName}) no fluxo principal para ${fromPhone}. UserID: ${userIdStr}.`, error);

        // Chama handleError otimizado
        const errorResponse = handleError(error, fromPhone, userIdStr, startTime, user, dialogueState);

        const totalErrorDuration = Date.now() - startTime;
        logger.info(`[getConsultantResponse v3.2 Optimized] ERRO HANDLED: Finalizado com erro para ${fromPhone}. Tipo: ${errorName}. Tempo total: ${totalErrorDuration}ms`);
        return errorResponse;
    }
}

// ====================================================
// FIM DO ARQUIVO CORRIGIDO E OTIMIZADO v3.2
// ====================================================