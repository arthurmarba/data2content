// @/app/lib/consultantService.ts - v3.10 COM LOGS DE DEPURAÇÃO ADICIONAIS

// --- Imports Essenciais e Módulos ---
import { Model, Types } from "mongoose";
import { subDays, format } from "date-fns";
import { ptBR } from 'date-fns/locale';
import opossum from "opossum";
import { logger } from '@/app/lib/logger';
import { createClient } from "redis";

// Importa os novos módulos de serviço
import * as intentService from './intentService';
import { getRandomGreeting } from './intentService';
import * as dataService from './dataService';
import * as promptService from './promptService';
import { callOpenAIForQuestion } from "@/app/lib/aiService"; // Import da IA

// Importa tipos de erro
import {
    BaseError, UserNotFoundError, MetricsNotFoundError, AIError, CacheError, DatabaseError, ReportAggregationError, DetailedStatsError
} from "@/app/lib/errors";

// Importa modelos
import User, { IUser } from "@/app/models/User";
import { DailyMetric, IDailyMetric } from "@/app/models/DailyMetric";
import Metric, { IMetric } from "@/app/models/Metric";

// Importa tipos dos outros serviços
import { IEnrichedReport, ReferenceSearchResult } from './dataService';
import { DetailedContentStat, AggregatedReport } from './reportHelpers';

// --- Constantes que PERMANECEM ---
const GREETING_RECENCY_THRESHOLD_MINUTES = 15;
const HISTORY_RAW_LINES_LIMIT = 10;

const REDIS_CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const REDIS_STATE_TTL_SECONDS = 60 * 60 * 24 * 30;
const REDIS_HISTORY_TTL_SECONDS = 60 * 60 * 24 * 30;

// --- Lógica de Cache (Redis) ---
// (Simplificado - Reutilize sua implementação real)
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
let redisInitialized = false; let isConnecting = false;
redisClient.on('error', (err: Error) => { logger.error('[Redis] Erro:', err); redisInitialized = false; });
redisClient.on('connect', () => { logger.info('[Redis] Conectando...'); });
redisClient.on('ready', () => { logger.info('[Redis] Conectado.'); redisInitialized = true; isConnecting = false; });
redisClient.on('end', () => { logger.warn('[Redis] Conexão encerrada.'); redisInitialized = false; });
const initializeRedis = async (): Promise<void> => { if (!redisInitialized && !isConnecting) { isConnecting = true; logger.info('[Redis] Tentando conectar...'); try { await redisClient.connect(); } catch (err) { logger.error('[Redis] Falha inicial:', err); isConnecting = false; } } };
initializeRedis();
const ensureRedisConnection = async <T>( operation: () => Promise<T>, operationName: string, key?: string ): Promise<T> => { /* ... */ return {} as T; };
const getFromCache = async (key: string): Promise<string | null> => { logger.debug(`[getFromCache] Buscando ${key}`); /* ... */ return null; };
const setInCache = async (key: string, value: string, ttlSeconds: number): Promise<string | null> => { logger.debug(`[setInCache] Salvando ${key}`); /* ... */ return null; };

// --- Lógica de Diálogo/Histórico (Redis) ---
// (Simplificado - Reutilize sua implementação real)
interface IDialogueState {
    lastInteraction?: number;
    lastGreetingSent?: number;
}
const getDialogueState = async (userId: string): Promise<IDialogueState> => { logger.debug(`[getDialogueState] Buscando estado para ${userId}`); /* ... */ return { /* lastInteraction: Date.now() - 20*60*1000, lastGreetingSent: Date.now() - 20*60*1000 */ }; };
const updateDialogueState = async (userId: string, newState: IDialogueState): Promise<string | null> => { logger.info(`[updateDialogueState] Atualizando para user ${userId}`, newState); /* ... */ return 'OK'; };
const getConversationHistory = async (userId: string): Promise<string> => { logger.debug(`[getConversationHistory] Buscando histórico para ${userId}`); /* ... */ return "User: Olá\nAI: Oi! Como posso ajudar?"; };
const updateConversationContext = async (userId: string, incomingText: string, aiCoreResponse: string, dialogueState: IDialogueState): Promise<void> => { logger.info(`[updateConversationContext] Atualizando histórico para ${userId}`);/*...*/ }
const incrementUsageCounter = async (userId: string): Promise<number> => { logger.debug(`[incrementUsageCounter] Incrementando para ${userId}`); /* ... */ return 1; };


