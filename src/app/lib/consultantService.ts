// <<< IMPORTANTE: Backfill de Dados Históricos >>>
// Lembre-se que para a análise histórica por formato funcionar corretamente,
// você precisará executar um processo para preencher o campo 'format'
// nos documentos Metric existentes no seu banco de dados.
// =======================================================

import { Model, Types } from "mongoose";
import User, { IUser } from "@/app/models/User"; // Assume que IUser é exportado corretamente
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";

import {
    buildAggregatedReport,
    AggregatedReport,
    DurationStat,
    OverallStats,
    DetailedContentStat, // Mantido pois é usado na interface IEnrichedReport
    ReportAggregationError
} from "@/app/lib/reportHelpers"; // Removidos DayOfWeekStat, DetailedStatsError se não usados em catch

import {
    BaseError,
    UserNotFoundError,
    MetricsNotFoundError,
    AIError,
    CacheError,
    DatabaseError
} from "@/app/lib/errors";

import { callOpenAIForQuestion } from "@/app/lib/aiService"; // Mantido - Usado na simulação/TODO
import { subDays } from "date-fns";
import opossum from "opossum";
// import retry from "async-retry"; // Removido - Se a lógica real de retry usar, descomente
import { logger } from '@/app/lib/logger';
import { createClient } from "redis";

// ====================================================
// Função Auxiliar de Normalização de Texto
// ====================================================
function normalizeText(text: string | undefined | null): string {
    if (!text) return "";
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// ====================================================
// Constantes de Configuração e Palavras-chave (Reduzidas)
// ====================================================
const METRICS_FETCH_DAYS_LIMIT = 180;
const CONTENT_METRICS_LIMIT = 10; // Usado em fetchAndPrepareReportData
const GREETING_RECENCY_THRESHOLD_MINUTES = 15;
const HISTORY_RAW_LINES_LIMIT = 10; // Usado em getConversationHistory

// Constantes de Cache e TTL
const REDIS_CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const REDIS_STATE_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;

// ====================================================
// Constantes de Palavras-chave (Reduzidas para o uso real)
// ====================================================
const POSITIVE_SENTIMENT_KEYWORDS = ["bom", "ótimo", "legal", "gostei", "excelente", "feliz", "aumentou", "cresceu", "sim", "curti", "ajudou", "obrigado", "obrigada", "aplicável", "útil", "util"];
const NEGATIVE_SENTIMENT_KEYWORDS = ["ruim", "péssimo", "triste", "problema", "difícil", "caiu", "diminuiu", "preocupado", "não", "nao", "confuso", "perdi", "piorou", "inválido", "genérico"];
const GREETING_KEYWORDS = ["oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite", "e aí", "eae"];
// Mantidas keywords usadas na lógica de intent e casos especiais
const REQUEST_KEYWORDS = ["métrica", "dado", "ajuda", "info", "relatório", "resumo", "plano", "performance", "número", "analisa", "analise", "visão geral", "detalhado", "completo", "estratégia", "postar", "ideia", "conteúdo", "sugestão", "justifica", "explica", "detalha", "métricas", "por que", "melhor dia", "melhor hora", "formato", "proposta", "contexto"];
const CONTENT_IDEAS_KEYWORDS = [ "ideia", "conteúdo", "sugestão de post", "sugestões de post", "sugere", "sugestão", "o que postar", "inspiração", "exemplos de posts", "dicas de conteúdo", "ideias criativas" ];
const BEST_TIME_KEYWORDS = ["melhor dia", "melhor hora", "melhor horário", "qual dia", "qual hora", "qual horário", "quando postar", "frequência", "cadência"];
const JUSTIFICATION_KEYWORDS = ["por que", "porque", "pq", "justifica", "explica", "baseado em", "como assim", "detalha", "qual a lógica", "fundamento", "embase", "embasar"];
const REPORT_KEYWORDS = ["relatório", "relatorio", "plano", "estratégia", "detalhado", "completo"];
const FEEDBACK_POSITIVE_KEYWORDS = ["sim", "gostei", "útil", "util", "aplicável", "ajudou", "boa"];
const FEEDBACK_NEGATIVE_KEYWORDS = ["não", "nao"];
const FEEDBACK_NEUTRAL_RESPONSE_WORDS = ["não", "nao"];

// Normalizadas apenas as que são usadas
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
type IAggregatedStats = object; // Placeholder. Defina propriedades se souber.

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
    detailedContentStats?: DetailedContentStat[]; // Contém format, proposal, context no _id
}

interface IGrowthDataResult { historicalAverages?: OverallStats, recent90Averages?: OverallStats, previous90Averages?: OverallStats }
interface ReportDataInput { user: IUser; dailyMetricModel: Model<IDailyMetric>; contentMetricModel: Model<IMetric>; }
interface PreparedData { enrichedReport: IEnrichedReport; }
interface IDialogueState { lastInteraction?: number; lastGreetingSent?: number; /* ... */ }

// ====================================================
// Redis: Inicialização e Funções de Cache
// ====================================================
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
let redisInitialized = false;
let isConnecting = false;

redisClient.on('error', (err: Error) => { logger.error('[Redis] Erro:', err); redisInitialized = false; });
redisClient.on('connect', () => { logger.info('[Redis] Conectando...'); });
redisClient.on('ready', () => { logger.info('[Redis] Conectado.'); redisInitialized = true; isConnecting = false; });
redisClient.on('end', () => { logger.warn('[Redis] Conexão encerrada.'); redisInitialized = false; });

