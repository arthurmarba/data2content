// src/app/api/whatsapp/process-response/route.ts
// v2.4.0 - Aprimora gerenciamento de estado para ações pendentes e confirmações

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService'; // Agora importa o stateService.ts atualizado
import * as dataService from '@/app/lib/dataService';
import { IUser } from '@/app/models/User';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
    determineIntent,
    normalizeText,
    getRandomGreeting,
    IntentResult,
    DeterminedIntent
} from '@/app/lib/intentService'; // Caminho já corrigido

export const runtime = 'nodejs';

interface ProcessRequestBody {
  fromPhone?: string;
  incomingText?: string;
  userId: string;
  taskType?: string;
}

const PROCESSING_MESSAGE_DELAY_MS = 1800;
const pickRandom = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error('pickRandom: array vazio');
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error('pickRandom: item indefinido');
  return item;
};
const GET_PROCESSING_MESSAGES_POOL = (userName: string): string[] => [
    `Ok, ${userName}! Recebi seu pedido. 👍 Estou verificando e já te respondo...`,
    `Entendido, ${userName}! Um momento enquanto preparo sua resposta... ⏳`,
    `Certo, ${userName}! Consultando o Tuca para você... 🧠`,
    `Aguarde um instante, ${userName}, estou processando sua solicitação...`,
    `Só um pouquinho, ${userName}, já estou vendo isso para você!`,
];

const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10;
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const DAILY_PLAN_TIMEOUT_MS = 30000;
const DAILY_PLAN_MAX_TOKENS = 350;

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
let receiver: Receiver | null = null;
if (currentSigningKey && nextSigningKey) {
    receiver = new Receiver({ currentSigningKey, nextSigningKey });
} else {
    logger.error("[QStash Worker Init] Chaves de assinatura QStash não definidas.");
}

// --- ADICIONADO: Helper para determinar se a resposta da IA sugere uma ação pendente ---
// Esta é uma heurística e pode precisar de refinamento.
function aiResponseSuggestsPendingAction(responseText: string): { suggests: boolean; actionType?: stateService.IDialogueState['lastAIQuestionType']; pendingActionContext?: stateService.IDialogueState['pendingActionContext'] } {
    const lowerResponse = responseText.toLowerCase();
    // Exemplos de frases que o Tuca poderia usar ao sugerir uma ação que requer confirmação
    if (lowerResponse.includes("o que acha?") ||
        lowerResponse.includes("quer que eu verifique?") ||
        lowerResponse.includes("posso buscar esses dados?") ||
        lowerResponse.includes("gostaria de prosseguir com isso?") ||
        lowerResponse.includes("se quiser, posso tentar") ||
        (lowerResponse.includes("posso ") && lowerResponse.endsWith("?"))) {

        // Tenta inferir o tipo de ação com base em keywords na resposta do Tuca
        if (lowerResponse.includes("dia da semana") || lowerResponse.includes("melhores dias") || lowerResponse.includes("desempenho por dia")) {
            return { suggests: true, actionType: 'confirm_fetch_day_stats', pendingActionContext: { originalSuggestion: responseText.slice(0, 150) } };
        }
        // Adicionar outras lógicas para diferentes tipos de ações que o Tuca pode sugerir
        // Por enquanto, um genérico para outras confirmações
        return { suggests: true, actionType: 'confirm_another_action', pendingActionContext: { originalSuggestion: responseText.slice(0, 150) } };
    }
    return { suggests: false };
}
// --- FIM ADIÇÃO ---