// --- Sumarização de Histórico ---
async function summarizeConversationHistory(historyText: string): Promise<string> { return historyText; }
function getPromptHistory(fullHistory: string): string {
     const lines = fullHistory.split('\n');
     const historyForPrompt = lines.slice(-HISTORY_RAW_LINES_LIMIT).join('\n');
     // logger.debug(`[getPromptHistory] Histórico para prompt:\n${historyForPrompt}`); // Descomente se precisar ver o histórico exato do prompt
     return historyForPrompt;
}


// =========================================================================
// Lógica de IA (Opossum, Retry) - RECONSTRUÍDA
// =========================================================================
const openAICallAction = async (prompt: string): Promise<string> => {
    logger.debug("[openAICallAction] Executando callOpenAIForQuestion...");
    const result = await callOpenAIForQuestion(prompt);
    return result;
};

const breakerOptions: opossum.Options = {
    timeout: 60000,
    errorThresholdPercentage: 50,
    resetTimeout: 30000
};

const openAIBreaker = new opossum(openAICallAction, breakerOptions);

openAIBreaker.on('open', () => logger.warn(`[Opossum] Circuito ABERTO para AI Service.`));
openAIBreaker.on('close', () => logger.info(`[Opossum] Circuito FECHADO para AI Service.`));
openAIBreaker.on('halfOpen', () => logger.info(`[Opossum] Circuito MEIO-ABERTO para AI Service.`));
openAIBreaker.on('success', (result) => logger.debug(`[Opossum] Chamada AI Service SUCCESS.`));
openAIBreaker.on('failure', (error) => logger.warn(`[Opossum] Chamada AI Service FAILURE. Erro: ${error?.constructor?.name || typeof error} - ${error instanceof Error ? error.message : String(error)}`));


async function callAIWithResilience(prompt: string): Promise<string> {
    const fnTag = "[callAIWithResilience]";
    logger.debug(`${fnTag} Tentando executar via Opossum...`);
    try {
        const result = await openAIBreaker.fire(prompt);
        // <<< LOG ADICIONADO PARA VER O RESULTADO DIRETO DO OPOSSUM >>>
        logger.debug(`${fnTag} Opossum retornou resultado bruto (Tipo: ${typeof result}): "${String(result).substring(0,100)}..."`);

        if (typeof result === 'string' && result.trim() !== '') {
             logger.debug(`${fnTag} Opossum executou com SUCESSO e resultado é NÃO VAZIO.`);
            return result;
        } else {
             logger.error(`${fnTag} Opossum retornou SUCESSO mas resultado é INESPERADO ou VAZIO. Tipo: ${typeof result}`, { result });
             throw new AIError("Resultado inesperado ou vazio recebido da camada de resiliência da IA.", undefined);
        }
    } catch (error: unknown) {
        logger.warn(`${fnTag} Falha ao executar via Opossum. Processando erro...`);
        if (error instanceof AIError) {
            logger.warn(`${fnTag} Erro AIError capturado (propagado): ${error.message}`);
            throw error;
        }
        if (error instanceof Error && error.name === 'BreakerOpenError') {
            logger.error(`${fnTag} Circuito da IA está aberto. Nova chamada rejeitada.`);
            throw new AIError("Serviço da IA temporariamente indisponível (Circuito Aberto). Tente novamente mais tarde.", error);
        }
        let errorMessage = "Erro desconhecido na camada de resiliência da IA.";
        let originalError: Error | undefined;
        if (error instanceof Error) {
            originalError = error;
            errorMessage = `Falha na camada de resiliência da IA: ${error.message}`;
            logger.error(`${fnTag} Erro capturado:`, { name: error.name, message: error.message });
        } else {
            errorMessage = `Falha inesperada (não-Error) na camada de resiliência da IA: ${String(error)}`;
            logger.error(`${fnTag} Falha inesperada (não-Error) capturada:`, { error });
            originalError = undefined;
        }
        throw new AIError(errorMessage, originalError);
    }
}
// =======================================================================
// FIM: Lógica de IA (Opossum, Retry) - RECONSTRUÍDA
// =======================================================================


