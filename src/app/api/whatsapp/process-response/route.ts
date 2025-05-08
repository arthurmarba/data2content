// src/app/api/whatsapp/process-response/route.ts
// v2.2 - Corrigido erro "Not all code paths return a value"

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import * as dataService from '@/app/lib/dataService';
import { IUser } from '@/app/models/User';
// Removido AggregatedReport se não usado diretamente aqui
// import { AggregatedReport } from '@/app/lib/reportHelpers';
import OpenAI from 'openai'; // Usado apenas no fluxo daily_tip
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Importação de functionExecutors (se necessário aqui, parece que não é usado diretamente)
// import { functionExecutors } from '@/app/lib/aiFunctions';

export const runtime = 'nodejs';

// Interface do corpo da requisição
interface ProcessRequestBody {
  fromPhone?: string;
  incomingText?: string;
  userId: string;
  taskType?: string;
}

// Configurações
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10;
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const DAILY_PLAN_TIMEOUT_MS = 30000;
const DAILY_PLAN_MAX_TOKENS = 350;

// --- INICIALIZAÇÃO DO QSTASH RECEIVER ---
const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
let receiver: Receiver | null = null;
if (currentSigningKey && nextSigningKey) {
    receiver = new Receiver({ currentSigningKey, nextSigningKey });
} else {
    logger.error("[QStash Worker Init] Chaves de assinatura QStash não definidas.");
}
// --- FIM DA INICIALIZAÇÃO ---


/**
 * POST /api/whatsapp/process-response
 * Endpoint chamado pelo QStash.
 */
