import { Model, Types } from "mongoose";
import User, { IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";

// <<< ATENÇÃO v3.2: Importações de reportHelpers ATUALIZADAS >>>
import {
    buildAggregatedReport, // Função agora é async e espera mais args
    AggregatedReport,      // Interface agora inclui detailedContentStats
    DayOfWeekStat,
    DurationStat,
    OverallStats,
    DetailedContentStat    // <<< NOVO TIPO IMPORTADO >>>
    // getDetailedContentStats é chamado internamente por buildAggregatedReport agora
} from "@/app/lib/reportHelpers"; // Ajuste o caminho se necessário

import { callOpenAIForQuestion } from "@/app/lib/aiService"; // Presume que esta função existe
import { subDays, formatISO, subMinutes } from "date-fns";
import winston from "winston";
import opossum from "opossum";
import retry from "async-retry";
import { logger } from '@/app/lib/logger';
import { createClient, RedisClientType } from "redis"; // Simplificado tipo Redis

// ====================================================
// Função Auxiliar de Normalização de Texto (Mantida)
// ====================================================
/**
 * Converte texto para minúsculas e remove acentos/diacríticos.
 * @param text Texto original.
 * @returns Texto normalizado.
 */
function normalizeText(text: string | undefined | null): string {
    if (!text) return "";
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

// ====================================================
// Constantes de Configuração e Palavras-chave (Mantidas, com Regex e Request atualizados)
// ====================================================
const TEMP_MIN = Number(process.env.TEMP_MIN) || 0.6;
const TEMP_MAX = Number(process.env.TEMP_MAX) || 0.7;
const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 1000;
const METRICS_FETCH_DAYS_LIMIT = 180;
const CONTENT_METRICS_LIMIT = 10;
const GREETING_RECENCY_THRESHOLD_MINUTES = 15;
const HISTORY_RAW_LINES_LIMIT = 10;

// Constantes de Cache e TTL (Mantidas)
const REDIS_CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const REDIS_STATE_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_GRAPH_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_USAGE_TTL_DAYS = 35;

// ====================================================
// Constantes de Palavras-chave e Lógica (Mantidas - Já incluíam formato/proposta/contexto)
// ====================================================
// --- Originais ---
const POSITIVE_SENTIMENT_KEYWORDS = ["bom", "ótimo", "legal", "gostei", "excelente", "feliz", "aumentou", "cresceu", "sim", "curti", "ajudou", "obrigado", "obrigada", "aplicável", "útil", "util"];
const NEGATIVE_SENTIMENT_KEYWORDS = ["ruim", "péssimo", "triste", "problema", "difícil", "caiu", "diminuiu", "preocupado", "não", "nao", "confuso", "perdi", "piorou", "inválido", "genérico"];
// <<< Regex ATUALIZADO v3.2 para incluir 'formato' >>>
const GRAPH_TOPIC_REGEX = /\b(métrica[s]?|relatório[s]?|crescimento|engajamento|alcance|conteúdo[s]?|post[s]?|formato[s]?|curtida[s]?|comentário[s]?|compartilhamento[s]?|salvamento[s]?|visualizaç(?:ão|ões)|dica[s]?|sugest(?:ão|ões)|plano|estratégia|ideia[s]?|ajuda|dúvida|analisar|análise|melhorar|otimizar|duração|tempo|vídeo|reels|foto|carrossel|cadência|frequência|proposta|contexto)\b/g;
const GREETING_KEYWORDS = ["oi", "olá", "ola", "tudo bem", "bom dia", "boa tarde", "boa noite", "e aí", "eae"];
// <<< Request Keywords ATUALIZADO v3.2 para incluir 'formato' >>>
const REQUEST_KEYWORDS = ["métrica", "dado", "ajuda", "info", "relatório", "resumo", "plano", "performance", "número", "analisa", "analise", "visão geral", "detalhado", "completo", "estratégia", "postar", "ideia", "conteúdo", "sugestão", "justifica", "explica", "detalha", "métricas", "por que", "melhor dia", "melhor hora", "formato", "proposta", "contexto"];
const CONTENT_IDEAS_KEYWORDS = [ "ideia", "conteúdo", "sugestão de post", "sugestões de post", "sugere", "sugestão", "o que postar", "inspiração", "exemplos de posts", "dicas de conteúdo", "ideias criativas" ];
const BEST_TIME_KEYWORDS = ["melhor dia", "melhor hora", "melhor horário", "qual dia", "qual hora", "qual horário", "quando postar", "frequência", "cadência"];
const JUSTIFICATION_KEYWORDS = ["por que", "porque", "pq", "justifica", "explica", "baseado em", "como assim", "detalha", "qual a lógica", "fundamento", "embase", "embasar"];
const REPORT_KEYWORDS = ["relatório", "relatorio", "plano", "estratégia", "detalhado", "completo"];
const FEEDBACK_POSITIVE_KEYWORDS = ["sim", "gostei", "útil", "util", "aplicável", "ajudou", "boa"];
const FEEDBACK_NEGATIVE_KEYWORDS = ["não", "nao"];
const FEEDBACK_NEUTRAL_RESPONSE_WORDS = ["não", "nao"];

// --- Normalizadas (Mantidas) ---
const NORMALIZED_POSITIVE_KEYWORDS = POSITIVE_SENTIMENT_KEYWORDS.map(normalizeText);
const NORMALIZED_NEGATIVE_KEYWORDS = NEGATIVE_SENTIMENT_KEYWORDS.map(normalizeText);
const NORMALIZED_GREETING_KEYWORDS = GREETING_KEYWORDS.map(normalizeText);
const NORMALIZED_REQUEST_KEYWORDS = REQUEST_KEYWORDS.map(normalizeText); // Já inclui formato
const NORMALIZED_CONTENT_IDEAS_KEYWORDS = CONTENT_IDEAS_KEYWORDS.map(normalizeText);
const NORMALIZED_BEST_TIME_KEYWORDS = BEST_TIME_KEYWORDS.map(normalizeText);
const NORMALIZED_JUSTIFICATION_KEYWORDS = JUSTIFICATION_KEYWORDS.map(normalizeText);
const NORMALIZED_REPORT_KEYWORDS = REPORT_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS = FEEDBACK_POSITIVE_KEYWORDS.map(normalizeText);
const NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS = FEEDBACK_NEGATIVE_KEYWORDS.map(normalizeText);

// --- URLs de Exemplo (Mantidas) ---
const EXAMPLE_VIDEO_URL = process.env.EXAMPLE_VIDEO_URL || "https://exemplo.com/video-ideas";
const EXAMPLE_INFOGRAPHIC_URL = process.env.EXAMPLE_INFOGRAPHIC_URL || "https://exemplo.com/infographics";
const EXAMPLE_BLOG_GUIDE_URL = process.env.EXAMPLE_BLOG_GUIDE_URL || "https://exemplo.com/blog-guide";

// ====================================================
// Interfaces e Tipos (ATUALIZADAS v3.2)
// ====================================================

interface IAggregatedStats { /* ... (mantida) ... */ }
interface ISimplifiedContent { /* ... (mantida) ... */ }
interface IGrowthComparisons { /* ... (mantida) ... */ }

// <<< Interface IEnrichedReport ATUALIZADA v3.2 >>>
interface IEnrichedReport {
    overallStats?: OverallStats | IAggregatedStats;
    contentDetails: ISimplifiedContent[];
    historicalComparisons?: IGrowthComparisons;
    longTermComparisons?: IGrowthComparisons;
    profileSegment: string;
    multimediaSuggestion: string;
    top3Posts?: ISimplifiedContent[]; // Vem de buildAggregatedReport
    bottom3Posts?: ISimplifiedContent[]; // Vem de buildAggregatedReport
    durationStats?: DurationStat[]; // Vem de buildAggregatedReport
    detailedContentStats?: DetailedContentStat[]; // <<< CAMPO ATUALIZADO/RENOMEADO (Vem de buildAggregatedReport) >>>
}

interface IGrowthDataResult { /* ... (mantida) ... */ }
interface ReportDataInput { /* ... (mantida) ... */ }
interface PreparedData { /* ... (mantida) ... */ }
type SelectedContentMetric = Pick<IMetric, '_id' | 'description' | 'postLink' | 'user' | 'postDate'>;
interface IDialogueState { /* ... (mantida) ... */ }

// Erros Customizados (Mantidos)
class BaseError extends Error { /*...*/ }
class UserNotFoundError extends BaseError { }
class MetricsNotFoundError extends BaseError { }
class AIError extends BaseError { }
class CacheError extends BaseError { }
class DatabaseError extends BaseError { }

// ====================================================
// Redis: Inicialização e Funções de Cache (Mantidas)
// ====================================================
const redisClient = createClient({ /*...*/ });
let redisInitialized = false;
let isConnecting = false;
redisClient.on('error', (err: Error) => { /*...*/ });
const initializeRedis = async (): Promise<void> => { /*...*/ };
const ensureRedisConnection = async <T>(operation: () => Promise<T>, operationName: string, key?: string): Promise<T | null> => { /*...*/ return null;};
const getFromCache = async (key: string): Promise<string | null> => { /*...*/ return null;};
const setInCache = async (key: string, value: string, ttlSeconds: number): Promise<'OK' | null> => { /*...*/ return null;};

// ====================================================
// Funções Auxiliares Básicas (Mantidas)
// ====================================================
const computeGrowth = (current: number, historical: number): string => { /*...*/ return "";};
const selectRandom = <T>(arr: T[]): T | undefined => { /*...*/ return undefined;};
const getRandomEmoji = (): string => { /*...*/ return '✨';};
const getRandomGreeting = (userName: string): string => { /*...*/ return `Olá ${userName}!`;};

// ====================================================
// Funções Auxiliares de Formatação para IA (ATUALIZADAS v3.2)
// ====================================================

// formatDurationStatsForAI (Mantida)
const formatDurationStatsForAI = (stats?: DurationStat[]): string => {
    if (!stats || stats.length === 0) return 'N/A';
    const mappedStats = stats.map(s => {
        const match = s.range.match(/^(\d+)/);
        const sortKey = (match && match[1]) ? parseInt(match[1], 10) : Infinity;
        return {
            text: `Duração ${s.range}: ${s.averageShares?.toFixed(1) ?? 'N/A'} comp. (Média)`,
            sortKey: sortKey
        };
    });
    const sortedText = mappedStats
        .sort((a, b) => a.sortKey - b.sortKey)
        .map(item => item.text);
    return sortedText.join('; ');
};

/**
 * <<< NOVO HELPER v3.2 >>>
 * Formata estatísticas Detalhadas (Formato/Proposta/Contexto) para o prompt da IA.
 */
function formatDetailedContentStatsForAI(stats?: DetailedContentStat[]): string {
    if (!stats || stats.length === 0) {
      return 'N/A (Sem dados por Formato/Proposta/Contexto disponíveis)';
    }
    // Limita aos 15 principais grupos, ordenados por contagem (exemplo)
    return stats
      .sort((a, b) => b.count - a.count) // Ordena por contagem desc
      .slice(0, 15)
      .map(s => {
        const format = s._id.format || 'N/D';
        const proposal = s._id.proposal || 'N/D';
        const context = s._id.context || 'N/D';
        const shares = s.avgCompartilhamentos?.toFixed(1) ?? 'N/A';
        const saves = s.avgSalvamentos?.toFixed(1) ?? 'N/A';
        const likes = s.avgCurtidas?.toFixed(1) ?? 'N/A'; // Assumindo avgCurtidas presente
        return `[${format} / ${proposal} / ${context}]: Comp. ${shares}, Salv. ${saves}, Curt. ${likes} (Base ${s.count} posts)`;
      })
      .join('; \n    * '); // Formato de lista para o prompt
}

// <<< FUNÇÃO ANTIGA REMOVIDA v3.2 >>>
// function formatProposalContextStatsForAI(stats?: ProposalContextStat[]): string { /* ... */ }


// ====================================================
// Análise de Sentimento (Mantida)
// ====================================================
const analyzeSentiment = (normalizedText: string): "positive" | "negative" | "neutral" => { /*...*/ return "neutral";};
const advancedAnalyzeSentiment = (text: string): "positive" | "negative" | "neutral" => { /*...*/ return "neutral";};


// ====================================================
// Gerenciamento de Diálogo e Histórico (Início - Mantido)
// ====================================================
const getDialogueState = async (userId: string): Promise<IDialogueState> => { /*...*/ return {}; };
const updateDialogueState = async (userId: string, newState: IDialogueState): Promise<'OK' | null> => { /*...*/ return null; };
const getConversationHistory = async (userId: string): Promise<string> => { /*...*/ return ""; };
const updateConversationHistory = async (userId: string, newEntry: string): Promise<'OK' | null> => { /*...*/ return null; };

// ====================================================
// Sumarização de Histórico (Mantida, logs v3.2)
// ====================================================
const HISTORY_SUMMARIZATION_THRESHOLD_LINES = 6;
const HISTORY_SUMMARY_MAX_TOKENS = 150;
const HISTORY_SUMMARY_TEMPERATURE = 0.3;

async function summarizeConversationHistory(userId: string, historyText: string): Promise<string> {
    const lines = historyText.split('\n');
    if (!historyText || lines.length <= HISTORY_SUMMARIZATION_THRESHOLD_LINES) {
        logger.debug(`[History Summary v3.2] Histórico curto ou vazio para ${userId} (${lines.length} linhas), usando texto original.`); // Log v3.2
        return historyText;
    }

    logger.debug(`[History Summary v3.2] Histórico com ${lines.length} linhas excede o limite de ${HISTORY_SUMMARIZATION_THRESHOLD_LINES}, tentando sumarizar para ${userId}...`); // Log v3.2

    const summarizationPrompt = `
Sua tarefa é resumir a seguinte conversa recente entre um Usuário (User) e uma IA Consultora (AI) em no máximo 3-4 frases curtas ou 3 bullet points concisos.
Foque nos últimos tópicos discutidos, no sentimento ou objetivo recente do usuário, e em quaisquer perguntas ou tarefas que ficaram pendentes.
O resumo será usado como memória de curto prazo para a próxima resposta da IA. Seja direto e informativo.

Conversa Recente para Resumir:
---
${historyText}
---

Resumo Conciso:`;

    try {
        const summary = await callOpenAIForQuestion(summarizationPrompt, {
            temperature: HISTORY_SUMMARY_TEMPERATURE,
            max_tokens: HISTORY_SUMMARY_MAX_TOKENS
        });

        if (summary && !summary.startsWith("Desculpe, ocorreu um erro") && summary.trim().length > 0) {
            logger.debug(`[History Summary v3.2] Resumo gerado com sucesso para ${userId}. Tamanho: ${summary.length} chars.`); // Log v3.2
            return `Resumo da conversa recente:\n${summary.trim()}`;
        } else {
            logger.warn(`[History Summary v3.2] Falha ao gerar resumo (resposta vazia ou erro da IA) para ${userId}. Usando histórico original.`); // Log v3.2
            return historyText;
        }
    } catch (error) {
        logger.error(`[History Summary v3.2] Erro na chamada da API para sumarização para ${userId}:`, error); // Log v3.2
        return historyText;
    }
}


// ====================================================
// Feedback e Personalização Dinâmica (Mantidas, logs v3.2)
// ====================================================

const updateUserFeedback = async (userId: string, feedback: string): Promise<number | null> => {
    const lowerFeedback = normalizeText(feedback);
    if (NORMALIZED_FEEDBACK_POSITIVE_KEYWORDS.some(p => lowerFeedback.includes(p))) {
        logger.debug(`[Feedback v3.2] Usuário ${userId} deu feedback: ${lowerFeedback} -> positive`); // Log v3.2
        return ensureRedisConnection<number>(() => redisClient.hIncrBy(`feedback:${userId}`, "positive", 1), 'atualizar feedback positivo', userId);
    }
    if (NORMALIZED_FEEDBACK_NEGATIVE_KEYWORDS.some(n => lowerFeedback.includes(n))) {
        logger.debug(`[Feedback v3.2] Usuário ${userId} deu feedback: ${lowerFeedback} -> negative`); // Log v3.2
        return ensureRedisConnection<number>(() => redisClient.hIncrBy(`feedback:${userId}`, "negative", 1), 'atualizar feedback negativo', userId);
    }
    logger.debug(`[Feedback v3.2] Feedback não reconhecido: "${lowerFeedback}" para User: ${userId}`); // Log v3.2
    return null;
};

const getUserProfileSegment = (hobbies: string[] | undefined | null): string => {
    if (hobbies && Array.isArray(hobbies) && hobbies.length > 0) {
        try {
            const hobbyString = hobbies.length === 1 ? hobbies[0] :
                                hobbies.length === 2 ? hobbies.join(" e ") :
                                hobbies.slice(0, -1).join(", ") + " e " + hobbies.slice(-1);
            return `Vi que você curte ${hobbyString}. Talvez dê para conectar isso com seus posts!`;
        } catch (joinError) {
            logger.error(`[getUserProfileSegment v3.2] Erro ao fazer join dos hobbies:`, { hobbies: hobbies, error: joinError }); // Log v3.2
            return "";
        }
    }
    return "";
};

const getMultimediaSuggestion = (): string => selectRandom([ // Lógica mantida
    `Que tal variar o formato? Um vídeo curto ou um carrossel podem engajar mais de formas diferentes.`,
    `Pensou em usar um infográfico para mostrar dados de forma visual? Pode aumentar salvamentos.`,
    `Um conteúdo mais denso como um guia ou checklist pode gerar mais salvamentos e valor percebido.`
]) ?? "Considere variar os formatos do seu conteúdo.";

const adjustTone = (tone: string, conversationHistory: string): string => { // Lógica mantida
    if (!conversationHistory) return tone;
    const lastEntries = conversationHistory.toLowerCase().split('\n').slice(-4).join(' ');

    if (lastEntries.includes("desanimado") || lastEntries.includes("frustrado") || lastEntries.includes("não sei") || NORMALIZED_NEGATIVE_KEYWORDS.some(kw => lastEntries.includes(kw))) {
        logger.debug(`[Tone Adjust v3.2] Sentimento negativo detectado, ajustando para tom acolhedor.`); // Log v3.2
        return "mais acolhedor e encorajador";
    }
    if (lastEntries.includes("rápido") || lastEntries.includes("direto") || lastEntries.includes("resumo")) {
        logger.debug(`[Tone Adjust v3.2] Pedido de objetividade detectado, ajustando para tom direto.`); // Log v3.2
        return "mais direto e objetivo";
    }
    return tone;
};

const getProactiveSuggestions = (enrichedReport: IEnrichedReport): string => { // Lógica mantida (desabilitada)
    const SHARE_DROP_THRESHOLD = -5.0;
    const SAVE_DROP_THRESHOLD = -5.0;
    const suggestions: string[] = [];
    const comps = enrichedReport.historicalComparisons;

    if (comps) {
        try {
            if (comps.compartilhamentosGrowth && comps.compartilhamentosGrowth !== "N/A" && !comps.compartilhamentosGrowth.includes("Novo") && parseFloat(comps.compartilhamentosGrowth) < SHARE_DROP_THRESHOLD) {
                suggestions.push(/*...*/);
            }
            if (comps.salvamentosGrowth && comps.salvamentosGrowth !== "N/A" && !comps.salvamentosGrowth.includes("Novo") && parseFloat(comps.salvamentosGrowth) < SAVE_DROP_THRESHOLD) {
                suggestions.push(/*...*/);
            }
        } catch (e) {
            logger.warn(`[Proactive Suggestion v3.2] Erro ao parsear growth string: ${e}`); // Log v3.2
        }
    }

    if (suggestions.length > 0) {
        const chosenSuggestion = selectRandom(suggestions);
        logger.debug(`[Proactive Suggestion v3.2] Sugestão contextual escolhida: ${chosenSuggestion}`); // Log v3.2
        // return chosenSuggestion;
    } else {
        logger.debug(`[Proactive Suggestion v3.2] Nenhuma sugestão proativa específica gerada.`); // Log v3.2
    }
    return "";
};

// ====================================================
// Persistência de Grafo de Diálogo (Mantida, logs v3.2)
// ====================================================
const persistDialogueGraph = async (userId: string, userPrompt: string, aiResponse: string): Promise<void> => {
    const cleanResponse = aiResponse /* ... (lógica de limpeza mantida) ... */ .trim();
    const textForKeywords = `${normalizeText(userPrompt)} ${normalizeText(cleanResponse)}`;

    // Regex já inclui 'formato'
    const keywords = textForKeywords.match(GRAPH_TOPIC_REGEX);
    let uniqueTopics = keywords ? Array.from(new Set(keywords)).slice(0, 5) : [];

    if (uniqueTopics.length > 0) {
        const dataToPersist = { topics: uniqueTopics, updatedAt: new Date().toISOString() };
        logger.info(`[Graph v3.2] Persistindo (keywords) para ${userId}: ${uniqueTopics.join(', ')}`); // Log v3.2
        await ensureRedisConnection<'OK'>(
            () => redisClient.set(`graph:${userId}`, JSON.stringify(dataToPersist), { EX: REDIS_GRAPH_TTL_SECONDS }) as Promise<'OK'>,
            'persistir grafo (keywords)',
            userId
        );
    } else {
        logger.debug(`[Graph v3.2] Nenhuma keyword relevante encontrada via regex para ${userId}. Não persistindo grafo.`); // Log v3.2
    }
};

const getGraphSummary = async (userId: string): Promise<string> => { // Lógica mantida
    const graphData = await ensureRedisConnection(() => redisClient.get(`graph:${userId}`), 'buscar sumário do grafo', userId);
    if (graphData) {
        try {
            const graph = JSON.parse(graphData);
            if (Array.isArray(graph.topics) && graph.topics.length > 0) {
                const topicsToShow = graph.topics.slice(-3);
                return `\n\nLembrei que falamos recentemente sobre: ${topicsToShow.join(", ")}.`;
            }
        } catch (parseError) {
            logger.error(`[Graph v3.2] Erro ao parsear dados do grafo para ${userId}:`, { message: parseError instanceof Error ? parseError.message : String(parseError) }); // Log v3.2
        }
    }
    return "";
};

// ====================================================
// Funções de Busca de Dados (Início - Mantidas, logs v3.2)
// ====================================================

async function getCombinedGrowthData(userId: Types.ObjectId, dailyMetricModel: Model<IDailyMetric>): Promise<IGrowthDataResult> {
    const now = new Date();
    const historicalStart = subDays(now, 14);
    const recent90Start = subDays(now, 90);
    const previous90Start = subDays(now, 180);
    const previous90End = recent90Start;

    logger.debug(`[DB:Facet v3.2] Períodos para ${userId} - Histórico: >= ${formatISO(historicalStart)}, Recente90: >= ${formatISO(recent90Start)}, Anterior90: >= ${formatISO(previous90Start)} e < ${formatISO(previous90End)}`); // Log v3.2

    const groupStage: any = { /* ... (mantido) ... */ };
    const pipeline = [ /* ... (mantido) ... */ ];

    try {
        logger.debug(`[DB:Facet v3.2] Executando agregação $facet para usuário ${userId}...`); // Log v3.2
        const results = await dailyMetricModel.aggregate(pipeline).exec();
        if (!results?.[0]) {
            logger.warn(`[DB:Facet v3.2] Agregação $facet sem resultados para usuário ${userId}`); // Log v3.2
            return {};
         }
        const facetResult = results[0];
        logger.debug(`[DB:Facet v3.2] Resultados para ${userId}:`, { /* ... */ }); // Log v3.2
        return { /* ... (mantido) ... */ };
    } catch (error: unknown) {
        logger.error(`[DB:Facet v3.2] Erro na agregação $facet para usuário ${userId}:`, { /* ... */ }); // Log v3.2
        throw new DatabaseError(`Falha ao buscar dados de crescimento agregado para ${userId}`);
    }
}

async function fetchContentDetailsForMetrics(
    metricsToFetch: IDailyMetric[] | undefined,
    contentMetricModel: Model<IMetric>
): Promise<ISimplifiedContent[] | undefined> {
    logger.debug(`[fetchContentDetails v3.2] Iniciando busca de detalhes para ${metricsToFetch?.length ?? 0} métricas diárias.`); // Log v3.2
    if (!metricsToFetch || metricsToFetch.length === 0) { return undefined; }

    const postIdsToFetch = metricsToFetch
        .map(dm => dm.postId) // Assumindo que postId é obrigatório agora
        .filter((id): id is Types.ObjectId => !!id && Types.ObjectId.isValid(id));

    logger.debug(`[fetchContentDetails v3.2] PostIDs válidos para busca: [${postIdsToFetch.join(', ')}] (Total: ${postIdsToFetch.length})`); // Log v3.2

    if (postIdsToFetch.length === 0) {
        logger.warn(`[fetchContentDetails v3.2] Nenhuma postId válida encontrada.`); // Log v3.2
        return metricsToFetch.map(dm => ({ /* ... */ }));
    }

    try {
        logger.debug(`[fetchContentDetails v3.2] Executando contentMetricModel.find com $in para ${postIdsToFetch.length} IDs...`); // Log v3.2
        const contentMetrics = await contentMetricModel.find({ _id: { $in: postIdsToFetch } })
            .select('_id description postLink')
            .lean()
            .exec() as Pick<IMetric, '_id' | 'description' | 'postLink'>[];

        logger.debug(`[fetchContentDetails v3.2] Consulta ao BD retornou ${contentMetrics.length} detalhes.`); // Log v3.2
        if (contentMetrics.length > 0 && contentMetrics[0]) {
            logger.debug(`[fetchContentDetails v3.2] Exemplo: ID=${contentMetrics[0]._id}, Desc='${contentMetrics[0].description?.substring(0, 30)}...'`); // Log v3.2
        }

        const contentMap = new Map<string, ISimplifiedContent>();
        contentMetrics.forEach(cm => { contentMap.set(cm._id.toString(), { /*...*/ }); });

        const simplifiedResults = metricsToFetch.map(dm => {
            const postIdStr = dm.postId?.toString();
            if (postIdStr && contentMap.has(postIdStr)) {
                return contentMap.get(postIdStr)!;
            } else {
                 if (postIdStr) logger.warn(`[fetchContentDetails v3.2] Detalhe NÃO encontrado para PostID: ${postIdStr}`); // Log v3.2
                 else logger.warn(`[fetchContentDetails v3.2] DailyMetric ${dm._id} sem PostID.`); // Log v3.2
                return { /* ... (retorno de erro mantido) ... */ };
            }
        });
        logger.debug(`[fetchContentDetails v3.2] Mapeamento concluído. Retornando ${simplifiedResults.length} resultados.`); // Log v3.2
        return simplifiedResults;

    } catch (error) {
        logger.error(`[fetchContentDetails v3.2] Erro ao buscar detalhes por PostIDs:`, { /*...*/ }); // Log v3.2
        return metricsToFetch.map(dm => ({ /* ... (retorno de erro mantido) ... */ }));
    }
}

// ====================================================
// Funções Helper para getConsultantResponse (Preparação de Dados - ATUALIZADA v3.2)
// ====================================================

/**
 * <<< ATUALIZADO v3.2 >>>
 * Busca todos os dados necessários e prepara o relatório enriquecido para a IA.
 * Inclui busca de detailedContentStats (Formato/Proposta/Contexto) via buildAggregatedReport.
 */
async function fetchAndPrepareReportData({ user, dailyMetricModel, contentMetricModel }: ReportDataInput): Promise<PreparedData> {
    const userId = user._id;
    const userIdStr = userId.toString();
    logger.debug(`[fetchAndPrepareReportData v3.2] Iniciando para usuário ${userIdStr}`); // Log v3.2
    const metricsStartDate = subDays(new Date(), METRICS_FETCH_DAYS_LIMIT); // Data inicial para buscar métricas

    let dailyMetricsRaw: IDailyMetric[] = [];
    let contentMetricsRaw: Pick<IMetric, 'description' | 'postLink'>[] = [];
    let growthData: IGrowthDataResult = {};
    // <<< INICIALIZAÇÃO ATUALIZADA v3.2 >>>
    let aggregatedReportResult: AggregatedReport = {
        top3: [], bottom3: [], dayOfWeekStats: [], durationStats: [], detailedContentStats: [], overallStats: undefined
    };
    let top3Simplified: ISimplifiedContent[] | undefined;
    let bottom3Simplified: ISimplifiedContent[] | undefined;

    try {
        logger.debug(`[fetchAndPrepareReportData v3.2] Buscando dados brutos (DailyMetrics, ContentMetrics, GrowthData)...`);
        // <<< CHAMADA ANTIGA getProposalContextStats REMOVIDA DO Promise.all >>>
        const [
            dailyMetricsData,
            contentMetricsData,
            growthResult
        ] = await Promise.all([
            dailyMetricModel.find({ user: userId, postDate: { $gte: metricsStartDate } })
                .select('postDate stats user postId _id')
                .sort({ postDate: -1 })
                .lean().exec() as Promise<IDailyMetric[]>,
            contentMetricModel.find({ user: userId })
                .select('description postLink')
                .sort({ postDate: -1 })
                .limit(CONTENT_METRICS_LIMIT)
                .lean().exec(),
            getCombinedGrowthData(userId, dailyMetricModel),
        ]);

        // Atribui resultados
        dailyMetricsRaw = dailyMetricsData;
        contentMetricsRaw = contentMetricsData as Pick<IMetric, 'description' | 'postLink'>[];
        growthData = growthResult;

        logger.debug(`[fetchAndPrepareReportData v3.2] Dados brutos buscados: ${dailyMetricsRaw.length} DailyMetrics, ${contentMetricsRaw.length} ContentMetrics.`);

        if (dailyMetricsRaw.length === 0) {
            logger.warn(`[fetchAndPrepareReportData v3.2] Nenhuma métrica diária encontrada nos últimos ${METRICS_FETCH_DAYS_LIMIT} dias para ${userIdStr}.`);
            throw new MetricsNotFoundError(`Não encontrei métricas diárias recentes (últimos ${METRICS_FETCH_DAYS_LIMIT} dias)`);
        }

        // <<< CHAMADA ATUALIZADA v3.2 para buildAggregatedReport >>>
        logger.debug(`[fetchAndPrepareReportData v3.2] Executando buildAggregatedReport com ${dailyMetricsRaw.length} métricas...`);
        aggregatedReportResult = await buildAggregatedReport(
            dailyMetricsRaw,
            userId,
            metricsStartDate,
            dailyMetricModel, // Passa o model
            contentMetricModel// Passa o model
        );
        // Log inclui contagem de detailedContentStats agora
        logger.debug(`[fetchAndPrepareReportData v3.2] Resultado buildAggregatedReport: overall ${aggregatedReportResult.overallStats ? 'OK' : 'N/A'}, duration ${aggregatedReportResult.durationStats?.length ?? 0}, detailed ${aggregatedReportResult.detailedContentStats?.length ?? 0}`);
        // <<< FIM CHAMADA ATUALIZADA v3.2 >>>

        // Busca detalhes para top/bottom (baseado no resultado de buildAggregatedReport - Mantido)
        logger.debug(`[fetchAndPrepareReportData v3.2] Buscando detalhes para posts top (${aggregatedReportResult.top3.length}) / bottom (${aggregatedReportResult.bottom3.length})...`);
        [top3Simplified, bottom3Simplified] = await Promise.all([
            fetchContentDetailsForMetrics(aggregatedReportResult.top3, contentMetricModel),
            fetchContentDetailsForMetrics(aggregatedReportResult.bottom3, contentMetricModel)
        ]);

        const foundTop = top3Simplified?.filter(p => p.description && !p.description.startsWith('Descrição não encontrada') && !p.description.startsWith('Erro ao buscar descrição')).length ?? 0;
        const foundBottom = bottom3Simplified?.filter(p => p.description && !p.description.startsWith('Descrição não encontrada') && !p.description.startsWith('Erro ao buscar descrição')).length ?? 0;
        logger.debug(`[fetchAndPrepareReportData v3.2] Detalhes de conteúdo buscados: top3 ${foundTop}/${top3Simplified?.length ?? 0}, bottom3 ${foundBottom}/${bottom3Simplified?.length ?? 0}`);
        if (top3Simplified && foundTop !== top3Simplified.length) { logger.debug('[fetchAndPrepareReportData v3.2] Top 3 Simplificado com possíveis falhas:', top3Simplified); }
        if (bottom3Simplified && foundBottom !== bottom3Simplified.length) { logger.debug('[fetchAndPrepareReportData v3.2] Bottom 3 Simplificado com possíveis falhas:', bottom3Simplified); }

    } catch (error: unknown) {
        logger.error(`[fetchAndPrepareReportData v3.2] Erro durante preparação de dados para ${userIdStr}:`, { message: error instanceof Error ? error.message : String(error) });
        if (error instanceof DatabaseError || error instanceof MetricsNotFoundError) throw error;
        throw new DatabaseError(`Falha ao preparar dados do relatório para ${userIdStr}`);
    }

    // Calcula comparações de crescimento (lógica mantida)
    let historicalComparisons: IGrowthComparisons | undefined = undefined;
    let longTermComparisons: IGrowthComparisons | undefined = undefined;
    const currentStatsForComparison = growthData.recent90Averages ?? aggregatedReportResult?.overallStats;
    const histAvg = growthData.historicalAverages;
    const recent90Avg = growthData.recent90Averages;
    const prev90Avg = growthData.previous90Averages;
    if (currentStatsForComparison && histAvg) { historicalComparisons = { /*...*/ }; } else { logger.warn(`[fetchAndPrepareReportData v3.2] Não calculou HistComp.`); }
    if (recent90Avg && prev90Avg) { longTermComparisons = { /*...*/ }; } else { logger.warn(`[fetchAndPrepareReportData v3.2] Não calculou LongTermComp.`); }

    // Fallback para overallStats (lógica mantida)
    if (!aggregatedReportResult?.overallStats) {
        logger.error(`[fetchAndPrepareReportData v3.2] Falha crítica: overallStats ausentes.`);
        if (growthData.recent90Averages) {
            logger.warn(`[fetchAndPrepareReportData v3.2] Usando recent90Averages como fallback.`);
            aggregatedReportResult.overallStats = growthData.recent90Averages as unknown as OverallStats;
        } else {
            throw new MetricsNotFoundError(`Não foi possível calcular overallStats para ${userIdStr}`);
        }
    }

    const simplifiedContent: ISimplifiedContent[] = contentMetricsRaw.map(c => ({ description: c.description, postLink: c.postLink }));
    const userHobbies: string[] = (user.hobbies && Array.isArray(user.hobbies)) ? user.hobbies : [];

    // <<< MONTAGEM FINAL ATUALIZADA v3.2 >>>
    const enrichedReport: IEnrichedReport = {
        overallStats: aggregatedReportResult.overallStats,
        contentDetails: simplifiedContent,
        historicalComparisons,
        longTermComparisons,
        profileSegment: getUserProfileSegment(userHobbies),
        multimediaSuggestion: getMultimediaSuggestion(),
        top3Posts: top3Simplified,
        bottom3Posts: bottom3Simplified,
        durationStats: aggregatedReportResult.durationStats,
        detailedContentStats: aggregatedReportResult.detailedContentStats, // <<< CAMPO ATUALIZADO >>>
    };

    // Log resumido final (atualizado)
    logger.debug(`[fetchAndPrepareReportData v3.2] Relatório enriquecido final para ${userIdStr} montado.`, {
        hasOverall: !!enrichedReport.overallStats,
        contentCount: enrichedReport.contentDetails.length,
        hasHistComp: !!enrichedReport.historicalComparisons,
        hasLongComp: !!enrichedReport.longTermComparisons,
        top3Count: enrichedReport.top3Posts?.length ?? 0,
        bottom3Count: enrichedReport.bottom3Posts?.length ?? 0,
        durationStatsCount: enrichedReport.durationStats?.length ?? 0,
        detailedContentStatsCount: enrichedReport.detailedContentStats?.length ?? 0, // <<< Log Atualizado >>>
    });
    logger.debug(`[fetchAndPrepareReportData v3.2] Concluído para usuário ${userIdStr}.`);
    return { enrichedReport };
}


// ====================================================
// Templates de Geração de Prompts (VERSÃO ESTRATÉGICA v3.2 - COM FORMATO EXPLÍCITO)
// ====================================================

/**
 * <<< ATUALIZADO para v3.2 >>>
 * Gera as instruções CORE para a IA, incorporando formato explícito e regras v3.2.
 */
const generateAIInstructions = ( // <<< REATORADA PARA v3.2 >>>
    userName: string,
    enrichedReport: IEnrichedReport,
    tone: string,
    hobbies: string[]
): string => {
    // <<< Desestrutura detailedContentStats >>>
    const {
        overallStats,
        historicalComparisons,
        longTermComparisons,
        top3Posts,
        bottom3Posts,
        contentDetails,
        durationStats,
        detailedContentStats // <<< NOVO DADO DETALHADO >>>
     } = enrichedReport;
    const destaqueDesc = contentDetails?.[0]?.description?.substring(0, 70) ?? "N/A";
    const hobbiesList = hobbies.length > 0 ? hobbies.join(", ") : "Nenhum";

    // Funções internas de formatação (mantidas)
    const formatPostsForAI = (posts?: ISimplifiedContent[]): { formatted: string; hasRealDescriptions: boolean } => {
        if (!posts || posts.length === 0) return { formatted: 'N/A', hasRealDescriptions: false };
        let hasRealDescriptions = false;
        const formattedPosts = posts.slice(0, 3).map(p => {
            const isDescriptionValid = p?.description && !p.description.startsWith('Descrição não encontrada') && !p.description.startsWith('Erro ao buscar descrição');
            if (isDescriptionValid) { hasRealDescriptions = true; return `"${p.description!.substring(0, 100)}..."`; }
            return `(ID ${p?._id?.toString().slice(-4) ?? 'N/A'} - Desc. Indisponível)`;
        }).join('; \n    * ');
        return { formatted: `\n    * ${formattedPosts}`, hasRealDescriptions };
    };
    const formatGrowth = (growth?: string) => growth ?? 'N/A';
    const formatStat = (stat?: number) => stat?.toFixed(1) ?? 'N/A';

    const topPostsResult = formatPostsForAI(top3Posts);
    const bottomPostsResult = formatPostsForAI(bottom3Posts);
    const canAnalyzeDescriptions = topPostsResult.hasRealDescriptions || bottomPostsResult.hasRealDescriptions;

    // <<< Usa o novo helper formatDetailedContentStatsForAI >>>
    const formattedDurationStats = formatDurationStatsForAI(durationStats);
    const formattedDetailedContentStats = formatDetailedContentStatsForAI(detailedContentStats);

    logger.debug(`[Prompt Gen v3.2] Pode analisar descrições? ${canAnalyzeDescriptions}. Duration Stats: ${formattedDurationStats}. Detailed Stats: ${formattedDetailedContentStats}`); // Log v3.2

    // <<< INÍCIO DAS INSTRUÇÕES ATUALIZADAS v3.2 >>>
    let instructions = `
---
**Instruções Detalhadas para a IA (Consultor Parceiro e ESTRATÉGICO v3.2 - Com Formato/Proposta/Contexto):**

**Persona:** Consultor de mídias sociais PARCEIRO, AMIGÁVEL, PRÁTICO, CONVERSACIONAL e ESTRATÉGICO. Você entende profundamente de Instagram, fatores de crescimento, análise de dados e agora também de estratégias de conteúdo baseadas em **Formato, Proposta e Contexto explícitos**. Aja como um colega experiente, oferecendo conselhos diretos, acionáveis e baseados em dados e princípios sólidos (Regras 1, 2, 3 abaixo).

**Tom:** Use o tom **${tone}**, garantindo que soe natural, direto e encorajador. Adapte levemente baseado no sentimento do usuário, se aplicável.

**Restrições:**
    * EVITE jargões técnicos excessivos. Explique conceitos complexos de forma simples.
    * EVITE tom de relatório formal, respostas genéricas ou linguagem passiva.
    * NÃO faça perguntas de feedback genéricas ao final.
    * SEJA CONCISO: Vá direto ao ponto, mas forneça contexto suficiente. Priorize 1-2 recomendações chave por resposta.
    * FOCO NO USUÁRIO: As recomendações devem ser personalizadas para os dados e contexto de ${userName}.
    * **NÃO DECLARE UM FORMATO COMO UNIVERSALMENTE MELHOR (Regra 2):** Baseie sugestões de formato no **desempenho REAL daquele formato PARA ${userName}**, conforme os dados detalhados.

**Seu Papel Principal:** Analisar os dados e contexto fornecidos, aplicar os **Princípios Chave de Crescimento (REGRAS OBRIGATÓRIAS)** abaixo, **correlacionando os diferentes tipos de dados (geral, duração, detalhados por formato/proposta/contexto, top/bottom)**, e gerar **1 ou 2 insights/conselhos principais** que sejam ACIONÁVEIS e ESTRATÉGICOS para ${userName}.

---
**Princípios Chave de Crescimento (REGRAS OBRIGATÓRIAS v3.2):**

**1. Foco em Alcance via Compartilhamento e Retenção (Regra 1 - Atualizada v3.2):**
    * **Conceito:** Crescimento e descoberta vêm de **Compartilhamentos** e **Retenção**.
    * **Métricas Chave:** Dê **peso especial** à média de \`avgCompartilhamentos\`, \`avgSalvamentos\`, ao crescimento dessas métricas (\`historicalComparisons\`), aos \`top3Posts\`, aos \`durationStats\` (qual faixa de duração maximiza compartilhamentos/retenção), **e MUITO importante, aos \`detailedContentStats\`** (quais combinações de **Formato/Proposta/Contexto** geram mais compartilhamentos/salvamentos).
    * **Sua Ação:** Ao dar conselhos, **conecte explicitamente** a sugestão ao **potencial de aumentar compartilhamentos e/ou retenção (ou métricas correlatas como salvamentos)**. Use os dados (\`avgCompartilhamentos\`, \`durationStats\`, **\`detailedContentStats\`**) para embasar.
    * **Análise Correlacionada:** Verifique se as combinações Formato/Proposta/Contexto com mais compartilhamentos/salvamentos (\`detailedContentStats\`) também têm bom desempenho em \`durationStats\` ou aparecem nos \`top3Posts\`.
    * **Justificativa:** Justifique recomendações citando o dado relevante (Ex: "Sugiro focar em [Formato X / Proposta Y / Contexto Z], pois seus dados (\`detailedContentStats\`) mostram a maior média de compartilhamentos (${/* Exemplo */ formatStat(detailedContentStats?.find(s => s._id.format === 'Reel' && s._id.proposal === 'Dicas')?.avgCompartilhamentos)}) para essa combinação, o que é chave para o alcance (Regra 1).").

**2. Flexibilidade de Formato - Match Criador/Audiência (Regra 2 - Atualizada v3.2 com Formato Explícito):**
    * **Conceito:** **NÃO existe 'formato ideal' universal**. O sucesso depende da combinação do criador, conteúdo e *sua* audiência (refletida nos dados). **Os dados do usuário têm precedência.**
    * **Sua Ação:** Baseie recomendações de formato/conteúdo **PRIMARIAMENTE no desempenho relativo observado nos DADOS DO PRÓPRIO USUÁRIO**. Use o campo **\`format\` explícito** nos \`detailedContentStats\` para comparar diretamente o desempenho (compartilhamentos, salvamentos, curtidas) entre Reels, Fotos, Carrosséis, etc., *dentro da mesma Proposta/Contexto, quando possível*. Analise também \`overallStats\`, \`top3Posts\`, \`bottom3Posts\`, \`durationStats\`.
    * **Linguagem (OBRIGATÓRIO):** Use linguagem **condicional e de teste**:
        * *"Seus dados (\`detailedContentStats\`) indicam que [Formato A] sobre [Proposta B / Contexto C] teve [métrica positiva Z]. Considerando esse bom resultado *para você*, *pode ser interessante* explorar mais posts nessa linha."*
        * *"Notei que seus [Formato X], em média, geraram mais [compartilhamentos/salvamentos] do que [Formato Y] para [Proposta Z / Contexto W] (\`detailedContentStats\`). *Talvez valha a pena testar* mais [Formato X] nesse nicho, se você se sente confortável produzindo nele."*
        * *"O formato [Formato específico] teve um desempenho abaixo da média nos seus últimos posts com [Proposta/Contexto] (\`detailedContentStats\`). Antes de descartá-lo, vale analisar se foi o formato em si ou talvez a execução daquele post específico."*
    * **Balanceamento:** Se os dados (\`detailedContentStats\`) mostram que Carrosséis sobre "Dicas / Beleza" geram mais compartilhamentos *para ${userName}* que Reels sobre "Dicas / Beleza", recomende otimizar os Carrosséis nesse nicho *para ele*, aplicando a Regra 1, mesmo que Reels sejam popularmente vistos como mais "virais". **O dado do usuário MANDA.**

**3. Qualidade e Cadência Estratégica > Quantidade (Regra 3 - Sem Mudanças):**
    * **Conceito:** Qualidade > Quantidade. Frequência excessiva canibaliza alcance.
    * **Sua Ação (APENAS SE PERGUNTADO SOBRE FREQUÊNCIA/CADÊNCIA - keywords: ${NORMALIZED_BEST_TIME_KEYWORDS.join(', ')}):**
        * **Explique Princípios:** Qualidade > quantidade, risco de canibalização.
        * **Explique a ESTRATÉGIA de Monitoramento (Não Calcule!):** Diga: "Uma boa tática é olhar os *Insights* do post atual na plataforma. Veja o *alcance entre seguidores* nas primeiras 48-72h. Se ainda estiver crescendo bem, talvez espere mais. Se estabilizou/caiu muito, pode ser hora do próximo. Isso ajuda a não 'atropelar' um post."
        * **Restrição Fundamental:** **NÃO tente calcular ou prever o momento exato.** Apenas **explique a ESTRATÉGIA** para *ele mesmo* aplicar usando os Insights da plataforma.

---
**Tratamento de Follow-ups e Justificativas:**
* Se o usuário perguntar "por que?", "explica melhor?" (keywords: ${NORMALIZED_JUSTIFICATION_KEYWORDS.join(', ')}):
    1. Consulte 'Contexto Anterior'.
    2. Consulte 'Dados para Análise' abaixo (especialmente **\`detailedContentStats\`**). // <<< ATUALIZADO
    3. Consulte 'Princípios Chave (Regras 1, 2, 3)' acima.
    4. Responda **brevemente**, conectando a recomendação a um **dado específico** (\`overallStats\`, \`durationStats\`, **\`detailedContentStats\`**, descrição de post) ou a uma das **Regras Chave**. (Ex: "A sugestão veio da Regra 2 e dos \`detailedContentStats\`, que mostraram que o formato 'Reel' teve ${/* Exemplo */ formatStat(detailedContentStats?.find(s => s._id.format === 'Reel')?.avgCompartilhamentos)} compartilhamentos médios, superando 'Foto'.").

---
**Dados para Análise:**

1.  **Usuário:** ${userName}. Interesses: ${hobbiesList}.
2.  **Contexto Geral:**
    * Médias Gerais (\`overallStats\`): Curtidas: ${formatStat(overallStats?.avgCurtidas)}, Coment.: ${formatStat(overallStats?.avgComentarios)}, **COMPART.: ${formatStat(overallStats?.avgCompartilhamentos)}**, Salv.: ${formatStat(overallStats?.avgSalvamentos)}. (Base ${overallStats?.count ?? 'N/A'}).
    * Tendências vs 14d (\`historicalComparisons\`): Curtidas ${formatGrowth(historicalComparisons?.curtidasGrowth)}, Coment. ${formatGrowth(historicalComparisons?.comentariosGrowth)}, **COMP. ${formatGrowth(historicalComparisons?.compartilhamentosGrowth)}**, Salv. ${formatGrowth(historicalComparisons?.salvamentosGrowth)}.
    * Tendências vs 90d (\`longTermComparisons\`): Curtidas ${formatGrowth(longTermComparisons?.curtidasGrowth)}, **Comp. ${formatGrowth(longTermComparisons?.compartilhamentosGrowth)}**.
3.  **Desempenho por Duração Média (\`durationStats\`)**:
    * **Compartilhamentos Médios por Faixa:** ${formattedDurationStats}.  **(Use junto com formato explícito se disponível).**
4.  **<<< ATUALIZADO v3.2 >>> Desempenho Detalhado por Formato/Proposta/Contexto (\`detailedContentStats\`)**:
    * **Métricas Médias por Grupo:**
    * ${formattedDetailedContentStats} **<-- DADO CENTRAL! Use para comparar formatos, identificar melhores combinações e embasar Regras 1 e 2!** (Se N/A, mencione a falta).
5.  **Conteúdo Recente (Exemplo):** Um post sobre: "${destaqueDesc}...".
`;

    // Lógica para analisar descrições (se disponíveis) OU usar dados gerais (ATUALIZADA v3.2)
    if (canAnalyzeDescriptions) {
        instructions += `
6.  **Performance de Conteúdo Detalhada (Descrições):**
    * Posts com Melhor Desempenho (Top 3 Descrições): ${topPostsResult.formatted}
    * Posts com Pior Desempenho (Bottom 3 Descrições): ${bottomPostsResult.formatted}
    * **Sua Análise Principal:** Compare **temas, CTAs** das descrições 'Melhores' vs 'Piores'. **CRUZE** essas observações com os dados de **\`detailedContentStats\`** (qual Formato/Proposta/Contexto esses posts representam?). O que, no texto e nos números (especialmente **compartilhamentos/salvamentos** - Regra 1), parece fazer a diferença? Use o **Formato explícito** dos \`detailedContentStats\` para confirmar/refutar hipóteses sobre formato (Regra 2). Conecte com **Princípios Chave (Regras 1, 2, 3)**.

**Geração de Conselhos (Baseada na Análise CORRELACIONADA de Conteúdo, Dados Detalhados e Regras):**
7.  **Ação Focada:** Gere **1 ou 2 conselhos principais**, ACIONÁVEIS e ESPECÍFICOS. Aplique os **Princípios Chave (Regras 1, 2, 3)**.
    * **PRIORIDADE:** Baseie o(s) conselho(s) diretamente na sua **análise combinada** das descrições (item 6), dos dados numéricos (itens 2, 3, **4 - detailedContentStats**) e das Regras. Seja direto sobre o que replicar/evitar, especificando Formato/Proposta/Contexto quando relevante.
8.  **Justificativa Breve e Conectada (Regras 1, 2):** Forneça justificativa **curta (1 frase)** para cada conselho, conectando-o à sua análise (item 6), a um **dado específico** (ex: \`durationStats\`, **\`detailedContentStats\` mostrando desempenho superior de um formato específico**) e/ou a um **Princípio Chave** (Regra 1 ou 2).
`;
    } else {
        instructions += `
6.  **Performance de Conteúdo:** Descrições detalhadas indisponíveis. Sua análise se baseará nos números gerais, tendências, \`durationStats\` e **\`detailedContentStats\`**.

**Geração de Conselhos (Baseada em Dados Gerais, Detalhados e Regras):**
7.  **Ação Focada:** Gere **1 ou 2 conselhos principais**, ACIONÁVEIS e ESPECÍFICOS, baseando-se nos **dados gerais** (\`overallStats\`, tendências), **nos \`detailedContentStats\` (para comparar formatos e propostas/contextos)** e nos \`durationStats\`. Aplique os **Princípios Chave (Regras 1, 2, 3)**. Use os \`detailedContentStats\` para dar direcionamento de Formato/Proposta/Contexto. Se \`durationStats\` ou \`detailedContentStats\` faltarem, baseie-se no que estiver disponível, sendo mais cauteloso.
8.  **Justificativa Breve e Conectada (Regras 1, 2):** Forneça justificativa **curta (1 frase)** conectando o conselho a um **dado específico** (ex: 'Com base nos \`detailedContentStats\` (Regra 2), o formato X performou melhor para a Proposta Z.') e/ou a um **Princípio Chave** (Regra 1 ou 2).
`;
    }

    instructions += `
9.  **Personalização (Opcional e Sutil):** Se fizer sentido, conecte **rapidamente** um conselho aos interesses (${hobbiesList}). Não force.

**Formato Final da Resposta:**
10. Use linguagem natural, tom de conversa **${tone}**.
11. Formate conselhos como lista curta (numerada ou bullet points).
12. **Mantenha a resposta final CONCISA e focada nos conselhos principais.** Evite introduções/conclusões longas.
---
`; // <<< FIM DAS INSTRUÇÕES ATUALIZADAS v3.2 >>>
    return instructions;
}; // <<< FIM DA FUNÇÃO generateAIInstructions ATUALIZADA v3.2 >>>

// ====================================================
// Templates de Geração de Prompts (Continuação - Builders v3.2)
// ====================================================

/**
 * <<< ATUALIZADO v3.2 >>>
 * Constrói o prompt para resumo de métricas, usando instruções v3.2.
 */
const buildMetricsSummaryPrompt = (
    userName: string, enrichedReport: IEnrichedReport, tone: string, sentiment: string,
    history: string, // Histórico potencialmente sumarizado
    hobbies: string[]
): string => {
    // Desestrutura só o necessário para o highlight inicial
    const { overallStats, historicalComparisons } = enrichedReport;
    const basePrompt = `Opa ${userName}! Analisando seus números recentes... ${getRandomEmoji()}`;
    const shareStat = overallStats?.avgCompartilhamentos?.toFixed(1) ?? 'N/A';
    const shareGrowth = historicalComparisons?.compartilhamentosGrowth ?? 'N/A';
    const highlights = `Vi aqui que sua média de compartilhamentos tá em ${shareStat}, com ${shareGrowth === 'N/A' ? 'variação N/A' : `crescimento de ${shareGrowth}`} nos últimos 14d.`;
    const hobbyComment = getUserProfileSegment(hobbies);
    const sentimentComment = sentiment === "negative" ? "Notei um tom de preocupação..." : sentiment === "positive" ? "Que legal ver seu ânimo!..." : "";

    const contextHistory = history ? `\n\nContexto Anterior:\n${history}` : "";
    // Chama a versão v3.2 das instruções, que contém toda a lógica e dados atualizados
    const aiInstructions = generateAIInstructions(userName, enrichedReport, tone, hobbies);
    const reminder = "\n\n(IA: Lembre-se de aplicar os Princípios Chave v3.2, ser CONCISO/CONVERSACIONAL, dando 1-2 conselhos chave com justificativa breve baseada nos dados [incluindo Formato/Proposta/Contexto] e regras.)"; // Reminder v3.2

    return `${basePrompt} ${sentimentComment} ${hobbyComment}\n${highlights}\n\n${aiInstructions}${contextHistory}${reminder}`;
};


/**
 * <<< ATUALIZADO v3.2 >>>
 * Constrói o prompt para consultoria estratégica, usando instruções v3.2.
 */
const buildStrategicConsultantPrompt = (
    userName: string, enrichedReport: IEnrichedReport, tone: string, sentiment: string,
    history: string, // Histórico potencialmente sumarizado
    hobbies: string[]
): string => {
    const { contentDetails } = enrichedReport;
    const postDescription = contentDetails?.[0]?.description?.substring(0, 70) ?? "seu conteúdo recente";
    const basePrompt = `Beleza, ${userName}! Pensando aqui na sua estratégia com base nos dados recentes (tipo "${postDescription}..."). ${getRandomEmoji()}`;
    const hobbyComment = getUserProfileSegment(hobbies);
    const sentimentComment = sentiment === "negative" ? "Entendi a preocupação..." : sentiment === "positive" ? "Legal! Bom momento pra otimizar..." : "";

    const contextHistory = history ? `\n\nContexto Anterior:\n${history}` : "";
    // Chama a versão v3.2 das instruções
    const aiInstructions = generateAIInstructions(userName, enrichedReport, tone, hobbies);
    const reminder = "\n\n(IA: Lembre-se de focar em 1-2 direções estratégicas, aplicar os Princípios Chave v3.2 [incluindo Formato/Proposta/Contexto], ser CONVERSACIONAL e CONCISO.)"; // Reminder v3.2

    return `${basePrompt}\n${sentimentComment} ${hobbyComment}\n\n${aiInstructions}${contextHistory}${reminder}`;
};


/**
 * <<< ATUALIZADO v3.2 >>>
 * Constrói o prompt para ideias de conteúdo, usando Formato/Proposta/Contexto.
 */
const buildContentIdeasPrompt = (
    userName: string, enrichedReport: IEnrichedReport, incomingText: string,
    tone: string, sentiment: string, history: string,
    hobbies: string[]
): string => {
    const getValidDescriptions = (posts?: ISimplifiedContent[]): string[] => {
        if (!posts) return [];
        return posts.map(p => p.description)
            .filter((desc): desc is string => !!desc && !desc.startsWith('Descrição não encontrada') && !desc.startsWith('Erro ao buscar descrição'));
    };
    const topDescriptions = getValidDescriptions(enrichedReport.top3Posts);
    const bottomDescriptions = getValidDescriptions(enrichedReport.bottom3Posts);
    const canAnalyzeDescriptions = topDescriptions.length > 0 || bottomDescriptions.length > 0;
    const avgShares = enrichedReport.overallStats?.avgCompartilhamentos?.toFixed(1) ?? 'N/A';
    // <<< Usa o novo helper para os dados detalhados >>>
    const formattedDetailedContentStats = formatDetailedContentStatsForAI(enrichedReport.detailedContentStats);

    let prompt = `**Tarefa Principal:** Usuário (${userName}) pediu: "${incomingText}".\n\n`;
    prompt += `**Sua Missão:** Gere **exatamente 2 ideias** de posts criativas e **acionáveis** para ${userName}, com foco em potencial de **compartilhamento/retenção para alcance** (seguindo a **Regra 1**).\n`;

    prompt += `**Análise de Base:** Baseie suas ideias no que funcionou (ou não), especialmente o que parece ter gerado **mais compartilhamentos e engajamento** (Regra 1). Use os dados abaixo:\n`;
    if (canAnalyzeDescriptions) {
        if (topDescriptions.length > 0) prompt += `- Posts com Melhor Desempenho (Descrições): ${topDescriptions.map(d => `"${d.substring(0, 75)}..."`).join("; ")}.\n`;
        if (bottomDescriptions.length > 0) prompt += `- Posts com Pior Desempenho (Descrições): ${bottomDescriptions.map(d => `"${d.substring(0, 75)}..."`).join("; ")}.\n`;
    } else {
        prompt += `- Contexto: Sem descrições detalhadas. Baseie as ideias nos dados gerais, interesses e desempenho por Formato/Proposta/Contexto.\n`; // Atualizado
    }
    prompt += `- Média de Compartilhamentos Recentes: ${avgShares}\n`;
    // <<< Inclui os stats detalhados como base para ideias >>>
    prompt += `- Desempenho Detalhado (Formato/Proposta/Contexto):\n    * ${formattedDetailedContentStats}\n`;
    const durationInfo = formatDurationStatsForAI(enrichedReport.durationStats);
    if (durationInfo !== 'N/A') {
        prompt += `- Compartilhamentos por Duração: ${durationInfo}\n`;
    }

    prompt += `**Instruções Adicionais:**\n`;
    // <<< Instrução ATUALIZADA para sugerir formato >>>
    prompt += `- Para cada ideia, sugira um **Formato** (ex: Reel, Carrossel, Foto) e explique **o motivo em 1 frase curta**, conectando ao **potencial de engajamento/alcance/compartilhamento** (Regra 1), idealmente referenciando um dado (ex: bom desempenho de uma combinação Formato/Proposta/Contexto nos dados detalhados).\n`;
    prompt += `- Se possível, conecte uma ideia aos interesses: ${hobbies.join(', ') || 'Nenhum'}.\n`;
    prompt += `- Use um tom **${tone}**, mas **conversacional e direto**.\n`;
    prompt += `- **Formato da Resposta:** Sua resposta deve conter APENAS a lista numerada de ideias e suas justificativas curtas. Não inclua NENHUM outro texto.`;

    const contextHistory = history ? `\n\nContexto Anterior (para referência):\n${history}` : "";
    prompt += contextHistory;

    logger.debug(`[Prompt Build v3.2] Usando prompt refinado para 'content_ideas' com Formato/Proposta/Contexto.`); // Log v3.2
    return prompt;
};


/**
 * <<< ATUALIZADO v3.2 >>>
 * Constrói o prompt para respostas gerais, aplicando instruções v3.2.
 */
const buildGeneralResponsePrompt = (
    userName: string,
    enrichedReport: IEnrichedReport,
    incomingText: string,
    tone: string,
    sentiment: string,
    history: string, // Histórico potencialmente sumarizado
    hobbies: string[]
): string => {
    const { overallStats, historicalComparisons } = enrichedReport;
    const avgShares = overallStats?.avgCompartilhamentos?.toFixed(1) ?? "N/A";
    const sharesGrowthShort = historicalComparisons?.compartilhamentosGrowth ?? "N/A";
    const basePrompt = `Certo ${userName}, sobre sua pergunta "${incomingText}"... Olhando seus dados (média de ${avgShares} compartilhamentos, ${sharesGrowthShort === 'N/A' ? 'variação N/A' : `crescimento ${sharesGrowthShort}`} vs 14d), aqui vão alguns pontos: ${getRandomEmoji()}`;
    const hobbyComment = getUserProfileSegment(hobbies);

    const contextHistory = history ? `\n\nContexto Anterior:\n${history}` : "";
    // Chama a versão v3.2 das instruções
    const aiInstructions = generateAIInstructions(userName, enrichedReport, tone, hobbies);
    const reminder = "\n\n(IA: Lembre-se de responder diretamente à pergunta, aplicar os Princípios Chave v3.2 [incluindo Formato/Proposta/Contexto] de forma CONCISA e CONVERSACIONAL, incluindo 1-2 conselhos relevantes com justificativa breve.)"; // Reminder v3.2

    return `${basePrompt}\n${hobbyComment}\n\n${aiInstructions}${contextHistory}${reminder}`;
};

/**
 * Constrói o prompt específico para gerar um resumo estratégico semanal.
 * <<< NOTA v3.2: Esta função ainda opera sobre a estrutura AggregatedReport simples. >>>
 * <<< Para usar os dados detalhados (Formato/Proposta/Contexto) aqui, >>>
 * <<< seria necessário modificar como `generateStrategicWeeklySummary` é chamada >>>
 * <<< ou a estrutura `AggregatedReport` passada para ela. >>>
 */
function buildWeeklySummaryPrompt(
    userName: string,
    aggregatedReport: AggregatedReport // Recebe apenas AggregatedReport básico
): string {
    // ... (Lógica interna mantida, como na Parte 3 da sua versão original) ...
    const { overallStats, durationStats, top3, bottom3 } = aggregatedReport;
    const formatStat = (stat?: number) => stat?.toFixed(1) ?? 'N/A';
    const formattedDurationStats = formatDurationStatsForAI(durationStats);
    const formatSimplifiedPosts = (posts: IDailyMetric[], label: string): string => { /* ... */ return ""; };
    const topPostsSummary = formatSimplifiedPosts(top3, "Top 3 em Compartilhamentos");
    const bottomPostsSummary = formatSimplifiedPosts(bottom3, "Bottom 3 em Compartilhamentos");

    const instructions = `
---
**Instruções para IA (Resumo Semanal Estratégico - Consultor Parceiro v3.2):** // Log v3.2
// ... (Persona, Tom, Tarefa mantidos) ...
---
**Princípios Chave de Crescimento (Aplicar ao analisar os dados da semana):**
// ... (Regras 1, 2, 3 mantidas, mas cientes da limitação de dados detalhados aqui) ...
2.  **Flexibilidade de Formato (Regra 2):** O que os \`durationStats\` e \`top3\`/\`bottom3\` sugerem sobre formatos/durações que funcionaram *esta semana*? (Análise limitada sem dados detalhados de formato explícito).
---
**Dados Agregados da Última Semana para Análise (${userName}):**
// ... (Dados mostrados são apenas os de AggregatedReport: overall, duration, top/bottom) ...
* **Desempenho Detalhado por Formato/Proposta/Contexto:** (Indisponível neste resumo semanal específico)
---
Gere o resumo semanal estratégico diretamente em tom de conversa para ${userName}. Finalize motivando.
`;
    return instructions;
}


/**
 * <<< ATUALIZADO v3.2 >>>
 * Seleciona e constrói o prompt apropriado com base na intenção detectada.
 */
function selectAndBuildPrompt(
    intent: 'report' | 'metrics_summary' | 'content_ideas' | 'general',
    userName: string,
    enrichedReport: IEnrichedReport, // Contém detailedContentStats v3.2
    incomingText: string,
    tone: string,
    sentiment: "positive" | "negative" | "neutral",
    conversationHistory: string,
    hobbies: string[]
): string {
    logger.debug(`[Prompt Select v3.2] Intent: ${intent}, Sentiment: ${sentiment}, Tone: ${tone}`); // Log v3.2
    let promptFn: Function;
    const baseArgs = [userName, enrichedReport]; // enrichedReport contém os dados v3.2
    let specificArgs: any[] = [];

    // Switch case mantido, pois os builders agora chamam generateAIInstructions v3.2
    switch (intent) {
        case 'report':
            promptFn = buildStrategicConsultantPrompt;
            specificArgs = [tone, sentiment, conversationHistory, hobbies];
            break;
        case 'metrics_summary':
            promptFn = buildMetricsSummaryPrompt;
            specificArgs = [tone, sentiment, conversationHistory, hobbies];
            break;
        case 'content_ideas':
            promptFn = buildContentIdeasPrompt; // Builder v3.2
            specificArgs = [incomingText, tone, sentiment, conversationHistory, hobbies];
            break;
        case 'general':
        default:
            promptFn = buildGeneralResponsePrompt;
            specificArgs = [incomingText, tone, sentiment, conversationHistory, hobbies];
            break;
    }

    const allArgs = [...baseArgs, ...specificArgs];
    logger.debug(`[Prompt Select v3.2] Selecionado template estratégico: ${promptFn.name}`); // Log v3.2
    const prompt = promptFn(...allArgs);

    logger.debug(`[Prompt Build v3.2] Prompt construído (início): ${prompt.substring(0, 250)}...`); // Log v3.2
    logger.debug(`[Prompt Build v3.2] Tamanho total do prompt: ${prompt.length} chars.`); // Log v3.2

    return prompt;
}

// ====================================================
// Circuit Breaker e Retry para OpenAI (Mantidos)
// ====================================================
const openAICallWithRetry = async (prompt: string): Promise<string> => { /* ... (código mantido, temp fixa já estava ok) ... */ return "";};
const breakerOptions = { /* ... */ } as opossum.Options;
const openAIBreaker = new opossum(openAICallWithRetry, breakerOptions);
// Handlers de eventos do Opossum (mantidos)
// ...

// ====================================================
// Contador de Uso (Mantido)
// ====================================================
const incrementUsageCounter = async (userId: string): Promise<number | null> => { /* ... (código mantido) ... */ return null;};

// ====================================================
// Funções Helper para o Fluxo Principal (Mantidas, com logs atualizados v3.2)
// ====================================================
async function callAIWithResilience(prompt: string): Promise<string> { /* ... (lógica mantida, logs ok) ... */ return "";}
async function updateConversationContext(userId: string, incomingText: string, aiCoreResponse: string, dialogueState: IDialogueState): Promise<void> { /* ... (lógica mantida, logs ok) ... */ }
async function lookupUser(fromPhone: string): Promise<IUser> { /* ... (lógica mantida, logs ok) ... */ throw new UserNotFoundError(''); }
async function loadContext(userIdStr: string): Promise<{ dialogueState: IDialogueState, conversationHistory: string }> { /* ... (lógica mantida, logs ok) ... */ return { dialogueState: {}, conversationHistory: "" }; }
async function addGreetingAndGraph(baseResponse: string, userIdStr: string, greeting: string, dialogueState: IDialogueState): Promise<string> { /* ... (lógica mantida, logs ok) ... */ return "";}
async function handleSpecialCases( /*...*/ ): Promise<string | null> { /* ... (lógica mantida, logs ok) ... */ return null;}
function formatPostListWithLinks(posts: ISimplifiedContent[] | undefined, title: string): string { /* ... (lógica mantida, logs ok) ... */ return "";}

/**
 * <<< ATUALIZADO v3.2 >>>
 * Processa a requisição principal da IA após casos especiais serem descartados.
 */
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
    logger.debug(`[processMainAIRequest v3.2] Iniciando para User: ${userIdStr} com query: "${normalizedQuery}"`); // Log v3.2
    const dataPrepStartTime = Date.now();

    // 1. Buscar e Preparar Dados (v3.2 - fetchAndPrepareReportData já está atualizado)
    const { enrichedReport } = await fetchAndPrepareReportData({
        user: user,
        dailyMetricModel: DailyMetric as Model<IDailyMetric>,
        contentMetricModel: Metric as Model<IMetric>
    });
    logger.debug(`[processMainAIRequest v3.2] Preparação de dados v3.2 concluída (Tempo: ${Date.now() - dataPrepStartTime}ms)`); // Log v3.2

    // 2. Preparar Entradas para o Prompt (lógica mantida)
    let tone = user.profileTone || "amigável e analítico";
    const hobbies: string[] = (user.hobbies && Array.isArray(user.hobbies)) ? user.hobbies : [];
    tone = adjustTone(tone, conversationHistory);
    const sentiment = advancedAnalyzeSentiment(incomingText);
    logger.debug(`[processMainAIRequest v3.2] Dados pré-prompt: User=${userIdStr}, Sentiment=${sentiment}, Tone=${tone}`); // Log v3.2

    // 3. Determinação da Intenção (lógica mantida)
    const intentStartTime = Date.now();
    let intent: 'report' | 'metrics_summary' | 'content_ideas' | 'general';
    // ... (lógica de detecção de intenção mantida) ...
    logger.debug(`[processMainAIRequest v3.2] Intenção Final Detectada: ${intent} (Tempo: ${Date.now() - intentStartTime}ms)`); // Log v3.2

    // 4. Construção do Prompt Estratégico (v3.2 - selectAndBuildPrompt usa builders/instructions v3.2)
    const prompt = selectAndBuildPrompt(
        intent,
        user.name || "usuário",
        enrichedReport, // Contém os novos dados detalhados v3.2
        incomingText, tone, sentiment, conversationHistory, hobbies
    );

    // 5. Chamada à IA com Resiliência (lógica mantida)
    const aiCallStartTime = Date.now();
    const aiCoreResponse = await callAIWithResilience(prompt);
    logger.debug(`[processMainAIRequest v3.2] Chamada à IA concluída (Tempo: ${Date.now() - aiCallStartTime}ms)`); // Log v3.2
    logger.debug(`[processMainAIRequest v3.2] Resposta CORE da IA (v3.2) (início): ${aiCoreResponse.substring(0, 500)}...`); // Log v3.2
    const originalAICoreResponseForContext = aiCoreResponse;

    // 6. Pós-processamento: Adicionar lista de posts (lógica mantida)
    logger.debug(`[processMainAIRequest v3.2] Formatando lista de posts...`); // Log v3.2
    let postsInfo = "";
    if (intent !== 'content_ideas' && intent !== 'metrics_summary') {
        const topPostsFormatted = formatPostListWithLinks(enrichedReport.top3Posts, "📈 Posts que se destacaram:");
        const bottomPostsFormatted = formatPostListWithLinks(enrichedReport.bottom3Posts, "📉 Posts com menor desempenho:");
        if (topPostsFormatted || bottomPostsFormatted) {
            postsInfo = `\n\n---\n**Posts que usei como referência:**${topPostsFormatted}${topPostsFormatted && bottomPostsFormatted ? '\n' : ''}${bottomPostsFormatted}`;
            logger.debug(`[processMainAIRequest v3.2] Lista de posts de referência adicionada.`); // Log v3.2
        } else {
            logger.debug(`[processMainAIRequest v3.2] Nenhuma lista de posts adicionada.`); // Log v3.2
        }
    } else {
         logger.debug(`[processMainAIRequest v3.2] Lista de posts omitida para intent: ${intent}.`); // Log v3.2
    }
    let responseWithPosts = aiCoreResponse + postsInfo;

    // 7. Adicionar Saudação/Grafo (lógica mantida)
    const postProcessingStartTime = Date.now();
    const finalResponse = await addGreetingAndGraph(responseWithPosts, userIdStr, greeting, dialogueState);
    logger.debug(`[processMainAIRequest v3.2] Pós-processamento (Saudação/Grafo) concluído (Tempo: ${Date.now() - postProcessingStartTime}ms)`); // Log v3.2

    // 8. Atualizações Finais (Cache, Contexto, Usage) em Background (lógica mantida)
    logger.debug(`[processMainAIRequest v3.2] Finalizando: Cache, Contexto, Usage...`); // Log v3.2
    setInCache(cacheKey, finalResponse, REDIS_CACHE_TTL_SECONDS).catch(/*...*/);
    updateConversationContext(userIdStr, incomingText, originalAICoreResponseForContext, dialogueState).catch(/*...*/);
    incrementUsageCounter(userIdStr).catch(/*...*/);

    return finalResponse;
}

/**
 * Trata erros globais e formata mensagem amigável para o usuário. (Mantida)
 */
function handleError( /* ...args... */ ): string { /* ... (lógica mantida) ... */ return "";}


// ====================================================
// Função Exportada para Resumo Semanal (Mantida com Nota v3.2)
// ====================================================
/**
 * Gera um resumo estratégico semanal conciso.
 * <<< NOTA v3.2: Ainda opera sobre AggregatedReport simples e não usa formato explícito. >>>
 */
export async function generateStrategicWeeklySummary(
    userName: string,
    aggregatedReport: AggregatedReport
): Promise<string> {


// ====================================================
// Função Principal Exportada: getConsultantResponse (v3.2)
// ====================================================
/**
 * <<< ATUALIZADO v3.2 >>>
 * Processa a solicitação do usuário vinda do WhatsApp (ou outra interface).
 * Orquestra busca de usuário, contexto, cache, tratamento de casos especiais,
 * chamada da IA estratégica (v3.2 com Formato/Proposta/Contexto) e tratamento de erros.
 */
export async function getConsultantResponse(fromPhone: string, incomingText: string): Promise<string> {
    const startTime = Date.now();
    logger.info(`[getConsultantResponse v3.2] INÍCIO: Chamada de ${fromPhone}. Texto: "${incomingText.substring(0, 50)}..."`); // Log v3.2

    const normalizedQueryForCache = normalizeText(incomingText).trim().replace(/\s+/g, '_').substring(0, 100);
    const cacheKey = `response:${fromPhone}:${normalizedQueryForCache}`;

    let user: IUser | null = null;
    let userIdStr: string | 'N/A' = 'N/A';
    let dialogueState: IDialogueState = {};
    let conversationHistory: string = "";

    try {
        // 1. Verificar Cache (lógica mantida)
        const cachedResponse = await getFromCache(cacheKey);
        if (cachedResponse) { /* ... (retorno e logs mantidos) ... */ return cachedResponse; }
        logger.info(`[Cache v3.2] MISS para chave: ${cacheKey}`); // Log v3.2

        // 2. Buscar Usuário (lógica mantida)
        user = await lookupUser(fromPhone);
        userIdStr = user._id.toString();
        // 3. Carregar Contexto (lógica mantida)
        ({ dialogueState, conversationHistory } = await loadContext(userIdStr));
        // 4. Preparação Inicial (lógica mantida)
        const greeting = getRandomGreeting(user.name || 'usuário');
        const normalizedQuery = normalizeText(incomingText.trim());
        if (!normalizedQuery) { /* ... (retorno de mensagem vazia mantido) ... */ }

        // 5. Tratar Casos Especiais (lógica mantida)
        const specialCaseResponse = await handleSpecialCases( /*...*/ );
        if (specialCaseResponse !== null) {
            logger.info(`[Flow v3.2] Resposta de caso especial gerada para ${fromPhone}. Tempo total: ${Date.now() - startTime}ms`); // Log v3.2
            return specialCaseResponse;
         }

        // 6. Fluxo Principal da IA Estratégica (v3.2)
        logger.debug(`[getConsultantResponse v3.2] Iniciando fluxo principal da IA (processMainAIRequest v3.2).`); // Log v3.2
        const aiResponse = await processMainAIRequest( // Chama a versão v3.2
             user, incomingText, normalizedQuery, conversationHistory, dialogueState, greeting, userIdStr, cacheKey
        );

        // 7. Sucesso
        const totalDuration = Date.now() - startTime;
        logger.info(`[getConsultantResponse v3.2] FIM: Resposta principal (IA Estratégica v3.2) gerada para ${fromPhone}. Tamanho: ${aiResponse.length}. Tempo total: ${totalDuration}ms`); // Log v3.2
        return aiResponse;

    } catch (error: unknown) {
        // 8. Tratamento Global de Erros (lógica mantida)
        const errorResponse = handleError(error, fromPhone, userIdStr, startTime, user, dialogueState);
        const totalErrorDuration = Date.now() - startTime;
        logger.info(`[getConsultantResponse v3.2] ERRO: Finalizado com erro para ${fromPhone}. Tempo total: ${totalErrorDuration}ms`); // Log v3.2
        return errorResponse;
    }
}

// ====================================================
// FIM DO ARQUIVO v3.2
// ====================================================