// --- Funções Auxiliares de Orquestração ---
async function loadContext(userIdStr: string): Promise<{ dialogueState: IDialogueState, conversationHistory: string }> {
    logger.debug(`[loadContext] Carregando contexto para ${userIdStr}`);
    const [dialogueState, conversationHistory] = await Promise.all([
         getDialogueState(userIdStr),
         getConversationHistory(userIdStr)
     ]);
    // A sumarização foi movida para getPromptHistory, aqui usamos o histórico completo
    logger.debug(`[Context Load] Carregado ${userIdStr}. Tamanho Histórico: ${conversationHistory.length}`);
    return { dialogueState, conversationHistory };
}
// updateConversationContext (placeholder mantido)
const adjustTone = (tone: string): string => tone; // Placeholder
const persistDialogueGraph = async (): Promise<void> => { logger.debug("[persistDialogueGraph] Placeholder chamado."); /*...*/ }; // Placeholder
const getGraphSummary = async (): Promise<string> => { logger.debug("[getGraphSummary] Placeholder chamado."); return ""; }; // Placeholder

/**
 * Adiciona saudação e resumo do grafo (se aplicável) à resposta base.
 * Atualiza o estado do diálogo se uma saudação for enviada.
 */
async function addGreetingAndGraph(
    baseResponse: string,
    userIdStr: string,
    greeting: string,
    dialogueState: IDialogueState
): Promise<string> {
    // <<< LOG ADICIONADO >>>
    logger.debug(`[addGreetingAndGraph] Recebeu baseResponse: "${baseResponse?.substring(0, 100)}..." (Tamanho: ${baseResponse?.length ?? 0})`);

    const fnTag = "[addGreetingAndGraph]";
    let finalResponse = baseResponse; // Inicia com a resposta base
    let needsGreeting = false;
    const now = Date.now();

    if (greeting) {
        const lastGreetingTime = dialogueState.lastGreetingSent;
        if (!lastGreetingTime || (now - lastGreetingTime > GREETING_RECENCY_THRESHOLD_MINUTES * 60 * 1000)) {
            needsGreeting = true;
        }
    }

    if (needsGreeting) {
        logger.debug(`${fnTag} Adicionando saudação para user ${userIdStr}`);
        finalResponse = `${greeting}\n\n${baseResponse}`; // Prepend greeting
        const newState: IDialogueState = { ...dialogueState, lastGreetingSent: now };
        updateDialogueState(userIdStr, newState) // Atualiza async
            .catch(err => logger.error(`${fnTag} Falha ao atualizar estado do diálogo (saudação) para ${userIdStr}:`, err));
    } else {
        logger.debug(`${fnTag} Saudação não necessária ou não fornecida para user ${userIdStr}`);
    }

    // TODO: Implementar lógica do grafo
    // const graphSummary = await getGraphSummary();
    // if (graphSummary) { finalResponse = `${graphSummary}\n\n${finalResponse}`; }

    // <<< LOG ADICIONADO >>>
    logger.debug(`[addGreetingAndGraph] Retornando finalResponse: "${finalResponse?.substring(0, 100)}..." (Tamanho: ${finalResponse?.length ?? 0})`);
    return finalResponse;
}

