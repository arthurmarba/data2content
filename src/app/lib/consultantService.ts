/**
 * @fileoverview Serviço principal para obter respostas do consultor Tuca.
 * Otimizado para:
 * - Respostas diretas para interações simples.
 * - Contexto leve para IA em perguntas sociais/meta.
 * - Mensagem de "processando" condicional e variada para queries complexas.
 * @version 4.6.1 (Corrige tipo de dialogueState para IDialogueState)
 */

import { logger } from '@/app/lib/logger';
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from './intentService';
import { askLLMWithEnrichedContext } from './aiOrchestrator';
// ATUALIZADO: Importa IDialogueState de stateService
import * as stateService from '@/app/lib/stateService';
import * as dataService from './dataService';
import { UserNotFoundError } from '@/app/lib/errors';
import { IUser } from '@/app/models/User';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { functionExecutors } from '@/app/lib/aiFunctions';

// Configurações para mensagem de processamento
const PROCESSING_MESSAGE_DELAY_MS = 1800;
const pickRandom = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error('pickRandom: array vazio');
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error('pickRandom: item indefinido'); // Defesa extra
  return item;
};
const GET_PROCESSING_MESSAGES_POOL = (userName: string): string[] => [
    `Ok, ${userName}! Recebi seu pedido. 👍 Estou verificando e já te respondo...`,
    `Entendido, ${userName}! Um momento enquanto preparo sua resposta... ⏳`,
    `Certo, ${userName}! Consultando o Tuca para você... 🧠`,
    `Aguarde um instante, ${userName}, estou processando sua solicitação...`,
    `Só um pouquinho, ${userName}, já estou vendo isso para você!`,
];

// Configurações existentes
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10;

interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    // ***** CORREÇÃO APLICADA AQUI *****
    dialogueState?: stateService.IDialogueState; // Usa o tipo IDialogueState exportado
    // ***********************************
    // determinedIntent?: DeterminedIntent; // Opcional, se o orchestrator precisar
}

