/**
 * @fileoverview Serviço principal para obter respostas do consultor Tuca.
 * Otimizado para:
 * - Respostas diretas para interações simples.
 * - Contexto leve para IA em perguntas sociais/meta.
 * - ATUALIZADO: Primeira mensagem de reconhecimento AGORA é gerada por uma chamada real à IA 
 * (via nova função em aiOrchestrator) usando um prompt dedicado para "quebra-gelo".
 * - Integração de resumo de histórico no contexto da IA.
 * @version 4.7.6 (Quebra-Gelo Dinâmico via IA Real)
 */

import { logger } from '@/app/lib/logger';
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from './intentService';
// ATUALIZADO: Importar getQuickAcknowledgementLLMResponse de aiOrchestrator
import { askLLMWithEnrichedContext, getQuickAcknowledgementLLMResponse } from './aiOrchestrator';
import * as stateService from '@/app/lib/stateService'; 
import * as dataService from './dataService';
import { IEnrichedReport } from './dataService'; 
import { UserNotFoundError } from '@/app/lib/errors';
import { IUser } from '@/app/models/User';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { functionExecutors } from '@/app/lib/aiFunctions';
import { getFunAcknowledgementPrompt } from './funAcknowledgementPrompt'; // Importa o novo prompt

const pickRandom = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error('pickRandom: array vazio');
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error('pickRandom: item indefinido'); 
  return item;
};

// Configurações existentes
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10; 
const SUMMARY_MAX_HISTORY_FOR_CONTEXT = 6; 

interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.IDialogueState; 
}

/**
 * ATUALIZADO: Gera a primeira mensagem de reconhecimento chamando a IA.
 */
async function generateDynamicAcknowledgement(
    userName: string,
    userQuery: string,
    // userId: string // Pode ser útil para logs ou personalização futura
): Promise<string | null> {
    const TAG_ACK = '[generateDynamicAcknowledgement v4.7.6]';
    const queryExcerpt = userQuery.length > 35 ? `${userQuery.substring(0, 32)}...` : userQuery;
    logger.info(`${TAG_ACK} Gerando reconhecimento dinâmico via IA para ${userName} sobre: "${queryExcerpt}"`);
    
    try {
        const systemPromptForAck = getFunAcknowledgementPrompt(userName, queryExcerpt);
        // Chama a nova função em aiOrchestrator
        const ackMessage = await getQuickAcknowledgementLLMResponse(systemPromptForAck, userQuery, userName); 
        
        if (ackMessage) {
            logger.info(`${TAG_ACK} Reconhecimento dinâmico gerado pela IA: "${ackMessage.substring(0,70)}..."`);
            return ackMessage;
        } else {
            logger.warn(`${TAG_ACK} getQuickAcknowledgementLLMResponse retornou null. Sem quebra-gelo.`);
            return null;
        }
    } catch (error) {
        logger.error(`${TAG_ACK} Erro ao gerar reconhecimento dinâmico via IA:`, error);
        // Em caso de erro, não envia o quebra-gelo para não bloquear o fluxo principal.
        return null; 
    }
}


