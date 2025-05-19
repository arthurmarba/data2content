// src/app/api/whatsapp/process-response/route.ts
// v2.9.8 (Nome Sempre no Quebra-Gelo e Correção no Log de Minutos)
// - MODIFICADO: Quebra-gelo dinâmico agora sempre tenta usar o firstName do usuário.
//   A lógica de GREETING_THRESHOLD_MILLISECONDS foi removida desta decisão específica.
// - CORRIGIDO: Cálculo para exibição de minutos no log de frequência do quebra-gelo.
// v2.9.7 (Quebra-Gelo Sempre Enviado, Nome do Usuário Condicional por Frequência)
// v2.9.6 (Correção de Erro de Atribuição no Bloco Catch Final)
// v2.9.5 (Lógica de Interrupção no Worker)

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext, getQuickAcknowledgementLLMResponse } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService'; // Deve ser v1.9.4 ou superior
import * as dataService from '@/app/lib/dataService';
import { IUser, IUserPreferences } from '@/app/models/User';
import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import {
    determineIntent,
    normalizeText,
    getRandomGreeting,
    IntentResult,
    DeterminedIntent
} from '@/app/lib/intentService'; // Deve ser v2.18.6 ou superior
import { startOfDay } from 'date-fns';
import { generateConversationSummary, inferUserExpertiseLevel } from '@/app/lib/aiService';
import { getFunAcknowledgementPrompt } from '@/app/lib/funAcknowledgementPrompt'; // v1.3.0 ou superior

export const runtime = 'nodejs';

interface ProcessRequestBody {
  fromPhone?: string;
  incomingText?: string;
  userId: string;
  taskType?: string;
  determinedIntent: DeterminedIntent | null;
  qstashMessageId?: string;
}

