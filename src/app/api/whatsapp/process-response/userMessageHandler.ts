// src/app/api/whatsapp/process-response/userMessageHandler.ts
// Versão: vShortTermMemory_CtxExtract_13_FIXED_WamidHandling (Captura WAMID e melhora tratamento de erro no envio)
// - ATUALIZADO: Captura e loga o WAMID retornado pelo whatsappService.
// - ATUALIZADO: Melhorado o tratamento de erro para chamadas a sendWhatsAppMessage.
// - CORRIGIDO: Adicionada chave de fechamento '}' ausente no final da função handleUserMessage (mantido).
// - Baseado em: vShortTermMemory_CtxExtract_13
import { NextResponse } from 'next/server';
import {
    ChatCompletionMessageParam,
    ChatCompletionUserMessageParam,
    ChatCompletionAssistantMessageParam,
    ChatCompletionSystemMessageParam
} from 'openai/resources/chat/completions';
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService'; // Importa nossa função otimizada
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import type { ILastResponseContext, IDialogueState } from '@/app/lib/stateService';
import * as dataService from '@/app/lib/dataService';
import { IUser, IUserPreferences } from '@/app/models/User';
import {
    determineIntent,
    normalizeText,
    getRandomGreeting,
    IntentResult,
    DeterminedIntent
} from '@/app/lib/intentService';
import { generateConversationSummary, inferUserExpertiseLevel, callOpenAIForQuestion } from '@/app/lib/aiService';
import * as humorKnowledge from '@/app/lib/knowledge/humorScriptWritingKnowledge';
import { ProcessRequestBody, EnrichedAIContext } from './types';
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
    COMPLEX_TASK_INTENTS,
    CONTEXT_EXTRACTION_MODEL,
    CONTEXT_EXTRACTION_TEMP,
    CONTEXT_EXTRACTION_MAX_TOKENS,
    INSTIGATING_QUESTION_MODEL,
    INSTIGATING_QUESTION_TEMP,
    INSTIGATING_QUESTION_MAX_TOKENS
} from '@/app/lib/constants';

const HANDLER_TAG_BASE = '[UserMsgHandler vShortTermMemory_CtxExtract_13_FIXED_WamidHandling]'; // Tag atualizada

/**
 * Extrai o tópico principal e entidades chave da resposta de uma IA.
 * ATUALIZADO: Agora também define se a aiResponseText original era uma pergunta.
 * @param aiResponseText O texto da resposta da IA.
 * @param userId O ID do usuário (para logging).
 * @returns Uma promessa que resolve para ILastResponseContext ou null.
 */
