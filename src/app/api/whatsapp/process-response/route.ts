// src/app/api/whatsapp/process-response/route.ts
// Proposta v2.3 - Integração da lógica de intenção e mensagem de processamento condicional

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import * as dataService from '@/app/lib/dataService';
import { IUser } from '@/app/models/User';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// --- ADICIONADO: Importações do intentService ---
import {
    determineIntent,
    normalizeText, // Será usado para normalizar incomingText
    getRandomGreeting,
    IntentResult,
    DeterminedIntent
} from '@/app/lib/intentService'; // Ajuste o caminho se necessário
// --- FIM ADIÇÃO ---


export const runtime = 'nodejs';

interface ProcessRequestBody {
  fromPhone?: string;
  incomingText?: string;
  userId: string;
  taskType?: string;
}

// --- ADICIONADO: Constantes para mensagem de processamento ---
const PROCESSING_MESSAGE_DELAY_MS = 1800;
const pickRandom = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error('pickRandom: array vazio');
  return arr[Math.floor(Math.random() * arr.length)]!;
};
const GET_PROCESSING_MESSAGES_POOL = (userName: string): string[] => [
    `Ok, ${userName}! Recebi seu pedido. 👍 Estou verificando e já te respondo...`,
    `Entendido, ${userName}! Um momento enquanto preparo sua resposta... ⏳`,
    `Certo, ${userName}! Consultando o Tuca para você... 🧠`,
    `Aguarde um instante, ${userName}, estou processando sua solicitação...`,
    `Só um pouquinho, ${userName}, já estou vendo isso para você!`,
];
// --- FIM ADIÇÃO ---

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