const initializeRedis = async (): Promise<void> => {
    if (!redisInitialized && !isConnecting) {
        isConnecting = true;
        logger.info('[Redis] Tentando conectar...');
        try { await redisClient.connect(); } catch (err) { logger.error('[Redis] Falha inicial:', err); isConnecting = false; }
    }
};
initializeRedis(); // Tenta conectar na inicialização

const ensureRedisConnection = async <T>( operation: () => Promise<T>, operationName: string, key?: string ): Promise<T> => {
    if (!redisInitialized) {
        logger.warn(`[Redis] Operação '${operationName}'${key ? ` para key '${key}'` : ''} sem conexão. Tentando reconectar...`);
        await initializeRedis();
        if (!redisInitialized) throw new CacheError(`Redis indisponível para ${operationName}`);
        logger.info(`[Redis] Reconectado, continuando '${operationName}'...`)
    }
    try {
        const result = await Promise.race([
             operation(),
             new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Redis operation timed out')), 5000))
        ]);
        return result;
    } catch (error) {
        const errMsg = `Falha na operação Redis '${operationName}'${key ? ` para key '${key}'` : ''}`;
        logger.error(`[Redis] ${errMsg}`, error);
        throw new CacheError(errMsg, error instanceof Error ? error : undefined);
    }
};

const getFromCache = async (key: string): Promise<string | null> => {
     try {
         return await ensureRedisConnection<string | null>(() => redisClient.get(key), 'getFromCache', key);
     } catch (error) {
         if (error instanceof CacheError) {
             logger.warn(`[Cache] Falha GET (key: ${key}). Continuando sem cache.`, error.message);
             return null;
         } throw error;
     }
};

const setInCache = async (key: string, value: string, ttlSeconds: number): Promise<string | null> => {
     try {
         return await ensureRedisConnection<string | null>(() => redisClient.set(key, value, { EX: ttlSeconds }), 'setInCache', key);
     } catch (error) {
          if (error instanceof CacheError) {
             logger.warn(`[Cache] Falha SET (key: ${key}).`, error.message);
             return null;
         } throw error;
     }
};

// ====================================================
// Funções Auxiliares Básicas
// ====================================================
const selectRandom = <T>(arr: T[]): T | undefined => arr[Math.floor(Math.random() * arr.length)];
const getRandomGreeting = (userName: string): string => selectRandom([`Oi ${userName}!`, `Olá ${userName}!`, `E aí ${userName}, tudo certo?`]) ?? `Olá ${userName}!`;

// ====================================================
// Análise de Sentimento
// ====================================================
const advancedAnalyzeSentiment = (text: string): "positive" | "negative" | "neutral" => {
    const lowerText = text.toLowerCase();
    // Lógica simples de keywords - pode ser melhorada com IA ou libs específicas
    const hasPositive = POSITIVE_SENTIMENT_KEYWORDS.some(kw => lowerText.includes(kw));
    const hasNegative = NEGATIVE_SENTIMENT_KEYWORDS.some(kw => lowerText.includes(kw));
    if (hasPositive && !hasNegative) return "positive";
    if (hasNegative && !hasPositive) return "negative";
    return "neutral";
 };

// ====================================================
// Gerenciamento de Diálogo e Histórico
// ====================================================
const getDialogueState = async (userId: string): Promise<IDialogueState> => {
    const stateJson = await ensureRedisConnection<string | null>(() => redisClient.get(`state:${userId}`), 'getDialogueState', userId);
    if (stateJson) { try { return JSON.parse(stateJson); } catch (e) { logger.error(`[Dialogue] Erro parse estado ${userId}`, e); } }
    return {};
};

const updateDialogueState = async (userId: string, newState: IDialogueState): Promise<string | null> => {
     try {
         const stateJson = JSON.stringify(newState);
         return await ensureRedisConnection<string | null>(() => redisClient.set(`state:${userId}`, stateJson, { EX: REDIS_STATE_TTL_SECONDS }), 'updateDialogueState', userId);
     } catch (e) {
          logger.error(`[Dialogue] Erro save estado ${userId}`, e);
          if (e instanceof CacheError) throw e;
          throw new BaseError("Falha ao salvar estado do diálogo.", e as Error);
     }
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
     } catch (error) {
          logger.error(`[History] Erro ao atualizar histórico ${userId}:`, error);
          throw error;
     }
 };

// ====================================================
// Sumarização de Histórico
// ====================================================
async function summarizeConversationHistory(historyText: string): Promise<string> {
    // TODO: Implementar lógica real de sumarização com IA se necessário
    const lines = historyText.split('\n');
    if (lines.length > HISTORY_RAW_LINES_LIMIT) {
        logger.warn(`[Summarize] Histórico (${lines.length} linhas) > ${HISTORY_RAW_LINES_LIMIT}, usando sem sumarizar.`);
        // return callOpenAIForSummary(historyText);
    }
    return historyText;
}

// ====================================================
// Feedback, Personalização, Grafo (Placeholders/Limpos)
// ====================================================
// TODO: Implementar ou remover
const updateUserFeedback = async (userId: string /*, feedback: string */ ): Promise<number | null> => { logger.warn(`[Feedback] updateUserFeedback não implementado para ${userId}.`); return null; };
// TODO: Implementar ou remover
const getUserProfileSegment = (/* hobbies: string[] | undefined | null */): string => { return "Geral"; };
const getMultimediaSuggestion = (): string => { return ""; }; // TODO: Implementar
// TODO: Implementar ou remover
const adjustTone = (tone: string /*, conversationHistory: string */): string => { return tone; };
// TODO: Implementar ou remover
const persistDialogueGraph = async (/* userId: string, userPrompt: string, aiResponse: string */): Promise<void> => { logger.warn("[Graph] persistDialogueGraph não implementado."); };
// TODO: Implementar ou remover
const getGraphSummary = async (/* userId: string */): Promise<string> => { return ""; };

