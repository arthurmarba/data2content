// src/app/api/whatsapp/process-response/userMessageHandler.ts
import { NextResponse } from 'next/server';
// CORREÇÃO: Importar tipos específicos de mensagem
import { 
    ChatCompletionMessageParam,
    ChatCompletionUserMessageParam, // Adicionado
    ChatCompletionAssistantMessageParam, // Adicionado
    ChatCompletionSystemMessageParam // Adicionado para clareza, embora o TS possa inferir
} from 'openai/resources/chat/completions'; // Para tipagem do histórico
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import * as dataService from '@/app/lib/dataService';
import { IUser, IUserPreferences } from '@/app/models/User';
import {
    determineIntent,
    normalizeText,
    getRandomGreeting,
    IntentResult,
    DeterminedIntent
} from '@/app/lib/intentService';
import { generateConversationSummary, inferUserExpertiseLevel } from '@/app/lib/aiService';
import * as humorKnowledge from '@/app/lib/knowledge/humorScriptWritingKnowledge';
import { ProcessRequestBody, EnrichedAIContext } from './types'; // Tipos locais da rota
import {
    generateDynamicAcknowledgementInWorker,
    aiResponseSuggestsPendingAction,
    stripLeadingGreetings 
} from './handlerUtils';
import { extractExcerpt, pickRandom } from '@/app/lib/utils';
import {
    STREAM_READ_TIMEOUT_MS,
    HISTORY_LIMIT,
    CACHE_TTL_SECONDS,
    SUMMARY_GENERATION_INTERVAL,
    EXPERTISE_INFERENCE_INTERVAL,
    GREETING_THRESHOLD_MILLISECONDS,
    ACK_SKIP_THRESHOLD_MILLISECONDS,
    COMPLEX_TASK_INTENTS
} from '@/app/lib/constants';

const HANDLER_TAG_BASE = '[UserMsgHandler]';