export async function getConsultantResponse(
    fromPhone: string,
    incoming: string
): Promise<string> {
    const TAG = '[consultantService 4.6.1]'; // ATUALIZADO: Versão
    const start = Date.now();
    const rawText = incoming;
    logger.info(`${TAG} ⇢ ${fromPhone.slice(-4)}… «${rawText.slice(0, 40)}»`);

    const norm = normalizeText(rawText.trim());
    if (!norm) {
        logger.warn(`${TAG} Mensagem normalizada vazia.`);
        return `${getRandomGreeting('')} Pode repetir, por favor? Não entendi bem.`;
    }

    let user: IUser;
    let uid: string;
    let userName: string;
    let greeting: string;

    try {
        user = await dataService.lookupUser(fromPhone);
        logger.debug(`${TAG} Usuário ${user._id} carregado.`);
        uid = user._id.toString();
        userName = user.name || 'criador';
        greeting = getRandomGreeting(userName);
    } catch (e) {
        logger.error(`${TAG} Erro em lookupUser:`, e);
        if (e instanceof UserNotFoundError) {
            return 'Olá! Parece que é nosso primeiro contato por aqui. Para começar, preciso fazer seu cadastro rápido. Pode me confirmar seu nome completo, por favor?';
        }
        return 'Tive um problema ao buscar seus dados. Poderia tentar novamente em alguns instantes? Se persistir, fale com o suporte. 🙏';
    }

    const cacheKey = `resp:${fromPhone}:${norm.slice(0, 100)}`;
    try {
        const cached = await stateService.getFromCache(cacheKey);
        if (cached) { logger.info(`${TAG} (cache hit) ${Date.now() - start} ms`); return cached; }
        logger.info(`${TAG} (cache miss)`);
    } catch (cacheError) { logger.error(`${TAG} Erro ao buscar do cache Redis:`, cacheError); }

    let dialogueState: stateService.IDialogueState = {}; // Usa IDialogueState
    try {
        dialogueState = await stateService.getDialogueState(uid);
        logger.debug(`${TAG} Estado carregado: ${JSON.stringify(dialogueState)}`);
    } catch (stateError) { logger.error(`${TAG} Erro ao buscar estado do Redis:`, stateError); }

    let intentResult: IntentResult;
    let determinedIntent: DeterminedIntent | null = null;
    let responseTextForSpecialHandled: string | null = null;
    let pendingActionContextFromIntent: any = null;

    try {
        intentResult = await determineIntent(norm, user, rawText, dialogueState, greeting, uid);
        if (intentResult.type === 'special_handled') {
            logger.info(`${TAG} Intenção tratada como caso especial pela intentService.`);
            responseTextForSpecialHandled = intentResult.response;
        } else { // type === 'intent_determined'
            determinedIntent = intentResult.intent;
            if (intentResult.intent === 'user_confirms_pending_action' || intentResult.intent === 'user_denies_pending_action') {
                pendingActionContextFromIntent = intentResult.pendingActionContext;
            }
            logger.info(`${TAG} Intenção determinada: ${determinedIntent}`);
        }
    } catch (intentError) {
        logger.error(`${TAG} Erro ao determinar intenção:`, intentError);
        determinedIntent = 'general';
    }

    if (responseTextForSpecialHandled) {
        // Salvar histórico e estado para special_handled
        const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: rawText };
        const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: responseTextForSpecialHandled };
        const currentHistory = await stateService.getConversationHistory(uid).catch(() => []);
        const updatedHistory = [...currentHistory, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
        
        await stateService.setConversationHistory(uid, updatedHistory);
        await stateService.clearPendingActionState(uid); // Limpa ação pendente
        await stateService.updateDialogueState(uid, { lastInteraction: Date.now() });
        
        logger.info(`${TAG} ✓ ok (special_handled por intentService) ${Date.now() - start} ms`);
        return responseTextForSpecialHandled;
    }

    // Se chegou aqui, 'determinedIntent' não é null e precisa da IA.
    let effectiveIncomingText = rawText;
    let effectiveIntent = determinedIntent as DeterminedIntent;

    if (determinedIntent === 'user_confirms_pending_action') {
        logger.info(`${TAG} Usuário confirmou ação pendente. Contexto original: ${JSON.stringify(pendingActionContextFromIntent)}`);
        if (dialogueState.lastAIQuestionType === 'confirm_fetch_day_stats' && pendingActionContextFromIntent?.originalUserQuery) {
            effectiveIncomingText = `Sim, por favor, quero saber sobre ${pendingActionContextFromIntent.originalUserQuery}. Mostre-me o desempenho por dia da semana.`;
            effectiveIntent = 'ASK_BEST_TIME';
        } else if (pendingActionContextFromIntent?.originalSuggestion) {
             effectiveIncomingText = `Sim, pode prosseguir com: "${pendingActionContextFromIntent.originalSuggestion}"`;
             effectiveIntent = 'general';
        } else {
            effectiveIncomingText = "Sim, por favor, prossiga.";
            effectiveIntent = 'general';
        }
        logger.info(`${TAG} Texto efetivo para IA após confirmação: "${effectiveIncomingText.slice(0,50)}...", Intenção efetiva: ${effectiveIntent}`);
        await stateService.clearPendingActionState(uid);
    } else if (determinedIntent === 'user_denies_pending_action') {
        logger.info(`${TAG} Usuário negou ação pendente.`);
        await stateService.clearPendingActionState(uid);
        const denialResponse = pickRandom(["Entendido. Como posso te ajudar então?", "Ok. O que você gostaria de fazer a seguir?", "Sem problemas. Em que mais posso ser útil hoje?"]);
        
        const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: rawText };
        const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: denialResponse };
        const currentHistory = await stateService.getConversationHistory(uid).catch(() => []);
        const updatedHistory = [...currentHistory, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
        await stateService.setConversationHistory(uid, updatedHistory);
        await stateService.updateDialogueState(uid, { lastInteraction: Date.now() });
        
        return denialResponse;
    } else if (dialogueState.lastAIQuestionType) {
        logger.info(`${TAG} Usuário não respondeu diretamente à ação pendente (${dialogueState.lastAIQuestionType}). Limpando estado pendente.`);
        await stateService.clearPendingActionState(uid);
    }


    let historyMessages: ChatCompletionMessageParam[] = [];
    try {
        historyMessages = await stateService.getConversationHistory(uid);
    } catch (histError) { logger.error(`${TAG} Erro ao buscar histórico do Redis:`, histError); }
    const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);

    const currentDialogueStateAfterIntent = await stateService.getDialogueState(uid); // Recarrega estado atualizado
    const enrichedContext: EnrichedContext = { 
        user, 
        historyMessages: limitedHistoryMessages, 
        dialogueState: currentDialogueStateAfterIntent 
    };

    const isLightweightQuery = effectiveIntent === 'social_query' || effectiveIntent === 'meta_query_personal' || effectiveIntent === 'generate_proactive_alert';
    let processingMessageTimer: NodeJS.Timeout | null = null;
    let processingMessageHasBeenSent = false;

    if (!isLightweightQuery) {
        processingMessageTimer = setTimeout(async () => {
            if (processingMessageTimer && !processingMessageHasBeenSent) {
                try {
                    const message = pickRandom(GET_PROCESSING_MESSAGES_POOL(userName));
                    logger.debug(`${TAG} Enviando mensagem de processamento (intenção: ${effectiveIntent}) para ${fromPhone} após ${PROCESSING_MESSAGE_DELAY_MS}ms.`);
                    await sendWhatsAppMessage(fromPhone, message);
                    processingMessageHasBeenSent = true;
                } catch (sendError) {
                    logger.error(`${TAG} Falha ao enviar mensagem de processamento condicional (não fatal):`, sendError);
                }
            }
            processingMessageTimer = null;
        }, PROCESSING_MESSAGE_DELAY_MS);
    } else {
        logger.debug(`${TAG} Pulando mensagem de processamento para intenção leve: ${effectiveIntent}`);
    }

    let finalText = '';
    let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let streamTimeout: NodeJS.Timeout | null = null;

    try {
        logger.debug(`${TAG} Chamando askLLMWithEnrichedContext (intenção: ${effectiveIntent}). Texto efetivo: ${effectiveIncomingText.slice(0,50)}`);
        const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(
            enrichedContext,
            effectiveIncomingText, // Usa o texto efetivo
            effectiveIntent
        );
        historyPromise = hp;

        if (processingMessageTimer) {
            logger.debug(`${TAG} Resposta da IA recebida, cancelando timer da mensagem de processamento.`);
            clearTimeout(processingMessageTimer);
            processingMessageTimer = null;
        }
        
        reader = stream.getReader();
        streamTimeout = setTimeout(() => { logger.warn(`${TAG} Timeout stream read...`); streamTimeout = null; reader?.cancel().catch(()=>{/*ignore*/}); }, STREAM_READ_TIMEOUT_MS);
        // eslint-disable-next-line no-constant-condition
        while (true) {
             let value: string | undefined; let done: boolean | undefined;
             try { const result = await reader.read(); if (streamTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
             catch (readError: any) { logger.error(`${TAG} Erro reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro stream read: ${readError.message}`); }
             if (done) { break; } if (typeof value === 'string') { finalText += value; } else { logger.warn(`${TAG} 'value' undefined mas 'done' false.`); }
        }
        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
        logger.debug(`${TAG} Texto final montado: ${finalText.length} chars.`);
        if (finalText.trim().length === 0) { finalText = 'Hum... não consegui gerar uma resposta completa agora.'; }

    } catch (err: any) {
        logger.error(`${TAG} Erro durante chamada/leitura LLM:`, err);
        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
        if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; }
        finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
    } finally {
        if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${TAG} Erro releaseLock:`, e); } }
        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
        if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; }
    }

    // Lógica para definir/limpar estado de ação pendente após resposta da IA
    // (Esta lógica foi movida para o worker QStash - process-response/route.ts)

    let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
    try {
         logger.debug(`${TAG} Iniciando persistência no Redis...`);
         // O estado do diálogo (lastAIQuestionType) será atualizado pelo worker QStash após esta resposta.
         // Aqui, apenas atualizamos lastInteraction.
         const dialogueStateForSave = await stateService.getDialogueState(uid); // Pega o estado mais recente
         const nextStateToSave = { ...dialogueStateForSave, lastInteraction: Date.now() };
         
         const cacheKeyForPersistence = `resp:${fromPhone}:${effectiveIncomingText.trim().slice(0, 100)}`;

         if (historyPromise) {
             try {
                 finalHistoryForSaving = await historyPromise;
                 logger.debug(`${TAG} historyPromise resolvida com ${finalHistoryForSaving.length} mensagens.`);
             } catch (historyError) {
                 logger.error(`${TAG} Erro ao obter histórico final da historyPromise (não será salvo):`, historyError);
                 finalHistoryForSaving = [];
             }
         } else { logger.warn(`${TAG} historyPromise não encontrada para salvar histórico.`); }

         const persistencePromises = [
             stateService.updateDialogueState(uid, nextStateToSave),
             stateService.setInCache(cacheKeyForPersistence, finalText, CACHE_TTL_SECONDS),
             stateService.incrementUsageCounter(uid),
         ];
         if (finalHistoryForSaving.length > 0) {
              persistencePromises.push(stateService.setConversationHistory(uid, finalHistoryForSaving));
         } else { logger.warn(`${TAG} Pulando salvamento do histórico.`); }
         
         await Promise.allSettled(persistencePromises);
         logger.debug(`${TAG} Persistência no Redis concluída.`);
    } catch (persistError) { logger.error(`${TAG} Erro persistência Redis (não fatal):`, persistError); }

    const duration = Date.now() - start;
    logger.info(`${TAG} ✓ ok ${duration} ms. Retornando ${finalText.length} chars.`);
    return finalText;
}

// Função de Resumo Semanal (Mantida como estava)
export async function generateStrategicWeeklySummary(
  userName: string,
  userId: string
): Promise<string> {
    const TAG = '[weeklySummary v4.6.1]'; // ATUALIZADO: Versão
    // ... (resto da função mantida como na v4.5.0/4.6.0)
    let reportData: unknown;
    let overallStatsForPrompt: unknown = null;
    try {
        logger.debug(`${TAG} Buscando dados para resumo semanal de ${userName} (ID: ${userId})`);
        const lookedUpUser = await dataService.lookupUserById(userId);
        const getAggregatedReportExecutor = functionExecutors.getAggregatedReport;
        if (!getAggregatedReportExecutor) {
            logger.error(`${TAG} Executor para 'getAggregatedReport' não está definido em functionExecutors.`);
            return `Não foi possível gerar o resumo semanal: funcionalidade de relatório indisponível. Por favor, contate o suporte.`;
        }
        reportData = await getAggregatedReportExecutor({}, lookedUpUser); 
        let hasError = false;
        let statsAreMissing = true;
        if (typeof reportData === 'object' && reportData !== null) {
            if ('error' in reportData && (reportData as { error: any }).error) {
                hasError = true;
                logger.warn(`${TAG} Falha ao obter relatório agregado para ${userName}: ${(reportData as { error: any }).error}`);
            } else if ('overallStats' in reportData && (reportData as { overallStats: any }).overallStats) {
                statsAreMissing = false;
                overallStatsForPrompt = (reportData as { overallStats: any }).overallStats;
                logger.info(`${TAG} Relatório obtido com overallStats para resumo semanal de ${userName}.`);
            } else {
                logger.warn(`${TAG} Relatório agregado para ${userName} não contém 'overallStats' ou está vazio.`);
            }
        } else {
            logger.warn(`${TAG} Falha ao obter relatório agregado para ${userName}: formato de resposta inesperado.`);
        }
        if (hasError || statsAreMissing) {
            return 'Não foi possível gerar o resumo semanal: falha ao buscar ou processar seus dados recentes.';
        }
    } catch (e: any) {
        logger.error(`${TAG} Erro crítico ao buscar relatório para resumo semanal de ${userName}:`, e);
        return `Não consegui buscar seus dados para gerar o resumo semanal agora devido a um erro: ${e.message || String(e)}`;
    }
    if (!overallStatsForPrompt) {
        logger.error(`${TAG} overallStatsForPrompt está nulo inesperadamente antes de gerar o prompt para ${userName}.`);
        return 'Não foi possível gerar o resumo semanal: dados de métricas gerais não encontrados após processamento.';
    }
    const PROMPT = `Como consultor estratégico, resuma em 3 bullets concisos os principais destaques (positivos ou pontos de atenção) das métricas gerais de ${userName} desta semana, baseado nestes dados: ${JSON.stringify(
        overallStatsForPrompt
    )}. Foco em insights acionáveis.`;
    try {
        logger.warn(`${TAG} Chamada direta à IA para resumo não implementada/configurada completamente para produção.`);
        let exampleInsights = '[Insight 1], [Insight 2], [Insight 3]';
        if (typeof overallStatsForPrompt === 'object' && overallStatsForPrompt !== null) {
            const keys = Object.keys(overallStatsForPrompt);
            exampleInsights = keys.slice(0,3).map(key => `[Insight sobre ${key}]`).join(', ');
        }
        return `Aqui estão os destaques da semana para ${userName} (simulado): \n- ${exampleInsights.replace(/, /g, '\n- ') || 'Insights gerais baseados nos dados.'}`;
    } catch (e: any) {
        logger.error(`${TAG} Erro ao gerar resumo semanal para ${userName}:`, e);
        return `Não consegui gerar o resumo semanal para ${userName} agora devido a um erro: ${e.message || String(e)}`;
    }
}