// ====================================================
// Funções de Busca de Dados
// ====================================================
/** @throws {DatabaseError} */
async function getCombinedGrowthData(userId: Types.ObjectId, dailyMetricModel: Model<IDailyMetric>): Promise<IGrowthDataResult> { // dailyMetricModel mantido pois é usado na chamada
    try {
        // TODO: Implementar lógica real de agregação $facet
        logger.warn(`[DB:Facet] Função getCombinedGrowthData não implementada para ${userId}.`);
        return {};
    } catch(error) {
        logger.error(`[DB:Facet] Erro na agregação $facet ${userId}:`, error);
        throw new DatabaseError(`Falha crescimento agregado ${userId}`, error as Error);
    }
}
/** @throws {DatabaseError} */
async function fetchContentDetailsForMetrics(metricsToFetch: IDailyMetric[] | undefined, contentMetricModel: Model<IMetric>): Promise<Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined> {
    if (!metricsToFetch || metricsToFetch.length === 0) return undefined;
    const postIdsToFetch = metricsToFetch.map(dm => dm.postId).filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));
    if (postIdsToFetch.length === 0) return [];

    try {
        const contentMetrics = await contentMetricModel.find({ _id: { $in: postIdsToFetch } })
            .select('_id description postLink').lean().exec();
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
/**
 * Busca dados e prepara o relatório enriquecido para a IA.
 * @throws {MetricsNotFoundError|DatabaseError|ReportAggregationError}
 */
async function fetchAndPrepareReportData({ user, dailyMetricModel, contentMetricModel }: ReportDataInput): Promise<PreparedData> {
    const userId = user._id;
    const userIdStr = userId.toString();
    logger.debug(`[fetchData] Iniciando para ${userIdStr}`);
    const metricsStartDate = subDays(new Date(), METRICS_FETCH_DAYS_LIMIT);

    let dailyMetricsRaw: IDailyMetric[] = [];
    let contentMetricsRaw: Pick<IMetric, 'description' | 'postLink'>[] = [];
    let growthData: IGrowthDataResult = {};
    let aggregatedReportResult: AggregatedReport | null = null;

    try {
        logger.debug(`[fetchData] Buscando dados brutos...`);
        [ dailyMetricsRaw, contentMetricsRaw, growthData ] = await Promise.all([
            dailyMetricModel.find({ user: userId, postDate: { $gte: metricsStartDate } })
                .select('postDate stats user postId _id').sort({ postDate: -1 }).lean().exec(),
             contentMetricModel.find({ user: userId }).select('description postLink')
                .sort({ postDate: -1 }).limit(CONTENT_METRICS_LIMIT).lean().exec(),
             getCombinedGrowthData(userId, dailyMetricModel), // Pode lançar DatabaseError
        ]);
        logger.debug(`[fetchData] Brutos: ${dailyMetricsRaw.length} Daily, ${contentMetricsRaw.length} Content.`);

        if (dailyMetricsRaw.length === 0) throw new MetricsNotFoundError(`Sem métricas diárias (${METRICS_FETCH_DAYS_LIMIT}d)`);

        logger.debug(`[fetchData] Executando buildAggregatedReport...`);
        aggregatedReportResult = await buildAggregatedReport(dailyMetricsRaw, userId, metricsStartDate, dailyMetricModel, contentMetricModel as Model<IMetric>);
        logger.debug(`[fetchData] buildAggregatedReport: overall=${!!aggregatedReportResult.overallStats}, detailed=${aggregatedReportResult.detailedContentStats?.length ?? 0}`);

        logger.debug(`[fetchData] Buscando detalhes top/bottom...`);
        const [top3Simplified, bottom3Simplified] = await Promise.all([
            fetchContentDetailsForMetrics(aggregatedReportResult.top3, contentMetricModel),
            fetchContentDetailsForMetrics(aggregatedReportResult.bottom3, contentMetricModel)
        ]);

         let historicalComparisons: IGrowthComparisons | undefined = undefined;
         let longTermComparisons: IGrowthComparisons | undefined = undefined;
         // TODO: Implementar cálculos de comparação usando uma função computeGrowth
         logger.warn("[fetchData] Cálculos de 'historicalComparisons' e 'longTermComparisons' não implementados.");

        if (!aggregatedReportResult?.overallStats) {
            logger.error(`[fetchData] overallStats ausentes.`);
            if (growthData.recent90Averages) {
                logger.warn(`[fetchData] Usando recent90Averages como fallback overallStats.`);
                aggregatedReportResult = { ...aggregatedReportResult, overallStats: growthData.recent90Averages as unknown as OverallStats };
            } else {
                throw new MetricsNotFoundError(`Não foi possível calcular overallStats para ${userIdStr}`);
            }
        }

        const userHobbies: string[] = (user.hobbies && Array.isArray(user.hobbies)) ? user.hobbies : [];
        const profileSegment = getUserProfileSegment(/* userHobbies */); // Passa hobbies se a função usar

        const enrichedReport: IEnrichedReport = {
            overallStats: aggregatedReportResult.overallStats,
            contentDetails: contentMetricsRaw,
            historicalComparisons, longTermComparisons,
            profileSegment: profileSegment,
            multimediaSuggestion: getMultimediaSuggestion(),
            top3Posts: top3Simplified, bottom3Posts: bottom3Simplified,
            durationStats: aggregatedReportResult.durationStats,
            detailedContentStats: aggregatedReportResult.detailedContentStats, // Contém format
        };

        logger.debug(`[fetchData] Relatório enriquecido montado.`);
        return { enrichedReport };

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error(`[fetchData] Falha para ${userIdStr}: ${errorMessage}`, { error });
        if (error instanceof MetricsNotFoundError || error instanceof DatabaseError || error instanceof ReportAggregationError) throw error;
        if (error instanceof Error && error.name === 'MongoServerError') throw new DatabaseError(`DB error: ${error.message}`, error);
        throw new DatabaseError(`Falha desconhecida preparar relatório: ${errorMessage}`, error as Error);
    }
}


// ====================================================
// Templates de Geração de Prompts (IMPLEMENTAÇÃO COM NOVO PROMPT)
// ====================================================

/**
 * Constrói a base de instruções e formata os dados para a IA.
 * Incorpora as regras de negócio e o novo campo 'format'.
 */
function generateAIInstructions(userName: string, report: IEnrichedReport, history: string, tone: string): string {
    // Obtém o segmento/nicho principal (placeholder, idealmente viria do user.profileSegment ou hobbies)
    const profileSegment = report.profileSegment || "Geral";

    // Formata a seção detailedContentStats de forma legível e concisa
    let detailedStatsString = "\nNão há dados detalhados por formato/proposta/contexto disponíveis.\n";
    if (report.detailedContentStats && report.detailedContentStats.length > 0) {
        detailedStatsString = "\n## Desempenho Detalhado (Formato/Proposta/Contexto - Top 7):\n";
        // Limita e formata os stats detalhados
        report.detailedContentStats.slice(0, 7).forEach(stat => {
            detailedStatsString += `- F: ${stat._id.format}, P: ${stat._id.proposal}, C: ${stat._id.context} (${stat.count} posts) -> Comp. Médio: ${stat.avgCompartilhamentos?.toFixed(1)}, Salv. Médio: ${stat.avgSalvamentos?.toFixed(1)}\n`;
        });
    }

     // Formata a seção durationStats
    let durationStatsString = "\nNão há dados de desempenho por duração disponíveis.\n";
    if (report.durationStats && report.durationStats.length > 0) {
        durationStatsString = "\n## Desempenho por Duração (Foco em Compartilhamentos):\n";
        report.durationStats.forEach(stat => {
             durationStatsString += `- Faixa ${stat.range} (${stat.contentCount} posts): Comp. Médio = ${stat.averageShares.toFixed(2)}\n`;
         });
     }

     // Formata Overall Stats de forma concisa
     let overallStatsString = "\nNão há dados gerais disponíveis.\n";
     if (report.overallStats) {
         overallStatsString = `\n## Métricas Gerais (Médias):\n- Compartilhamentos: ${report.overallStats.avgCompartilhamentos?.toFixed(1)}\n- Salvamentos: ${report.overallStats.avgSalvamentos?.toFixed(1)}\n- Curtidas: ${report.overallStats.avgCurtidas?.toFixed(1)}\n- Comentários: ${report.overallStats.avgComentarios?.toFixed(1)}\n- Visualizações: ${report.overallStats.avgVisualizacoes?.toFixed(0)}\n (Baseado em ${report.overallStats.count} posts)\n`;
     }

    // Monta o prompt base com as instruções e dados formatados
    const instructions = `
# Persona e Contexto
Você é o 'InsightAI', um consultor especialista em mídias sociais, parceiro estratégico e amigável do criador de conteúdo ${userName}. Seu tom deve ser ${tone}. Você se comunica via WhatsApp. O objetivo principal é analisar os dados de desempenho fornecidos e oferecer insights práticos, recomendações acionáveis e ideias de conteúdo para ajudar ${userName} a otimizar sua estratégia, crescer sua audiência e aumentar o engajamento, considerando seu nicho principal (${profileSegment}).

# Dados Disponíveis para Análise (Resumo)
${overallStatsString}
${detailedStatsString}
${durationStatsString}
*Observação: Top/Bottom Posts e Comparações Históricas não incluídos neste resumo, mas podem ser referenciados se necessário.*

# Regras e Diretrizes Essenciais para Análise e Resposta

## Regra 1: FOCO EM ALCANCE E RETENÇÃO (Métricas Chave)
- **Prioridade:** Compartilhamentos e Salvamentos são métricas **cruciais** para alcançar não-seguidores e viralizar. Dê **peso especial** a elas em suas análises e recomendações, especialmente se o objetivo for crescimento.
- **Duração:** Analise os dados de 'Desempenho por Duração'. Quais faixas de duração geram mais compartilhamentos? Use isso para guiar sugestões de duração de vídeos/Reels.
- **Justificativa:** Conecte suas sugestões ao impacto potencial no alcance (Ex: "Vídeos de 15-29s tiveram mais compartilhamentos em média para você, o que pode ajudar a alcançar mais pessoas.").

## Regra 2: ANÁLISE DE FORMATO PERSONALIZADA (Dados do Usuário!)
- **Análise Essencial:** Use os dados de 'Desempenho Detalhado' para comparar o desempenho (compartilhamentos, salvamentos, etc.) dos **diferentes 'format'** (Reel, Foto, Carrossel...) **especificamente para ${userName}**.
- **NÃO existe "melhor formato" universal.** O que funciona para ${userName} pode ser diferente das tendências gerais. **Baseie-se nos dados DELE!**
- **Linguagem Condicional:** Use linguagem **cautelosa e sugestiva**, não impositiva.
    - *Bom:* "Seus dados mostram que seus Carrosséis sobre [Contexto X] tiveram uma boa média de salvamentos. Se você gosta desse formato, talvez valha a pena explorar mais."
    - *Bom:* "Notei que seus Reels na faixa de 30-59s tiveram menos compartilhamentos que os mais curtos. Você pode considerar testar vídeos mais concisos, se fizer sentido para o conteúdo."
    - *Ruim:* "Você TEM que fazer mais Reels." ou "Fotos não funcionam mais."
- **Proficiência Implícita:** Reconheça que a habilidade do criador influencia. Foque em sugerir otimizações nos formatos que JÁ mostram bons resultados para ele, ou sugira experimentar outros com base em dados, mas sempre como uma opção a considerar.

## Regra 3: CADÊNCIA E QUALIDADE (Princípios e Explicação)
- **Princípio:** Mencione brevemente, se apropriado (ex: ao discutir planejamento ou baixo engajamento), que **qualidade consistente e dar tempo para cada post respirar** costuma ser melhor que volume excessivo (evitar canibalização de alcance).
- **Método de Cadência (Explicar, NÃO Calcular):** Se relevante para a pergunta, **explique** a seguinte tática: "Uma forma de pensar sobre quando postar o próximo conteúdo é acompanhar o alcance do seu post atual entre seus seguidores. Quando ele atingir sua média histórica das primeiras 48-72 horas (verifique nos Insights da plataforma), pode ser um bom indicativo. Isso ajuda a dar o tempo necessário para cada post performar." **NÃO tente calcular ou prever a data exata.**

## Diretrizes Adicionais
- **Proposta e Contexto:** Use também as dimensões 'proposal' e 'context' dos dados detalhados para insights mais específicos (Ex: "Dicas sobre Fitness em formato Carrossel tiveram muitos salvamentos.").
- **Resposta Direta:** Responda diretamente à userMessage (que será adicionada ao final deste prompt).
- **Tom e Formato:** Mantenha o tom ${tone}. Use emojis moderadamente. Seja útil e acionável. Se pedir ideias, dê 2-3 exemplos concretos baseados na análise. Se a intenção for um relatório completo, seja mais detalhado.

# Tarefa
Analise os dados resumidos acima, o histórico da conversa ('conversationHistory') e a mensagem do usuário ('userMessage') a seguir. Aplique as regras e diretrizes. Gere uma resposta útil e personalizada para ${userName}.

# Histórico Recente:
${history}
`;
    return instructions;
}


/**
 * Seleciona e constrói o prompt final para a IA.
 */
function selectAndBuildPrompt(
    intent: string,
    userName: string,
    report: IEnrichedReport,
    userMessage: string,
    tone: string,
    sentiment: string,
    history: string,
    hobbies: string[]
): string {
    // Gera a base das instruções e formata os dados principais
    // Passa o profileSegment real do report para as instruções
    const baseInstructionsAndData = generateAIInstructions(userName, report, history, tone);

    // Adaptações baseadas no intent poderiam ir aqui
    // Ex: Se intent === 'report', talvez formatar MAIS dados do report nas instruções.
    // Ex: Se intent === 'content_ideas', focar mais nas análises de formato/proposta/contexto que deram certo.
    logger.debug(`[Prompt Build] Intent: ${intent}, Tone: ${tone}, Sentiment: ${sentiment}, Hobbies: ${hobbies.join(',')}`);

    // Concatena TUDO para formar o prompt final
    const finalPrompt = `${baseInstructionsAndData}\n# Mensagem Atual do Usuário:\n${userMessage}\n\n# Sua Resposta Detalhada e Acionável:`;
    logger.info(`[Prompt Construído] Para User: ${userName}, Intent: ${intent}, Tamanho: ${finalPrompt.length}`);
    // logger.debug(`[Prompt Construído] Conteúdo:\n${finalPrompt}`); // Descomente para debug pesado

    return finalPrompt;
}

// ====================================================
// Circuit Breaker, Retry, Usage Counter
// ====================================================
/** @throws {AIError} */
const openAICallWithRetry = async (prompt: string): Promise<string> => {
     try {
         // TODO: Implementar chamada real à IA usando callOpenAIForQuestion
         // A lógica de retry pode ser adicionada aqui ou feita externamente se necessário
         logger.warn("[AI Call] openAICallWithRetry está usando resposta simulada!");
         const response = await callOpenAIForQuestion(prompt, { temperature: 0.7 }); // Exemplo de chamada real
         // const response = "Simulação OpenAI ok - Analisei seus formatos: Reels curtos (até 15s) e Carrosséis de Dicas tiveram mais compartilhamentos recentemente. Considere explorar isso."; // Simulação
         if (!response) throw new Error("Resposta vazia da IA");
         return response;
     } catch (error) {
         throw new AIError("Falha ao chamar OpenAI", error as Error); // Simplificado, assumindo que o retry está fora ou não é mais necessário aqui
     }
};
const breakerOptions = { timeout: 15000, errorThresholdPercentage: 50, resetTimeout: 30000 } as opossum.Options;
// Passa a função real (ou a que tem retry) para o Opossum
const openAIBreaker = new opossum(openAICallWithRetry, breakerOptions);
openAIBreaker.on('failure', (error) => logger.error(`[Opossum] OpenAI Breaker falhou: ${error.message}`));
openAIBreaker.on('open', () => logger.warn('[Opossum] OpenAI Breaker ABERTO'));
openAIBreaker.on('close', () => logger.info('[Opossum] OpenAI Breaker FECHADO'));


const incrementUsageCounter = async (userId: string): Promise<number> => {
     const count = await ensureRedisConnection<number>(() => redisClient.hIncrBy(`usage:${userId}`, 'count', 1), 'incrementUsageCounter', userId);
     // TODO: Considerar lógica para expirar o contador de uso (ex: mensalmente)
     return count;
};

// ====================================================
// Funções Helper para o Fluxo Principal
// ====================================================

/** @throws {AIError} */
async function callAIWithResilience(prompt: string): Promise<string> {
     logger.debug(`[AI Call] Executando via Opossum... Prompt size: ${prompt.length}`);
     try {
         // Opossum agora chama openAICallWithRetry (que pode ter seu próprio retry ou não)
         const response = await openAIBreaker.fire(prompt);
         if (typeof response !== 'string' || response.trim() === "") { // Verifica resposta vazia também
             logger.error("[AI Call] Resposta vazia ou inválida recebida da IA/Opossum.");
             throw new AIError("Resposta vazia ou inesperada da IA.");
         }
         logger.debug(`[AI Call] Sucesso via Opossum.`);
         return response;
     } catch (error) {
         logger.error('[AI Call] Erro capturado pelo Opossum/wrapper:', error);
         if (error instanceof AIError) throw error;
         throw new AIError("Falha na chamada resiliente da IA.", error as Error);
     }
}

/** @throws {CacheError|BaseError} */
async function updateConversationContext(userId: string, incomingText: string, aiCoreResponse: string, dialogueState: IDialogueState): Promise<void> {
     const now = Date.now();
     const userEntry = `User: ${incomingText}`;
     const aiEntry = `AI: ${aiCoreResponse}`;
     try {
         const [updateStateResult, , ] = await Promise.all([
             updateDialogueState(userId, { ...dialogueState, lastInteraction: now }),
             updateConversationHistory(userId, userEntry),
             updateConversationHistory(userId, aiEntry)
         ]);
          logger.debug(`[Context Update] Completo para ${userId}. Set State Result: ${updateStateResult}`);
     } catch (error) {
         logger.error(`[Context Update] Falha para ${userId}.`, error);
         throw error;
     }
}

/** @throws {UserNotFoundError|DatabaseError} */
async function lookupUser(fromPhone: string): Promise<IUser> {
    logger.debug(`[User Lookup] Buscando ${fromPhone.slice(0, -4)}****`);
    try {
        const user = await User.findOne({ phone: fromPhone }).lean().exec();
        if (!user) throw new UserNotFoundError(`Usuário não encontrado: ${fromPhone.slice(0, -4)}****`);
        logger.debug(`[User Lookup] Encontrado: ${user._id}`);
        return user as IUser;
    } catch (error) {
         if (error instanceof UserNotFoundError) throw error;
         logger.error(`[User Lookup] Erro DB ${fromPhone.slice(0,-4)}****:`, error);
         throw new DatabaseError(`Erro ao buscar usuário`, error as Error);
    }
}

/** @throws {CacheError|BaseError} */
async function loadContext(userIdStr: string): Promise<{ dialogueState: IDialogueState, conversationHistory: string }> {
     logger.debug(`[Context Load] Carregando para ${userIdStr}`);
     try {
         const [state, rawHistory] = await Promise.all([
             getDialogueState(userIdStr),
             getConversationHistory(userIdStr)
         ]);
         // Sumariza o histórico ANTES de retornar
         const summarizedHistory = await summarizeConversationHistory(rawHistory);
         logger.debug(`[Context Load] Contexto carregado para ${userIdStr}. History summarized: ${rawHistory.length !== summarizedHistory.length}`);
         return { dialogueState: state, conversationHistory: summarizedHistory };
     } catch (error) {
          logger.error(`[Context Load] Falha para ${userIdStr}.`, error);
          throw error;
     }
}

/** @throws {CacheError|BaseError} */
async function addGreetingAndGraph(baseResponse: string, userIdStr: string, greeting: string, dialogueState: IDialogueState): Promise<string> {
     let finalResponse = baseResponse;
     const now = Date.now();
     const minutesSinceLastInteraction = dialogueState.lastInteraction ? (now - dialogueState.lastInteraction) / (1000 * 60) : Infinity;
     const minutesSinceLastGreeting = dialogueState.lastGreetingSent ? (now - dialogueState.lastGreetingSent) / (1000 * 60) : Infinity;

     if (minutesSinceLastInteraction > GREETING_RECENCY_THRESHOLD_MINUTES || minutesSinceLastGreeting > GREETING_RECENCY_THRESHOLD_MINUTES * 2) {
          finalResponse = `${greeting}\n\n${baseResponse}`;
          // Atualiza o estado com try-catch isolado para não quebrar o fluxo principal se falhar
          updateDialogueState(userIdStr, { ...dialogueState, lastGreetingSent: now })
            .catch(err => logger.error(`[addGreeting] Falha ao atualizar lastGreetingSent para ${userIdStr}`, err));
     }

     try {
        const graphSummary = await getGraphSummary(/* userIdStr */); // Parâmetro removido
        finalResponse += graphSummary; // Adiciona string vazia se não houver resumo
     } catch (err) {
         logger.error(`[addGreeting] Falha ao obter graphSummary para ${userIdStr}`, err);
         // Continua sem o resumo do grafo em caso de erro
     }

     return finalResponse;
}

/** Pode lançar erros internos dependendo da implementação */
async function handleSpecialCases(user: IUser, incomingText: string, normalizedQuery: string, /* conversationHistory: string, */ dialogueState: IDialogueState, greeting: string, userIdStr: string /*, cacheKey: string */): Promise<string | null> {
     // conversationHistory e cacheKey removidos pois não eram usados aqui
     if (GREETING_KEYWORDS.includes(normalizedQuery)) {
          return `${greeting} Em que posso ajudar com suas métricas ou estratégia de conteúdo hoje?`;
     }
     if (NORMALIZED_BEST_TIME_KEYWORDS.some(kw => normalizedQuery.includes(kw))) {
          // Explica a Regra 3 aqui diretamente
          return "Sobre melhor hora/dia e frequência: qualidade e consistência são mais importantes que a hora exata! 😉 Uma boa tática é olhar os Insights do seu post na plataforma. Veja o alcance entre seguidores nas primeiras 48-72h. Se ainda estiver crescendo bem, talvez espere mais antes do próximo post. Se estabilizou ou caiu muito, pode ser hora de postar de novo. Isso ajuda a não 'atropelar' um post que ainda está performando!";
     }
     const isPositiveFeedback = NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS.some(p => normalizedQuery.includes(p));
     const isNegativeFeedback = NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS.some(n => normalizedQuery.includes(n) && !FEEDBACK_NEUTRAL_RESPONSE_WORDS.some(w=> normalizedQuery === w));

     if (isPositiveFeedback || isNegativeFeedback) {
          // Passa o texto original como feedback, ou o normalizado? Depende do que updateUserFeedback espera
          updateUserFeedback(userIdStr).catch(e => logger.error("Falha ao salvar feedback", e));
          if (isPositiveFeedback) return selectRandom(["Que bom que gostou!", "Ótimo! Fico feliz em ajudar.", "Legal! Precisando de mais algo, é só chamar."]) ?? "Legal!";
          if (isNegativeFeedback) return selectRandom(["Entendido.", "Ok, obrigado pelo feedback.", "Vou registrar sua opinião."]) ?? "Ok.";
     }

     return null;
}

/** Formata lista de posts (Helper) */
function formatPostListWithLinks(posts: Pick<IMetric, '_id' | 'description' | 'postLink'>[] | undefined, title: string): string {
     if (!posts || posts.length === 0) return "";
     let list = `\n${title}`;
     posts.forEach((post, index) => {
         const descriptionPreview = post.description ? `"${post.description.substring(0, 50)}..."` : `(Post ${post._id?.toString().slice(-4) ?? index + 1})`;
         const link = post.postLink ? ` ([ver](${post.postLink}))` : "";
         list += `\n- ${descriptionPreview}${link}`;
     });
     return list;
}

// ====================================================
// Processamento Principal da IA
// ====================================================
/**
 * Processa a requisição principal da IA após casos especiais serem descartados.
 * @throws Lança erros de preparação de dados ou AIError.
 */
async function processMainAIRequest(
    user: IUser,
    incomingText: string,
    normalizedQuery: string,
    conversationHistory: string, // Já sumarizado!
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
    // tone = adjustTone(tone, conversationHistory); // Chama função ajustada (sem history)

    const sentiment = advancedAnalyzeSentiment(incomingText);
    logger.debug(`[processMainAIRequest] Dados pré-prompt: Sentiment=${sentiment}, Tone=${tone}`);

    let intent: 'report' | 'metrics_summary' | 'content_ideas' | 'general' = 'general';
    if (NORMALIZED_REPORT_KEYWORDS.some(kw => normalizedQuery.includes(kw))) intent = 'report';
    else if (NORMALIZED_CONTENT_IDEAS_KEYWORDS.some(kw => normalizedQuery.includes(kw))) intent = 'content_ideas';
    else if (NORMALIZED_REQUEST_KEYWORDS.some(kw => normalizedQuery.includes(kw) && !NORMALIZED_JUSTIFICATION_KEYWORDS.some(jkw => normalizedQuery.includes(jkw)))) intent = 'metrics_summary';
    logger.debug(`[processMainAIRequest] Intenção Detectada: ${intent}`);

    // Chama a função que CONSTRÓI o prompt com as novas instruções e dados formatados
    const prompt = selectAndBuildPrompt(
        intent, user.name || "usuário", enrichedReport,
        incomingText, tone, sentiment, conversationHistory, hobbies
    );

    const aiCoreResponse = await callAIWithResilience(prompt);
    logger.debug(`[processMainAIRequest] Resposta CORE da IA recebida.`);
    const originalAICoreResponseForContext = aiCoreResponse; // Guarda antes de formatar

    // Adiciona posts de referência se não for pedido de ideias/resumo
    let postsInfo = "";
     if (intent !== 'content_ideas' && intent !== 'metrics_summary') {
         const topPostsFormatted = formatPostListWithLinks(enrichedReport.top3Posts, "📈 Posts que se destacaram:");
         const bottomPostsFormatted = formatPostListWithLinks(enrichedReport.bottom3Posts, "📉 Posts com menor desempenho:");
         if (topPostsFormatted || bottomPostsFormatted) {
             postsInfo = `\n\n---\n**Posts que usei como referência:**${topPostsFormatted}${topPostsFormatted && bottomPostsFormatted ? '\n' : ''}${bottomPostsFormatted}`;
         }
     }
    const responseWithPosts = aiCoreResponse + postsInfo;

    // Adiciona saudação e sumário do grafo (se houver)
    const finalResponse = await addGreetingAndGraph(responseWithPosts, userIdStr, greeting, dialogueState);

    // Atualizações finais assíncronas (não bloqueiam a resposta)
    logger.debug(`[processMainAIRequest] Agendando atualizações finais async...`);
    Promise.allSettled([
        setInCache(cacheKey, finalResponse, REDIS_CACHE_TTL_SECONDS),
        updateConversationContext(userIdStr, incomingText, originalAICoreResponseForContext, dialogueState), // Passa resposta original
        incrementUsageCounter(userIdStr),
        persistDialogueGraph(/* userIdStr, incomingText, originalAICoreResponseForContext */) // Passa parâmetros se a função for implementada
    ]).then(results => {
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                 const operations = ['setInCache', 'updateConversationContext', 'incrementUsageCounter', 'persistDialogueGraph'];
                 logger.error(`[Background Update Failed] Operação [${operations[index]}]:`, result.reason);
            }
        });
    });

    return finalResponse;
}