export async function POST(request: NextRequest): Promise<NextResponse> {
  const TAG = '[QStash Worker /process-response v2.4.0]'; // ATUALIZADO: Versão

  if (!receiver) {
      logger.error(`${TAG} QStash Receiver não inicializado.`);
      return NextResponse.json({ error: 'QStash Receiver not configured' }, { status: 500 });
  }

  let bodyText: string;
  let payload: ProcessRequestBody;

  try {
    bodyText = await request.text();
    const signature = request.headers.get('upstash-signature');
    if (!signature) { return NextResponse.json({ error: 'Missing signature header' }, { status: 401 }); }
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) { return NextResponse.json({ error: 'Invalid signature' }, { status: 401 }); }
    logger.info(`${TAG} Assinatura QStash verificada.`);

    try {
      payload = JSON.parse(bodyText);
      if (!payload.userId) { throw new Error('Payload inválido: userId ausente.'); }
    } catch (e) { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const { userId, taskType, incomingText, fromPhone } = payload;

    if (taskType === "daily_tip") {
        const planTAG = `${TAG}[DailyPlan]`;
        logger.info(`${planTAG} Iniciando tarefa de roteiro diário para User ${userId}...`);
        let userForTip: IUser;
        let userPhoneForTip: string | null | undefined;
        let planText: string = "Não foi possível gerar seu roteiro de stories hoje. Tente pedir uma sugestão diretamente!";
        try {
            userForTip = await dataService.lookupUserById(userId);
            userPhoneForTip = userForTip.whatsappPhone;
            if (!userPhoneForTip || !userForTip.whatsappVerified) { logger.warn(`${planTAG} Usuário ${userId} não tem WhatsApp válido/verificado.`); return NextResponse.json({ success: true, message: "User has no verified WhatsApp number." }, { status: 200 }); }
            const userGoal = (userForTip as any).goal || 'aumentar o engajamento';
            const latestReport = await dataService.getLatestAggregatedReport(userId);
            const bestProposal = latestReport?.proposalStats?.[0]?._id?.proposal || 'Não identificada';
            const bestContext = latestReport?.contextStats?.[0]?._id?.context || 'Não identificado';
            const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
            const promptForDailyTip = `Como consultor de Instagram Tuca, crie um plano de stories conciso e prático para ${userForTip.name || 'o usuário'} postar hoje, ${today}. O objetivo principal é ${userGoal}.\n\nBaseie-se nestas métricas recentes (se disponíveis):\n${JSON.stringify(latestReport?.overallStats || { info: "Sem dados gerais recentes." }, null, 2)}\nProposta com melhor performance recente: ${bestProposal}\nContexto com melhor performance recente: ${bestContext}\n\nEstruture o plano em 3 momentos (Manhã ☀️, Tarde ☕, Noite 🌙) com 1 sugestão específica e criativa para cada. Para cada sugestão, explique brevemente o *porquê* (ligado às métricas, objetivo ou boas práticas de engajamento). Use emojis e um tom motivador. Seja direto ao ponto.`;
            const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
            const completion = await openaiClient.chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: "system", content: promptForDailyTip }], temperature: 0.7, max_tokens: DAILY_PLAN_MAX_TOKENS, }, { timeout: DAILY_PLAN_TIMEOUT_MS });
            const generatedPlan = completion.choices[0]?.message?.content?.trim();
            if (generatedPlan) { planText = `Bom dia, ${userForTip.name || 'tudo certo'}! ✨\n\nCom base nas suas métricas e objetivo (${userGoal}), aqui está um roteiro de stories sugerido para hoje (${today}):\n\n${generatedPlan}\n\nLembre-se de adaptar ao seu estilo! 😉`; }
            else { logger.warn(`${planTAG} IA não retornou conteúdo para o roteiro do User ${userId}.`); }
            await sendWhatsAppMessage(userPhoneForTip, planText);
            return NextResponse.json({ success: true }, { status: 200 });
        } catch (error) {
            logger.error(`${planTAG} Erro ao processar roteiro diário para User ${userId}:`, error);
            if (userPhoneForTip) { try { await sendWhatsAppMessage(userPhoneForTip, "Desculpe, não consegui gerar seu roteiro de stories hoje devido a um erro interno."); } catch (e) {} }
            return NextResponse.json({ error: `Failed to process daily story plan: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
        }

    } else {
        // --- Processar Mensagem Normal do Utilizador ---
        const msgTAG = `${TAG}[UserMsg v2.4.0]`; // ATUALIZADO: Versão
        logger.info(`${msgTAG} Processando mensagem normal para User ${userId}...`);

        if (!fromPhone || !incomingText) { return NextResponse.json({ error: 'Invalid payload for user message' }, { status: 400 }); }

        let user: IUser;
        let dialogueState: stateService.IDialogueState = {}; // Usa a interface IDialogueState importada
        let historyMessages: ChatCompletionMessageParam[] = [];
        let userName: string;
        let greeting: string;

        try {
            const [userData, stateData, historyData] = await Promise.all([
                dataService.lookupUserById(userId),
                stateService.getDialogueState(userId), // Carrega o estado do diálogo
                stateService.getConversationHistory(userId)
            ]);
            user = userData;
            dialogueState = stateData; // dialogueState é carregado aqui
            historyMessages = historyData;
            userName = user.name || 'criador';
            greeting = getRandomGreeting(userName);
            logger.debug(`${msgTAG} Dados carregados para User: ${userId}. Histórico com ${historyMessages.length} msgs. Estado: ${JSON.stringify(dialogueState)}`);
        } catch (err) { 
            logger.error(`${msgTAG} Erro ao carregar dados iniciais para User ${userId}:`, err);
            try { await sendWhatsAppMessage(fromPhone, "Desculpe, tive um problema ao carregar seus dados. Tente novamente em instantes."); } catch (e) {}
            return NextResponse.json({ error: `Failed to load initial user data: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
        }
        
        const normText = normalizeText(incomingText.trim());
        if (!normText) {
            logger.warn(`${msgTAG} Mensagem normalizada vazia.`);
            const emptyNormResponse = `${greeting} Pode repetir, por favor? Não entendi bem.`;
            await sendWhatsAppMessage(fromPhone, emptyNormResponse);
            return NextResponse.json({ success: true, message: "Empty normalized text" }, { status: 200 });
        }

        let intentResult: IntentResult;
        let currentDeterminedIntent: DeterminedIntent | null = null;
        let responseTextForSpecialHandled: string | null = null;
        let pendingActionContextFromIntent: any = null;

        try {
            // Passa o dialogueState atual para determineIntent
            intentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
            
            if (intentResult.type === 'special_handled') {
                responseTextForSpecialHandled = intentResult.response;
            } else { // type === 'intent_determined'
                currentDeterminedIntent = intentResult.intent;
                // Se a intenção for de confirmação/negação, pegamos o contexto associado
                if (intentResult.intent === 'user_confirms_pending_action' || intentResult.intent === 'user_denies_pending_action') {
                    pendingActionContextFromIntent = intentResult.pendingActionContext;
                }
            }
            logger.info(`${msgTAG} Resultado da intenção: ${JSON.stringify(intentResult)}`);
        } catch (intentError) {
            logger.error(`${msgTAG} Erro ao determinar intenção:`, intentError);
            currentDeterminedIntent = 'general'; // Default em caso de erro
        }

        // --- ATUALIZADO: Lógica de tratamento de intenção ---
        if (responseTextForSpecialHandled) {
            logger.info(`${msgTAG} Enviando resposta special_handled: "${responseTextForSpecialHandled.slice(0,50)}..."`);
            await sendWhatsAppMessage(fromPhone, responseTextForSpecialHandled);
            
            const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: incomingText };
            const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: responseTextForSpecialHandled };
            const updatedHistory = [...historyMessages, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
            
            await stateService.setConversationHistory(userId, updatedHistory);
            // Limpa qualquer ação pendente, pois esta interação foi resolvida diretamente
            await stateService.clearPendingActionState(userId);
            await stateService.updateDialogueState(userId, { lastInteraction: Date.now() }); // Apenas atualiza lastInteraction

            return NextResponse.json({ success: true }, { status: 200 });
        }

        let effectiveIncomingText = incomingText; 
        let effectiveIntent = currentDeterminedIntent as DeterminedIntent; 

        if (currentDeterminedIntent === 'user_confirms_pending_action') {
            logger.info(`${msgTAG} Usuário confirmou ação pendente. Contexto original: ${JSON.stringify(pendingActionContextFromIntent)}`);
            // Lógica para transformar a confirmação em uma nova "pergunta" para a IA
            // Esta é uma parte crucial e pode precisar de mais refinamento baseado nos tipos de pendingActionContext
            if (dialogueState.lastAIQuestionType === 'confirm_fetch_day_stats' && pendingActionContextFromIntent?.originalUserQuery) {
                effectiveIncomingText = `Sim, por favor, quero saber sobre ${pendingActionContextFromIntent.originalUserQuery}. Mostre-me o desempenho por dia da semana.`;
                effectiveIntent = 'ASK_BEST_TIME'; // Ou a intenção que realmente busca esses dados
            } else if (pendingActionContextFromIntent?.originalSuggestion) {
                 effectiveIncomingText = `Sim, pode prosseguir com: "${pendingActionContextFromIntent.originalSuggestion}"`;
                 effectiveIntent = 'general'; // Deixa a IA reinterpretar no contexto da sugestão confirmada
            } else {
                effectiveIncomingText = "Sim, por favor, prossiga.";
                effectiveIntent = 'general'; // Genérico, a IA usará o histórico para entender
            }
            logger.info(`${msgTAG} Texto efetivo para IA após confirmação: "${effectiveIncomingText.slice(0,50)}...", Intenção efetiva: ${effectiveIntent}`);
            await stateService.clearPendingActionState(userId); // Limpa o estado após tratar a confirmação
        } else if (currentDeterminedIntent === 'user_denies_pending_action') {
            logger.info(`${msgTAG} Usuário negou ação pendente.`);
            await stateService.clearPendingActionState(userId);
            const denialResponse = pickRandom(["Entendido. Como posso te ajudar então?", "Ok. O que você gostaria de fazer a seguir?", "Sem problemas. Em que mais posso ser útil hoje?"]);
            await sendWhatsAppMessage(fromPhone, denialResponse);
            
            const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: incomingText };
            const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: denialResponse };
            const updatedHistory = [...historyMessages, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
            await stateService.setConversationHistory(userId, updatedHistory);
            await stateService.updateDialogueState(userId, { lastInteraction: Date.now() });

            return NextResponse.json({ success: true }, { status: 200 });
        } else if (dialogueState.lastAIQuestionType) {
            // Se havia uma ação pendente mas o usuário não confirmou/negou diretamente (mudou de assunto),
            // limpamos o estado da ação pendente.
            logger.info(`${msgTAG} Usuário não respondeu diretamente à ação pendente (${dialogueState.lastAIQuestionType}). Limpando estado pendente.`);
            await stateService.clearPendingActionState(userId);
            // A `effectiveIntent` e `effectiveIncomingText` já são as da nova pergunta do usuário.
        }
        // --- FIM ATUALIZAÇÃO ---

        const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
        // Recarrega o estado do diálogo caso tenha sido modificado (ex: por clearPendingActionState)
        const currentDialogueState = await stateService.getDialogueState(userId);
        const enrichedContext = { user, historyMessages: limitedHistoryMessages, dialogueState: currentDialogueState };

        const isLightweightQuery = effectiveIntent === 'social_query' || effectiveIntent === 'meta_query_personal';
        let processingMessageTimer: NodeJS.Timeout | null = null;
        let processingMessageHasBeenSent = false;

        if (!isLightweightQuery) {
            processingMessageTimer = setTimeout(async () => {
                if (processingMessageTimer && !processingMessageHasBeenSent) {
                    try {
                        const message = pickRandom(GET_PROCESSING_MESSAGES_POOL(userName));
                        logger.debug(`${msgTAG} Enviando mensagem de processamento (intenção: ${effectiveIntent}) após ${PROCESSING_MESSAGE_DELAY_MS}ms.`);
                        await sendWhatsAppMessage(fromPhone, message);
                        processingMessageHasBeenSent = true;
                    } catch (sendError) { logger.error(`${msgTAG} Falha ao enviar mensagem de processamento condicional:`, sendError); }
                }
                processingMessageTimer = null;
            }, PROCESSING_MESSAGE_DELAY_MS);
        } else {
            logger.debug(`${msgTAG} Pulando mensagem de processamento para intenção leve: ${effectiveIntent}`);
        }

        let finalText = '';
        let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
        let reader: ReadableStreamDefaultReader<string> | null = null;
        let streamTimeout: NodeJS.Timeout | null = null;

        try {
            logger.debug(`${msgTAG} Chamando askLLMWithEnrichedContext com texto efetivo: "${effectiveIncomingText.slice(0,50)}...", intenção efetiva: ${effectiveIntent}`);
            const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(
                enrichedContext,
                effectiveIncomingText,
                effectiveIntent
            );
            historyPromise = hp;

            if (processingMessageTimer) {
                logger.debug(`${msgTAG} Resposta da IA recebida, cancelando timer da mensagem de processamento.`);
                clearTimeout(processingMessageTimer);
                processingMessageTimer = null;
            }
            
            reader = stream.getReader();
            streamTimeout = setTimeout(() => { logger.warn(`${msgTAG} Timeout stream read...`); streamTimeout = null; reader?.cancel().catch(()=>{/*ignore*/}); }, STREAM_READ_TIMEOUT_MS);
            while (true) {
                 let value: string | undefined; let done: boolean | undefined;
                 try { const result = await reader.read(); if (streamTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
                 catch (readError: any) { logger.error(`${msgTAG} Erro reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro stream read: ${readError.message}`); }
                 if (done) { break; } if (typeof value === 'string') { finalText += value; } else { logger.warn(`${msgTAG} 'value' undefined mas 'done' false.`); }
            }
            if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }

            logger.debug(`${msgTAG} Texto final montado para User ${userId}: ${finalText.length} chars.`);
            if (finalText.trim().length === 0) { finalText = 'Hum... não consegui gerar uma resposta completa agora.'; }

        } catch (err: any) {
            logger.error(`${msgTAG} Erro durante chamada/leitura LLM:`, err);
            if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
            if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; }
            finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
        } finally {
            if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${msgTAG} Erro releaseLock:`, e); } }
            if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
            if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; }
        }

        // --- ATUALIZADO: Lógica para definir/limpar estado de ação pendente após resposta da IA ---
        if (finalText && !isLightweightQuery && effectiveIntent !== 'user_confirms_pending_action' && effectiveIntent !== 'user_denies_pending_action') {
            const pendingActionInfo = aiResponseSuggestsPendingAction(finalText);
            if (pendingActionInfo.suggests && pendingActionInfo.actionType) {
                logger.info(`${msgTAG} Resposta da IA sugere uma nova ação pendente: ${pendingActionInfo.actionType}. Contexto: ${JSON.stringify(pendingActionInfo.pendingActionContext)}`);
                // Atualiza o estado do diálogo com a nova pergunta pendente da IA
                await stateService.updateDialogueState(userId, {
                    lastAIQuestionType: pendingActionInfo.actionType,
                    pendingActionContext: pendingActionInfo.pendingActionContext
                });
            } else {
                // Se a IA não sugeriu uma nova ação pendente, e não estávamos já tratando uma confirmação/negação,
                // é seguro limpar qualquer estado de ação pendente que possa ter ficado.
                await stateService.clearPendingActionState(userId);
            }
        } else if (isLightweightQuery || effectiveIntent === 'user_confirms_pending_action' || effectiveIntent === 'user_denies_pending_action') {
            // Para queries leves ou após uma confirmação/negação já tratada, sempre limpamos o estado pendente
            // (já foi feito para confirmação/negação, mas é uma boa garantia aqui também).
            await stateService.clearPendingActionState(userId);
        }
        // --- FIM ATUALIZAÇÃO ---

        await sendWhatsAppMessage(fromPhone, finalText);
        logger.info(`${msgTAG} Resposta final enviada com sucesso para ${fromPhone}.`);
        
        let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
        try {
             logger.debug(`${msgTAG} Iniciando persistência no Redis para User ${userId}...`);
             // O nextState para lastInteraction será atualizado aqui, incluindo o estado potencialmente modificado pela IA
             const finalDialogueStateForSave = await stateService.getDialogueState(userId);
             const nextStateToSave = { ...finalDialogueStateForSave, lastInteraction: Date.now() };
             
             const cacheKeyForPersistence = `resp:${fromPhone}:${effectiveIncomingText.trim().slice(0, 100)}`; 

             if (historyPromise) {
                 try { 
                     finalHistoryForSaving = await historyPromise; 
                     logger.debug(`${msgTAG} historyPromise resolvida com ${finalHistoryForSaving.length} mensagens.`);
                 }
                 catch (historyError) { logger.error(`${msgTAG} Erro ao obter histórico final da historyPromise:`, historyError); finalHistoryForSaving = []; }
             } else { logger.warn(`${msgTAG} historyPromise não encontrada para salvar histórico.`); }
             
             const persistencePromises = [
                 stateService.updateDialogueState(userId, nextStateToSave), // Salva o estado atualizado
                 stateService.setInCache(cacheKeyForPersistence, finalText, CACHE_TTL_SECONDS),
                 stateService.incrementUsageCounter(userId),
             ];

             if (finalHistoryForSaving.length > 0) {
                  persistencePromises.push(stateService.setConversationHistory(userId, finalHistoryForSaving));
             } else { logger.warn(`${msgTAG} Pulando salvamento do histórico.`); }

             await Promise.allSettled(persistencePromises);
             logger.debug(`${msgTAG} Persistência no Redis concluída.`);
        } catch (persistError) { logger.error(`${msgTAG} Erro persistência Redis (não fatal):`, persistError); }

        logger.info(`${msgTAG} Tarefa de mensagem normal concluída com sucesso para User ${userId}.`);
        return NextResponse.json({ success: true }, { status: 200 });
    }

  } catch (error) {
    logger.error(`${TAG} Erro GERAL não tratado na API worker:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  logger.error(`${TAG} Código atingiu o final da função POST inesperadamente.`);
  return NextResponse.json({ error: 'Server ended without an explicit response.' }, { status: 500 });
}