interface IMetricMinimal { _id?: Types.ObjectId; description?: string; postLink?: string; }
function formatPostListWithLinks(posts: IMetricMinimal[] | undefined, title: string): string {
     if (!posts || posts.length === 0) return "";
     let formatted = `\n${title}\n`;
     posts.forEach(post => {
         formatted += `- ${post.description?.substring(0, 50) || 'Post sem descrição'}... ${post.postLink ? `([ver](${post.postLink}))` : ''}\n`;
     });
     return formatted;
 }


// --- Lógica Principal de Processamento ---
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
    const versionTag = "[processMainAIRequest v3.10]";
    logger.debug(`${versionTag} Orquestrando para ${userIdStr}. Intent via IntentService...`);

    const intentResult = await intentService.determineIntent(normalizedQuery, user, incomingText, dialogueState, greeting, userIdStr);
    if (intentResult.type === 'special_handled') {
        logger.info(`${versionTag} Resposta de caso especial recebida de IntentService.`);
        updateDialogueState(userIdStr, { ...dialogueState, lastInteraction: Date.now() }).catch(e => logger.error('Falha ao salvar estado dialogo (caso especial)', e));
        return intentResult.response;
    }
    const intent = intentResult.intent;
    logger.info(`${versionTag} Intenção principal determinada: ${intent}`);

    let tone = user.profileTone || "informal e prestativo";
    tone = adjustTone(tone);

    let prompt: string;
    let aiCoreResponse: string;
    let finalResponse: string;
    let originalAICoreResponseForContext: string;
    const promptHistory = getPromptHistory(conversationHistory);
    const currentInteractionTime = Date.now();

    // Atualiza estado da interação (async)
    const interactionStateUpdate: IDialogueState = { ...dialogueState, lastInteraction: currentInteractionTime };
    updateDialogueState(userIdStr, interactionStateUpdate)
        .catch(e => logger.error(`${versionTag} Falha ao salvar estado dialogo (interação inicial) para ${userIdStr}`, e));


    // --- Fluxo para Geração de Roteiro ---
    if (intent === 'script_request') {
        logger.debug(`${versionTag} Iniciando fluxo de Geração de Roteiro...`);
        const referenceResult = await dataService.extractReferenceAndFindPost(incomingText, user._id);

        if (referenceResult.status === 'clarify' || referenceResult.status === 'error') {
            let finalMessage = referenceResult.message;
            const historyLines = conversationHistory.split('\n');
            let lastAiResponse = "";
            for(let i = historyLines.length - 1; i >= 0; i--) {
                const currentLine = historyLines[i];
                if (currentLine && currentLine.startsWith('AI:')) {
                    lastAiResponse = currentLine.substring(3).trim();
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
            return finalMessage;
        }

        const { description: sourceDescription, proposal: sourceProposal, context: sourceContext } = referenceResult.post;
        logger.debug(`${versionTag} [ScriptRequest] Post fonte ${referenceResult.post._id}. Gerando prompt via PromptService v3.0...`);
        prompt = promptService.generateScriptInstructions(user.name || "usuário", sourceDescription, sourceProposal, sourceContext, promptHistory, tone, incomingText);

        logger.info(`${versionTag} [ScriptRequest] Chamando IA via camada de resiliência...`);
        aiCoreResponse = await callAIWithResilience(prompt);
        // <<< LOG ADICIONADO >>>
        logger.debug(`[processMainAIRequest] Valor de aiCoreResponse recebido (ScriptRequest): "${aiCoreResponse?.substring(0,100)}..." (Tamanho: ${aiCoreResponse?.length ?? 0})`);
        originalAICoreResponseForContext = aiCoreResponse;
        finalResponse = aiCoreResponse; // Script não passa por addGreetingAndGraph aqui
        logger.debug(`${versionTag} [ScriptRequest] Roteiro gerado pela IA OK (via resiliência).`);

    // --- Fluxo para Outras Intenções ---
    } else {
        logger.debug(`${versionTag} Iniciando fluxo padrão (não roteiro) para intent: ${intent}...`);
        const dataPrepStartTime = Date.now();
        const { enrichedReport } = await dataService.fetchAndPrepareReportData({ user, dailyMetricModel: DailyMetric, contentMetricModel: Metric });
        logger.debug(`${versionTag} Preparação de dados via DataService OK (${Date.now() - dataPrepStartTime}ms).`);

        if (intent === 'content_plan') {
            let commonCombinationDataForPlan: { proposal: string; context: string; stat: DetailedContentStat } | null = null;
            const reliableStats = (enrichedReport.detailedContentStats || []).filter((stat): stat is DetailedContentStat => !!(stat && stat._id && stat.count >= 2));
            if (reliableStats.length === 1) {
                const bestStat = reliableStats[0]!;
                commonCombinationDataForPlan = { proposal: bestStat._id.proposal || 'N/A', context: bestStat._id.context || 'N/A', stat: bestStat };
                logger.info(`${versionTag} [Content Plan Logic v3.0] Apenas uma comb. confiável. Acionando prompt AGRUPADO.`);
            } else if (reliableStats.length > 1) {
                const bestStat = reliableStats[0]!;
                const bestPCKey = `${bestStat._id.proposal || 'N/A'}|${bestStat._id.context || 'N/A'}`;
                const top3Keys = reliableStats.slice(0, 3).map(stat => `${stat._id.proposal || 'N/A'}|${stat._id.context || 'N/A'}`);
                const bestKeyCountInTop3 = top3Keys.filter(key => key === bestPCKey).length;
                if (bestKeyCountInTop3 >= 2) {
                    commonCombinationDataForPlan = { proposal: bestStat._id.proposal || 'N/A', context: bestStat._id.context || 'N/A', stat: bestStat };
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

        logger.info(`${versionTag} Chamando IA para intent ${intent} via camada de resiliência. Tamanho prompt: ${prompt.length}`);
        aiCoreResponse = await callAIWithResilience(prompt);
        // <<< LOG ADICIONADO >>>
        logger.debug(`[processMainAIRequest] Valor de aiCoreResponse recebido (Other Intents): "${aiCoreResponse?.substring(0,100)}..." (Tamanho: ${aiCoreResponse?.length ?? 0})`);
        originalAICoreResponseForContext = aiCoreResponse;
        logger.debug(`${versionTag} Resposta CORE IA padrão OK (via resiliência).`);

        let postsInfo = "";
        const intentsWithoutGeneralPosts = ['content_plan', 'ranking_request'];
        if (!intentsWithoutGeneralPosts.includes(intent)) {
            const topFormatted = formatPostListWithLinks(enrichedReport.top3Posts, "📈 Posts gerais que se destacaram:");
            const bottomFormatted = formatPostListWithLinks(enrichedReport.bottom3Posts, "📉 Posts gerais com menor desempenho:");
            if (topFormatted || bottomFormatted) { postsInfo = `\n\n---\n**Posts gerais referência:**${topFormatted}${topFormatted && bottomFormatted ? '\n' : ''}${bottomFormatted}`; }
        }
        const responseWithExtras = aiCoreResponse + postsInfo;
        // <<< LOG ADICIONADO >>>
        logger.debug(`[processMainAIRequest] Valor de responseWithExtras antes de addGreeting: "${responseWithExtras?.substring(0,100)}..."`);

        // Passa o estado da interação atualizado, não o original `dialogueState`
        finalResponse = await addGreetingAndGraph(responseWithExtras, userIdStr, greeting, interactionStateUpdate);
        // <<< LOG ADICIONADO >>>
        logger.debug(`[processMainAIRequest] Valor de finalResponse após addGreeting: "${finalResponse?.substring(0,100)}..." (Tamanho: ${finalResponse?.length ?? 0})`);
    }

    // --- Atualizações Assíncronas Comuns ---
    logger.debug(`${versionTag} Agendando updates async para user ${userIdStr} (Intent: ${intent})...`);
    Promise.allSettled([
        setInCache(cacheKey, finalResponse, REDIS_CACHE_TTL_SECONDS),
        // Usa a resposta ORIGINAL da IA para o contexto do histórico
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
function handleError(error: unknown, fromPhone: string, userId: string | 'N/A', startTime: number): string {
    const versionTag = "[handleError v3.10]";
    const duration = Date.now() - startTime;
    let userMessage = `Ops! Tive um probleminha aqui e não consegui processar sua solicitação (${error instanceof Error ? error.constructor.name : 'Unknown'}). 🤯 Poderia tentar novamente em um instante? Se o problema persistir, fale com o suporte.`;
    let errorType = "UnknownError";
    let logPayload: any = { error };

    if (error instanceof AIError) {
         errorType = 'AIError';
         logPayload = { message: error.message, name: error.name, stack: error.stack };
    }
    else if (error instanceof BaseError) {
        errorType = error.constructor.name;
        logPayload = { message: error.message, name: error.name, stack: error.stack };
    }
    else if (error instanceof Error) {
        errorType = error.constructor.name;
        logPayload = { message: error.message, name: error.name, stack: error.stack };
    }
    else {
        errorType = 'UnknownNonError';
        logPayload = { error };
    }
    logger.error( `${versionTag} Erro processando para ${userId} (${fromPhone.slice(0,-4)}****). Tipo: ${errorType}. Duração: ${duration}ms.`, logPayload );
    return userMessage;
}

// --- Função Principal Exportada ---
export async function getConsultantResponse(fromPhone: string, incomingText: string): Promise<string> {
    const versionTag = "[getConsultantResponse v3.10]";
    const startTime = Date.now();
    logger.info(`${versionTag} INÍCIO: Chamada de ${fromPhone.slice(0, -4)}****. Msg: "${incomingText.substring(0, 50)}..."`);

    // --- Nível de Log (Ajuste conforme necessário: 'debug', 'info', 'warn', 'error') ---
    // Exemplo: Mudar para debug para ver todos os logs que adicionamos
    // logger.level = 'debug';
    // ----------------------------------------------------------------------------------

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

        const userNameForGreeting = user.name || 'usuário';
        const greeting = getRandomGreeting(userNameForGreeting);

        if (!normalizedQuery) { logger.warn(`${versionTag} Mensagem vazia ou inválida de ${fromPhone}.`); return `${greeting} Como posso ajudar? 😊`; }

        const aiResponse = await processMainAIRequest(
            user, incomingText, normalizedQuery, fullConversationHistory, dialogueState,
            greeting, userIdStr, cacheKey
        );

        const totalDuration = Date.now() - startTime;
        logger.info(`${versionTag} FIM OK. User: ${userIdStr}. Tam Resposta: ${aiResponse.length}. Tempo Total: ${totalDuration}ms`);
        return aiResponse;

    } catch (error: unknown) {
        const errorResponse = handleError(error, fromPhone, userIdStr, startTime);
        return errorResponse;
    } finally {
         // Exemplo: Resetar nível de log se foi alterado temporariamente
         // logger.level = process.env.LOG_LEVEL || 'info';
    }
}

// --- Funções Exportadas Adicionais ---
export async function generateStrategicWeeklySummary(userName: string, aggregatedReport: AggregatedReport): Promise<string> {
    const fnTag = "[generateStrategicWeeklySummary]";
    logger.warn(`${fnTag} Função não totalmente implementada.`);
    const prompt = `Gere um resumo estratégico semanal curto e direto (2-3 pontos principais) para ${userName} baseado nestes dados agregados de desempenho: ${JSON.stringify(aggregatedReport.overallStats)}. Foque nos maiores Ganhos ou Perdas.`;
    try {
        return await callAIWithResilience(prompt);
    } catch(error) {
        logger.error(`${fnTag} Falha para ${userName}`, error);
        if (error instanceof AIError) return "Desculpe, não consegui falar com a IA para gerar o resumo semanal agora.";
        return "Desculpe, ocorreu um erro inesperado ao gerar o resumo semanal.";
    }
}


// =========================================================================
// FIM: consultantService.ts (v3.10 - Com Logs de Depuração)
// =========================================================================