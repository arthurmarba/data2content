// src/app/api/whatsapp/process-response/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash"; // Importa a classe Receiver
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext } from '@/app/lib/aiOrchestrator'; // Para respostas normais
import * as stateService from '@/app/lib/stateService';
import * as dataService from '@/app/lib/dataService';
import { IUser } from '@/app/models/User'; // Importa a interface IUser
// Importa tipos necessários (ProposalStat e ContextStat podem não ser estritamente necessários aqui se acessarmos via _id)
import { AggregatedReport } from '@/app/lib/reportHelpers';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export const runtime = 'nodejs';

// Define a estrutura esperada do corpo da requisição vinda do QStash
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
// Aumenta o timeout para o roteiro, pois pode exigir mais processamento da IA
const DAILY_PLAN_TIMEOUT_MS = 30000; // Timeout para o roteiro diário (30s) - Ajuste!
const DAILY_PLAN_MAX_TOKENS = 350; // Aumenta um pouco o limite de tokens para o roteiro

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
 * Endpoint chamado pelo QStash para processar a resposta da IA ou gerar roteiros diários.
 */
export async function POST(request: NextRequest) {
  const TAG = '[QStash Worker /process-response v2.0]'; // Tag atualizada

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
    if (taskType === "daily_tip") { // Renomear taskType para "daily_story_plan" seria mais claro
        // --- Processar Tarefa de Roteiro Diário de Stories ---
        const planTAG = `${TAG}[DailyPlan]`;
        logger.info(`${planTAG} Iniciando tarefa de roteiro diário para User ${userId}...`);

        let user: IUser;
        let userPhone: string | null | undefined;
        let planText: string = "Não foi possível gerar seu roteiro de stories hoje. Tente pedir uma sugestão diretamente!"; // Fallback

        try {
            // a. Carregar dados do usuário (incluindo telefone e objetivo, se houver)
            user = await dataService.lookupUserById(userId);
            userPhone = user.whatsappPhone;
            if (!userPhone || !user.whatsappVerified) {
                logger.warn(`${planTAG} Usuário ${userId} não tem WhatsApp válido/verificado. Abortando roteiro.`);
                return NextResponse.json({ success: true, message: "User has no verified WhatsApp number." }, { status: 200 });
            }
            // <<< Assumindo que existe user.goal >>>
            const userGoal = (user as any).goal || 'aumentar o engajamento'; // Use 'any' ou ajuste a interface IUser
            logger.debug(`${planTAG} Objetivo do usuário ${userId}: ${userGoal}`);

            // b. Carregar dados para o roteiro (último relatório)
            const latestReport = await dataService.getLatestAggregatedReport(userId);
            logger.debug(`${planTAG} Relatório carregado para User ${userId}.`);

            // Extrair métricas chave do relatório (exemplo)
            // *** CORREÇÃO AQUI: Acessa _id.proposal ***
            const bestProposal = latestReport?.proposalStats?.[0]?._id?.proposal || 'Não identificada';
            const bestContext = latestReport?.contextStats?.[0]?._id?.context || 'Não identificado'; // Contexto estava correto
            // *** FIM DA CORREÇÃO ***

            // c. Formular Prompt Detalhado para Roteiro de Story
            const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
            const prompt = `Como consultor de Instagram Tuca, crie um plano de stories conciso e prático para ${user.name || 'o usuário'} postar hoje, ${today}. O objetivo principal é ${userGoal}.

Baseie-se nestas métricas recentes (se disponíveis):
${JSON.stringify(latestReport?.overallStats || { info: "Sem dados gerais recentes." }, null, 2)}
Proposta com melhor performance recente: ${bestProposal}
Contexto com melhor performance recente: ${bestContext}

Estruture o plano em 3 momentos (Manhã ☀️, Tarde ☕, Noite 🌙) com 1 sugestão específica e criativa para cada. Para cada sugestão, explique brevemente o *porquê* (ligado às métricas, objetivo ou boas práticas de engajamento). Use emojis e um tom motivador. Seja direto ao ponto.`;

            logger.debug(`${planTAG} Prompt para IA: ${prompt.substring(0, 150)}...`);

            // d. Chamar a IA
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
            const completion = await openai.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [{ role: "system", content: prompt }],
                temperature: 0.7, // Mantém um equilíbrio
                max_tokens: DAILY_PLAN_MAX_TOKENS, // Usa constante definida
            }, {
                timeout: DAILY_PLAN_TIMEOUT_MS // Usa constante definida
            });
            const generatedPlan = completion.choices[0]?.message?.content?.trim();

            if (generatedPlan) {
                // Adiciona uma introdução e formata a mensagem final
                planText = `Bom dia, ${user.name || 'tudo certo'}! ✨\n\nCom base nas suas métricas e objetivo (${userGoal}), aqui está um roteiro de stories sugerido para hoje (${today}):\n\n${generatedPlan}\n\nLembre-se de adaptar ao seu estilo! 😉`;
                logger.info(`${planTAG} Roteiro gerado para User ${userId}.`);
            } else {
                logger.warn(`${planTAG} IA não retornou conteúdo para o roteiro do User ${userId}.`);
                // Mantém a mensagem de fallback definida no início
            }

            // e. Enviar o roteiro
            logger.info(`${planTAG} Enviando roteiro para ${userPhone}...`);
            await sendWhatsAppMessage(userPhone, planText);
            logger.info(`${planTAG} Roteiro enviado com sucesso para ${userPhone}.`);

            // f. (Opcional) Persistir estado/log
            // await stateService.logDailyPlanSent(userId);

            return NextResponse.json({ success: true }, { status: 200 });

        } catch (error) {
            logger.error(`${planTAG} Erro ao processar roteiro diário para User ${userId}:`, error);
            if (userPhone) {
                try { await sendWhatsAppMessage(userPhone, "Desculpe, não consegui gerar seu roteiro de stories hoje devido a um erro interno."); } catch (e) {}
            }
            return NextResponse.json({ error: `Failed to process daily story plan: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
        }

    } else {
        // --- Processar Mensagem Normal do Utilizador (Fluxo Existente) ---
        const msgTAG = `${TAG}[UserMsg]`;
        logger.info(`${msgTAG} Processando mensagem normal para User ${userId}...`);

        // Validações adicionais para este fluxo
        if (!fromPhone || !incomingText) {
             logger.error(`${msgTAG} Payload inválido para mensagem de usuário: fromPhone ou incomingText ausente.`);
             return NextResponse.json({ error: 'Invalid payload for user message' }, { status: 400 });
        }

        // (Lógica existente para buscar dados, preparar contexto, chamar IA, enviar resposta, persistir)
        // ... (código igual à versão anterior) ...
        let user: IUser;
        let dialogueState: stateService.DialogueState = {};
        let historyString: string = '';
        let latestReport: AggregatedReport | null = null;

        try {
            user = await dataService.lookupUserById(userId); // Já temos o ID
            [dialogueState, historyString, latestReport] = await Promise.all([
                stateService.getDialogueState(userId),
                stateService.getConversationHistory(userId),
                dataService.getLatestAggregatedReport(userId)
            ]);
            logger.debug(`${msgTAG} Dados carregados para User: ${userId}`);
        } catch (err) {
            logger.error(`${msgTAG} Erro ao carregar dados para User ${userId}:`, err);
            return NextResponse.json({ error: `Failed to load user data: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
        }

        let historyMessages: ChatCompletionMessageParam[] = [];
        if (historyString) {
            try { /* ... lógica de parse do histórico ... */
                 const lines = historyString.trim().split('\n');
                 let currentRole: 'user' | 'assistant' | null = null;
                 let currentContent = '';
                 for (const line of lines) {
                     if (line.startsWith('User: ')) { if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() }); currentRole = 'user'; currentContent = line.substring(6); }
                     else if (line.startsWith('Assistant: ')) { if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() }); currentRole = 'assistant'; currentContent = line.substring(11); }
                     else if (currentRole) { currentContent += '\n' + line; }
                 }
                 if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() });
            } catch (parseError) { logger.error(`${msgTAG} Erro ao parsear histórico para User ${userId}:`, parseError); historyMessages = []; }
        }
        const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
        logger.debug(`${msgTAG} Histórico preparado (limitado a ${limitedHistoryMessages.length} msgs).`);

        const enrichedContext = { user, historyMessages: limitedHistoryMessages, dialogueState, latestReport };

        let finalText = '';
        let historyFromLLM: ChatCompletionMessageParam[] = [];
        let readCounter = 0;
        let streamTimeout: NodeJS.Timeout | null = null;
        let reader: ReadableStreamDefaultReader<string> | null = null;

        try {
            logger.debug(`${msgTAG} Chamando askLLMWithEnrichedContext para User ${userId}...`);
            const { stream, history: updatedHistory } = await askLLMWithEnrichedContext(enrichedContext, incomingText);
            historyFromLLM = updatedHistory;
            logger.debug(`${msgTAG} askLLMWithEnrichedContext retornou para User ${userId}. Lendo stream...`);

            reader = stream.getReader();
            streamTimeout = setTimeout(() => { /* ... lógica de timeout ... */ logger.warn(`${msgTAG} Timeout (${STREAM_READ_TIMEOUT_MS}ms) durante leitura do stream...`); streamTimeout = null; reader?.cancel().catch(e => logger.error(`${msgTAG} Erro ao cancelar reader:`, e)); }, STREAM_READ_TIMEOUT_MS);

            while (true) { /* ... loop de leitura ... */
                 readCounter++; let value: string | undefined; let done: boolean | undefined;
                 try { const result = await reader.read(); if (streamTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
                 catch (readError: any) { logger.error(`${msgTAG} Erro em reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro ao ler stream: ${readError.message}`); }
                 if (done) { break; } if (typeof value === 'string') { finalText += value; } else { logger.warn(`${msgTAG} 'value' undefined mas 'done' false.`); }
            }
            if (streamTimeout) { clearTimeout(streamTimeout); }
            logger.debug(`${msgTAG} Texto final montado para User ${userId}: ${finalText.length} chars.`);
            if (finalText.trim().length === 0) { finalText = 'Hum... não consegui gerar uma resposta completa agora.'; }

        } catch (err: any) { /* ... tratamento de erro ... */ logger.error(`${msgTAG} Erro durante chamada/leitura LLM:`, err); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; finalText = 'Ops! Tive uma dificuldade técnica.';
        } finally { /* ... releaseLock ... */ if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${msgTAG} Erro releaseLock:`, e); } } }

        try {
            logger.info(`${msgTAG} Enviando resposta final (${finalText.length} chars) para ${fromPhone}...`);
            await sendWhatsAppMessage(fromPhone, finalText);
            logger.info(`${msgTAG} Resposta final enviada com sucesso para ${fromPhone}.`);
        } catch (sendError) { /* ... tratamento de erro envio ... */ logger.error(`${msgTAG} Falha CRÍTICA ao enviar resposta final:`, sendError); return NextResponse.json({ error: `Failed to send final message: ${sendError instanceof Error ? sendError.message : String(sendError)}` }, { status: 500 }); }

        try { /* ... persistência ... */
             logger.debug(`${msgTAG} Iniciando persistência no Redis para User ${userId}...`);
             const nextState = { ...(dialogueState || {}), lastInteraction: Date.now() };
             const cacheKey = `resp:${fromPhone}:${incomingText.trim().slice(0, 100)}`;
             const newHistoryString = historyFromLLM.filter(msg => msg.role === 'user' || (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim().length > 0)).map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`).join('\n');
             await Promise.allSettled([ stateService.updateDialogueState(userId, nextState), stateService.setConversationHistory(userId, newHistoryString), stateService.setInCache(cacheKey, finalText, CACHE_TTL_SECONDS), stateService.incrementUsageCounter(userId), ]);
             logger.debug(`${msgTAG} Persistência no Redis concluída para User ${userId}.`);
        } catch (persistError) { logger.error(`${msgTAG} Erro persistência (não fatal):`, persistError); }

        logger.info(`${msgTAG} Tarefa de mensagem normal concluída com sucesso para User ${userId}.`);
        return NextResponse.json({ success: true }, { status: 200 });
    }
    // --- Fim do Fluxo Normal ---

  } catch (error) {
    // Captura erros gerais não tratados (ex: falha na verificação inicial, erro crítico)
    logger.error(`${TAG} Erro GERAL não tratado na API worker:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