// ====================================================
// Tratamento Global de Erros
// ====================================================
function handleError(error: unknown, fromPhone: string, userId: string | 'N/A', startTime: number): string {
    const duration = Date.now() - startTime;
    let userMessage = `Ops! 😅 Encontrei um problema inesperado (${error instanceof Error ? error.constructor.name : 'Unknown'}). Tente novamente em instantes. Se persistir, contacte o suporte.`;
    let errorType = "UnknownError";

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

    return userMessage;
}


// ====================================================
// Função Exportada para Resumo Semanal (Placeholder)
// ====================================================
export async function generateStrategicWeeklySummary(userName: string, aggregatedReport: AggregatedReport): Promise<string> {
      logger.warn("[generateWeeklySummary] Função não totalmente implementada.");
      // TODO: Construir prompt específico para resumo semanal
      const prompt = `Gere um resumo estratégico semanal curto para ${userName} baseado nestes dados agregados: ${JSON.stringify(aggregatedReport.overallStats)}`;
      try {
          return await callAIWithResilience(prompt);
      } catch(error) {
          logger.error(`[generateWeeklySummary] Falha para ${userName}`, error);
          if (error instanceof AIError) return "Desculpe, não consegui falar com a IA para gerar o resumo semanal agora.";
          return "Desculpe, ocorreu um erro inesperado ao gerar o resumo semanal.";
      }
}