function extractExcerpt(text: string, maxLength: number = 30): string {
    if (!text) return '';
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.substring(0, maxLength - 3)}...`;
}

const pickRandom = <T>(arr: T[]): T => {
  if (arr.length === 0) throw new Error('pickRandom: array vazio');
  const item = arr[Math.floor(Math.random() * arr.length)];
  if (item === undefined) throw new Error('pickRandom: item indefinido');
  return item;
};

const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10;
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;

const DAILY_PLAN_TIMEOUT_MS = 75000;
const DAILY_PLAN_MAX_TOKENS = 1200;
const DAILY_COMMUNITY_INSPIRATION_COUNT = 1;
const SUMMARY_GENERATION_INTERVAL = 3;
const EXPERTISE_INFERENCE_INTERVAL = 5;

// GREETING_THRESHOLD_MILLISECONDS pode ser mantido para outras lógicas de saudação futuras,
// mas não será usado para decidir se o *nome* vai no quebra-gelo desta rota.
const GREETING_THRESHOLD_MILLISECONDS = (process.env.GREETING_THRESHOLD_HOURS ? parseInt(process.env.GREETING_THRESHOLD_HOURS) : 3) * 60 * 60 * 1000;

const COMPLEX_TASK_INTENTS: DeterminedIntent[] = [
    'content_plan',
    'report',
];

const COMMON_GREETINGS_FOR_STRIPPING: string[] = [
    'fala meu querido', 'fala minha querida',
    'querido tuca', 'querida tuca',
    'tudo bem', 'tudo bom', 'bom dia', 'boa tarde', 'boa noite',
    'e aí', 'eae', 'fala aí',
    'oi', 'olá', 'ola', 'opa', 'fala', 'tuca'
];

const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
let receiver: Receiver | null = null;
if (currentSigningKey && nextSigningKey) {
    receiver = new Receiver({ currentSigningKey, nextSigningKey });
} else {
    logger.error("[QStash Worker Init v2.9.8] Chaves de assinatura QStash não definidas.");
}

function aiResponseSuggestsPendingAction(responseText: string): {
    suggests: boolean;
    actionType?: stateService.IDialogueState['lastAIQuestionType'];
    pendingActionContext?: stateService.IDialogueState['pendingActionContext']
} {
    const lowerResponse = responseText.toLowerCase();
    const generalQuestionKeywords = [
        "o que acha?", "quer que eu verifique?", "posso buscar esses dados?",
        "gostaria de prosseguir com isso?", "se quiser, posso tentar"
    ];
    const endsWithQuestionMark = lowerResponse.endsWith("?");
    const includesPosso = lowerResponse.includes("posso ");

    if (generalQuestionKeywords.some(kw => lowerResponse.includes(kw)) || (includesPosso && endsWithQuestionMark)) {
        if (lowerResponse.includes("dia da semana") || lowerResponse.includes("melhores dias") || lowerResponse.includes("desempenho por dia")) {
            return { suggests: true, actionType: 'confirm_fetch_day_stats', pendingActionContext: { originalSuggestion: responseText.slice(0, 250) } };
        }
        if ((lowerResponse.includes("objetivo específico") || lowerResponse.includes("métrica específica") || lowerResponse.includes("focar em algo")) &&
            (lowerResponse.includes("inspiração") || lowerResponse.includes("exemplos da comunidade"))) {
            let propContext = {};
            const propMatch = responseText.match(/para (?:a proposta|o tema)\s*['"]?([^'"\.,]+)['"]?/i);
            const contextMatch = responseText.match(/(?:no|para o) contexto\s*['"]?([^'"\.,]+)['"]?/i);
            if (propMatch?.[1]) (propContext as any).proposal = propMatch[1].trim();
            if (contextMatch?.[1]) (propContext as any).context = contextMatch[1].trim();

            return {
                suggests: true,
                actionType: 'clarify_community_inspiration_objective',
                pendingActionContext: Object.keys(propContext).length > 0 ? propContext : { originalQuery: responseText.slice(0, 250) }
            };
        }
        return { suggests: true, actionType: 'confirm_another_action', pendingActionContext: { originalSuggestion: responseText.slice(0, 250) } };
    }
    return { suggests: false };
}

function stripLeadingGreetings(text: string): string {
    let currentText = text;
    const normalizedInput = normalizeText(text);

    for (const greeting of COMMON_GREETINGS_FOR_STRIPPING) {
        const normalizedGreeting = normalizeText(greeting);

        if (normalizedInput.startsWith(normalizedGreeting)) {
            const greetingLengthInOriginalText = greeting.length;

            if (currentText.toLowerCase().startsWith(greeting.toLowerCase())) {
                const charAfterGreeting = currentText[greetingLengthInOriginalText];

                if (greetingLengthInOriginalText === currentText.length ||
                    !charAfterGreeting ||
                    charAfterGreeting === ' ' ||
                    charAfterGreeting === ',' ||
                    charAfterGreeting === '!' ||
                    charAfterGreeting === '.' ||
                    charAfterGreeting === '?') {

                    let textWithoutGreeting = currentText.substring(greetingLengthInOriginalText);
                    textWithoutGreeting = textWithoutGreeting.replace(/^[\s,!.\?¿¡]+/, '').trim();

                    if (textWithoutGreeting.length < currentText.length) {
                        logger.debug(`[stripLeadingGreetings v2.9.8] Saudação "${greeting}" removida. Original: "${text}", Resultante: "${textWithoutGreeting}"`);
                        return textWithoutGreeting;
                    }
                }
            }
        }
    }
    return text.trim();
}

async function generateDynamicAcknowledgementInWorker(
    firstName: string | null, 
    userQuery: string,
    userIdForLog: string,
    dialogueState: stateService.IDialogueState
): Promise<string | null> {
    const TAG_ACK = '[QStash Worker][generateDynamicAck v2.9.8]';

    const cleanedUserQuery = stripLeadingGreetings(userQuery);
    const queryExcerpt = extractExcerpt(cleanedUserQuery, 35);
    const conversationSummaryForPrompt = dialogueState.conversationSummary;

    logger.info(`${TAG_ACK} User ${userIdForLog}: Gerando reconhecimento. Nome para prompt: ${firstName || '(sem nome para prompt)'}. Query Original: "${userQuery.slice(0,50)}...", Query Limpa para Excerto: "${cleanedUserQuery.slice(0,50)}...", Excerto: "${queryExcerpt}"`);
    if (conversationSummaryForPrompt) {
        logger.debug(`${TAG_ACK} User ${userIdForLog}: Usando resumo da conversa para prompt do ack: "${conversationSummaryForPrompt.substring(0,100)}..."`);
    }

    try {
        const systemPromptForAck = getFunAcknowledgementPrompt(firstName, queryExcerpt, conversationSummaryForPrompt);
        const ackMessage = await getQuickAcknowledgementLLMResponse(systemPromptForAck, userQuery, firstName || 'usuário'); 

        if (ackMessage) {
            logger.info(`${TAG_ACK} User ${userIdForLog}: Reconhecimento dinâmico gerado: "${ackMessage.substring(0,70)}..."`);
            return ackMessage;
        } else {
            logger.warn(`${TAG_ACK} User ${userIdForLog}: getQuickAcknowledgementLLMResponse retornou null. Sem quebra-gelo dinâmico.`);
            return null;
        }
    } catch (error) {
        logger.error(`${TAG_ACK} User ${userIdForLog}: Erro ao gerar reconhecimento dinâmico via IA:`, error);
        return null;
    }
}


export async function POST(request: NextRequest): Promise<NextResponse> {
  const TAG = '[QStash Worker /process-response v2.9.8 AckNameAlways]';

  if (!receiver) {
      logger.error(`${TAG} QStash Receiver não inicializado.`);
      return NextResponse.json({ error: 'QStash Receiver not configured' }, { status: 500 });
  }

  let bodyText: string;
  let payload: ProcessRequestBody | undefined = undefined;
  let messageId_MsgAtual: string | undefined = undefined;

  try {
    bodyText = await request.text();
    const signature = request.headers.get('upstash-signature');
    if (!signature) { return NextResponse.json({ error: 'Missing signature header' }, { status: 401 }); }
    const isValid = await receiver.verify({ signature, body: bodyText });
    if (!isValid) { return NextResponse.json({ error: 'Invalid signature' }, { status: 401 }); }
    logger.info(`${TAG} Assinatura QStash verificada.`);

    try {
      payload = JSON.parse(bodyText) as ProcessRequestBody;
      if (!payload.userId) { throw new Error('Payload inválido: userId ausente.'); }
      if (payload.determinedIntent === undefined) { logger.warn(`${TAG} determinedIntent não presente no payload do QStash.`); }
      
      messageId_MsgAtual = payload.qstashMessageId || `internal_${payload.userId}_${Date.now()}`;
      logger.info(`${TAG} Processando MsgAtual com ID: ${messageId_MsgAtual}`);

    } catch (e: any) {
      logger.error(`${TAG} Erro ao parsear payload ou obter messageId: ${e.message}. BodyText (início): ${bodyText.slice(0,200)}`);
      return NextResponse.json({ error: 'Invalid request body or missing message ID' }, { status: 400 });
    }

    const { userId, taskType, incomingText, fromPhone, determinedIntent: intentFromPayload } = payload;

    if (taskType === "daily_tip") {
        // ... (código da Dica Diária existente)
        const planTAG = `${TAG}[DailyTip v2.9.8]`;
        logger.info(`${planTAG} Iniciando tarefa de Dica Diária para User ${userId}...`);
        let userForTip: IUser;
        let userPhoneForTip: string | null | undefined;
        let basePlanText: string = "Hoje não consegui preparar seu roteiro de Stories detalhado, mas que tal compartilhar algo espontâneo sobre seus bastidores? 😉";
        let finalMessageText: string;

        try {
            userForTip = await dataService.lookupUserById(userId);
            userPhoneForTip = userForTip.whatsappPhone;

            if (!userPhoneForTip || !userForTip.whatsappVerified) {
                logger.warn(`${planTAG} Usuário ${userId} não tem WhatsApp válido/verificado.`);
                return NextResponse.json({ success: true, message: "User has no verified WhatsApp number." }, { status: 200 });
            }

            const userFullNameForTip = userForTip.name || 'você';
            const userFirstNameForTip = userFullNameForTip.split(' ')[0]!;

            const userGoal = userForTip.goal || userForTip.userLongTermGoals?.[0]?.goal || 'aumentar o engajamento e criar uma conexão mais forte com a audiência';
            const latestReport = await dataService.getLatestAggregatedReport(userId);
            let performanceSummary = "Ainda não tenho dados suficientes sobre o desempenho dos seus posts para identificar os principais interesses da sua audiência neste momento.";
            let topPerformingThemes: string[] = [];

            if (latestReport) {
                const topProposals = latestReport.proposalStats?.slice(0, 2).map(p => p._id.proposal).filter(p => p && p !== "Outro") || [];
                const topContexts = latestReport.contextStats?.slice(0, 2).map(c => c._id.context).filter(c => c && c !== "Geral") || [];
                let summaryParts = [];
                if (topProposals.length > 0) { summaryParts.push(`Suas propostas de conteúdo que mais se destacaram recentemente foram: ${topProposals.join(' e ')}.`); topPerformingThemes.push(...topProposals); }
                if (topContexts.length > 0) { summaryParts.push(`Dentro dessas propostas, os contextos que geraram bom engajamento incluem: ${topContexts.join(' e ')}.`); topContexts.forEach(c => { if (!topPerformingThemes.includes(c)) topPerformingThemes.push(c); });}
                const firstTopPost = latestReport.top3Posts?.[0];
                if (firstTopPost && firstTopPost.description) { summaryParts.push(`Por exemplo, seu post sobre "${firstTopPost.description.substring(0, 40)}..." foi um dos que mais chamou a atenção.`); }
                if (summaryParts.length > 0) { performanceSummary = summaryParts.join(' '); }
            }

            const today = new Date().toLocaleDateString('pt-BR', { weekday: 'long' });
            const uniqueTopThemes = Array.from(new Set(topPerformingThemes)).slice(0, 3);
            const themesForPrompt = uniqueTopThemes.length > 0 ? uniqueTopThemes.join(', ') : 'temas variados de interesse do seu público';
            const followersCount = (await dataService.getLatestAccountInsights(userId))?.accountDetails?.followers_count || 'não disponível';

            const promptForDailyStoryPlan = `