export async function getConsultantResponse(
    fromPhone: string,
    incoming: string
): Promise<string> {
    const TAG = '[consultantService v4.7.6]'; // ATUALIZADO: Versão
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

    let dialogueState: stateService.IDialogueState = {}; 
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
        } else { 
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
        const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: rawText };
        const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: responseTextForSpecialHandled };
        const currentHistory = await stateService.getConversationHistory(uid).catch(() => []);
        const updatedHistory = [...currentHistory, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
        
        await stateService.setConversationHistory(uid, updatedHistory);
        await stateService.clearPendingActionState(uid); 
        await stateService.updateDialogueState(uid, { lastInteraction: Date.now() }); 
        
        logger.info(`${TAG} ✓ ok (special_handled por intentService) ${Date.now() - start} ms`);
        return responseTextForSpecialHandled;
    }

    const isLightweightQuery = determinedIntent === 'social_query' || determinedIntent === 'meta_query_personal' || determinedIntent === 'generate_proactive_alert';
    if (!isLightweightQuery && determinedIntent !== 'user_confirms_pending_action' && determinedIntent !== 'user_denies_pending_action') {
        try {
            // ATUALIZADO: Chama a IA para o reconhecimento dinâmico
            const dynamicAckMessage = await generateDynamicAcknowledgement(userName, rawText /*, uid */);
            if (dynamicAckMessage) {
                logger.debug(`${TAG} Enviando reconhecimento dinâmico (gerado por IA) para ${fromPhone}: "${dynamicAckMessage}"`);
                await sendWhatsAppMessage(fromPhone, dynamicAckMessage);
                // Opcional: Adicionar dynamicAckMessage ao histórico da IA principal?
                // Por enquanto, não adicionamos para manter o histórico da IA principal focado na tarefa analítica.
                // Se for adicionar, seria aqui:
                // rawHistoryMessages.push({ role: 'assistant', content: dynamicAckMessage });
            }
        } catch (ackError) {
            logger.error(`${TAG} Falha ao gerar/enviar reconhecimento dinâmico via IA (não fatal):`, ackError);
        }
    }

    let effectiveIncomingText = rawText;
    let effectiveIntent = determinedIntent as DeterminedIntent;

    if (determinedIntent === 'user_confirms_pending_action') {
        logger.info(`${TAG} Usuário confirmou ação pendente. Contexto original: ${JSON.stringify(pendingActionContextFromIntent)}`);
        if (dialogueState.lastAIQuestionType === 'confirm_fetch_day_stats' && pendingActionContextFromIntent?.originalUserQuery) {
            effectiveIncomingText = `Sim, por favor, quero saber sobre ${pendingActionContextFromIntent.originalUserQuery}. Mostre-me o desempenho por dia da semana.`;
            effectiveIntent = 'ASK_BEST_TIME';
        } else if (dialogueState.lastAIQuestionType === 'clarify_community_inspiration_objective' && pendingActionContextFromIntent) {
            const originalProposal = (pendingActionContextFromIntent as any)?.proposal || "um tema relevante";
            const originalContext = (pendingActionContextFromIntent as any)?.context || "uma abordagem específica";
            effectiveIncomingText = `Para a inspiração sobre proposta '${originalProposal}' e contexto '${originalContext}', confirmo que quero focar em '${rawText.trim()}'. Por favor, busque exemplos.`;
            effectiveIntent = 'ask_community_inspiration';
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
        dialogueState = await stateService.getDialogueState(uid);
    }

    let historyForAI: ChatCompletionMessageParam[] = [];
    const rawHistoryMessages = await stateService.getConversationHistory(uid).catch(() => {
        logger.error(`${TAG} Erro ao buscar histórico do Redis para montar contexto da IA.`);
        return [];
    });

    if (dialogueState.conversationSummary && dialogueState.conversationSummary.trim() !== "") {
        logger.debug(`${TAG} Utilizando resumo da conversa no contexto da IA: "${dialogueState.conversationSummary.substring(0,100)}..."`);
        historyForAI.push({ 
            role: 'system', 
            content: `Resumo da conversa até este ponto (use para contexto, mas foque nas mensagens mais recentes para a resposta atual): ${dialogueState.conversationSummary}` 
        });
        historyForAI.push(...rawHistoryMessages.slice(-SUMMARY_MAX_HISTORY_FOR_CONTEXT));
    } else {
        historyForAI.push(...rawHistoryMessages.slice(-HISTORY_LIMIT));
    }

    const enrichedContext: EnrichedContext = { 
        user, 
        historyMessages: historyForAI, 
        dialogueState: dialogueState 
    };
    
    let finalText = '';
    let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let streamTimeout: NodeJS.Timeout | null = null;

    try {
        logger.debug(`${TAG} Chamando askLLMWithEnrichedContext (intenção: ${effectiveIntent}). Texto efetivo: ${effectiveIncomingText.slice(0,50)}`);
        const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(
            enrichedContext, 
            effectiveIncomingText, 
            effectiveIntent
        );
        historyPromise = hp;
        
        reader = stream.getReader();
        streamTimeout = setTimeout(() => { logger.warn(`${TAG} Timeout stream read...`); streamTimeout = null; reader?.cancel().catch(()=>{/*ignore*/}); }, STREAM_READ_TIMEOUT_MS);
        
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
        finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
    } finally {
        if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${TAG} Erro releaseLock:`, e); } }
        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
    }

    let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
    try {
         logger.debug(`${TAG} Iniciando persistência no Redis (básica)...`);
         const dialogueStateForSave = await stateService.getDialogueState(uid); 
         const nextStateToSave: Partial<stateService.IDialogueState> = { 
             ...dialogueStateForSave, 
             lastInteraction: Date.now() 
         };
         
         const cacheKeyForPersistence = `resp:${fromPhone}:${effectiveIncomingText.trim().slice(0, 100)}`;

         if (historyPromise) {
             try {
                 finalHistoryForSaving = await historyPromise;
                 logger.debug(`${TAG} historyPromise resolvida com ${finalHistoryForSaving.length} mensagens.`);
             } catch (historyError) {
                 logger.error(`${TAG} Erro ao obter histórico final da historyPromise. Montando fallback:`, historyError);
                 finalHistoryForSaving = [...rawHistoryMessages.slice(-HISTORY_LIMIT + 2), {role: 'user', content: effectiveIncomingText}, {role: 'assistant', content: finalText}];
             }
         } else { 
             logger.warn(`${TAG} historyPromise não encontrada para salvar histórico. Montando fallback.`);
             finalHistoryForSaving = [...rawHistoryMessages.slice(-HISTORY_LIMIT + 2), {role: 'user', content: effectiveIncomingText}, {role: 'assistant', content: finalText}];
         }

         const persistencePromises = [
             stateService.updateDialogueState(uid, nextStateToSave), 
             stateService.setInCache(cacheKeyForPersistence, finalText, CACHE_TTL_SECONDS),
             stateService.incrementUsageCounter(uid),
         ];
         if (finalHistoryForSaving.length > 0) {
              persistencePromises.push(stateService.setConversationHistory(uid, finalHistoryForSaving));
         } else { logger.warn(`${TAG} Pulando salvamento do histórico (array vazio).`); }
         
         await Promise.allSettled(persistencePromises);
         logger.debug(`${TAG} Persistência no Redis (básica) concluída.`);
    } catch (persistError) { logger.error(`${TAG} Erro persistência Redis (não fatal):`, persistError); }

    const duration = Date.now() - start;
    logger.info(`${TAG} ✓ ok ${duration} ms. Retornando ${finalText.length} chars.`);
    return finalText;
}

export async function generateStrategicWeeklySummary(
  userName: string,
  userId: string
): Promise<string> {
    const TAG = '[weeklySummary v4.7.6]'; 
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
        
        reportData = await getAggregatedReportExecutor({ analysisPeriod: 180 }, lookedUpUser); 
        
        let hasError = false;
        let statsAreMissing = true;
        
        if (typeof reportData === 'object' && reportData !== null) {
            const reportPayload = reportData as { reportData?: IEnrichedReport; error?: string; analysisPeriodUsed?: number };
            
            if (reportPayload.error) {
                hasError = true;
                logger.warn(`${TAG} Falha ao obter relatório agregado para ${userName}: ${reportPayload.error}`);
            } else if (reportPayload.reportData?.overallStats) {
                statsAreMissing = false;
                overallStatsForPrompt = reportPayload.reportData.overallStats;
                logger.info(`${TAG} Relatório obtido com overallStats para resumo semanal de ${userName}. Período usado: ${reportPayload.analysisPeriodUsed} dias.`);
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