async function extractContextFromAIResponse(
    aiResponseText: string,
    userId: string
): Promise<ILastResponseContext | null> {
    const TAG = `${HANDLER_TAG_BASE}[extractContextFromAIResponse] User ${userId}:`;
    const trimmedResponseText = aiResponseText.trim();
    const wasOriginalResponseAQuestion = trimmedResponseText.endsWith('?');

    if (!trimmedResponseText || trimmedResponseText.length < 10) {
        logger.debug(`${TAG} Resposta da IA muito curta para extração de tópico/entidades, mas registrando se era pergunta.`);
        const shortContext: ILastResponseContext = { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
        logger.debug(`${TAG} Contexto retornado para resposta curta - Timestamp: ${shortContext.timestamp}, WasQuestion: ${shortContext.wasQuestion}`);
        return shortContext;
    }

    const prompt = `
Dada a seguinte resposta de um assistente de IA chamado Tuca, identifique concisamente:
1. O tópico principal da resposta de Tuca (em até 10 palavras).
2. As principais entidades ou termos chave mencionados por Tuca (liste até 3-4 termos).

Resposta de Tuca:
---
${trimmedResponseText.substring(0, 1500)} ${trimmedResponseText.length > 1500 ? "\n[...resposta truncada...]" : ""}
---

Responda SOMENTE em formato JSON com as chaves "topic" (string) e "entities" (array de strings).
Se não for possível determinar um tópico claro ou entidades, retorne um JSON com "topic": null e "entities": [].
JSON:
`;

    try {
        logger.debug(`${TAG} Solicitando extração de tópico/entidades para a resposta da IA...`);
        const modelForExtraction = (typeof CONTEXT_EXTRACTION_MODEL !== 'undefined' ? CONTEXT_EXTRACTION_MODEL : process.env.CONTEXT_EXTRACTION_MODEL) || 'gpt-3.5-turbo';
        const tempForExtraction = (typeof CONTEXT_EXTRACTION_TEMP !== 'undefined' ? CONTEXT_EXTRACTION_TEMP : Number(process.env.CONTEXT_EXTRACTION_TEMP)) ?? 0.2;
        const maxTokensForExtraction = (typeof CONTEXT_EXTRACTION_MAX_TOKENS !== 'undefined' ? CONTEXT_EXTRACTION_MAX_TOKENS : Number(process.env.CONTEXT_EXTRACTION_MAX_TOKENS)) || 100;

        const extractionResultText = await callOpenAIForQuestion(prompt, {
            model: modelForExtraction,
            temperature: tempForExtraction,
            max_tokens: maxTokensForExtraction,
        });

        if (!extractionResultText) {
            logger.warn(`${TAG} Extração de tópico/entidades retornou texto vazio.`);
            const emptyTextContext: ILastResponseContext = { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
            logger.debug(`${TAG} Contexto retornado (texto de extração vazio) - Timestamp: ${emptyTextContext.timestamp}, WasQuestion: ${emptyTextContext.wasQuestion}`);
            return emptyTextContext;
        }

        const jsonMatch = extractionResultText.match(/\{[\s\S]*\}/);
        if (!jsonMatch || !jsonMatch[0]) {
            logger.warn(`${TAG} Nenhum JSON encontrado na resposta da extração de tópico/entidades. Resposta: ${extractionResultText}`);
            const noJsonContext: ILastResponseContext = { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
            logger.debug(`${TAG} Contexto retornado (sem JSON na extração) - Timestamp: ${noJsonContext.timestamp}, WasQuestion: ${noJsonContext.wasQuestion}`);
            return noJsonContext;
        }

        const parsedJson = JSON.parse(jsonMatch[0]);

        const context: ILastResponseContext = {
            topic: (parsedJson && typeof parsedJson.topic === 'string') ? parsedJson.topic.trim() : undefined,
            entities: (parsedJson && Array.isArray(parsedJson.entities)) ? parsedJson.entities.map((e: any) => String(e).trim()).filter((e: string) => e) : [],
            timestamp: Date.now(),
            wasQuestion: wasOriginalResponseAQuestion,
        };

        if (!context.topic && (!context.entities || context.entities.length === 0) && !context.wasQuestion) {
            logger.debug(`${TAG} Extração de contexto não produziu tópico, entidades ou indicativo de pergunta. Retornando null após tentativa de parse.`);
            if (!context.wasQuestion) return null;
        }

        logger.info(`${TAG} Contexto extraído da resposta da IA (FINAL) - Topic: "${context.topic ? context.topic.substring(0,50) + '...' : 'N/A'}", Entities: [${context.entities?.join(', ')}], Timestamp: ${context.timestamp}, WasQuestion: ${context.wasQuestion}`);
        return context;

    } catch (error) {
        logger.error(`${TAG} Erro ao extrair tópico/entidades da resposta da IA:`, error);
        const errorContext: ILastResponseContext = { timestamp: Date.now(), wasQuestion: wasOriginalResponseAQuestion };
        logger.debug(`${TAG} Contexto retornado (erro na extração) - Timestamp: ${errorContext.timestamp}, WasQuestion: ${errorContext.wasQuestion}`);
        return errorContext;
    }
}

/**
 * Gera uma pergunta instigante baseada na resposta da IA e no contexto da conversa.
 */
async function generateInstigatingQuestion(
    aiResponseText: string,
    dialogueState: IDialogueState,
    userId: string
): Promise<string | null> {
    const TAG = `${HANDLER_TAG_BASE}[generateInstigatingQuestion] User ${userId}:`;

    if (!aiResponseText || aiResponseText.trim().length < 15) {
        logger.debug(`${TAG} Resposta da IA muito curta para gerar pergunta instigante.`);
        return null;
    }
    const potentialLastSegment = aiResponseText.includes('\n\n') ? aiResponseText.substring(aiResponseText.lastIndexOf('\n\n') + 2) : aiResponseText;
    if (potentialLastSegment.trim().endsWith('?')) {
        logger.debug(`${TAG} Resposta da IA (ou seu último segmento) já termina com uma pergunta. Pulando geração de pergunta instigante.`);
        return null;
    }

    const lastResponseTopic = dialogueState.lastResponseContext?.topic || 'Não especificado';
    const conversationSummary = dialogueState.conversationSummary || 'Não há resumo ainda.';

    const prompt = `
Você é um assistente especialista em engajamento de usuários e marketing digital, com o objetivo de ajudar o usuário a explorar mais o potencial da IA Tuca.
A IA Tuca acabou de fornecer a seguinte resposta para o usuário:
---
${aiResponseText.substring(0, 1000)} ${aiResponseText.length > 1000 ? "\n[...resposta truncada...]" : ""}
---

Contexto adicional:
- Tópico da última resposta da IA (se houver): "${lastResponseTopic}"
- Resumo da conversa até agora: "${conversationSummary.substring(0, 500)}"

Baseado na resposta de Tuca e no contexto geral, formule UMA pergunta curta (1-2 frases), aberta e instigante (em português brasileiro) que incentive o usuário a:
1. Refletir sobre um aspecto relacionado que ele pode não ter considerado.
2. Explorar um próximo passo lógico ou uma otimização relevante ao que foi discutido.
3. Aprofundar seu entendimento sobre o tópico discutido por Tuca.

A pergunta NÃO deve ser uma simples confirmação ou algo que Tuca possa responder diretamente com 'sim' ou 'não'. Deve genuinamente levar o usuário a pensar e a querer usar o Tuca para investigar mais.
Mesmo que a resposta de Tuca seja breve ou pareça conclusiva (ex: um simples "Entendido." ou um alerta de "nenhum dado novo encontrado"), tente encontrar um aspecto relacionado, um 'e se...', uma sugestão de exploração de dados ou uma forma de o usuário aprender mais sobre o tema geral ou funcionalidades do Tuca.
Evite perguntas que Tuca já tenha feito recentemente ou que sejam muito genéricas.
Se, após um esforço genuíno, a resposta de Tuca for *extremamente* transacional (ex: apenas "Ok.") e não houver *nenhum* gancho minimamente relevante, responda APENAS com a palavra "NO_QUESTION".

Pergunta instigante (ou "NO_QUESTION"):
`;

    try {
        logger.debug(`${TAG} Solicitando geração de pergunta instigante...`);
        const model = (typeof INSTIGATING_QUESTION_MODEL !== 'undefined' ? INSTIGATING_QUESTION_MODEL : process.env.INSTIGATING_QUESTION_MODEL) || 'gpt-3.5-turbo';
        const temperature = (typeof INSTIGATING_QUESTION_TEMP !== 'undefined' ? INSTIGATING_QUESTION_TEMP : Number(process.env.INSTIGATING_QUESTION_TEMP)) ?? 0.7;
        const max_tokens = (typeof INSTIGATING_QUESTION_MAX_TOKENS !== 'undefined' ? INSTIGATING_QUESTION_MAX_TOKENS : Number(process.env.INSTIGATING_QUESTION_MAX_TOKENS)) || 80;

        const questionText = await callOpenAIForQuestion(prompt, {
            model,
            temperature,
            max_tokens,
        });

        if (!questionText || questionText.trim().toUpperCase() === 'NO_QUESTION' || questionText.trim().length < 10) {
            logger.debug(`${TAG} Nenhuma pergunta instigante gerada ou "NO_QUESTION" recebido. Resposta: "${questionText}"`);
            return null;
        }

        logger.info(`${TAG} Pergunta instigante gerada: "${questionText.trim()}"`);
        return questionText.trim();

    } catch (error) {
        logger.error(`${TAG} Erro ao gerar pergunta instigante:`, error);
        return null;
    }
}


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

    let initialDataLoadStartTime: number = 0;
    let updateState1StartTime: number = 0;
    let getDialogueState2StartTime: number = 0;
    let determineIntentStartTimeGlobal: number = 0;
    let updateState2StartTime: number = 0;
    let getDialogueState3StartTime: number = 0;
    let getDSCountersCallStartTimeGlobal: number = 0;
    let getDSInterruptStartTimeGlobal: number = 0;
    let getDSConfirmTaskStartTime: number = 0;
    let getDSClearPendingStartTime: number = 0;
    let getDSClearPending2StartTime: number = 0;
    let getDSFinalSaveStartTime: number = 0;


    try {
        initialDataLoadStartTime = Date.now();
        const [userData, initialDialogueStateResult, historyData] = await Promise.all([
            dataService.lookupUserById(userId),
            stateService.getDialogueState(userId),
            stateService.getConversationHistory(userId)
        ]);
        logger.debug(`${handlerTAG} Carregamento inicial (lookupUserById, getDialogueState, getConversationHistory) levou ${Date.now() - initialDataLoadStartTime}ms.`);

        user = userData;
        dialogueState = initialDialogueStateResult;
        historyMessages = historyData;

        const fullName = user.name || 'criador';
        firstName = fullName.split(' ')[0]!;
        greeting = getRandomGreeting(firstName);

        logger.debug(`${handlerTAG} Dados carregados. Nome: ${firstName}, Histórico: ${historyMessages.length} msgs. Sumário Conv: ${dialogueState.conversationSummary ? '"' + extractExcerpt(dialogueState.conversationSummary, 30) + '"': 'N/A'}`);

        const stateUpdateForProcessingStart: Partial<stateService.IDialogueState> = {
            currentProcessingMessageId: messageId_MsgAtual,
            currentProcessingQueryExcerpt: queryExcerpt_MsgAtual
        };
        if (dialogueState.interruptSignalForMessageId === messageId_MsgAtual) {
            stateUpdateForProcessingStart.interruptSignalForMessageId = null;
        }

        updateState1StartTime = Date.now();
        await stateService.updateDialogueState(userId, stateUpdateForProcessingStart);
        logger.debug(`${handlerTAG} stateService.updateDialogueState (início processamento) levou ${Date.now() - updateState1StartTime}ms.`);

        getDialogueState2StartTime = Date.now();
        dialogueState = await stateService.getDialogueState(userId);
        logger.debug(`${handlerTAG} stateService.getDialogueState (após update início) levou ${Date.now() - getDialogueState2StartTime}ms.`);
        logger.info(`${handlerTAG} Estado de processamento atualizado. currentProcessingMessageId setado para ${messageId_MsgAtual}. QueryExcerpt: "${queryExcerpt_MsgAtual}"`);

    } catch (err) {
        logger.error(`${handlerTAG} Erro ao carregar dados iniciais ou definir estado de processamento:`, err);
        try { 
            const wamid = await sendWhatsAppMessage(fromPhone, "Desculpe, tive um problema ao iniciar o processamento da sua mensagem. Tente novamente em instantes.");
            logger.info(`${handlerTAG} Mensagem de erro (carregamento inicial) enviada. UserMsgID: ${messageId_MsgAtual}, WhatsAppMsgID: ${wamid}`);
        }
        catch (e: any) { 
            logger.error(`${handlerTAG} Falha CRÍTICA ao enviar mensagem de erro (carregamento inicial) para UserMsgID: ${messageId_MsgAtual}:`, e);
        }
        await stateService.updateDialogueState(userId, { currentProcessingMessageId: null, currentProcessingQueryExcerpt: null });
        return NextResponse.json({ error: `Failed to load initial user data or set processing state: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
    }

    const normText = normalizeText(incomingText.trim());
    if (!normText) {
        logger.warn(`${handlerTAG} Mensagem normalizada resultou em texto vazio.`);
        const emptyNormResponse = `${greeting} Não entendi bem o que você disse. Pode repetir, por favor?`;
        try {
            const wamid = await sendWhatsAppMessage(fromPhone, emptyNormResponse);
            logger.info(`${handlerTAG} Mensagem (texto normalizado vazio) enviada. UserMsgID: ${messageId_MsgAtual}, WhatsAppMsgID: ${wamid}`);
        } catch (sendError) {
            logger.error(`${handlerTAG} FALHA AO ENVIAR mensagem (texto normalizado vazio) para UserMsgID: ${messageId_MsgAtual}. Erro:`, sendError);
        }
        await stateService.updateDialogueState(userId, { currentProcessingMessageId: null, currentProcessingQueryExcerpt: null, lastInteraction: Date.now() });
        return NextResponse.json({ success: true, message: "Empty normalized text, user informed." }, { status: 200 });
    }

    let intentResult: IntentResult | undefined = undefined;
    let currentDeterminedIntent: DeterminedIntent | null = intentFromPayload;
    let responseTextForSpecialHandled: string | null = null;
    let pendingActionContextFromIntent: any = null;
    let dialogueStateUpdateForTaskStart: Partial<stateService.IDialogueState> = {};

    determineIntentStartTimeGlobal = Date.now();
    if (!currentDeterminedIntent) {
        logger.warn(`${handlerTAG} 'determinedIntent' não veio no payload. Determinando agora com contexto.`);
        try {
            intentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
            if (intentResult.type === 'special_handled') {
                responseTextForSpecialHandled = intentResult.response;
                if (dialogueState.currentTask) dialogueStateUpdateForTaskStart.currentTask = null;
            } else {
                currentDeterminedIntent = intentResult.intent;
                logger.info(`${handlerTAG} Intenção determinada (com contexto): ${currentDeterminedIntent}`);
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
            } catch (e: any) {
                logger.error(`${handlerTAG} Erro ao tentar obter detalhes da intenção (vinda do payload '${currentDeterminedIntent}'):`, e);
            }
        }
    }
    logger.debug(`${handlerTAG} Bloco determineIntent (global) levou ${Date.now() - determineIntentStartTimeGlobal}ms.`);


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
        updateState2StartTime = Date.now();
        await stateService.updateDialogueState(userId, dialogueStateUpdateForTaskStart);
        logger.debug(`${handlerTAG} stateService.updateDialogueState (task start) levou ${Date.now() - updateState2StartTime}ms.`);

        getDialogueState3StartTime = Date.now();
        dialogueState = await stateService.getDialogueState(userId);
        logger.debug(`${handlerTAG} stateService.getDialogueState (após task start) levou ${Date.now() - getDialogueState3StartTime}ms.`);
    }

    if (responseTextForSpecialHandled) {
        let fullResponseForSpecial = responseTextForSpecialHandled;
        const instigatingQuestionForSpecial = await generateInstigatingQuestion(responseTextForSpecialHandled, dialogueState, userId);
        if (instigatingQuestionForSpecial) {
            fullResponseForSpecial += `\n\n${instigatingQuestionForSpecial}`;
        }
        
        try {
            const wamid = await sendWhatsAppMessage(fromPhone, fullResponseForSpecial);
            logger.info(`${handlerTAG} Mensagem (intenção especial) enviada. UserMsgID: ${messageId_MsgAtual}, WhatsAppMsgID: ${wamid}, Preview: "${fullResponseForSpecial.substring(0,50)}..."`);
        } catch (sendError) {
            logger.error(`${handlerTAG} FALHA AO ENVIAR mensagem (intenção especial) para UserMsgID: ${messageId_MsgAtual}. Erro:`, sendError);
        }

        const userMsgHist: ChatCompletionUserMessageParam = { role: 'user', content: incomingText! };
        const assistantMsgHist: ChatCompletionAssistantMessageParam = { role: 'assistant', content: fullResponseForSpecial };
        const updatedHistory = [...historyMessages, userMsgHist, assistantMsgHist].slice(-HISTORY_LIMIT);
        await stateService.setConversationHistory(userId, updatedHistory);

        const stateUpdateAfterSpecial: Partial<stateService.IDialogueState> = {
            lastInteraction: Date.now(),
            currentProcessingMessageId: null,
            currentProcessingQueryExcerpt: null,
        };

        getDSCountersCallStartTimeGlobal = Date.now();
        const currentDSForCounters = await stateService.getDialogueState(userId);
        logger.debug(`${handlerTAG} stateService.getDialogueState (para contadores) levou ${Date.now() - getDSCountersCallStartTimeGlobal}ms.`);

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

        const extractedContextForSpecial = await extractContextFromAIResponse(fullResponseForSpecial, userId);
        stateUpdateAfterSpecial.lastResponseContext = extractedContextForSpecial;

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
                try {
                    const wamid = await sendWhatsAppMessage(fromPhone!, dynamicAckMessage);
                    logger.info(`${handlerTAG} Quebra-gelo dinâmico enviado. UserMsgID: ${messageId_MsgAtual}, WhatsAppMsgID: ${wamid}`);
                    historyMessages.push({ role: 'assistant', content: dynamicAckMessage } as ChatCompletionAssistantMessageParam);
                    if (historyMessages.length > HISTORY_LIMIT) historyMessages.shift();
                } catch (sendAckError) {
                    logger.error(`${handlerTAG} FALHA AO ENVIAR quebra-gelo dinâmico para UserMsgID: ${messageId_MsgAtual}. Erro:`, sendAckError);
                }
            }
        } catch (ackError) {
            logger.error(`${handlerTAG} Falha ao gerar quebra-gelo dinâmico:`, ackError);
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

    getDSInterruptStartTimeGlobal = Date.now();
    const freshDialogueStateForInterrupt = await stateService.getDialogueState(userId);
    logger.debug(`${handlerTAG} stateService.getDialogueState (para interrupção) levou ${Date.now() - getDSInterruptStartTimeGlobal}ms.`);

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
            lastResponseContext: null,
        });
        logger.info(`${handlerTAG} Estado limpo após interrupção de MsgID: ${messageId_MsgAtual}.`);
        return NextResponse.json({ success: true, message: 'Processing interrupted by newer user message after acknowledgement phase.' }, { status: 200 });
    }
    logger.debug(`${handlerTAG} Sem sinal de interrupção. Prosseguindo para resposta principal da LLM.`);

    let effectiveIncomingText = incomingText!;
    let effectiveIntent = currentDeterminedIntent as DeterminedIntent;

    let currentTurnHistory: ChatCompletionMessageParam[] = [...historyMessages];
    currentTurnHistory.push({ role: 'user', content: effectiveIncomingText } as ChatCompletionUserMessageParam);

    const systemMessagesForContext: ChatCompletionSystemMessageParam[] = [];
    if (effectiveIntent === 'EXPLAIN_DATA_SOURCE_FOR_ANALYSIS') {
        systemMessagesForContext.push({
            role: 'system',
            content: `O usuário está perguntando sobre a origem dos dados ou a base de uma análise que você forneceu anteriormente. Consulte o histórico da conversa (especialmente o resumo e as últimas mensagens, e o contexto da última resposta: ${dialogueState.lastResponseContext?.topic || 'N/A'}) para identificar a análise relevante e explique como você chegou à conclusão ou quais dados foram usados. Seja claro e direto.`
        });
        logger.info(`${handlerTAG} Adicionada mensagem de sistema para intenção EXPLAIN_DATA_SOURCE_FOR_ANALYSIS.`);
    } else if (effectiveIntent === 'REQUEST_METRIC_DETAILS_FROM_CONTEXT') {
        systemMessagesForContext.push({
            role: 'system',
            content: `O usuário está pedindo mais detalhes ou os números específicos relacionados a uma métrica ou análise que foi discutida recentemente. Revise o contexto da conversa (resumo, últimas mensagens, e contexto da última resposta: ${dialogueState.lastResponseContext?.topic || 'N/A'}) para entender a que ele se refere e forneça os detalhes solicitados de forma precisa.`
        });
        logger.info(`${handlerTAG} Adicionada mensagem de sistema para intenção REQUEST_METRIC_DETAILS_FROM_CONTEXT.`);
    } else if (effectiveIntent === 'ASK_CLARIFICATION_PREVIOUS_RESPONSE') {
        systemMessagesForContext.push({
            role: 'system',
            content: `O usuário está pedindo um esclarecimento sobre sua última resposta ou uma informação que você forneceu (Contexto da última resposta: ${dialogueState.lastResponseContext?.topic || 'N/A'}). Releia sua última mensagem no histórico e a pergunta do usuário para entender a dúvida. Responda de forma clara e didática, elaborando sobre o ponto que não ficou claro ou fornecendo mais detalhes.`
        });
        logger.info(`${handlerTAG} Adicionada mensagem de sistema para intenção ASK_CLARIFICATION_PREVIOUS_RESPONSE.`);
    } else if (effectiveIntent === 'CONTINUE_PREVIOUS_TOPIC') {
         systemMessagesForContext.push({
            role: 'system',
            content: `O usuário indicou que deseja continuar ou aprofundar um tópico discutido recentemente (Contexto da última resposta: ${dialogueState.lastResponseContext?.topic || 'N/A'}). Revise o histórico da conversa, especialmente o resumo e suas últimas interações, para identificar este tópico. Prossiga a discussão fornecendo mais informações, fazendo perguntas relevantes para dar seguimento, ou explorando aspectos relacionados.`
        });
        logger.info(`${handlerTAG} Adicionada mensagem de sistema para intenção CONTINUE_PREVIOUS_TOPIC.`);
    }

    if (systemMessagesForContext.length > 0) {
        currentTurnHistory = [...systemMessagesForContext, ...currentTurnHistory];
    }

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
            currentTurnHistory.push({ role: 'system', content: humorDirectives } as ChatCompletionSystemMessageParam);
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
                getDSConfirmTaskStartTime = Date.now();
                dialogueState = await stateService.getDialogueState(userId);
                logger.debug(`${handlerTAG} stateService.getDialogueState (após confirm task) levou ${Date.now() - getDSConfirmTaskStartTime}ms.`);
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
            if(lastUserMessage) {
                lastUserMessage.content = effectiveIncomingText;
            }
        }
        await stateService.clearPendingActionState(userId);
        getDSClearPendingStartTime = Date.now();
        dialogueState = await stateService.getDialogueState(userId);
        logger.debug(`${handlerTAG} stateService.getDialogueState (após clear pending) levou ${Date.now() - getDSClearPendingStartTime}ms.`);
    } else if (currentDeterminedIntent === 'user_denies_pending_action') {
        const denialResponse = pickRandom(["Entendido. Como posso te ajudar então?", "Ok. O que você gostaria de fazer a seguir?", "Sem problemas. Em que mais posso ser útil?"]);

        let finalDenialResponse = denialResponse;
        const instigatingQuestionForDenial = await generateInstigatingQuestion(denialResponse, dialogueState, userId);
        if (instigatingQuestionForDenial) {
            finalDenialResponse += `\n\n${instigatingQuestionForDenial}`;
        }
        
        try {
            const wamid = await sendWhatsAppMessage(fromPhone!, finalDenialResponse);
            logger.info(`${handlerTAG} Mensagem (negação de ação pendente) enviada. UserMsgID: ${messageId_MsgAtual}, WhatsAppMsgID: ${wamid}`);
        } catch (sendError) {
            logger.error(`${handlerTAG} FALHA AO ENVIAR mensagem (negação de ação pendente) para UserMsgID: ${messageId_MsgAtual}. Erro:`, sendError);
        }

        const userDenialMsgHist: ChatCompletionUserMessageParam = { role: 'user', content: incomingText! };
        const assistantDenialResponseHist: ChatCompletionAssistantMessageParam = { role: 'assistant', content: finalDenialResponse };
        const updatedHistoryDeny = [...currentTurnHistory.slice(0,-1), userDenialMsgHist, assistantDenialResponseHist].slice(-HISTORY_LIMIT);

        await stateService.setConversationHistory(userId, updatedHistoryDeny);

        const extractedContextForDenial = await extractContextFromAIResponse(finalDenialResponse, userId);

        await stateService.updateDialogueState(userId, {
            lastInteraction: Date.now(),
            currentProcessingMessageId: null, currentProcessingQueryExcerpt: null,
            lastAIQuestionType: undefined, pendingActionContext: undefined,
            lastResponseContext: extractedContextForDenial,
        });
        return NextResponse.json({ success: true, message: "User denied pending action." }, { status: 200 });
    } else if (dialogueState.lastAIQuestionType) {
        logger.info(`${handlerTAG} Havia uma pergunta pendente ('${dialogueState.lastAIQuestionType}'), mas o usuário respondeu com outra intenção ('${currentDeterminedIntent}'). Limpando estado pendente.`);
        await stateService.clearPendingActionState(userId);
        getDSClearPending2StartTime = Date.now();
        dialogueState = await stateService.getDialogueState(userId);
        logger.debug(`${handlerTAG} stateService.getDialogueState (após clear pending 2) levou ${Date.now() - getDSClearPending2StartTime}ms.`);
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
            let value: string | undefined; let done: boolean | undefined;
            try {
                const result = await reader.read();
                if (streamReadTimeoutLLM === null && !result.done) {
                    logger.warn(`${handlerTAG} Leitura da stream LLM continuou após timeout ter sido marcado como null. Interrompendo.`);
                    break;
                }
                const chunk: any = result.value;
                if (typeof chunk === 'string') {
                    value = chunk;
                } else if (chunk instanceof Uint8Array) {
                    value = new TextDecoder().decode(chunk);
                } else if (chunk !== undefined) {
                    logger.warn(`${handlerTAG} Stream da LLM retornou chunk de tipo inesperado: ${typeof chunk}`);
                    value = '';
                } else {
                    value = '';
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
            if (typeof value === 'string') finalText += value;
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

    const instigatingQuestion = await generateInstigatingQuestion(finalText, dialogueState, userId);
    let fullResponseToUser = finalText;
    if (instigatingQuestion) {
        fullResponseToUser += `\n\n${instigatingQuestion}`;
    }

    try {
        const wamid = await sendWhatsAppMessage(fromPhone!, fullResponseToUser);
        logger.info(`${handlerTAG} Resposta principal enviada. UserMsgID: ${messageId_MsgAtual}, WhatsAppMsgID: ${wamid}, Preview: "${fullResponseToUser.substring(0,100)}..."`);
    } catch (sendError: any) { // Captura erros do sendWhatsAppMessage (que já tentou retentativas)
        logger.error(`${handlerTAG} FALHA CRÍTICA AO ENVIAR resposta principal para UserMsgID: ${messageId_MsgAtual}. Erro: ${sendError.message}`, sendError);
        // Atualizar o estado para refletir a falha no envio, se apropriado.
        // Não há como notificar o usuário pelo mesmo canal se o envio falhou.
        // O erro não será relançado para o QStash aqui, para evitar loops se o problema for persistente com o número/API.
        // A falha será logada e a tarefa do QStash concluirá.
        await stateService.updateDialogueState(userId, { 
            lastResponseError: `send_failed: ${sendError.message.substring(0, 200)}`, // Limita o tamanho da msg de erro
        }).catch(stateErr => logger.error(`${handlerTAG} Falha ao atualizar estado após erro de envio:`, stateErr));
    }
    
    const extractedAIContext = await extractContextFromAIResponse(fullResponseToUser, userId);

    let finalDialogueStateUpdate: Partial<stateService.IDialogueState> = {
        lastInteraction: Date.now(),
        lastResponseContext: extractedAIContext,
    };

    const intentsToAvoidPendingActionSuggestion = [
        'social_query',
        'meta_query_personal',
        'user_confirms_pending_action',
        'user_denies_pending_action'
    ];
    if (fullResponseToUser && !intentsToAvoidPendingActionSuggestion.includes(effectiveIntent)) {
        const pendingActionInfo = aiResponseSuggestsPendingAction(fullResponseToUser);
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

    getDSFinalSaveStartTime = Date.now();
    const finalDialogueStateBeforeSave = await stateService.getDialogueState(userId);
    logger.debug(`${handlerTAG} stateService.getDialogueState (antes do save final) levou ${Date.now() - getDSFinalSaveStartTime}ms.`);

    if (finalDialogueStateBeforeSave.currentProcessingMessageId === messageId_MsgAtual) {
        finalDialogueStateUpdate.currentProcessingMessageId = null;
        finalDialogueStateUpdate.currentProcessingQueryExcerpt = null;
        logger.info(`${handlerTAG} Limpando currentProcessingMessageId e excerpt após processamento normal.`);
    } else {
        logger.warn(`${handlerTAG} currentProcessingMessageId no Redis (${finalDialogueStateBeforeSave.currentProcessingMessageId}) não corresponde ao ID desta tarefa (${messageId_MsgAtual}). Não limpando automaticamente aqui.`);
    }

    let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
    const userMessageForHistory: ChatCompletionUserMessageParam = { role: 'user', content: effectiveIncomingText };
    const assistantMessageForHistory: ChatCompletionAssistantMessageParam = { role: 'assistant', content: fullResponseToUser };

    if (historyPromise) {
        try {
            finalHistoryForSaving = await historyPromise;
            if (finalHistoryForSaving.length > 0 && finalHistoryForSaving[finalHistoryForSaving.length - 1]?.role === 'assistant') {
                finalHistoryForSaving[finalHistoryForSaving.length - 1]!.content = fullResponseToUser;
            } else {
                 finalHistoryForSaving.push(assistantMessageForHistory);
            }

            const lastUserMsgIdx = finalHistoryForSaving.map(m => m.role).lastIndexOf('user');
            const lastUserMessageInPromise = lastUserMsgIdx !== -1 ? finalHistoryForSaving[lastUserMsgIdx] : undefined;
            if (lastUserMessageInPromise && lastUserMessageInPromise.content !== effectiveIncomingText) {
                (lastUserMessageInPromise as ChatCompletionUserMessageParam).content = effectiveIncomingText;
            }
            finalHistoryForSaving = finalHistoryForSaving.slice(-HISTORY_LIMIT);

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
    const lastUserMessageToAdjust = lastUserMessageIndexInFinalHistory !== -1 ? finalHistoryForSaving[lastUserMessageIndexInFinalHistory] : undefined;
    if (lastUserMessageToAdjust && lastUserMessageToAdjust.content !== effectiveIncomingText) {
        logger.warn(`${handlerTAG} Ajustando a última mensagem do usuário no histórico final para corresponder a effectiveIncomingText (segunda checagem).`);
        if (lastUserMessageToAdjust.role === 'user') {
             (lastUserMessageToAdjust as ChatCompletionUserMessageParam).content = effectiveIncomingText;
        }
    }
    const lastAssistantMessageIndexInFinalHistory = finalHistoryForSaving.map(m => m.role).lastIndexOf('assistant');
    const lastAssistantMessageToAdjust = lastAssistantMessageIndexInFinalHistory !== -1 ? finalHistoryForSaving[lastAssistantMessageIndexInFinalHistory] : undefined;
    if (lastAssistantMessageToAdjust && lastAssistantMessageToAdjust.content !== fullResponseToUser) {
        logger.warn(`${handlerTAG} Ajustando a última mensagem do assistente no histórico final para corresponder a fullResponseToUser.`);
        if (lastAssistantMessageToAdjust.role === 'assistant') {
             (lastAssistantMessageToAdjust as ChatCompletionAssistantMessageParam).content = fullResponseToUser;
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

    await stateService.setInCache(`resp:${fromPhone!}:${effectiveIncomingText.trim().slice(0, 100)}`, fullResponseToUser, CACHE_TTL_SECONDS);
    await stateService.incrementUsageCounter(userId);

    logger.info(`${handlerTAG} Tarefa de mensagem de usuário concluída com sucesso.`);
    return NextResponse.json({ success: true, message: "User message processed." }, { status: 200 });
}