export async function handleUserMessage(payload: ProcessRequestBody): Promise<NextResponse> {
    const { userId, incomingText, fromPhone, determinedIntent: intentFromPayload, qstashMessageId } = payload;

    const messageId_MsgAtual = qstashMessageId || `internal_${userId}_${Date.now()}`;
    const handlerTAG = `${HANDLER_TAG_BASE} User ${userId} (MsgID: ${messageId_MsgAtual}):`;

    logger.info(`${handlerTAG} Iniciando processamento de mensagem de usuário...`);

    if (!fromPhone || !incomingText) {
        logger.error(`${handlerTAG} Payload inválido para mensagem de usuário. fromPhone ou incomingText ausente.`);
        return NextResponse.json({ error: 'Invalid payload for user message: fromPhone or incomingText missing.' }, { status: 400 });
    }

    let user: IUser;
    let dialogueState: stateService.IDialogueState;
    let historyMessages: ChatCompletionMessageParam[] = []; 
    let firstName: string; 
    let greeting: string; 
    const queryExcerpt_MsgAtual = extractExcerpt(incomingText, 30); 

    try {
        const [userData, initialDialogueState, historyData] = await Promise.all([
            dataService.lookupUserById(userId),
            stateService.getDialogueState(userId),
            stateService.getConversationHistory(userId)
        ]);
        user = userData;
        dialogueState = initialDialogueState;
        historyMessages = historyData;

        const fullName = user.name || 'criador'; 
        firstName = fullName.split(' ')[0]!;
        greeting = getRandomGreeting(firstName); 

        logger.debug(`${handlerTAG} Dados carregados. Nome: ${firstName}, Histórico: ${historyMessages.length} msgs.`);

        const stateUpdateForProcessingStart: Partial<stateService.IDialogueState> = {
            currentProcessingMessageId: messageId_MsgAtual,
            currentProcessingQueryExcerpt: queryExcerpt_MsgAtual
        };
        if (dialogueState.interruptSignalForMessageId === messageId_MsgAtual) {
            stateUpdateForProcessingStart.interruptSignalForMessageId = null;
        }
        await stateService.updateDialogueState(userId, stateUpdateForProcessingStart);
        dialogueState = await stateService.getDialogueState(userId); 
        logger.info(`${handlerTAG} Estado de processamento atualizado. currentProcessingMessageId setado para ${messageId_MsgAtual}. QueryExcerpt: "${queryExcerpt_MsgAtual}"`);

    } catch (err) {
        logger.error(`${handlerTAG} Erro ao carregar dados iniciais ou definir estado de processamento:`, err);
        try { await sendWhatsAppMessage(fromPhone, "Desculpe, tive um problema ao iniciar o processamento da sua mensagem. Tente novamente em instantes."); }
        catch (e) { logger.error(`${handlerTAG} Falha ao enviar mensagem de erro de carregamento inicial:`, e); }
        await stateService.updateDialogueState(userId, { currentProcessingMessageId: null, currentProcessingQueryExcerpt: null });
        return NextResponse.json({ error: `Failed to load initial user data or set processing state: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }

    const normText = normalizeText(incomingText.trim()); 
    if (!normText) {
        logger.warn(`${handlerTAG} Mensagem normalizada resultou em texto vazio.`);
        const emptyNormResponse = `${greeting} Não entendi bem o que você disse. Pode repetir, por favor?`;
        await sendWhatsAppMessage(fromPhone, emptyNormResponse);
        await stateService.updateDialogueState(userId, { currentProcessingMessageId: null, currentProcessingQueryExcerpt: null, lastInteraction: Date.now() });
        return NextResponse.json({ success: true, message: "Empty normalized text, user informed." }, { status: 200 });
    }

    let intentResult: IntentResult | undefined = undefined;
    let currentDeterminedIntent: DeterminedIntent | null = intentFromPayload; 
    let responseTextForSpecialHandled: string | null = null; 
    let pendingActionContextFromIntent: any = null; 
    let dialogueStateUpdateForTaskStart: Partial<stateService.IDialogueState> = {}; 

    if (!currentDeterminedIntent) {
        logger.warn(`${handlerTAG} 'determinedIntent' não veio no payload. Determinando agora.`);
        try {
            intentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
            if (intentResult.type === 'special_handled') {
                responseTextForSpecialHandled = intentResult.response;
                if (dialogueState.currentTask) dialogueStateUpdateForTaskStart.currentTask = null; 
            } else { 
                currentDeterminedIntent = intentResult.intent;
                if (intentResult.intent === 'user_confirms_pending_action' || intentResult.intent === 'user_denies_pending_action') {
                    pendingActionContextFromIntent = intentResult.pendingActionContext;
                } else if (COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent)) {
                    if (!dialogueState.currentTask || dialogueState.currentTask.name !== currentDeterminedIntent) {
                        const newCurrentTask: stateService.CurrentTask = { name: currentDeterminedIntent, objective: `Processar intenção: ${currentDeterminedIntent}`, currentStep: 'inicio' };
                        if (currentDeterminedIntent === 'content_plan' && incomingText.length > 20) { 
                            newCurrentTask.objective = `Criar plano de conteúdo baseado em: "${extractExcerpt(incomingText,100)}..."`;
                        }
                        dialogueStateUpdateForTaskStart.currentTask = newCurrentTask;
                    }
                } else if (dialogueState.currentTask && !COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent) && currentDeterminedIntent !== 'general') {
                    dialogueStateUpdateForTaskStart.currentTask = null;
                }
            }
        } catch (intentError) {
            logger.error(`${handlerTAG} Erro ao re-determinar intenção:`, intentError);
            currentDeterminedIntent = 'general'; 
            if (dialogueState.currentTask) dialogueStateUpdateForTaskStart.currentTask = null;
        }
    } else {
        logger.info(`${handlerTAG} Usando 'determinedIntent' ('${currentDeterminedIntent}') do payload.`);
        if (currentDeterminedIntent && (currentDeterminedIntent.startsWith('user_') || COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent) || currentDeterminedIntent === 'humor_script_request')) {
            try {
                const tempIntentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
                if (tempIntentResult.type === 'intent_determined') {
                    intentResult = tempIntentResult; 
                    if (COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent!)) { 
                        if (!dialogueState.currentTask || dialogueState.currentTask.name !== currentDeterminedIntent) {
                             const newCurrentTask: stateService.CurrentTask = { name: currentDeterminedIntent!, objective: `Processar intenção: ${currentDeterminedIntent}`, currentStep: 'inicio' };
                             if (currentDeterminedIntent === 'content_plan' && incomingText.length > 20) newCurrentTask.objective = `Criar plano de conteúdo baseado em: "${extractExcerpt(incomingText,100)}..."`;
                             dialogueStateUpdateForTaskStart.currentTask = newCurrentTask;
                        }
                    }
                }
            } catch (e) {
                logger.error(`${handlerTAG} Erro ao tentar obter detalhes da intenção (vinda do payload '${currentDeterminedIntent}'):`, e);
            }
        }
    }

    if (intentResult && intentResult.type === 'intent_determined' && currentDeterminedIntent) {
        const { extractedPreference, extractedGoal, extractedFact, memoryUpdateRequestContent } = intentResult;
        let updatedUserFromMemoryOp: IUser | null = null;
        try {
            if (currentDeterminedIntent === 'user_stated_preference' && extractedPreference) {
                const prefPayload: Partial<IUserPreferences> = {};
                const key = extractedPreference.field as keyof IUserPreferences; 
                const value = extractedPreference.value;
                if (key === 'preferredFormats' || key === 'dislikedTopics') { 
                    (prefPayload as any)[key] = Array.isArray(value) ? value : [value];
                } else {
                    (prefPayload as any)[key] = value;
                }
                updatedUserFromMemoryOp = await dataService.updateUserPreferences(userId, prefPayload);
            } else if (currentDeterminedIntent === 'user_shared_goal' && extractedGoal) {
                updatedUserFromMemoryOp = await dataService.addUserLongTermGoal(userId, extractedGoal);
            } else if (currentDeterminedIntent === 'user_mentioned_key_fact' && extractedFact) {
                updatedUserFromMemoryOp = await dataService.addUserKeyFact(userId, extractedFact);
            } else if (currentDeterminedIntent === 'user_requests_memory_update' && memoryUpdateRequestContent) {
                updatedUserFromMemoryOp = await dataService.addUserKeyFact(userId, memoryUpdateRequestContent); 
            }
            if (updatedUserFromMemoryOp) user = updatedUserFromMemoryOp; 
        } catch (memoryError) {
            logger.error(`${handlerTAG} Erro ao persistir memória para intenção '${currentDeterminedIntent}':`, memoryError);
        }
    }

    if (Object.keys(dialogueStateUpdateForTaskStart).length > 0) {
        await stateService.updateDialogueState(userId, dialogueStateUpdateForTaskStart);
        dialogueState = await stateService.getDialogueState(userId); 
    }

    if (responseTextForSpecialHandled) {
        await sendWhatsAppMessage(fromPhone, responseTextForSpecialHandled);
        const userMsgHist: ChatCompletionUserMessageParam = { role: 'user', content: incomingText! };
        const assistantMsgHist: ChatCompletionAssistantMessageParam = { role: 'assistant', content: responseTextForSpecialHandled };
        const updatedHistory = [...historyMessages, userMsgHist, assistantMsgHist].slice(-HISTORY_LIMIT);
        await stateService.setConversationHistory(userId, updatedHistory);

        const stateUpdateAfterSpecial: Partial<stateService.IDialogueState> = {
            lastInteraction: Date.now(),
            currentProcessingMessageId: null, 
            currentProcessingQueryExcerpt: null,
        };
        const currentDSForCounters = await stateService.getDialogueState(userId);
        const currentSummaryTurn = (currentDSForCounters.summaryTurnCounter || 0) + 1;
        if (currentSummaryTurn >= SUMMARY_GENERATION_INTERVAL) {
            const summary = await generateConversationSummary(updatedHistory, firstName);
            if (summary) stateUpdateAfterSpecial.conversationSummary = summary;
            stateUpdateAfterSpecial.summaryTurnCounter = 0;
        } else {
            stateUpdateAfterSpecial.summaryTurnCounter = currentSummaryTurn;
        }
        const currentExpertiseTurn = (currentDSForCounters.expertiseInferenceTurnCounter || 0) + 1;
        if(currentExpertiseTurn >= EXPERTISE_INFERENCE_INTERVAL) {
            stateUpdateAfterSpecial.expertiseInferenceTurnCounter = 0;
            const inferredLevel = await inferUserExpertiseLevel(updatedHistory, firstName);
            if (inferredLevel && user.inferredExpertiseLevel !== inferredLevel) {
                await dataService.updateUserExpertiseLevel(userId, inferredLevel);
            }
        } else {
            stateUpdateAfterSpecial.expertiseInferenceTurnCounter = currentExpertiseTurn;
        }
        await stateService.updateDialogueState(userId, stateUpdateAfterSpecial);
        return NextResponse.json({ success: true, message: "Special handled intent processed." }, { status: 200 });
    }

    const nowForAck = Date.now();
    const lastInteractionTimeForAck = dialogueState.lastInteraction || 0;
    let useNameToAck = true; 
    let shouldSkipDynamicAckEntirely = false; 
    const minutesSinceLastInteraction = (nowForAck - lastInteractionTimeForAck) / (1000 * 60);
    const secondsSinceLastInteraction = (nowForAck - lastInteractionTimeForAck) / 1000;

    if (dialogueState.lastInteraction && (nowForAck - dialogueState.lastInteraction) < ACK_SKIP_THRESHOLD_MILLISECONDS) {
        if (historyMessages.length > 0 && historyMessages[historyMessages.length -1]?.role === 'assistant') {
            logger.info(`${handlerTAG} Interação MUITO recente com o assistente (${secondsSinceLastInteraction.toFixed(0)}s atrás). Pulando quebra-gelo completamente.`);
            shouldSkipDynamicAckEntirely = true;
        } else {
            logger.info(`${handlerTAG} Interação recente, mas a última mensagem não foi do assistente. Quebra-gelo será considerado (para nome/genérico).`);
        }
    }

    if (!shouldSkipDynamicAckEntirely) {
        if (lastInteractionTimeForAck !== 0 && (nowForAck - lastInteractionTimeForAck) < GREETING_THRESHOLD_MILLISECONDS) {
            logger.info(`${handlerTAG} Interação recente (${minutesSinceLastInteraction.toFixed(1)} min). Quebra-gelo será genérico (sem nome).`);
            useNameToAck = false;
        } else if (lastInteractionTimeForAck === 0) {
            logger.info(`${handlerTAG} Primeira interação ou estado resetado. Quebra-gelo usará o nome.`);
        } else {
            logger.info(`${handlerTAG} Tempo suficiente desde a última interação (${minutesSinceLastInteraction.toFixed(1)} min). Quebra-gelo usará o nome.`);
        }
    }

    const isLightweightIntentForDynamicAck = currentDeterminedIntent === 'social_query' || currentDeterminedIntent === 'meta_query_personal';
    const intentsToSkipDynamicAck = [
        'user_confirms_pending_action',
        'user_denies_pending_action',
        'greeting', 
        'generate_proactive_alert' 
    ];

    if (!shouldSkipDynamicAckEntirely &&
        !isLightweightIntentForDynamicAck &&
        !intentsToSkipDynamicAck.includes(currentDeterminedIntent as string) 
       ) {
        try {
            const firstNameForAck = useNameToAck ? firstName : null;
            const dynamicAckMessage = await generateDynamicAcknowledgementInWorker(
                firstNameForAck,
                incomingText!,
                userId,
                dialogueState
            );
            if (dynamicAckMessage) {
                await sendWhatsAppMessage(fromPhone!, dynamicAckMessage);
                historyMessages.push({ role: 'assistant', content: dynamicAckMessage } as ChatCompletionAssistantMessageParam);
                if (historyMessages.length > HISTORY_LIMIT) historyMessages.shift(); 
            }
        } catch (ackError) {
            logger.error(`${handlerTAG} Falha ao gerar/enviar quebra-gelo dinâmico:`, ackError);
        }
    } else {
         if (shouldSkipDynamicAckEntirely) {
            logger.debug(`${handlerTAG} Pulando quebra-gelo: interação muito recente com assistente.`);
         } else if (isLightweightIntentForDynamicAck) {
            logger.debug(`${handlerTAG} Pulando quebra-gelo: intenção leve ('${currentDeterminedIntent}').`);
         } else if (intentsToSkipDynamicAck.includes(currentDeterminedIntent as string)){
            logger.debug(`${handlerTAG} Pulando quebra-gelo: intenção de sistema/resposta ('${currentDeterminedIntent}').`);
         }
    }

    const freshDialogueStateForInterrupt = await stateService.getDialogueState(userId);
    if (freshDialogueStateForInterrupt.interruptSignalForMessageId === messageId_MsgAtual) {
        logger.info(`${handlerTAG} INTERRUPÇÃO DETECTADA para MsgID: ${messageId_MsgAtual} ("${queryExcerpt_MsgAtual}") APÓS ACK. Sinal: ${freshDialogueStateForInterrupt.interruptSignalForMessageId}. Pulando resposta principal da LLM.`);
        const userMsgHistInterrupted: ChatCompletionUserMessageParam = { role: 'user', content: incomingText! };
        const finalHistoryForInterrupted = [...historyMessages, userMsgHistInterrupted].slice(-HISTORY_LIMIT);
        await stateService.setConversationHistory(userId, finalHistoryForInterrupted);
        await stateService.updateDialogueState(userId, {
            currentProcessingMessageId: null, currentProcessingQueryExcerpt: null,
            interruptSignalForMessageId: null, 
            lastInteraction: Date.now(),
            summaryTurnCounter: freshDialogueStateForInterrupt.summaryTurnCounter,
            expertiseInferenceTurnCounter: freshDialogueStateForInterrupt.expertiseInferenceTurnCounter,
            conversationSummary: freshDialogueStateForInterrupt.conversationSummary,
            currentTask: freshDialogueStateForInterrupt.currentTask, 
        });
        logger.info(`${handlerTAG} Estado limpo após interrupção de MsgID: ${messageId_MsgAtual}.`);
        return NextResponse.json({ success: true, message: 'Processing interrupted by newer user message after acknowledgement phase.' }, { status: 200 });
    }
    logger.debug(`${handlerTAG} Sem sinal de interrupção. Prosseguindo para resposta principal da LLM.`);

    let effectiveIncomingText = incomingText!;
    let effectiveIntent = currentDeterminedIntent as DeterminedIntent; 

    let currentTurnHistory: ChatCompletionMessageParam[] = [...historyMessages];
    currentTurnHistory.push({ role: 'user', content: effectiveIncomingText } as ChatCompletionUserMessageParam); 

    if (currentDeterminedIntent === 'humor_script_request') {
        try {
            const humorDirectives = [
                "**Diretrizes para Geração de Roteiros de Humor (Para a IA Tuca):**",
                humorKnowledge.getComicDistortionDirectives(),
                humorKnowledge.getSetupPunchlineStructureDirectives(),
                humorKnowledge.getJokeGenerationStrategiesForAI(),
                humorKnowledge.getJokeShapingDirectivesForAI(),
                humorKnowledge.getGeneralHumorQualityDirectives()
            ].join('\n\n---\n\n');
            currentTurnHistory.push({ role: 'system', content: humorDirectives } as ChatCompletionSystemMessageParam); // Adicionado cast para ChatCompletionSystemMessageParam
            logger.info(`${handlerTAG} Diretrizes de geração de humor adicionadas ao histórico para a IA.`);
        } catch (knowledgeError) {
            logger.error(`${handlerTAG} Erro ao obter/adicionar diretrizes de humor:`, knowledgeError);
        }
    }
    currentTurnHistory = currentTurnHistory.slice(-HISTORY_LIMIT); 

    if (currentDeterminedIntent === 'user_confirms_pending_action') {
        const lastAIQType = dialogueState.lastAIQuestionType;
        const pendingContext = dialogueState.pendingActionContext || pendingActionContextFromIntent; 

        if (lastAIQType === 'confirm_fetch_day_stats' && pendingContext?.originalSuggestion) {
            effectiveIncomingText = `Sim, por favor, quero saber sobre o desempenho por dia da semana. A sugestão era: "${pendingContext.originalSuggestion}".`;
            effectiveIntent = 'ASK_BEST_TIME';
        } else if (lastAIQType === 'clarify_community_inspiration_objective' && pendingContext) {
            const originalProposal = (pendingContext as any)?.proposal || "um tema relevante";
            const originalContext = (pendingContext as any)?.context || "uma abordagem específica";
            effectiveIncomingText = `Sim, para a inspiração sobre a proposta '${originalProposal}' (contexto '${originalContext}'), quero focar em '${incomingText!.trim()}'. Por favor, busque exemplos.`;
            effectiveIntent = 'ask_community_inspiration';
            if (dialogueState.currentTask?.name === 'ask_community_inspiration') {
                await stateService.updateDialogueState(userId, { currentTask: { ...dialogueState.currentTask, parameters: { ...(dialogueState.currentTask.parameters || {}), primaryObjectiveAchieved_Qualitative: incomingText!.trim() }, currentStep: 'objective_clarified' } });
                dialogueState = await stateService.getDialogueState(userId); 
            }
        } else if (pendingContext?.originalSuggestion) { 
            effectiveIncomingText = `Sim, pode prosseguir com: "${pendingContext.originalSuggestion}"`;
            effectiveIntent = 'general'; 
        } else {
            effectiveIncomingText = "Sim, por favor, prossiga."; 
            effectiveIntent = 'general';
        }
        const lastUserMsgIndex = currentTurnHistory.map(m => m.role).lastIndexOf('user');
        if (lastUserMsgIndex !== -1) {
            const lastUserMessage = currentTurnHistory[lastUserMsgIndex];
            if(lastUserMessage) { // Checagem adicional
                lastUserMessage.content = effectiveIncomingText;
            }
        }

        await stateService.clearPendingActionState(userId); 
        dialogueState = await stateService.getDialogueState(userId); 
    } else if (currentDeterminedIntent === 'user_denies_pending_action') {
        const denialResponse = pickRandom(["Entendido. Como posso te ajudar então?", "Ok. O que você gostaria de fazer a seguir?", "Sem problemas. Em que mais posso ser útil?"]);
        await sendWhatsAppMessage(fromPhone!, denialResponse);

        const userDenialMsgHist: ChatCompletionUserMessageParam = { role: 'user', content: incomingText! }; 
        const assistantDenialResponseHist: ChatCompletionAssistantMessageParam = { role: 'assistant', content: denialResponse };
        const updatedHistoryDeny = [...currentTurnHistory.slice(0,-1), userDenialMsgHist, assistantDenialResponseHist].slice(-HISTORY_LIMIT); 

        await stateService.setConversationHistory(userId, updatedHistoryDeny);
        await stateService.updateDialogueState(userId, {
            lastInteraction: Date.now(),
            currentProcessingMessageId: null, currentProcessingQueryExcerpt: null,
            lastAIQuestionType: undefined, pendingActionContext: undefined,
        });
        return NextResponse.json({ success: true, message: "User denied pending action." }, { status: 200 });
    } else if (dialogueState.lastAIQuestionType) { 
        logger.info(`${handlerTAG} Havia uma pergunta pendente ('${dialogueState.lastAIQuestionType}'), mas o usuário respondeu com outra intenção ('${currentDeterminedIntent}'). Limpando estado pendente.`);
        await stateService.clearPendingActionState(userId);
        dialogueState = await stateService.getDialogueState(userId); 
    }

    const enrichedContext: EnrichedAIContext = { user, historyMessages: currentTurnHistory, dialogueState, userName: firstName };
    let finalText = ''; 
    let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null; 

    try {
        const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(enrichedContext, effectiveIncomingText, effectiveIntent);
        historyPromise = hp; 
        const reader = stream.getReader();
        let streamReadTimeoutLLM: NodeJS.Timeout | null = setTimeout(() => {
            logger.warn(`${handlerTAG} Timeout (${STREAM_READ_TIMEOUT_MS}ms) lendo stream da LLM principal...`);
            streamReadTimeoutLLM = null; 
            reader?.cancel().catch(e => logger.error(`${handlerTAG} Erro ao cancelar reader da LLM no timeout:`, e));
        }, STREAM_READ_TIMEOUT_MS);

        while (true) {
            let value: string | undefined; let done: boolean | undefined; // Tipagem explícita para value
            try {
                const result = await reader.read();
                if (streamReadTimeoutLLM === null && !result.done) { 
                    logger.warn(`${handlerTAG} Leitura da stream LLM continuou após timeout ter sido marcado como null. Interrompendo.`);
                    break;
                }
                // value pode ser Uint8Array ou string, dependendo da implementação da stream.
                // Para ser seguro, tratamos como 'any' e verificamos o tipo.
                const chunk: any = result.value; 
                if (typeof chunk === 'string') {
                    value = chunk;
                } else if (chunk instanceof Uint8Array) {
                    value = new TextDecoder().decode(chunk);
                } else if (chunk !== undefined) {
                    logger.warn(`${handlerTAG} Stream da LLM retornou chunk de tipo inesperado: ${typeof chunk}`);
                    value = ''; // Ou alguma outra forma de tratamento
                } else {
                    value = ''; // Se for undefined
                }
                done = result.done;

            } catch (readError: any) {
                if (streamReadTimeoutLLM) clearTimeout(streamReadTimeoutLLM);
                streamReadTimeoutLLM = null;
                logger.error(`${handlerTAG} Erro crítico ao ler stream da LLM: ${readError.message}.`, readError);
                finalText = 'Ops! Tive uma dificuldade técnica ao processar sua solicitação. Por favor, tente novamente em alguns instantes.';
                break; 
            }
            if (done) break; 
            if (typeof value === 'string') finalText += value; // value já é string aqui
        }
        if (streamReadTimeoutLLM) clearTimeout(streamReadTimeoutLLM); 

        if (finalText.trim().length === 0 && !finalText.includes('Ops! Tive uma dificuldade técnica')) { 
            logger.warn(`${handlerTAG} Resposta da LLM principal vazia. Usando fallback.`);
            finalText = 'Hum... não consegui gerar uma resposta completa para isso agora. Você poderia tentar reformular sua pergunta ou tentar novamente em alguns instantes?';
        }
    } catch (err: any) {
        logger.error(`${handlerTAG} Erro GERAL na chamada da LLM ou processamento do stream:`, err);
        finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta. Por favor, tente novamente em alguns instantes.';
    }

    await sendWhatsAppMessage(fromPhone!, finalText);
    logger.info(`${handlerTAG} Resposta principal enviada ao usuário: "${finalText.substring(0,100)}..."`);

    let finalDialogueStateUpdate: Partial<stateService.IDialogueState> = { lastInteraction: Date.now() };

    const intentsToAvoidPendingActionSuggestion = [
        'social_query',
        'meta_query_personal',
        'user_confirms_pending_action', 
        'user_denies_pending_action'    
    ];
    if (finalText && !intentsToAvoidPendingActionSuggestion.includes(effectiveIntent)) {
        const pendingActionInfo = aiResponseSuggestsPendingAction(finalText); 
        if (pendingActionInfo.suggests && pendingActionInfo.actionType) {
            finalDialogueStateUpdate.lastAIQuestionType = pendingActionInfo.actionType;
            finalDialogueStateUpdate.pendingActionContext = pendingActionInfo.pendingActionContext;
            if (dialogueState.currentTask) {
                finalDialogueStateUpdate.currentTask = { ...dialogueState.currentTask, currentStep: `aguardando_confirmacao_sobre_${pendingActionInfo.actionType}` };
            }
            logger.info(`${handlerTAG} Resposta da IA sugere ação pendente: ${pendingActionInfo.actionType}`);
        } else { 
            finalDialogueStateUpdate.lastAIQuestionType = undefined;
            finalDialogueStateUpdate.pendingActionContext = undefined;
            if (dialogueState.currentTask && !COMPLEX_TASK_INTENTS.includes(dialogueState.currentTask.name as DeterminedIntent)) {
                 finalDialogueStateUpdate.currentTask = null;
            }
        }
    } else { 
        finalDialogueStateUpdate.lastAIQuestionType = undefined;
        finalDialogueStateUpdate.pendingActionContext = undefined;
        if (dialogueState.currentTask && (effectiveIntent === 'social_query' || effectiveIntent === 'meta_query_personal')) {
            if (!COMPLEX_TASK_INTENTS.includes(dialogueState.currentTask.name as DeterminedIntent)) {
                finalDialogueStateUpdate.currentTask = null;
            }
        }
    }

    const finalDialogueStateBeforeSave = await stateService.getDialogueState(userId);
    if (finalDialogueStateBeforeSave.currentProcessingMessageId === messageId_MsgAtual) {
        finalDialogueStateUpdate.currentProcessingMessageId = null;
        finalDialogueStateUpdate.currentProcessingQueryExcerpt = null;
        logger.info(`${handlerTAG} Limpando currentProcessingMessageId e excerpt após processamento normal.`);
    } else {
        logger.warn(`${handlerTAG} currentProcessingMessageId no Redis (${finalDialogueStateBeforeSave.currentProcessingMessageId}) não corresponde ao ID desta tarefa (${messageId_MsgAtual}). Não limpando automaticamente aqui.`);
    }

    let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
    const userMessageForHistory: ChatCompletionUserMessageParam = { role: 'user', content: effectiveIncomingText };
    const assistantMessageForHistory: ChatCompletionAssistantMessageParam = { role: 'assistant', content: finalText };

    if (historyPromise) {
        try {
            finalHistoryForSaving = await historyPromise; 
            const lastUserMsgIdx = finalHistoryForSaving.map(m => m.role).lastIndexOf('user');
            // CORREÇÃO: Adicionar checagem de nulidade para finalHistoryForSaving[lastUserMsgIdx]
            const lastUserMessageInPromise = lastUserMsgIdx !== -1 ? finalHistoryForSaving[lastUserMsgIdx] : undefined;
            if (lastUserMessageInPromise && lastUserMessageInPromise.content !== effectiveIncomingText) {
                (lastUserMessageInPromise as ChatCompletionUserMessageParam).content = effectiveIncomingText;
            }
        } catch (histError) {
            logger.error(`${handlerTAG} Erro ao obter histórico do historyPromise da IA:`, histError);
            const baseHistory = currentTurnHistory.filter(m => m.role !== 'user' || m.content !== incomingText); 
            finalHistoryForSaving = [...baseHistory, userMessageForHistory, assistantMessageForHistory].slice(-HISTORY_LIMIT);
        }
    } else { 
        const baseHistory = currentTurnHistory.filter(m => m.role !== 'user' || m.content !== incomingText);
        finalHistoryForSaving = [...baseHistory, userMessageForHistory, assistantMessageForHistory].slice(-HISTORY_LIMIT);
    }
   
    const lastUserMessageIndexInFinalHistory = finalHistoryForSaving.map(m => m.role).lastIndexOf('user');
    // CORREÇÃO: Adicionar checagem de nulidade para finalHistoryForSaving[lastUserMessageIndexInFinalHistory]
    const lastUserMessageToAdjust = lastUserMessageIndexInFinalHistory !== -1 ? finalHistoryForSaving[lastUserMessageIndexInFinalHistory] : undefined;
    if (lastUserMessageToAdjust && lastUserMessageToAdjust.content !== effectiveIncomingText) {
        logger.warn(`${handlerTAG} Ajustando a última mensagem do usuário no histórico final para corresponder a effectiveIncomingText (segunda checagem).`);
        if (lastUserMessageToAdjust.role === 'user') {
             (lastUserMessageToAdjust as ChatCompletionUserMessageParam).content = effectiveIncomingText;
        }
    }

    const summaryTurnCounter = (finalDialogueStateBeforeSave.summaryTurnCounter || 0) + 1;
    if (summaryTurnCounter >= SUMMARY_GENERATION_INTERVAL) {
        const summary = await generateConversationSummary(finalHistoryForSaving, firstName);
        if (summary) finalDialogueStateUpdate.conversationSummary = summary;
        finalDialogueStateUpdate.summaryTurnCounter = 0;
    } else {
        finalDialogueStateUpdate.summaryTurnCounter = summaryTurnCounter;
    }
    const expertiseTurnCounter = (finalDialogueStateBeforeSave.expertiseInferenceTurnCounter || 0) + 1;
    if(expertiseTurnCounter >= EXPERTISE_INFERENCE_INTERVAL) {
        const inferredLevel = await inferUserExpertiseLevel(finalHistoryForSaving, firstName);
        if (inferredLevel && user.inferredExpertiseLevel !== inferredLevel) {
            await dataService.updateUserExpertiseLevel(userId, inferredLevel);
            user.inferredExpertiseLevel = inferredLevel; 
        }
        finalDialogueStateUpdate.expertiseInferenceTurnCounter = 0;
    } else {
        finalDialogueStateUpdate.expertiseInferenceTurnCounter = expertiseTurnCounter;
    }

    await stateService.updateDialogueState(userId, finalDialogueStateUpdate);

    if (finalHistoryForSaving.length > 0) {
        await stateService.setConversationHistory(userId, finalHistoryForSaving);
    }

    await stateService.setInCache(`resp:${fromPhone!}:${effectiveIncomingText.trim().slice(0, 100)}`, finalText, CACHE_TTL_SECONDS);
    await stateService.incrementUsageCounter(userId);

    logger.info(`${handlerTAG} Tarefa de mensagem de usuário concluída com sucesso.`);
    return NextResponse.json({ success: true, message: "User message processed." }, { status: 200 });
}