export async function POST(request: NextRequest): Promise<NextResponse> { // <<< Adicionado tipo de retorno explícito
  const TAG = '[QStash Worker /process-response v2.2]'; // Tag atualizada

  if (!receiver) {
      logger.error(`${TAG} QStash Receiver não inicializado.`);
      return NextResponse.json({ error: 'QStash Receiver not configured' }, { status: 500 });
  }

  let bodyText: string;
  let payload: ProcessRequestBody;

  try {
    // 1. Verificar Assinatura QStash e Ler Corpo
    bodyText = await request.text();
    const signature = request.headers.get('upstash-signature');
    if (!signature) {
        logger.error(`${TAG} Header 'upstash-signature' ausente.`);
        return NextResponse.json({ error: 'Missing signature header' }, { status: 401 });
    }
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) {
      logger.error(`${TAG} Assinatura inválida recebida.`);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    logger.info(`${TAG} Assinatura QStash verificada.`);

    // 2. Parse do Corpo (Payload da Tarefa)
    try {
      payload = JSON.parse(bodyText);
      if (!payload.userId) { throw new Error('Payload inválido: userId ausente.'); }
    } catch (e) {
      logger.error(`${TAG} Erro ao parsear o corpo JSON ou payload inválido:`, e);
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { userId, taskType, incomingText, fromPhone } = payload;

    // --- ROTEAMENTO DA TAREFA ---
    if (taskType === "daily_tip") {
        // --- Processar Tarefa de Roteiro Diário de Stories ---
        const planTAG = `${TAG}[DailyPlan]`;
        logger.info(`${planTAG} Iniciando tarefa de roteiro diário para User ${userId}...`);
        let user: IUser;
        let userPhone: string | null | undefined;
        let planText: string = "Não foi possível gerar seu roteiro de stories hoje. Tente pedir uma sugestão diretamente!";
        try {
            user = await dataService.lookupUserById(userId);
            userPhone = user.whatsappPhone;
            if (!userPhone || !user.whatsappVerified) { logger.warn(`${planTAG} Usuário ${userId} não tem WhatsApp válido/verificado.`); return NextResponse.json({ success: true, message: "User has no verified WhatsApp number." }, { status: 200 }); }
            const userGoal = (user as any).goal || 'aumentar o engajamento';
            logger.debug(`${planTAG} Objetivo do usuário ${userId}: ${userGoal}`);
            const latestReport = await dataService.getLatestAggregatedReport(userId);
            logger.debug(`${planTAG} Relatório carregado para User ${userId}.`);
            const bestProposal = latestReport?.proposalStats?.[0]?._id?.proposal || 'Não identificada';
            const bestContext = latestReport?.contextStats?.[0]?._id?.context || 'Não identificado';
            const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
            const prompt = `Como consultor de Instagram Tuca, crie um plano de stories conciso e prático para ${user.name || 'o usuário'} postar hoje, ${today}. O objetivo principal é ${userGoal}.\n\nBaseie-se nestas métricas recentes (se disponíveis):\n${JSON.stringify(latestReport?.overallStats || { info: "Sem dados gerais recentes." }, null, 2)}\nProposta com melhor performance recente: ${bestProposal}\nContexto com melhor performance recente: ${bestContext}\n\nEstruture o plano em 3 momentos (Manhã ☀️, Tarde ☕, Noite 🌙) com 1 sugestão específica e criativa para cada. Para cada sugestão, explique brevemente o *porquê* (ligado às métricas, objetivo ou boas práticas de engajamento). Use emojis e um tom motivador. Seja direto ao ponto.`;
            logger.debug(`${planTAG} Prompt para IA: ${prompt.substring(0, 150)}...`);
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
            const completion = await openai.chat.completions.create({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', messages: [{ role: "system", content: prompt }], temperature: 0.7, max_tokens: DAILY_PLAN_MAX_TOKENS, }, { timeout: DAILY_PLAN_TIMEOUT_MS });
            const generatedPlan = completion.choices[0]?.message?.content?.trim();
            if (generatedPlan) { planText = `Bom dia, ${user.name || 'tudo certo'}! ✨\n\nCom base nas suas métricas e objetivo (${userGoal}), aqui está um roteiro de stories sugerido para hoje (${today}):\n\n${generatedPlan}\n\nLembre-se de adaptar ao seu estilo! 😉`; logger.info(`${planTAG} Roteiro gerado para User ${userId}.`); }
            else { logger.warn(`${planTAG} IA não retornou conteúdo para o roteiro do User ${userId}.`); }
            logger.info(`${planTAG} Enviando roteiro para ${userPhone}...`);
            await sendWhatsAppMessage(userPhone, planText);
            logger.info(`${planTAG} Roteiro enviado com sucesso para ${userPhone}.`);
            return NextResponse.json({ success: true }, { status: 200 }); // <<< RETORNO SUCESSO ROTEIRO
        } catch (error) {
            logger.error(`${planTAG} Erro ao processar roteiro diário para User ${userId}:`, error);
            if (userPhone) { try { await sendWhatsAppMessage(userPhone, "Desculpe, não consegui gerar seu roteiro de stories hoje devido a um erro interno."); } catch (e) {} }
            return NextResponse.json({ error: `Failed to process daily story plan: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 }); // <<< RETORNO ERRO ROTEIRO
        }

    } else {
        // --- Processar Mensagem Normal do Utilizador (Fluxo com Histórico JSON) ---
        const msgTAG = `${TAG}[UserMsg]`;
        logger.info(`${msgTAG} Processando mensagem normal para User ${userId}...`);

        if (!fromPhone || !incomingText) { logger.error(`${msgTAG} Payload inválido: fromPhone ou incomingText ausente.`); return NextResponse.json({ error: 'Invalid payload for user message' }, { status: 400 }); }

        let user: IUser;
        let dialogueState: stateService.DialogueState = {};
        let historyMessages: ChatCompletionMessageParam[] = [];
        try {
            const [userData, stateData, historyData] = await Promise.all([
                dataService.lookupUserById(userId),
                stateService.getDialogueState(userId),
                stateService.getConversationHistory(userId) // Retorna array
            ]);
            user = userData;
            dialogueState = stateData;
            historyMessages = historyData; // Atribui array
            logger.debug(`${msgTAG} Dados carregados para User: ${userId}. Histórico com ${historyMessages.length} mensagens.`);
        } catch (err) {
            logger.error(`${msgTAG} Erro ao carregar dados iniciais para User ${userId}:`, err);
            try { await sendWhatsAppMessage(fromPhone, "Desculpe, tive um problema ao carregar seus dados. Tente novamente em instantes."); } catch (e) {}
            return NextResponse.json({ error: `Failed to load initial user data: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 }); // <<< RETORNO ERRO CARREGAMENTO
        }

        // Aplica limite ao histórico para enviar à IA
        const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
        if (historyMessages.length > HISTORY_LIMIT) { logger.debug(`${msgTAG} Histórico limitado a ${HISTORY_LIMIT} msgs para envio.`); }

        // Prepara contexto (sem latestReport proativo)
        const enrichedContext = { user, historyMessages: limitedHistoryMessages, dialogueState };

        let finalText = '';
        let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
        let reader: ReadableStreamDefaultReader<string> | null = null;
        let streamTimeout: NodeJS.Timeout | null = null;

        try {
            logger.debug(`${msgTAG} Chamando askLLMWithEnrichedContext para User ${userId}...`);
            const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(enrichedContext, incomingText);
            historyPromise = hp;
            logger.debug(`${msgTAG} askLLMWithEnrichedContext retornou. Lendo stream...`);

            reader = stream.getReader();
            streamTimeout = setTimeout(() => { logger.warn(`${msgTAG} Timeout stream read...`); streamTimeout = null; reader?.cancel().catch(/*...*/); }, STREAM_READ_TIMEOUT_MS);
            // eslint-disable-next-line no-constant-condition
            while (true) {
                 let value: string | undefined; let done: boolean | undefined;
                 try { const result = await reader.read(); if (streamTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
                 catch (readError: any) { logger.error(`${msgTAG} Erro reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro stream read: ${readError.message}`); }
                 if (done) { break; } if (typeof value === 'string') { finalText += value; } else { logger.warn(`${msgTAG} 'value' undefined mas 'done' false.`); }
            }
            if (streamTimeout) { clearTimeout(streamTimeout); }
            logger.debug(`${msgTAG} Texto final montado para User ${userId}: ${finalText.length} chars.`);
            if (finalText.trim().length === 0) { finalText = 'Hum... não consegui gerar uma resposta completa agora.'; }

        } catch (err: any) {
            logger.error(`${msgTAG} Erro durante chamada/leitura LLM:`, err);
            if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
            finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
        } finally {
            if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${msgTAG} Erro releaseLock:`, e); } }
        }

        // Envio da Resposta Final
        try {
            logger.info(`${msgTAG} Enviando resposta final (${finalText.length} chars) para ${fromPhone}...`);
            await sendWhatsAppMessage(fromPhone, finalText);
            logger.info(`${msgTAG} Resposta final enviada com sucesso para ${fromPhone}.`);
        } catch (sendError: any) {
            logger.error(`${msgTAG} Falha CRÍTICA ao enviar resposta final:`, sendError);
            return NextResponse.json({ error: `Failed to send final message: ${sendError.message || String(sendError)}` }, { status: 500 }); // <<< RETORNO ERRO ENVIO
        }

        // Persistência no Redis
        let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
        try {
             logger.debug(`${msgTAG} Iniciando persistência no Redis para User ${userId}...`);
             const nextState = { ...(dialogueState || {}), lastInteraction: Date.now() };
             const cacheKey = `resp:${fromPhone}:${incomingText.trim().slice(0, 100)}`;

             if (historyPromise) {
                 try {
                     logger.debug(`${msgTAG} Aguardando historyPromise para salvar...`);
                     finalHistoryForSaving = await historyPromise;
                     logger.debug(`${msgTAG} historyPromise resolvida com ${finalHistoryForSaving.length} mensagens.`);
                 } catch (historyError) {
                     logger.error(`${msgTAG} Erro ao obter histórico final da historyPromise (não será salvo):`, historyError);
                     finalHistoryForSaving = [];
                 }
             } else { logger.warn(`${msgTAG} historyPromise não encontrada para salvar histórico.`); }

             const persistencePromises = [
                 stateService.updateDialogueState(userId, nextState),
                 stateService.setInCache(cacheKey, finalText, CACHE_TTL_SECONDS),
                 stateService.incrementUsageCounter(userId),
             ];

             if (finalHistoryForSaving.length > 0) {
                  logger.debug(`${msgTAG} Adicionando setConversationHistory com ${finalHistoryForSaving.length} msgs JSON.`);
                  persistencePromises.push(stateService.setConversationHistory(userId, finalHistoryForSaving)); // Passa ARRAY
             } else { logger.warn(`${msgTAG} Pulando salvamento do histórico.`); }

             await Promise.allSettled(persistencePromises);
             logger.debug(`${msgTAG} Persistência no Redis concluída.`);

        } catch (persistError) { logger.error(`${msgTAG} Erro persistência Redis (não fatal):`, persistError); }

        logger.info(`${msgTAG} Tarefa de mensagem normal concluída com sucesso para User ${userId}.`);
        return NextResponse.json({ success: true }, { status: 200 }); // <<< RETORNO SUCESSO MENSAGEM NORMAL
    }
    // --- Fim do Fluxo Normal ---

  } catch (error) {
    // Captura erros gerais não tratados
    logger.error(`${TAG} Erro GERAL não tratado na API worker:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); // <<< RETORNO ERRO GERAL
  }

  // <<< ADICIONADO: Retorno de Fallback >>>
  // Este ponto não deveria ser alcançado se a lógica try/catch/if/else estiver correta.
  logger.error(`${TAG} Código atingiu o final da função POST inesperadamente.`);
  return NextResponse.json({ error: 'Server ended without an explicit response.' }, { status: 500 });

} // Fecha a função POST