Você é Tuca, consultor de Instagram para ${userFirstNameForTip}. Hoje é ${today}.
O objetivo principal de ${userFirstNameForTip} é: ${userGoal}.
Contexto sobre os Interesses da Audiência: ${performanceSummary} Principais temas/interesses: ${themesForPrompt}. Seguidores: ${followersCount}.
Sua Tarefa: Crie um PLANEJAMENTO DETALHADO DE STORIES para ${userFirstNameForTip} postar HOJE (10-12 ideias, manhã/tarde/noite, foco em bastidores/interesses da audiência, uso de RECURSOS DE ENGAJAMENTO).
Formato: Story [Nº] ([Período]): [Ideia Criativa + Recurso Engajamento] *✨ Por quê?* [Justificativa Breve]
Comece com "Bom dia!", tom motivador. Use emojis. O plano de Stories é o corpo principal. Finalize com encorajamento.`;

            logger.debug(`${planTAG} Prompt para Stories: ${promptForDailyStoryPlan.substring(0,300)}...`);
            const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
            const storyCompletion = await openaiClient.chat.completions.create({
                model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
                messages: [{ role: "system", content: promptForDailyStoryPlan }],
                temperature: 0.75, max_tokens: DAILY_PLAN_MAX_TOKENS,
            }, { timeout: DAILY_PLAN_TIMEOUT_MS });
            const generatedStoryPlan = storyCompletion.choices[0]?.message?.content?.trim();

            if (generatedStoryPlan) {
                basePlanText = `Bom dia, ${userFirstNameForTip}! ☀️\n\nCom base nos seus resultados e no seu objetivo de ${userGoal}, preparei um planejamento de Stories especial para você postar hoje (${today}). Ele foi pensado para mostrar seus bastidores e engajar sua audiência com os temas que ela mais curte:\n\n${generatedStoryPlan}`;
            } else {
                logger.warn(`${planTAG} IA não retornou conteúdo para o planejamento de Stories do User ${userId}.`);
                basePlanText = `Bom dia, ${userFirstNameForTip}! ☀️\n\nHoje não consegui preparar seu roteiro de Stories detalhado, mas que tal compartilhar algo espontâneo sobre seus bastidores? 😉`;
            }
            finalMessageText = basePlanText;

            if (userForTip.communityInspirationOptIn) {
                logger.info(`${planTAG} Usuário ${userId} optou por inspiração da comunidade. Tentando buscar...`);
                let inspirationText = "";
                try {
                    let targetObjectiveForInspiration = 'gerou_alto_engajamento';
                    let inspirationFilters: dataService.CommunityInspirationFilters = {
                        primaryObjectiveAchieved_Qualitative: targetObjectiveForInspiration,
                    };
                    if (uniqueTopThemes.length > 0) {
                        logger.debug(`${planTAG} Usando objetivo de inspiração padrão: ${targetObjectiveForInspiration}`);
                    }

                    let excludeInspirationIds: string[] = [];
                    if (userForTip.lastCommunityInspirationShown_Daily?.date && userForTip.lastCommunityInspirationShown_Daily.inspirationIds) {
                        const todayForCompare = startOfDay(new Date());
                        const lastShownDate = startOfDay(new Date(userForTip.lastCommunityInspirationShown_Daily.date));
                        if (todayForCompare.getTime() === lastShownDate.getTime()) {
                            excludeInspirationIds = userForTip.lastCommunityInspirationShown_Daily.inspirationIds.map(id => id.toString());
                        }
                    }

                    const communityInspirations = await dataService.getInspirations(
                        inspirationFilters,
                        DAILY_COMMUNITY_INSPIRATION_COUNT,
                        excludeInspirationIds
                    );

                    if (communityInspirations && communityInspirations.length > 0) {
                        const chosenInspiration = communityInspirations[0]!;

                        inspirationText = `\n\n✨ *Inspiração da Comunidade para Hoje!*\n`;
                        inspirationText += `Para te ajudar a alcançar seu objetivo de ${userGoal}, veja este exemplo da comunidade que se destacou em *${chosenInspiration.primaryObjectiveAchieved_Qualitative?.replace(/_/g, ' ')}*:\n`;
                        inspirationText += `"${chosenInspiration.contentSummary}" (Proposta: ${chosenInspiration.proposal}, Contexto: ${chosenInspiration.context})\n`;
                        inspirationText += `Veja o post original: ${chosenInspiration.originalInstagramPostUrl}\n`;
                        inspirationText += `Lembre-se: use como inspiração e adapte ao seu estilo! 😉`;

                        finalMessageText += inspirationText;
                        await dataService.recordDailyInspirationShown(userId, [chosenInspiration._id.toString()]);
                        logger.info(`${planTAG} Inspiração da comunidade ID ${chosenInspiration._id} adicionada à dica diária para User ${userId}.`);
                    } else {
                        logger.info(`${planTAG} Nenhuma inspiração da comunidade encontrada para User ${userId} com os filtros atuais.`);
                    }
                } catch (inspError) {
                    logger.error(`${planTAG} Erro ao buscar ou formatar inspiração da comunidade para User ${userId}:`, inspError);
                }
            } else {
                 logger.info(`${planTAG} Usuário ${userId} não optou por inspiração da comunidade. Pulando.`);
            }

            finalMessageText += `\n\nLembre-se que estas são sugestões para inspirar sua criatividade para os Stories. Adapte ao seu estilo e aproveite o dia para se conectar com sua audiência! 😉🚀`;

            await sendWhatsAppMessage(userPhoneForTip, finalMessageText);
            logger.info(`${planTAG} Dica diária (Stories + Inspiração Com.) enviada para User ${userId}.`);
            return NextResponse.json({ success: true }, { status: 200 });

        } catch (error) {
            logger.error(`${planTAG} Erro GERAL ao processar Dica Diária para User ${userId}:`, error);
            if (userPhoneForTip) {
                try { await sendWhatsAppMessage(userPhoneForTip, "Desculpe, não consegui gerar sua dica completa hoje devido a um erro interno. Mas estou aqui se precisar de outras análises! 👍"); }
                catch (e) { logger.error(`${planTAG} Falha ao enviar mensagem de erro de Dica Diária para User ${userId}:`, e); }
            }
            return NextResponse.json({ error: `Failed to process daily tip: ${error instanceof Error ? error.message : String(error)}` }, { status: 500 });
        }
    } else { // Processamento de mensagem normal do usuário
        const msgTAG = `${TAG}[UserMsg v2.9.8 AckNameAlways]`;
        logger.info(`${msgTAG} Processando mensagem normal (MsgAtual ID: ${messageId_MsgAtual}) para User ${userId}...`);

        if (!fromPhone || !incomingText) {
            logger.error(`${msgTAG} Payload inválido para mensagem de usuário (MsgAtual ID: ${messageId_MsgAtual}). fromPhone ou incomingText ausente.`);
            return NextResponse.json({ error: 'Invalid payload for user message' }, { status: 400 });
        }

        let user: IUser;
        let dialogueState: stateService.IDialogueState;
        let historyMessages: ChatCompletionMessageParam[] = [];
        let firstName: string;
        let greeting: string;
        let queryExcerpt_MsgAtual = extractExcerpt(incomingText, 30);

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
            logger.debug(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Dados carregados. Nome: ${firstName}, Histórico: ${historyMessages.length}, Estado Inicial: ${JSON.stringify(dialogueState)}`);

            const stateUpdateForProcessingStart: Partial<stateService.IDialogueState> = {
                currentProcessingMessageId: messageId_MsgAtual,
                currentProcessingQueryExcerpt: queryExcerpt_MsgAtual
            };
            if (dialogueState.interruptSignalForMessageId === messageId_MsgAtual) {
                stateUpdateForProcessingStart.interruptSignalForMessageId = null;
            }
            await stateService.updateDialogueState(userId, stateUpdateForProcessingStart);
            dialogueState = await stateService.getDialogueState(userId);
            logger.info(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Estado atualizado. currentProcessingMessageId setado para ${messageId_MsgAtual}. Excerto: "${queryExcerpt_MsgAtual}"`);

        } catch (err) {
            logger.error(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Erro ao carregar dados iniciais ou definir estado de processamento:`, err);
            try { await sendWhatsAppMessage(fromPhone, "Desculpe, tive um problema ao iniciar o processamento da sua mensagem. Tente novamente em instantes."); } catch (e) {}
            await stateService.updateDialogueState(userId, { currentProcessingMessageId: null, currentProcessingQueryExcerpt: null });
            return NextResponse.json({ error: `Failed to load initial user data or set processing state: ${err instanceof Error ? err.message : String(err)}` }, { status: 500 });
        }

        const normText = normalizeText(incomingText.trim());
        if (!normText) {
            logger.warn(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Mensagem normalizada vazia.`);
            const emptyNormResponse = `${greeting} Pode repetir, por favor? Não entendi bem.`;
            await sendWhatsAppMessage(fromPhone, emptyNormResponse);
            await stateService.updateDialogueState(userId, { currentProcessingMessageId: null, currentProcessingQueryExcerpt: null, lastInteraction: Date.now() });
            return NextResponse.json({ success: true, message: "Empty normalized text" }, { status: 200 });
        }

        let intentResult: IntentResult | undefined = undefined;
        let currentDeterminedIntent: DeterminedIntent | null = intentFromPayload;
        let responseTextForSpecialHandled: string | null = null;
        let pendingActionContextFromIntent: any = null;
        let dialogueStateUpdateForTaskStart: Partial<stateService.IDialogueState> = {};

        if (!currentDeterminedIntent) {
            logger.warn(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): 'determinedIntent' não veio no payload. Determinando agora.`);
            try {
                intentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
                if (intentResult.type === 'special_handled') {
                    responseTextForSpecialHandled = intentResult.response;
                    if (dialogueState.currentTask) {
                        dialogueStateUpdateForTaskStart.currentTask = null;
                    }
                } else { 
                    currentDeterminedIntent = intentResult.intent;
                    if (intentResult.intent === 'user_confirms_pending_action' || intentResult.intent === 'user_denies_pending_action') {
                        pendingActionContextFromIntent = intentResult.pendingActionContext;
                    } else if (COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent)) {
                         if (!dialogueState.currentTask || dialogueState.currentTask.name !== currentDeterminedIntent) {
                            const newCurrentTask: stateService.CurrentTask = { name: currentDeterminedIntent, objective: `Processar intenção: ${currentDeterminedIntent}`, currentStep: 'inicio' };
                            if (currentDeterminedIntent === 'content_plan' && incomingText.length > 20) { newCurrentTask.objective = `Criar plano de conteúdo baseado em: "${extractExcerpt(incomingText,100)}..."`; }
                            dialogueStateUpdateForTaskStart.currentTask = newCurrentTask;
                        }
                    } else if (dialogueState.currentTask && !COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent) && currentDeterminedIntent !== 'general') {
                        dialogueStateUpdateForTaskStart.currentTask = null;
                    }
                }
            } catch (intentError) { 
                logger.error(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Erro ao re-determinar intenção:`, intentError);
                currentDeterminedIntent = 'general';
                if (dialogueState.currentTask) dialogueStateUpdateForTaskStart.currentTask = null;
            }
        } else {
            logger.info(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Usando 'determinedIntent' ('${currentDeterminedIntent}') do payload.`);
            if (currentDeterminedIntent && (currentDeterminedIntent.startsWith('user_') || COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent))) {
                try {
                    const tempIntentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
                    if (tempIntentResult.type === 'intent_determined') {
                        intentResult = tempIntentResult;
                         if (COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent!)) { 
                            if (!dialogueState.currentTask || dialogueState.currentTask.name !== currentDeterminedIntent) {
                                const newCurrentTask: stateService.CurrentTask = { name: currentDeterminedIntent!, objective: `Processar intenção: ${currentDeterminedIntent}`, currentStep: 'inicio' };
                                if (currentDeterminedIntent === 'content_plan' && incomingText.length > 20) { newCurrentTask.objective = `Criar plano de conteúdo baseado em: "${extractExcerpt(incomingText,100)}..."`; }
                                dialogueStateUpdateForTaskStart.currentTask = newCurrentTask;
                            }
                         }
                    }
                } catch (e) {
                    logger.error(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Erro ao tentar obter detalhes da intenção (vinda do payload):`, e);
                }
            }
        }
        if (intentResult && intentResult.type === 'intent_determined' && currentDeterminedIntent) {
            const { extractedPreference, extractedGoal, extractedFact, memoryUpdateRequestContent } = intentResult;
            let updatedUserFromMemoryOp: IUser | null = null;
            try {
                if (currentDeterminedIntent === 'user_stated_preference' && extractedPreference) {
                    const prefPayload: Partial<IUserPreferences> = {};
                    const key = extractedPreference.field; const value = extractedPreference.value;
                    if (key === 'preferredFormats' || key === 'dislikedTopics') { (prefPayload as any)[key] = [value]; } else { (prefPayload as any)[key] = value; }
                    updatedUserFromMemoryOp = await dataService.updateUserPreferences(userId, prefPayload);
                } else if (currentDeterminedIntent === 'user_shared_goal' && extractedGoal) {
                    updatedUserFromMemoryOp = await dataService.addUserLongTermGoal(userId, extractedGoal);
                } else if (currentDeterminedIntent === 'user_mentioned_key_fact' && extractedFact) {
                    updatedUserFromMemoryOp = await dataService.addUserKeyFact(userId, extractedFact);
                } else if (currentDeterminedIntent === 'user_requests_memory_update' && memoryUpdateRequestContent) {
                    updatedUserFromMemoryOp = await dataService.addUserKeyFact(userId, memoryUpdateRequestContent);
                }
                if (updatedUserFromMemoryOp) user = updatedUserFromMemoryOp;
            } catch (memoryError) { logger.error(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Erro ao persistir memória:`, memoryError); }
        }

        if (Object.keys(dialogueStateUpdateForTaskStart).length > 0) {
            await stateService.updateDialogueState(userId, dialogueStateUpdateForTaskStart);
            dialogueState = await stateService.getDialogueState(userId);
        }

        if (responseTextForSpecialHandled) {
            await sendWhatsAppMessage(fromPhone, responseTextForSpecialHandled);
            const userMsgHist: ChatCompletionMessageParam = { role: 'user', content: incomingText! }; 
            const assistantMsgHist: ChatCompletionMessageParam = { role: 'assistant', content: responseTextForSpecialHandled };
            const updatedHistory = [...historyMessages, userMsgHist, assistantMsgHist].slice(-HISTORY_LIMIT);
            await stateService.setConversationHistory(userId, updatedHistory);
            
            const stateUpdateAfterSpecial: Partial<stateService.IDialogueState> = {
                lastInteraction: Date.now(),
                currentProcessingMessageId: null, 
                currentProcessingQueryExcerpt: null,
            };
            const currentDSForCounters = await stateService.getDialogueState(userId); 
            const currentSummaryTurn = currentDSForCounters.summaryTurnCounter || 0;
            if ((currentSummaryTurn + 1) >= SUMMARY_GENERATION_INTERVAL) {
                const summary = await generateConversationSummary(updatedHistory, firstName);
                if (summary) stateUpdateAfterSpecial.conversationSummary = summary;
                stateUpdateAfterSpecial.summaryTurnCounter = 0;
            } else {
                stateUpdateAfterSpecial.summaryTurnCounter = currentSummaryTurn + 1;
            }
            const currentExpertiseTurn = currentDSForCounters.expertiseInferenceTurnCounter || 0;
            if((currentExpertiseTurn + 1) >= EXPERTISE_INFERENCE_INTERVAL) {
                stateUpdateAfterSpecial.expertiseInferenceTurnCounter = 0;
            } else {
                stateUpdateAfterSpecial.expertiseInferenceTurnCounter = currentExpertiseTurn + 1;
            }
            await stateService.updateDialogueState(userId, stateUpdateAfterSpecial);
            return NextResponse.json({ success: true }, { status: 200 });
        }

        // MODIFICADO: Lógica do Quebra-Gelo Dinâmico - Nome sempre usado, log de minutos corrigido
        const nowForAck = Date.now();
        const lastInteractionTimeForAck = dialogueState.lastInteraction || 0;
        // let useNameToAck = true; // Removido, nome será usado por padrão no quebra-gelo

        // CORREÇÃO NO LOG:
        const minutesSinceLastInteraction = (nowForAck - lastInteractionTimeForAck) / (1000 * 60);
        if (lastInteractionTimeForAck !== 0) {
             logger.info(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Tempo desde a última interação: ${minutesSinceLastInteraction.toFixed(1)} min.`);
        } else {
            logger.info(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Primeira interação ou estado resetado. Quebra-gelo usará o nome.`);
        }
        
        const isLightweightIntentForDynamicAck = currentDeterminedIntent === 'social_query' ||
                                                 currentDeterminedIntent === 'meta_query_personal' ||
                                                 currentDeterminedIntent === 'generate_proactive_alert';
        let quebraGeloEnviado = false;

        if (!isLightweightIntentForDynamicAck &&
            currentDeterminedIntent !== 'user_confirms_pending_action' &&
            currentDeterminedIntent !== 'user_denies_pending_action' &&
            currentDeterminedIntent !== 'greeting'
            ) {
            try {
                // MODIFICADO: Passa firstName diretamente (ou null se firstName for nulo, o que não deve acontecer aqui)
                const dynamicAckMessage = await generateDynamicAcknowledgementInWorker(firstName, incomingText!, userId, dialogueState);
                if (dynamicAckMessage) {
                    await sendWhatsAppMessage(fromPhone!, dynamicAckMessage);
                    quebraGeloEnviado = true;
                    historyMessages.push({ role: 'assistant', content: dynamicAckMessage });
                    if (historyMessages.length > HISTORY_LIMIT) historyMessages.shift();
                }
            } catch (ackError) { logger.error(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Falha ao gerar/enviar quebra-gelo:`, ackError); }
        } else {
            if (isLightweightIntentForDynamicAck) {
                 logger.debug(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Pulando quebra-gelo dinâmico (intenção leve: ${currentDeterminedIntent}).`);
            } else if (currentDeterminedIntent === 'greeting') {
                logger.debug(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Pulando quebra-gelo dinâmico (intenção: greeting, já tratada).`);
            } else {
                logger.debug(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Pulando quebra-gelo dinâmico (outra condição). Intenção: ${currentDeterminedIntent}`);
            }
        }

        const freshDialogueState = await stateService.getDialogueState(userId);
        if (freshDialogueState.interruptSignalForMessageId === messageId_MsgAtual) {
            logger.info(`${msgTAG} User ${userId}: INTERRUPÇÃO DETECTADA para MsgAtual ID: ${messageId_MsgAtual} ("${queryExcerpt_MsgAtual}"). Sinal: ${freshDialogueState.interruptSignalForMessageId}. Pulando resposta principal.`);
            
            const userMsgHist: ChatCompletionMessageParam = { role: 'user', content: incomingText! };
            const finalHistoryForInterrupted = [...historyMessages, userMsgHist].slice(-HISTORY_LIMIT);
            
            await stateService.setConversationHistory(userId, finalHistoryForInterrupted);

            await stateService.updateDialogueState(userId, {
                currentProcessingMessageId: null,
                currentProcessingQueryExcerpt: null,
                interruptSignalForMessageId: null, 
                lastInteraction: Date.now(),
                summaryTurnCounter: freshDialogueState.summaryTurnCounter,
                expertiseInferenceTurnCounter: freshDialogueState.expertiseInferenceTurnCounter,
                conversationSummary: freshDialogueState.conversationSummary,
                currentTask: freshDialogueState.currentTask,
            });
            logger.info(`${msgTAG} User ${userId}: Estado limpo após interrupção de MsgAtual ID: ${messageId_MsgAtual}.`);
            return NextResponse.json({ success: true, message: 'Processing interrupted by newer user message.' }, { status: 200 });
        }
        logger.debug(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Sem sinal de interrupção. Prosseguindo para resposta principal.`);

        let effectiveIncomingText = incomingText!; 
        let effectiveIntent = currentDeterminedIntent as DeterminedIntent;

        if (currentDeterminedIntent === 'user_confirms_pending_action') {
            if (dialogueState.lastAIQuestionType === 'confirm_fetch_day_stats' && pendingActionContextFromIntent?.originalUserQuery) {
                effectiveIncomingText = `Sim, por favor, quero saber sobre ${pendingActionContextFromIntent.originalUserQuery}. Mostre-me o desempenho por dia da semana.`;
                effectiveIntent = 'ASK_BEST_TIME';
            } else if (dialogueState.lastAIQuestionType === 'clarify_community_inspiration_objective' && pendingActionContextFromIntent) {
                const originalProposal = (pendingActionContextFromIntent as any)?.proposal || "um tema relevante";
                const originalContext = (pendingActionContextFromIntent as any)?.context || "uma abordagem específica";
                effectiveIncomingText = `Para a inspiração sobre proposta '${originalProposal}' e contexto '${originalContext}', confirmo que quero focar em '${incomingText!.trim()}'. Por favor, busque exemplos.`;
                effectiveIntent = 'ask_community_inspiration';
                if (dialogueState.currentTask?.name === 'ask_community_inspiration') {
                    await stateService.updateDialogueState(userId, { currentTask: { ...dialogueState.currentTask, parameters: { ...(dialogueState.currentTask.parameters || {}), primaryObjectiveAchieved_Qualitative: incomingText!.trim() }, currentStep: 'objective_clarified' } });
                    dialogueState = await stateService.getDialogueState(userId); 
                }
            } else if (pendingActionContextFromIntent?.originalSuggestion) {
                 effectiveIncomingText = `Sim, pode prosseguir com: "${pendingActionContextFromIntent.originalSuggestion}"`;
                 effectiveIntent = 'general';
            } else {
                effectiveIncomingText = "Sim, por favor, prossiga.";
                effectiveIntent = 'general';
            }
            await stateService.clearPendingActionState(userId);
        } else if (currentDeterminedIntent === 'user_denies_pending_action') {
            const denialResponse = pickRandom(["Entendido. Como posso te ajudar então?", "Ok. O que você gostaria de fazer a seguir?"]);
            await sendWhatsAppMessage(fromPhone!, denialResponse);
            const userMsgHistDeny: ChatCompletionMessageParam = { role: 'user', content: incomingText! };
            const assistantMsgHistDeny: ChatCompletionMessageParam = { role: 'assistant', content: denialResponse };
            const updatedHistoryDeny = [...historyMessages, userMsgHistDeny, assistantMsgHistDeny].slice(-HISTORY_LIMIT);
            await stateService.setConversationHistory(userId, updatedHistoryDeny);
            
            const stateUpdateAfterDenial: Partial<stateService.IDialogueState> = { 
                lastInteraction: Date.now(), 
                currentProcessingMessageId: null, 
                currentProcessingQueryExcerpt: null,
                lastAIQuestionType: undefined,
                pendingActionContext: undefined,
            };
            await stateService.updateDialogueState(userId, stateUpdateAfterDenial);
            return NextResponse.json({ success: true }, { status: 200 });
        } else if (dialogueState.lastAIQuestionType) { 
            await stateService.clearPendingActionState(userId);
            dialogueState = await stateService.getDialogueState(userId); 
        }

        const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
        const enrichedContext = { user, historyMessages: limitedHistoryMessages, dialogueState: dialogueState, userName: firstName };
        let finalText = '';
        let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
        
        try {
            const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(enrichedContext, effectiveIncomingText, effectiveIntent);
            historyPromise = hp;
            const reader = stream.getReader();
            let streamReadTimeout: NodeJS.Timeout | null = setTimeout(() => { logger.warn(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Timeout stream...`); streamReadTimeout = null; reader?.cancel().catch(()=>{/*ignore*/}); }, STREAM_READ_TIMEOUT_MS);
            while (true) { 
                 let value: string | undefined; let done: boolean | undefined;
                 try { const result = await reader.read(); if (streamReadTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
                 catch (readError: any) { if (streamReadTimeout) clearTimeout(streamReadTimeout); streamReadTimeout = null; throw new Error(`Erro stream read: ${readError.message}`); }
                 if (done) { break; } if (typeof value === 'string') { finalText += value; }
            }
            if (streamReadTimeout) { clearTimeout(streamReadTimeout); streamReadTimeout = null; }
            if (finalText.trim().length === 0) { finalText = 'Hum... não consegui gerar uma resposta completa agora.'; }
        } catch (err: any) { 
            logger.error(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Erro LLM:`, err);
            finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
        }

        await sendWhatsAppMessage(fromPhone!, finalText);
        logger.info(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Resposta principal enviada.`);

        let finalDialogueStateUpdate: Partial<stateService.IDialogueState> = { lastInteraction: Date.now() };
        
        if (finalText && effectiveIntent !== 'social_query' && effectiveIntent !== 'meta_query_personal' && effectiveIntent !== 'user_confirms_pending_action' && effectiveIntent !== 'user_denies_pending_action') {
            const pendingActionInfo = aiResponseSuggestsPendingAction(finalText);
            if (pendingActionInfo.suggests && pendingActionInfo.actionType) {
                finalDialogueStateUpdate.lastAIQuestionType = pendingActionInfo.actionType;
                finalDialogueStateUpdate.pendingActionContext = pendingActionInfo.pendingActionContext;
                if (dialogueState.currentTask) finalDialogueStateUpdate.currentTask = { ...dialogueState.currentTask, currentStep: `aguardando_confirmacao_sobre_${pendingActionInfo.actionType}` };
            } else {
                finalDialogueStateUpdate.lastAIQuestionType = undefined;
                finalDialogueStateUpdate.pendingActionContext = undefined;
                if (dialogueState.currentTask) finalDialogueStateUpdate.currentTask = null;
            }
        } else { 
            finalDialogueStateUpdate.lastAIQuestionType = undefined;
            finalDialogueStateUpdate.pendingActionContext = undefined;
            if (dialogueState.currentTask && (effectiveIntent === 'social_query' || effectiveIntent === 'meta_query_personal')) {
                finalDialogueStateUpdate.currentTask = null;
            }
        }

        const finalDialogueStateBeforeSave = await stateService.getDialogueState(userId);
        if (finalDialogueStateBeforeSave.currentProcessingMessageId === messageId_MsgAtual) {
            finalDialogueStateUpdate.currentProcessingMessageId = null;
            finalDialogueStateUpdate.currentProcessingQueryExcerpt = null;
            logger.info(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Limpando currentProcessingMessageId e excerpt após processamento normal.`);
        } else {
            logger.warn(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): currentProcessingMessageId no Redis (${finalDialogueStateBeforeSave.currentProcessingMessageId}) não corresponde ao ID desta tarefa. Não limpando.`);
        }
        
        let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
        if (historyPromise) { try { finalHistoryForSaving = await historyPromise; } catch { finalHistoryForSaving = [...historyMessages.slice(-HISTORY_LIMIT + 2), {role: 'user', content: effectiveIncomingText}, {role: 'assistant', content: finalText}];} } 
        else { finalHistoryForSaving = [...historyMessages.slice(-HISTORY_LIMIT + 2), {role: 'user', content: effectiveIncomingText}, {role: 'assistant', content: finalText}]; }

        const currentSummaryTurnFinal = (finalDialogueStateBeforeSave.summaryTurnCounter || 0) +1; 
        if (currentSummaryTurnFinal >= SUMMARY_GENERATION_INTERVAL) {
            const summary = await generateConversationSummary(finalHistoryForSaving, firstName);
            if (summary) finalDialogueStateUpdate.conversationSummary = summary;
            finalDialogueStateUpdate.summaryTurnCounter = 0;
        } else {
            finalDialogueStateUpdate.summaryTurnCounter = currentSummaryTurnFinal;
        }
        const currentExpertiseTurnFinal = (finalDialogueStateBeforeSave.expertiseInferenceTurnCounter || 0) + 1;
        if(currentExpertiseTurnFinal >= EXPERTISE_INFERENCE_INTERVAL) {
            const inferredLevel = await inferUserExpertiseLevel(finalHistoryForSaving, firstName);
            if (inferredLevel && user.inferredExpertiseLevel !== inferredLevel) { 
                await dataService.updateUserExpertiseLevel(userId, inferredLevel);
            }
            finalDialogueStateUpdate.expertiseInferenceTurnCounter = 0;
        } else {
            finalDialogueStateUpdate.expertiseInferenceTurnCounter = currentExpertiseTurnFinal;
        }

        await stateService.updateDialogueState(userId, finalDialogueStateUpdate);
        if (finalHistoryForSaving.length > 0) {
            await stateService.setConversationHistory(userId, finalHistoryForSaving);
        }
        await stateService.setInCache(`resp:${fromPhone!}:${effectiveIncomingText.trim().slice(0, 100)}`, finalText, CACHE_TTL_SECONDS);
        await stateService.incrementUsageCounter(userId);
        
        logger.info(`${msgTAG} User ${userId} (MsgAtual ID: ${messageId_MsgAtual}): Tarefa de mensagem normal concluída.`);
        return NextResponse.json({ success: true }, { status: 200 });
    }

  } catch (error: any) {
    const logMsgId = messageId_MsgAtual || 'N/A';
    logger.error(`${TAG} Erro GERAL não tratado na API worker (MsgAtual ID: ${logMsgId}):`, error);
    
    if (payload && payload.userId && messageId_MsgAtual) {
        try {
            const errorState = await stateService.getDialogueState(payload.userId);
            if (errorState.currentProcessingMessageId === messageId_MsgAtual) {
                await stateService.updateDialogueState(payload.userId, { currentProcessingMessageId: null, currentProcessingQueryExcerpt: null });
                logger.info(`${TAG} Estado de processamento limpo para MsgAtual ID: ${messageId_MsgAtual} após erro geral.`);
            }
        } catch (cleanupError) {
            logger.error(`${TAG} Erro ao tentar limpar estado de processamento para MsgAtual ID: ${messageId_MsgAtual} após erro geral:`, cleanupError);
        }
    } else {
        logger.warn(`${TAG} Não foi possível tentar limpar o estado de processamento após erro geral: payload ou messageId_MsgAtual não definidos. Payload: ${!!payload}, MsgAtual ID: ${messageId_MsgAtual}`);
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }

  const finalLogMsgId = messageId_MsgAtual || 'N/A';
  logger.error(`${TAG} Código atingiu o final da função POST inesperadamente (MsgAtual ID: ${finalLogMsgId}).`);
  return NextResponse.json({ error: 'Server ended without an explicit response.' }, { status: 500 });
}

