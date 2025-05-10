// src/app/api/whatsapp/process-response/route.ts
// v2.5.1 - Aprimora planejamento de Stories diário (daily_tip):
//          - Foco em narrativa de bastidores ao longo do dia.
//          - Sugestão explícita de recursos de engajamento do Instagram (enquetes, perguntas).
//          - Mantém base em métricas de conteúdo do feed para temas.
//          - Justificativas concisas para cada Story.
//          - Aumenta o número de sugestões de Stories.
//          - CORRIGIDO: Type error "Object is possibly 'undefined'" ao acessar top3Posts[0].description.

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
import {
    determineIntent,
    normalizeText,
    getRandomGreeting,
    IntentResult,
    DeterminedIntent
} from '@/app/lib/intentService';

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

const DAILY_PLAN_TIMEOUT_MS = 75000; 
const DAILY_PLAN_MAX_TOKENS = 1200;  

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
let receiver: Receiver | null = null;
if (currentSigningKey && nextSigningKey) {
    receiver = new Receiver({ currentSigningKey, nextSigningKey });
} else {
    logger.error("[QStash Worker Init] Chaves de assinatura QStash não definidas.");
}

function aiResponseSuggestsPendingAction(responseText: string): { suggests: boolean; actionType?: stateService.IDialogueState['lastAIQuestionType']; pendingActionContext?: stateService.IDialogueState['pendingActionContext'] } {
    const lowerResponse = responseText.toLowerCase();
    if (lowerResponse.includes("o que acha?") ||
        lowerResponse.includes("quer que eu verifique?") ||
        lowerResponse.includes("posso buscar esses dados?") ||
        lowerResponse.includes("gostaria de prosseguir com isso?") ||
        lowerResponse.includes("se quiser, posso tentar") ||
        (lowerResponse.includes("posso ") && lowerResponse.endsWith("?"))) {

        if (lowerResponse.includes("dia da semana") || lowerResponse.includes("melhores dias") || lowerResponse.includes("desempenho por dia")) {
            return { suggests: true, actionType: 'confirm_fetch_day_stats', pendingActionContext: { originalSuggestion: responseText.slice(0, 150) } };
        }
        return { suggests: true, actionType: 'confirm_another_action', pendingActionContext: { originalSuggestion: responseText.slice(0, 150) } };
    }
    return { suggests: false };
}