export async function POST(request: NextRequest): Promise<NextResponse> {
  const TAG = '[QStash Worker /process-response v2.3]'; // ALTERADO: Versão

  if (!receiver) {
      logger.error(`${TAG} QStash Receiver não inicializado.`);
      return NextResponse.json({ error: 'QStash Receiver not configured' }, { status: 500 });
  }

  let bodyText: string;
  let payload: ProcessRequestBody;

  try {
    bodyText = await request.text();
    const signature = request.headers.get('upstash-signature');
    if (!signature) { /* ... (verificação de assinatura mantida) ... */ return NextResponse.json({ error: 'Missing signature header' }, { status: 401 }); }
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) { /* ... (verificação de assinatura mantida) ... */ return NextResponse.json({ error: 'Invalid signature' }, { status: 401 }); }
    logger.info(`${TAG} Assinatura QStash verificada.`);

    try {
      payload = JSON.parse(bodyText);
      if (!payload.userId) { throw new Error('Payload inválido: userId ausente.'); }
    } catch (e) { /* ... (parse do corpo mantido) ... */ return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const { userId, taskType, incomingText, fromPhone } = payload;

    if (taskType === "daily_tip") {
        // --- Processar Tarefa de Roteiro Diário de Stories ---
        // (LÓGICA DO DAILY_TIP MANTIDA EXATAMENTE COMO ANTES - SEM ALTERAÇÕES AQUI)
        // ... (código do daily_tip omitido para brevidade, mas permanece o mesmo) ...
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
            const prompt = `Como consultor de Instagram Tuca, crie um plano de stories conciso e prático para ${userForTip.name || 'o usuário'} postar hoje, ${today}. O objetivo principal é ${userGoal}.\n\nBaseie-se nestas métricas recentes (se disponíveis):\n${JSON.stringify(latestReport?.overallStats || { info: "Sem dados gerais recentes." }, null, 2)}\nProposta com melhor performance recente: ${bestProposal}\nContexto com melhor performance recente: ${bestContext}\n\nEstruture o plano em 3 momentos (Manhã ☀️, Tarde ☕, Noite 🌙) com 1 sugestão específica e criativa para cada. Para cada sugestão, explique brevemente o *porquê* (ligado às métricas, objetivo ou boas práticas de engajamento). Use emojis e um tom motivador. Seja direto ao ponto.`;
            const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! }); // Renomeado para evitar conflito
            const completion = await openaiClient.chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: "system", content: prompt }], temperature: 0.7, max_tokens: DAILY_PLAN_MAX_TOKENS, }, { timeout: DAILY_PLAN_TIMEOUT_MS });
            const generatedPlan = completion.choices[0]?.message?.content?.trim();
            if (generatedPlan) { planText = `Bom dia, ${userForTip.name || 'tudo certo'}! ✨\n\nCom base nas suas métricas e objetivo (${userGoal}), aqui está um roteiro de stories sugerido para hoje (${today}):\n\n${generatedPlan}\n\nLembre-se de adaptar ao seu estilo! 😉`; logger.info(`${planTAG} Roteiro gerado para User ${userId}.`); }
            else { logger.warn(`${planTAG} IA não retornou conteúdo para o roteiro do User ${userId}.`); }
            await sendWhatsAppMessage(userPhoneForTip, planText);
            return NextResponse.json({ success: true }, { status: 200 });
        } catch (error) {
            logger.error(`${planTAG} Erro ao processar roteiro diário para User ${userId}:`, error);
            if (userPhoneForTip) { try { await sendWhatsAppMessage(userPhoneForTip, "Desculpe, não consegui gerar seu roteiro de stories hoje devido a um erro interno."); } catch (e) {} }
            return NextResponse.json({ error: `Failed to process daily story plan: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
        }

    } else {
        // --- Processar Mensagem Normal do Utilizador (Fluxo com Histórico JSON e Lógica de Intenção) ---
        const msgTAG = `${TAG}[UserMsg v2.3]`; // ALTERADO: Versão
        logger.info(`${msgTAG} Processando mensagem normal para User ${userId}...`);

        if (!fromPhone || !incomingText) { /* ... (validação mantida) ... */ return NextResponse.json({ error: 'Invalid payload for user message' }, { status: 400 }); }

        let user: IUser;
        let dialogueState: stateService.DialogueState = {};
        let historyMessages: ChatCompletionMessageParam[] = [];
        let userName: string; // ADICIONADO
        let greeting: string;   // ADICIONADO

        try {
            const [userData, stateData, historyData] = await Promise.all([
                dataService.lookupUserById(userId),
                stateService.getDialogueState(userId),
                stateService.getConversationHistory(userId)
            ]);
            user = userData;
            dialogueState = stateData;
            historyMessages = historyData;
            userName = user.name || 'criador'; // ADICIONADO
            greeting = getRandomGreeting(userName); // ADICIONADO
            logger.debug(`${msgTAG} Dados carregados para User: ${userId}. Histórico com ${historyMessages.length} mensagens.`);
        } catch (err) { /* ... (tratamento de erro mantido) ... */ 
            logger.error(`${msgTAG} Erro ao carregar dados iniciais para User ${userId}:`, err);
            try { await sendWhatsAppMessage(fromPhone, "Desculpe, tive um problema ao carregar seus dados. Tente novamente em instantes."); } catch (e) {}
            return NextResponse.json({ error: `Failed to load initial user data: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
        }
        
        // --- ADICIONADO: Normalizar texto e Determinar Intenção ---
        const normText = normalizeText(incomingText.trim());
        if (!normText) {
            logger.warn(`${msgTAG} Mensagem normalizada vazia.`);
            const emptyNormResponse = `${greeting} Pode repetir, por favor? Não entendi bem.`;
            await sendWhatsAppMessage(fromPhone, emptyNormResponse);
            // Salvar interação no histórico (opcional para esta resposta simples)
            return NextResponse.json({ success: true, message: "Empty normalized text" }, { status: 200 });
        }

        let intentResult: IntentResult;
        let currentDeterminedIntent: DeterminedIntent | null = null;
        let responseTextForSpecialHandled: string | null = null;

        try {
            intentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
            if (intentResult.type === 'special_handled') {
                logger.info(`${msgTAG} Intenção tratada como caso especial pela intentService.`);
                responseTextForSpecialHandled = intentResult.response;
            } else {
                currentDeterminedIntent = intentResult.intent;
                logger.info(`${msgTAG} Intenção determinada: ${currentDeterminedIntent}`);
            }
        } catch (intentError) {
            logger.error(`${msgTAG} Erro ao determinar intenção:`, intentError);
            currentDeterminedIntent = 'general'; // Default em caso de erro
        }

        if (responseTextForSpecialHandled) {
            logger.info(`${msgTAG} Enviando resposta special_handled: "${responseTextForSpecialHandled.slice(0,50)}..."`);
            await sendWhatsAppMessage(fromPhone, responseTextForSpecialHandled);
            // Salvar interação no histórico
            try {
                const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: incomingText };
                const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: responseTextForSpecialHandled };
                const updatedHistory = [...historyMessages, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
                await stateService.setConversationHistory(userId, updatedHistory);
                await stateService.updateDialogueState(userId, { ...(dialogueState || {}), lastInteraction: Date.now() });
            } catch(histSaveErr) { logger.error(`${msgTAG} Falha ao salvar histórico/estado para special_handled:`, histSaveErr); }
            return NextResponse.json({ success: true }, { status: 200 });
        }
        // Se chegou aqui, currentDeterminedIntent não é null e precisa da IA.
        // --- FIM ADIÇÃO ---

        const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
        if (historyMessages.length > HISTORY_LIMIT) { logger.debug(`${msgTAG} Histórico limitado a ${HISTORY_LIMIT} msgs para envio.`); }

        const enrichedContext = { user, historyMessages: limitedHistoryMessages, dialogueState };

        // --- ADICIONADO: Lógica da mensagem de processamento condicional ---
        const isLightweightQuery = currentDeterminedIntent === 'social_query' || currentDeterminedIntent === 'meta_query_personal';
        logger.info(`${msgTAG} Tipo de query para IA: ${isLightweightQuery ? 'Leve (social/meta)' : 'Padrão/Complexa'}`);

        let processingMessageTimer: NodeJS.Timeout | null = null;
        let processingMessageHasBeenSent = false;

        if (!isLightweightQuery) {
            processingMessageTimer = setTimeout(async () => {
                if (processingMessageTimer && !processingMessageHasBeenSent) {
                    try {
                        const message = pickRandom(GET_PROCESSING_MESSAGES_POOL(userName));
                        logger.debug(`${msgTAG} Enviando mensagem de processamento (intenção: ${currentDeterminedIntent}) após ${PROCESSING_MESSAGE_DELAY_MS}ms.`);
                        await sendWhatsAppMessage(fromPhone, message);
                        processingMessageHasBeenSent = true;
                    } catch (sendError) { logger.error(`${msgTAG} Falha ao enviar mensagem de processamento condicional (não fatal):`, sendError); }
                }
                processingMessageTimer = null;
            }, PROCESSING_MESSAGE_DELAY_MS);
        } else {
            logger.debug(`${msgTAG} Pulando mensagem de processamento para intenção leve: ${currentDeterminedIntent}`);
        }
        // --- FIM ADIÇÃO ---

        let finalText = '';
        let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
        let reader: ReadableStreamDefaultReader<string> | null = null;
        let streamTimeout: NodeJS.Timeout | null = null;

        try {
            logger.debug(`${msgTAG} Chamando askLLMWithEnrichedContext para User ${userId} com intenção ${currentDeterminedIntent}...`);
            // ALTERADO: Passar currentDeterminedIntent para askLLMWithEnrichedContext
            const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(
                enrichedContext,
                incomingText, // Usar incomingText (raw) para a IA
                currentDeterminedIntent as DeterminedIntent // Sabemos que não é null aqui
            );
            historyPromise = hp;

            // ADICIONADO: Cancelar timer de mensagem de processamento se a IA respondeu rápido
            if (processingMessageTimer) {
                logger.debug(`${msgTAG} Resposta da IA recebida, cancelando timer da mensagem de processamento.`);
                clearTimeout(processingMessageTimer);
                processingMessageTimer = null;
            }
            // --- FIM ADIÇÃO ---

            logger.debug(`${msgTAG} askLLMWithEnrichedContext retornou. Lendo stream...`);
            reader = stream.getReader();
            // ... (lógica de leitura do stream mantida) ...
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
            if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; } // ADICIONADO
            finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
        } finally {
            if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${msgTAG} Erro releaseLock:`, e); } }
            if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; } // ADICIONADO
            if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; } // ADICIONADO
        }

        // Envio da Resposta Final (lógica mantida)
        try { /* ... */ await sendWhatsAppMessage(fromPhone, finalText); /* ... */ }
        catch (sendError: any) { /* ... */ return NextResponse.json({ error: `Failed to send final message: ${sendError.message || String(sendError)}` }, { status: 500 }); }

        // Persistência no Redis (lógica mantida)
        // ... (código de persistência omitido para brevidade, mas permanece o mesmo) ...
        let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
        try {
             logger.debug(`${msgTAG} Iniciando persistência no Redis para User ${userId}...`);
             const nextState = { ...(dialogueState || {}), lastInteraction: Date.now() };
             const cacheKeyForPersistence = `resp:${fromPhone}:${incomingText.trim().slice(0, 100)}`; // cacheKey renomeado para evitar conflito
             if (historyPromise) {
                 try { finalHistoryForSaving = await historyPromise; }
                 catch (historyError) { logger.error(`${msgTAG} Erro ao obter histórico final da historyPromise:`, historyError); finalHistoryForSaving = []; }
             } else { logger.warn(`${msgTAG} historyPromise não encontrada para salvar histórico.`); }
             const persistencePromises = [ /* ... */ ];
             if (finalHistoryForSaving.length > 0) {
                  persistencePromises.push(stateService.setConversationHistory(userId, finalHistoryForSaving));
             } else { logger.warn(`${msgTAG} Pulando salvamento do histórico.`); }
             // Adicionar as outras promises de persistência:
             persistencePromises.push(stateService.updateDialogueState(userId, nextState));
             persistencePromises.push(stateService.setInCache(cacheKeyForPersistence, finalText, CACHE_TTL_SECONDS));
             persistencePromises.push(stateService.incrementUsageCounter(userId));

             await Promise.allSettled(persistencePromises);
             logger.debug(`${msgTAG} Persistência no Redis concluída.`);
        } catch (persistError) { logger.error(`${msgTAG} Erro persistência Redis (não fatal):`, persistError); }


        logger.info(`${msgTAG} Tarefa de mensagem normal concluída com sucesso para User ${userId}.`);
        return NextResponse.json({ success: true }, { status: 200 });
    }
    // --- Fim do Fluxo Normal ---

  } catch (error) {
    logger.error(`${TAG} Erro GERAL não tratado na API worker:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  logger.error(`${TAG} Código atingiu o final da função POST inesperadamente.`);
  return NextResponse.json({ error: 'Server ended without an explicit response.' }, { status: 500 });
}