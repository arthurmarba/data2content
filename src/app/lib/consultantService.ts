// @/app/lib/consultantService.ts - v3.10 REFATORADO (Plano Anti-Redundância + Clarificação Roteiro Contextual)

// --- Imports Essenciais e Módulos ---
import { Model, Types } from "mongoose"; // Ainda pode ser necessário para tipos ou passagem de modelos
import { subDays, format } from "date-fns"; // format/ptBR podem mover para promptService se só usados lá
import { ptBR } from 'date-fns/locale';
import opossum from "opossum";
import { logger } from '@/app/lib/logger';
import { createClient } from "redis";
// CORRIGIDO: Importa DetailedContentStat diretamente de reportHelpers
import { AggregatedReport, DetailedContentStat } from './reportHelpers';

// Importa os novos módulos de serviço
import * as intentService from './intentService'; // (Assumindo caminho relativo correto)
import { getRandomGreeting } from './intentService';
import * as dataService from './dataService'; // Assume v2.1 com msg clarificação atualizada
// Assume que promptService agora é a v3.0 com as atualizações anti-redundância
import * as promptService from './promptService';

// Importa tipos de erro
import {
    BaseError, UserNotFoundError, MetricsNotFoundError, AIError, CacheError, DatabaseError, ReportAggregationError, DetailedStatsError
} from "@/app/lib/errors";