// ====================================================
// Função Principal Exportada
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
        if (cachedResponse) {
            logger.info(`[Cache] HIT para ${cacheKey}. Tempo: ${Date.now() - startTime}ms`);
            // Consider incrementing usage even on cache hit? Requires user lookup.
            // lookupUser(fromPhone).then(u => u ? incrementUsageCounter(u._id.toString()) : null).catch(/* log */);
            return cachedResponse;
        }
        logger.debug(`[Cache] MISS para ${cacheKey}`);

        user = await lookupUser(fromPhone);
        userIdStr = user._id.toString();

        // Carrega estado e histórico (histórico já vem sumarizado se necessário)
        let conversationHistory: string;
        ({ dialogueState, conversationHistory } = await loadContext(userIdStr));

        const greeting = getRandomGreeting(user.name || 'usuário');
        const normalizedQuery = normalizeText(incomingText.trim());
        if (!normalizedQuery) {
            logger.warn(`[getConsultantResponse] Mensagem vazia de ${fromPhone}.`);
            return `${greeting} Como posso te ajudar hoje? 😊`;
        }

        // Trata casos especiais (saudações, feedback, melhor hora/dia)
        const specialCaseResponse = await handleSpecialCases(user, incomingText, normalizedQuery, /* conversationHistory, */ dialogueState, greeting, userIdStr /*, cacheKey */);
        if (specialCaseResponse !== null) {
            logger.info(`[Flow] Resposta de caso especial para ${fromPhone}. Tempo: ${Date.now() - startTime}ms`);
             Promise.allSettled([
                 setInCache(cacheKey, specialCaseResponse, REDIS_CACHE_TTL_SECONDS), // Cacheia resposta especial
                 incrementUsageCounter(userIdStr) // Incrementa uso para caso especial
             ]).then(results => { /* logar falhas */ });
            return specialCaseResponse;
        }

        // Fluxo principal com IA
        logger.debug(`[getConsultantResponse] Iniciando fluxo principal IA...`);
        const aiResponse = await processMainAIRequest(
            user, incomingText, normalizedQuery, conversationHistory,
            dialogueState, greeting, userIdStr, cacheKey
        );

        const totalDuration = Date.now() - startTime;
        logger.info(`[getConsultantResponse] FIM: Resposta principal gerada ${fromPhone}. Tam: ${aiResponse.length}. Tempo: ${totalDuration}ms`);
        return aiResponse;

    } catch (error: unknown) {
        const errorName = error instanceof Error ? error.constructor.name : "UnknownErrorType";
        logger.error(`[getConsultantResponse] ERRO CAPTURADO (${errorName}) fluxo principal ${fromPhone}. UserID: ${userIdStr}.`, error);
        const errorResponse = handleError(error, fromPhone, userIdStr, startTime);
        const totalErrorDuration = Date.now() - startTime;
        logger.info(`[getConsultantResponse] ERRO HANDLED: Finalizado com erro ${fromPhone}. Tipo: ${errorName}. Tempo: ${totalErrorDuration}ms`);
        return errorResponse;
    }
}
// ====================================================
// FIM
// ====================================================