export async function POST(request: NextRequest): Promise<NextResponse> {
  const TAG = '[QStash Worker /process-response v2.5.1]'; 

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
        const planTAG = `${TAG}[DailyStoryPlan v2.5.1]`; 
        logger.info(`${planTAG} Iniciando tarefa de planejamento de Stories diário para User ${userId}...`);
        
        let userForTip: IUser;
        let userPhoneForTip: string | null | undefined;
        let planText: string = "Hoje não consegui preparar seu roteiro de Stories detalhado, mas que tal compartilhar algo espontâneo sobre seus bastidores? 😉";

        try {
            userForTip = await dataService.lookupUserById(userId);
            userPhoneForTip = userForTip.whatsappPhone;

            if (!userPhoneForTip || !userForTip.whatsappVerified) {
                logger.warn(`${planTAG} Usuário ${userId} não tem WhatsApp válido/verificado.`);
                return NextResponse.json({ success: true, message: "User has no verified WhatsApp number." }, { status: 200 });
            }

            const userGoal = (userForTip as any).goal || 'aumentar o engajamento e criar uma conexão mais forte com a audiência';
            
            const latestReport = await dataService.getLatestAggregatedReport(userId); 
            let performanceSummary = "Ainda não tenho dados suficientes sobre o desempenho dos seus posts para identificar os principais interesses da sua audiência neste momento.";
            let topPerformingThemes: string[] = [];

            if (latestReport) {
                const topProposals = latestReport.proposalStats?.slice(0, 2).map(p => p._id.proposal).filter(p => p && p !== "Outro") || [];
                const topContexts = latestReport.contextStats?.slice(0, 2).map(c => c._id.context).filter(c => c && c !== "Geral") || [];
                
                let summaryParts = [];
                if (topProposals.length > 0) {
                    summaryParts.push(`Suas propostas de conteúdo que mais se destacaram recentemente foram: ${topProposals.join(' e ')}.`);
                    topPerformingThemes.push(...topProposals);
                }
                if (topContexts.length > 0) {
                    summaryParts.push(`Dentro dessas propostas, os contextos que geraram bom engajamento incluem: ${topContexts.join(' e ')}.`);
                    topContexts.forEach(c => { if (!topPerformingThemes.includes(c)) topPerformingThemes.push(c); });
                }

                // <<< CORREÇÃO DA LINHA 148 >>>
                const firstTopPost = latestReport.top3Posts?.[0];
                if (firstTopPost && firstTopPost.description) { 
                    summaryParts.push(`Por exemplo, seu post sobre "${firstTopPost.description.substring(0, 40)}..." foi um dos que mais chamou a atenção.`);
                }
                // <<< FIM DA CORREÇÃO >>>

                if (summaryParts.length > 0) {
                    performanceSummary = summaryParts.join(' ');
                }
            }
            
            const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
            const userNameForPrompt = userForTip.name || 'você';

            const uniqueTopThemes = Array.from(new Set(topPerformingThemes)).slice(0, 3); 
            const themesForPrompt = uniqueTopThemes.length > 0 ? uniqueTopThemes.join(', ') : 'temas variados de interesse do seu público';

            const promptForDailyTip = `
Você é Tuca, consultor de Instagram para ${userNameForPrompt}. Hoje é ${today}.
O objetivo principal de ${userNameForPrompt} é: ${userGoal}.

**Contexto sobre os Interesses da Audiência (baseado no desempenho de posts recentes):**
${performanceSummary}
Principais temas/interesses identificados: ${themesForPrompt}.
Número atual de seguidores: ${(await dataService.getLatestAccountInsights(userId))?.accountDetails?.followers_count || 'não disponível'}.

**Sua Tarefa:**
Crie um **PLANEJAMENTO DETALHADO DE STORIES** para ${userNameForPrompt} postar HOJE.
O plano deve conter uma sequência narrativa de **10 a 12 ideias de Stories** distribuídas ao longo do dia (manhã, tarde, noite).
Cada Story deve ter uma **ideia de conteúdo clara e criativa**, focada nos bastidores do criador e nos interesses da audiência.
**Para vários Stories, sugira o uso de RECURSOS DE ENGAJAMENTO do Instagram** (ex: enquetes, caixas de perguntas, quizzes, figurinhas de interação, contagem regressiva, etc.).
A justificativa para cada Story deve ser MUITO CONCISA (1 frase curta) ou implícita na sugestão do recurso de engajamento.

**Formato para cada Story:**
Story [Número] ([Manhã/Tarde/Noite]): [Ideia de Conteúdo Criativa, incluindo sugestão de recurso de engajamento se aplicável]
*✨ Por quê?* [Justificativa muito breve ou o benefício do recurso de engajamento]

**Exemplo de Story:**
Story 3 (Manhã): Mostre rapidamente a organização da sua mesa de trabalho para o dia e lance uma ENQUETE: "Café ou Chá pra começar o dia?"
*✨ Por quê?* Enquetes são ótimas para interação rápida e conhecer preferências.

**Diretrizes Adicionais:**
- Comece com uma saudação calorosa de "Bom dia!".
- Mantenha um tom motivador, prático e de parceria.
- Use emojis para tornar o plano visual e agradável.
- O plano de Stories deve ser o corpo principal da sua resposta.
- Finalize com uma mensagem de encorajamento.
`;

            logger.debug(`${planTAG} Prompt para IA (daily_story_plan):\n${promptForDailyTip.substring(0, 500)}...`);

            const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
            const completion = await openaiClient.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini', 
                messages: [{ role: "system", content: promptForDailyTip }],
                temperature: 0.75, 
                max_tokens: DAILY_PLAN_MAX_TOKENS, 
            }, { timeout: DAILY_PLAN_TIMEOUT_MS });
            
            const generatedPlan = completion.choices[0]?.message?.content?.trim();

            if (generatedPlan) {
                planText = `Bom dia, ${userForTip.name || 'tudo certo'}! ☀️\n\nCom base nos seus resultados e no seu objetivo de ${userGoal}, preparei um planejamento de Stories especial para você postar hoje (${today}). Ele foi pensado para mostrar seus bastidores e engajar sua audiência com os temas que ela mais curte:\n\n${generatedPlan}\n\nLembre-se que estas são sugestões para inspirar sua criatividade. Adapte ao seu estilo e aproveite o dia para se conectar com sua audiência! 😉🚀`;
            } else {
                logger.warn(`${planTAG} IA não retornou conteúdo para o planejamento de Stories do User ${userId}.`);
            }
            
            await sendWhatsAppMessage(userPhoneForTip, planText);
            logger.info(`${planTAG} Planejamento de Stories diário enviado para User ${userId}.`);
            return NextResponse.json({ success: true }, { status: 200 });

        } catch (error) {
            logger.error(`${planTAG} Erro ao processar planejamento de Stories diário para User ${userId}:`, error);
            if (userPhoneForTip) {
                try { await sendWhatsAppMessage(userPhoneForTip, "Desculpe, não consegui gerar seu planejamento de Stories hoje devido a um erro interno. Mas estou aqui se precisar de outras análises! 👍"); }
                catch (e) { logger.error(`${planTAG} Falha ao enviar mensagem de erro para User ${userId}:`, e); }
            }
            return NextResponse.json({ error: `Failed to process daily story plan: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
        }

    } else {
        const msgTAG = `${TAG}[UserMsg v2.5.1]`;
        logger.info(`${msgTAG} Processando mensagem normal para User ${userId}...`);

        if (!fromPhone || !incomingText) { return NextResponse.json({ error: 'Invalid payload for user message' }, { status: 400 }); }

        let user: IUser;
        let dialogueState: stateService.IDialogueState = {};
        let historyMessages: ChatCompletionMessageParam[] = [];
        let userName: string;
        let greeting: string;

        try {
            const [userData, stateData, historyData] = await Promise.all([
                dataService.lookupUserById(userId),
                stateService.getDialogueState(userId),
                stateService.getConversationHistory(userId)
            ]);
            user = userData;
            dialogueState = stateData;
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
            intentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
            
            if (intentResult.type === 'special_handled') {
                responseTextForSpecialHandled = intentResult.response;
            } else { 
                currentDeterminedIntent = intentResult.intent;
                if (intentResult.intent === 'user_confirms_pending_action' || intentResult.intent === 'user_denies_pending_action') {
                    pendingActionContextFromIntent = intentResult.pendingActionContext;
                }
            }
            logger.info(`${msgTAG} Resultado da intenção: ${JSON.stringify(intentResult)}`);
        } catch (intentError) {
            logger.error(`${msgTAG} Erro ao determinar intenção:`, intentError);
            currentDeterminedIntent = 'general';
        }

        if (responseTextForSpecialHandled) {
            logger.info(`${msgTAG} Enviando resposta special_handled: "${responseTextForSpecialHandled.slice(0,50)}..."`);
            await sendWhatsAppMessage(fromPhone, responseTextForSpecialHandled);
            
            const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: incomingText };
            const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: responseTextForSpecialHandled };
            const updatedHistory = [...historyMessages, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
            
            await stateService.setConversationHistory(userId, updatedHistory);
            await stateService.clearPendingActionState(userId);
            await stateService.updateDialogueState(userId, { lastInteraction: Date.now() });

            return NextResponse.json({ success: true }, { status: 200 });
        }

        let effectiveIncomingText = incomingText; 
        let effectiveIntent = currentDeterminedIntent as DeterminedIntent; 

        if (currentDeterminedIntent === 'user_confirms_pending_action') {
            logger.info(`${msgTAG} Usuário confirmou ação pendente. Contexto original: ${JSON.stringify(pendingActionContextFromIntent)}`);
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
            logger.info(`${msgTAG} Texto efetivo para IA após confirmação: "${effectiveIncomingText.slice(0,50)}...", Intenção efetiva: ${effectiveIntent}`);
            await stateService.clearPendingActionState(userId);
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
            logger.info(`${msgTAG} Usuário não respondeu diretamente à ação pendente (${dialogueState.lastAIQuestionType}). Limpando estado pendente.`);
            await stateService.clearPendingActionState(userId);
        }
        
        const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
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

        if (finalText && !isLightweightQuery && effectiveIntent !== 'user_confirms_pending_action' && effectiveIntent !== 'user_denies_pending_action') {
            const pendingActionInfo = aiResponseSuggestsPendingAction(finalText);
            if (pendingActionInfo.suggests && pendingActionInfo.actionType) {
                logger.info(`${msgTAG} Resposta da IA sugere uma nova ação pendente: ${pendingActionInfo.actionType}. Contexto: ${JSON.stringify(pendingActionInfo.pendingActionContext)}`);
                await stateService.updateDialogueState(userId, {
                    lastAIQuestionType: pendingActionInfo.actionType,
                    pendingActionContext: pendingActionInfo.pendingActionContext
                });
            } else {
                await stateService.clearPendingActionState(userId);
            }
        } else if (isLightweightQuery || effectiveIntent === 'user_confirms_pending_action' || effectiveIntent === 'user_denies_pending_action') {
            await stateService.clearPendingActionState(userId);
        }
        
        await sendWhatsAppMessage(fromPhone, finalText);
        logger.info(`${msgTAG} Resposta final enviada com sucesso para ${fromPhone}.`);
        
        let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
        try {
             logger.debug(`${msgTAG} Iniciando persistência no Redis para User ${userId}...`);
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
                 stateService.updateDialogueState(userId, nextStateToSave),
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