// Importa modelos
import User, { IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";

// Importa tipos que podem ser necessários neste nível
// CORRIGIDO: Remove DetailedContentStat da importação de dataService
import { IEnrichedReport, ReferenceSearchResult } from './dataService';


// --- Constantes que PERMANECEM ---
const GREETING_RECENCY_THRESHOLD_MINUTES = 15;
const HISTORY_RAW_LINES_LIMIT = 10;

const REDIS_CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const REDIS_STATE_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;

// --- Lógica de Cache (Redis) ---
// (Sem alterações - Código Omitido para Brevidade)
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
let redisInitialized = false; let isConnecting = false;
redisClient.on('error', (err: Error) => { logger.error('[Redis] Erro:', err); redisInitialized = false; });
redisClient.on('connect', () => { logger.info('[Redis] Conectando...'); });
redisClient.on('ready', () => { logger.info('[Redis] Conectado.'); redisInitialized = true; isConnecting = false; });
redisClient.on('end', () => { logger.warn('[Redis] Conexão encerrada.'); redisInitialized = false; });
const initializeRedis = async (): Promise<void> => { if (!redisInitialized && !isConnecting) { isConnecting = true; logger.info('[Redis] Tentando conectar...'); try { await redisClient.connect(); } catch (err) { logger.error('[Redis] Falha inicial:', err); isConnecting = false; } } };
initializeRedis();
const ensureRedisConnection = async <T>( operation: () => Promise<T>, operationName: string, key?: string ): Promise<T> => { /* ... */ return {} as T; };
const getFromCache = async (key: string): Promise<string | null> => { /* ... */ return null; };
const setInCache = async (key: string, value: string, ttlSeconds: number): Promise<string | null> => { /* ... */ return null; };

// --- Lógica de Diálogo/Histórico (Redis) ---
// (Sem alterações - Código Omitido para Brevidade)
interface IDialogueState { lastInteraction?: number; lastGreetingSent?: number; }
const getDialogueState = async (userId: string): Promise<IDialogueState> => { /* ... */ return {}; };
const updateDialogueState = async (userId: string, newState: IDialogueState): Promise<string | null> => { /* ... */ return null; };
const getConversationHistory = async (userId: string): Promise<string> => { /* ... */ return ""; };
const updateConversationHistory = async (userId: string, newEntry: string): Promise<'OK'> => { /* ... */ return 'OK'; };

// --- Contador de Uso (Redis) ---
// (Sem alterações - Código Omitido para Brevidade)
const incrementUsageCounter = async (userId: string): Promise<number> => { /* ... */ return 0; };

// --- Sumarização de Histórico ---
// (Sem alterações - Código Omitido para Brevidade)
async function summarizeConversationHistory(historyText: string): Promise<string> { return historyText; }
function getPromptHistory(fullHistory: string): string { const lines = fullHistory.split('\n'); return lines.slice(-HISTORY_RAW_LINES_LIMIT).join('\n'); }

// --- Lógica de IA (Opossum, Retry) ---
// (Sem alterações - Código Omitido para Brevidade)
import { callOpenAIForQuestion } from "@/app/lib/aiService";
const openAICallWithRetry = async (prompt: string): Promise<string> => { /*...*/ return ""; };
const breakerOptions: opossum.Options = { /*...*/ };
const openAIBreaker = new opossum(openAICallWithRetry, breakerOptions);
async function callAIWithResilience(prompt: string): Promise<string> { /*...*/ return ""; };

// --- Funções Auxiliares de Orquestração ---
// (Sem alterações - Código Omitido para Brevidade)
async function loadContext(userIdStr: string): Promise<{ dialogueState: IDialogueState, conversationHistory: string }> { return { dialogueState: {}, conversationHistory: "" }; }
async function updateConversationContext(userId: string, incomingText: string, aiCoreResponse: string, dialogueState: IDialogueState): Promise<void> { /*...*/ }
const adjustTone = (tone: string): string => tone;
const persistDialogueGraph = async (): Promise<void> => { /*...*/ };
const getGraphSummary = async (): Promise<string> => "";
async function addGreetingAndGraph(baseResponse: string, userIdStr: string, greeting: string, dialogueState: IDialogueState): Promise<string> { return ""; }
interface IMetricMinimal { _id?: Types.ObjectId; description?: string; postLink?: string; }
function formatPostListWithLinks(posts: IMetricMinimal[] | undefined, title: string): string { return ""; }


// --- Lógica Principal de Processamento ---

/**
 * Orquestra a chamada aos serviços para obter a resposta da IA.
 * v3.10: Adicionada dica contextual na clarificação de roteiro pós-plano.
 */
async function processMainAIRequest(
    user: IUser,
    incomingText: string,
    normalizedQuery: string,
    conversationHistory: string, // <<< Passando o histórico completo aqui
    dialogueState: IDialogueState,
    greeting: string,
    userIdStr: string,
    cacheKey: string
): Promise<string> {
    const versionTag = "[processMainAIRequest v3.10]"; // <<< Versão atualizada
    logger.debug(`${versionTag} Orquestrando para ${userIdStr}. Intent via IntentService...`);

    // 1. Determinar Intenção
    const intentResult = await intentService.determineIntent(normalizedQuery, user, incomingText, dialogueState, greeting, userIdStr);
    if (intentResult.type === 'special_handled') {
        logger.info(`${versionTag} Resposta de caso especial recebida de IntentService.`);
        return intentResult.response;
    }
    const intent = intentResult.intent;
    logger.info(`${versionTag} Intenção principal determinada: ${intent}`);

    let tone = user.profileTone || "informal e prestativo";
    tone = adjustTone(tone); // Placeholder

    let prompt: string;
    let aiCoreResponse: string;
    let finalResponse: string;
    let originalAICoreResponseForContext: string;
    const promptHistory = getPromptHistory(conversationHistory); // Pega só as últimas linhas para o prompt

    // --- Fluxo para Geração de Roteiro ---
    if (intent === 'script_request') {
        logger.debug(`${versionTag} Iniciando fluxo de Geração de Roteiro...`);
        const referenceResult = await dataService.extractReferenceAndFindPost(incomingText, user._id);

        if (referenceResult.status === 'clarify' || referenceResult.status === 'error') {
            let finalMessage = referenceResult.message;
            const historyLines = conversationHistory.split('\n');
            let lastAiResponse = "";
            for(let i = historyLines.length - 1; i >= 0; i--) {
                const line = historyLines[i];
                if (line && line.startsWith('AI:')) { // Correção anterior mantida
                    lastAiResponse = line.substring(3).trim();
                    break;
                }
            }
            const planKeywords = ["plano de conteúdo", "foco em", "sugestão de formato", "ideia de conteúdo"];
            const recentPlanDetected = planKeywords.some(keyword => lastAiResponse.toLowerCase().includes(keyword.toLowerCase()));
            if (recentPlanDetected && referenceResult.status === 'clarify') {
                const hint = "Se você estiver se referindo a uma das ideias do plano que acabamos de ver, a opção 3 abaixo pode ser a melhor forma de me contar! 😉\n\n";
                finalMessage = hint + finalMessage;
                logger.info(`${versionTag} [ScriptRequest] Adicionando dica contextual à mensagem de clarificação.`);
            }
            logger.info(`${versionTag} [ScriptRequest] Status: ${referenceResult.status}. Mensagem final: ${finalMessage}`);
            updateDialogueState(userIdStr, { ...dialogueState, lastInteraction: Date.now() }).catch(e => logger.error('Falha ao salvar estado dialogo script', e));
            return finalMessage;
        }

        const { description: sourceDescription, proposal: sourceProposal, context: sourceContext } = referenceResult.post;
        logger.debug(`${versionTag} [ScriptRequest] Post fonte ${referenceResult.post._id}. Gerando prompt via PromptService v3.0...`);
        prompt = promptService.generateScriptInstructions(user.name || "usuário", sourceDescription, sourceProposal, sourceContext, promptHistory, tone, incomingText);
        aiCoreResponse = await callAIWithResilience(prompt);
        originalAICoreResponseForContext = aiCoreResponse;
        finalResponse = aiCoreResponse;
        logger.debug(`${versionTag} [ScriptRequest] Roteiro gerado pela IA.`);

    // --- Fluxo para Outras Intenções ---
    } else {
        logger.debug(`${versionTag} Iniciando fluxo padrão (não roteiro) para intent: ${intent}...`);
        const dataPrepStartTime = Date.now();
        const { enrichedReport } = await dataService.fetchAndPrepareReportData({ user, dailyMetricModel: DailyMetric, contentMetricModel: Metric });
        logger.debug(`${versionTag} Preparação de dados via DataService OK (${Date.now() - dataPrepStartTime}ms).`);

        if (intent === 'content_plan') {
            let commonCombinationDataForPlan: { proposal: string; context: string; stat: DetailedContentStat } | null = null;
            const reliableStats = (enrichedReport.detailedContentStats || []).filter(
                (stat): stat is DetailedContentStat => !!(stat && stat._id && stat.count >= 2)
            );

            if (reliableStats.length === 1) {
                const bestStat = reliableStats[0];
                // --- CORREÇÃO APLICADA (Uso de !) ---
                commonCombinationDataForPlan = {
                    proposal: bestStat!._id.proposal || 'N/A',
                    context: bestStat!._id.context || 'N/A',
                    stat: bestStat!
                 };
                // --- FIM DA CORREÇÃO ---
                logger.info(`${versionTag} [Content Plan Logic v3.0] Apenas uma comb. confiável. Acionando prompt AGRUPADO.`);

            } else if (reliableStats.length > 1) {
                const bestStat = reliableStats[0];
                 // --- CORREÇÃO APLICADA (Uso de !) ---
                const bestPCKey = `${bestStat!._id.proposal || 'N/A'}|${bestStat!._id.context || 'N/A'}`;
                // --- FIM DA CORREÇÃO ---
                const top3Keys = reliableStats.slice(0, 3).map(stat => `${stat._id.proposal || 'N/A'}|${stat._id.context || 'N/A'}`);
                const bestKeyCountInTop3 = top3Keys.filter(key => key === bestPCKey).length;
                if (bestKeyCountInTop3 >= 2) {
                     // --- CORREÇÃO APLICADA (Uso de !) ---
                    commonCombinationDataForPlan = {
                        proposal: bestStat!._id.proposal || 'N/A',
                        context: bestStat!._id.context || 'N/A',
                        stat: bestStat!
                    };
                     // --- FIM DA CORREÇÃO ---
                    logger.info(`${versionTag} [Content Plan Logic v3.0] Comb. P/C principal (${bestPCKey}) repetida no Top 3. Acionando prompt AGRUPADO.`);
                }
            }

            if (commonCombinationDataForPlan) {
                 prompt = promptService.generateGroupedContentPlanInstructions(user.name || "usuário", commonCombinationDataForPlan, enrichedReport, promptHistory, tone, incomingText);
                 logger.info(`${versionTag} [Content Plan Logic v3.0] Usando generateGroupedContentPlanInstructions.`);
            } else {
                 if (reliableStats.length === 0) { logger.warn(`${versionTag} [Content Plan Logic v3.0] Nenhum dado confiável. Usando prompt padrão.`); }
                 else { logger.info(`${versionTag} [Content Plan Logic v3.0] Dados variados ou sem dominância. Usando prompt PADRÃO.`); }
                 prompt = promptService.generateContentPlanInstructions(user.name || "usuário", enrichedReport, promptHistory, tone, incomingText);
                 logger.info(`${versionTag} [Content Plan Logic v3.0] Usando generateContentPlanInstructions.`);
            }
        } else if (intent === 'ranking_request') {
            prompt = promptService.generateRankingInstructions(user.name || "usuário", enrichedReport, promptHistory, tone, incomingText);
        } else {
            prompt = promptService.generateAIInstructions(user.name || "usuário", enrichedReport, promptHistory, tone);
            if (intent === 'report') { prompt += `\n\n# Mensagem Atual:\n${incomingText}\n\n# Sua Análise ESTRATÉGICA CONCISA e CLARA c/ Pergunta Final:`; }
            else if (intent === 'content_ideas') { prompt += `\n\n# Mensagem Atual:\n${incomingText}\n\n# Suas Ideias de Conteúdo CONCISAS e CLARAS c/ Pergunta Final:`; }
            else { prompt += `\n\n# Mensagem Atual:\n${incomingText}\n\n# Sua Resposta CONCISA e CLARA c/ Pergunta Final Estratégica:`; }
        }

        logger.info(`${versionTag} Chamando IA para intent ${intent}. Tamanho prompt: ${prompt.length}`);
        aiCoreResponse = await callAIWithResilience(prompt);
        originalAICoreResponseForContext = aiCoreResponse;
        logger.debug(`${versionTag} Resposta CORE IA padrão OK.`);

        let postsInfo = "";
        const intentsWithoutGeneralPosts = ['content_plan', 'ranking_request'];
        if (!intentsWithoutGeneralPosts.includes(intent)) {
            const topFormatted = formatPostListWithLinks(enrichedReport.top3Posts, "📈 Posts gerais que se destacaram:");
            const bottomFormatted = formatPostListWithLinks(enrichedReport.bottom3Posts, "📉 Posts gerais com menor desempenho:");
            if (topFormatted || bottomFormatted) { postsInfo = `\n\n---\n**Posts gerais referência:**${topFormatted}${topFormatted && bottomFormatted ? '\n' : ''}${bottomFormatted}`; }
        }

        const responseWithExtras = aiCoreResponse + postsInfo;
        finalResponse = await addGreetingAndGraph(responseWithExtras, userIdStr, greeting, dialogueState);
    }

    // --- Atualizações Assíncronas Comuns ---
    logger.debug(`${versionTag} Agendando updates async para user ${userIdStr} (Intent: ${intent})...`);
    Promise.allSettled([
        setInCache(cacheKey, finalResponse, REDIS_CACHE_TTL_SECONDS),
        updateConversationContext(userIdStr, incomingText, originalAICoreResponseForContext, dialogueState),
        incrementUsageCounter(userIdStr),
        persistDialogueGraph()
    ]).then(results => {
         results.forEach((result, i) => {
            if (result.status === 'rejected') {
                 const ops = ['cache', 'context', 'usage', 'graph'];
                 logger.warn(`${versionTag} [AsyncUpdate] Falha op ${i} (${ops[i]}) para user ${userIdStr}:`, result.reason);
             }
         });
     });

    return finalResponse;
}

// --- Tratamento Global de Erros ---
// (Sem alterações - Código Omitido para Brevidade)
function handleError(error: unknown, fromPhone: string, userId: string | 'N/A', startTime: number): string {
    const versionTag = "[handleError v3.10]";
    const duration = Date.now() - startTime;
    let userMessage = `Ops! Tive um probleminha aqui e não consegui processar sua solicitação (${error instanceof Error ? error.constructor.name : 'Unknown'}). 🤯 Poderia tentar novamente em um instante? Se o problema persistir, fale com o suporte.`;
    let errorType = "UnknownError";
    if (error instanceof BaseError) { errorType = error.constructor.name; /* ... */ }
    else if (error instanceof Error) { errorType = error.constructor.name; /* ... */ }
    else { errorType = 'UnknownNonError'; /* ... */ }
    logger.error(`${versionTag} Erro processando para ${userId} (${fromPhone.slice(0,-4)}****). Tipo: ${errorType}. Duração: ${duration}ms.`, error);
    return userMessage;
 }

// --- Função Principal Exportada ---
// (Sem alterações - Código Omitido para Brevidade)
export async function getConsultantResponse(fromPhone: string, incomingText: string): Promise<string> {
    const versionTag = "[getConsultantResponse v3.10]";
    const startTime = Date.now();
    logger.info(`${versionTag} INÍCIO: Chamada de ${fromPhone.slice(0, -4)}****. Msg: "${incomingText.substring(0, 50)}..."`);
    const normalizedQuery = intentService.normalizeText(incomingText.trim());
    const normalizedQueryForCache = normalizedQuery.replace(/\s+/g, '_').substring(0, 100);
    const cacheKey = `response:${fromPhone}:${normalizedQueryForCache}`;
    let user: IUser | null = null;
    let userIdStr: string | 'N/A' = 'N/A';
    let dialogueState: IDialogueState = {};
    try {
        const cachedResponse = await getFromCache(cacheKey);
        if (cachedResponse) { logger.info(`${versionTag} [Cache] HIT para ${cacheKey}. Tempo Total: ${Date.now() - startTime}ms`); return cachedResponse; }
        logger.debug(`${versionTag} [Cache] MISS para ${cacheKey}`);
        user = await dataService.lookupUser(fromPhone);
        userIdStr = user._id.toString();
        let fullConversationHistory: string;
        ({ dialogueState, conversationHistory: fullConversationHistory } = await loadContext(userIdStr));
        const greeting = getRandomGreeting(user.name || 'usuário');
        if (!normalizedQuery) { logger.warn(`${versionTag} Mensagem vazia ou inválida de ${fromPhone}.`); return `${greeting} Como posso ajudar? 😊`; }
        const aiResponse = await processMainAIRequest(user, incomingText, normalizedQuery, fullConversationHistory, dialogueState, greeting, userIdStr, cacheKey);
        const totalDuration = Date.now() - startTime;
        logger.info(`${versionTag} FIM OK. User: ${userIdStr}. Tam Resposta: ${aiResponse.length}. Tempo Total: ${totalDuration}ms`);
        return aiResponse;
    } catch (error: unknown) {
        const errorName = error instanceof Error ? error.constructor.name : "Unknown";
        const errorResponse = handleError(error, fromPhone, userIdStr, startTime);
        return errorResponse;
    }
}

// --- Funções Exportadas Adicionais ---
// (Sem alterações)
export async function generateStrategicWeeklySummary(userName: string, aggregatedReport: AggregatedReport): Promise<string> { /* ... */ return ""; } // Simplificado


// =========================================================================
// FIM: consultantService.ts (v3.10 - Clarificação Roteiro Contextualizada)
// =========================================================================