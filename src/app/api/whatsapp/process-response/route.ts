// src/app/api/whatsapp/process-response/route.ts
// v2.9.4 (Melhoria na Limpeza de Saudação para Ack Dinâmico)
// - ATUALIZADO: `stripLeadingGreetings` melhorada para lidar com saudações compostas
//   e remover pontuação adjacente de forma mais eficaz. Ordenada a lista de saudações.
// v2.9.3 (Ack Dinâmico com Contexto do Resumo da Conversa)
// - ATUALIZADO: `generateDynamicAcknowledgementInWorker` agora busca o `conversationSummary`
//   do `dialogueState` e o passa para `getFunAcknowledgementPrompt`.

import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from "@upstash/qstash";
import { logger } from '@/app/lib/logger';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { askLLMWithEnrichedContext, getQuickAcknowledgementLLMResponse } from '@/app/lib/aiOrchestrator';
import * as stateService from '@/app/lib/stateService'; 
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
} from '@/app/lib/intentService'; 
import { startOfDay } from 'date-fns';
import { generateConversationSummary, inferUserExpertiseLevel } from '@/app/lib/aiService'; 
import { getFunAcknowledgementPrompt } from '@/app/lib/funAcknowledgementPrompt'; // Deve ser v1.1.0 ou superior

export const runtime = 'nodejs';

interface ProcessRequestBody {
  fromPhone?: string;
  incomingText?: string;
  userId: string;
  taskType?: string;
  determinedIntent: DeterminedIntent | null; 
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

const COMPLEX_TASK_INTENTS: DeterminedIntent[] = [
    'content_plan', 
    'report', 
];

// ATUALIZADO v2.9.4: Lista de saudações ordenada da mais longa para a mais curta
// para evitar remoções parciais.
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
    logger.error("[QStash Worker Init] Chaves de assinatura QStash não definidas.");
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

/**
 * ATUALIZADO v2.9.4: Remove saudações comuns do início do texto de forma mais eficaz.
 * A lista de saudações é ordenada da mais longa para a mais curta.
 * Lida melhor com pontuação adjacente.
 */
function stripLeadingGreetings(text: string): string {
    let currentText = text;
    const normalizedInput = normalizeText(text); 

    for (const greeting of COMMON_GREETINGS_FOR_STRIPPING) {
        const normalizedGreeting = normalizeText(greeting);
        
        // Verifica se o texto normalizado começa com a saudação normalizada
        if (normalizedInput.startsWith(normalizedGreeting)) {
            // Calcula o índice final da saudação no texto original (case-sensitive)
            // Isso é um pouco mais complexo se a saudação original tiver capitalização diferente
            // da lista, mas para esta lista, a correspondência direta do tamanho deve funcionar.
            const greetingLengthInOriginalText = greeting.length; 

            if (currentText.toLowerCase().startsWith(greeting.toLowerCase())) { // Checagem case-insensitive no texto original
                const charAfterGreeting = currentText[greetingLengthInOriginalText];

                // Verifica se após a saudação há um delimitador comum ou se é o fim da string
                if (greetingLengthInOriginalText === currentText.length || 
                    !charAfterGreeting || // Chegou ao fim da string
                    charAfterGreeting === ' ' || 
                    charAfterGreeting === ',' || 
                    charAfterGreeting === '!' || 
                    charAfterGreeting === '.' ||
                    charAfterGreeting === '?') {
                    
                    let textWithoutGreeting = currentText.substring(greetingLengthInOriginalText);
                    
                    // Remove pontuação e espaços extras do início da string resultante
                    textWithoutGreeting = textWithoutGreeting.replace(/^[\s,!.\?¿¡]+/, '').trim();
                    
                    // Se a remoção resultou em uma string diferente e mais curta, atualiza e sai
                    if (textWithoutGreeting.length < currentText.length) {
                        logger.debug(`[stripLeadingGreetings] Saudação "${greeting}" removida. Original: "${text}", Resultante: "${textWithoutGreeting}"`);
                        return textWithoutGreeting;
                    }
                }
            }
        }
    }
    // Se nenhuma saudação da lista foi removida, retorna o texto original (pode já estar trimado)
    return text.trim(); 
}


/**
 * Gera a mensagem de reconhecimento dinâmica ("quebra-gelo") chamando a IA.
 */
async function generateDynamicAcknowledgementInWorker(
    userName: string,
    userQuery: string, 
    userIdForLog: string,
    dialogueState: stateService.IDialogueState 
): Promise<string | null> {
    const TAG_ACK = '[QStash Worker][generateDynamicAck v2.9.4]'; // Tag de versão atualizada
    
    // ATUALIZADO v2.9.4: stripLeadingGreetings foi melhorada
    const cleanedUserQuery = stripLeadingGreetings(userQuery);
    const queryExcerpt = cleanedUserQuery.length > 35 ? `${cleanedUserQuery.substring(0, 32)}...` : cleanedUserQuery;
    const conversationSummaryForPrompt = dialogueState.conversationSummary; 
    
    logger.info(`${TAG_ACK} User ${userIdForLog}: Gerando reconhecimento. Query Original: "${userQuery.slice(0,50)}...", Query Limpa para Excerto: "${cleanedUserQuery.slice(0,50)}...", Excerto: "${queryExcerpt}"`);
    if (conversationSummaryForPrompt) {
        logger.debug(`${TAG_ACK} User ${userIdForLog}: Usando resumo da conversa para prompt do ack: "${conversationSummaryForPrompt.substring(0,100)}..."`);
    }
    
    try {
        const systemPromptForAck = getFunAcknowledgementPrompt(userName, queryExcerpt, conversationSummaryForPrompt);
        const ackMessage = await getQuickAcknowledgementLLMResponse(systemPromptForAck, userQuery, userName); 
        
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
  const TAG = '[QStash Worker /process-response v2.9.4]'; // Versão atualizada

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
      if (payload.determinedIntent === undefined) { logger.warn(`${TAG} determinedIntent não presente no payload do QStash.`); }
    } catch (e) { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }

    const { userId, taskType, incomingText, fromPhone, determinedIntent: intentFromPayload } = payload;

    if (taskType === "daily_tip") {
        const planTAG = `${TAG}[DailyTip v2.9.4]`; 
        logger.info(`${planTAG} Iniciando tarefa de Dica Diária para User ${userId}...`);
        // ... (código da Dica Diária existente, não modificado para esta funcionalidade) ...
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
            const userNameForPrompt = userForTip.name || 'você';
            const uniqueTopThemes = Array.from(new Set(topPerformingThemes)).slice(0, 3); 
            const themesForPrompt = uniqueTopThemes.length > 0 ? uniqueTopThemes.join(', ') : 'temas variados de interesse do seu público';
            const followersCount = (await dataService.getLatestAccountInsights(userId))?.accountDetails?.followers_count || 'não disponível';

            const promptForDailyStoryPlan = `
Você é Tuca, consultor de Instagram para ${userNameForPrompt}. Hoje é ${today}.
O objetivo principal de ${userNameForPrompt} é: ${userGoal}.
Contexto sobre os Interesses da Audiência: ${performanceSummary} Principais temas/interesses: ${themesForPrompt}. Seguidores: ${followersCount}.
Sua Tarefa: Crie um PLANEJAMENTO DETALHADO DE STORIES para ${userNameForPrompt} postar HOJE (10-12 ideias, manhã/tarde/noite, foco em bastidores/interesses da audiência, uso de RECURSOS DE ENGAJAMENTO).
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
                basePlanText = `Bom dia, ${userForTip.name || 'tudo certo'}! ☀️\n\nCom base nos seus resultados e no seu objetivo de ${userGoal}, preparei um planejamento de Stories especial para você postar hoje (${today}). Ele foi pensado para mostrar seus bastidores e engajar sua audiência com os temas que ela mais curte:\n\n${generatedStoryPlan}`;
            } else {
                logger.warn(`${planTAG} IA não retornou conteúdo para o planejamento de Stories do User ${userId}.`);
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
    } else { 
        const msgTAG = `${TAG}[UserMsg v2.9.4]`; // Tag de versão atualizada
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
            logger.debug(`${msgTAG} Dados carregados User: ${userId}. Histórico ${historyMessages.length}. Estado: ${JSON.stringify(dialogueState)}`);
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

        let intentResult: IntentResult | undefined = undefined;
        let currentDeterminedIntent: DeterminedIntent | null = intentFromPayload;
        let responseTextForSpecialHandled: string | null = null;
        let pendingActionContextFromIntent: any = null;
        let dialogueStateUpdateForTaskStart: Partial<stateService.IDialogueState> = {};

        if (!currentDeterminedIntent) {
            logger.warn(`${msgTAG} 'determinedIntent' não veio no payload do QStash para User ${userId}. Determinando agora.`);
            try {
                intentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
                if (intentResult.type === 'special_handled') { 
                    responseTextForSpecialHandled = intentResult.response; 
                    if (dialogueState.currentTask) {
                        logger.info(`${msgTAG} [SpecialHandled] Limpando currentTask (${dialogueState.currentTask.name}) devido à interação simples.`);
                        dialogueStateUpdateForTaskStart.currentTask = null;
                    }
                } else { 
                    currentDeterminedIntent = intentResult.intent; 
                    if (intentResult.intent === 'user_confirms_pending_action' || intentResult.intent === 'user_denies_pending_action') { 
                        pendingActionContextFromIntent = intentResult.pendingActionContext; 
                    } else if (COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent)) {
                         if (!dialogueState.currentTask || dialogueState.currentTask.name !== currentDeterminedIntent) {
                            logger.info(`${msgTAG} Nova tarefa complexa '${currentDeterminedIntent}' detectada. Definindo currentTask.`);
                            const newCurrentTask: stateService.CurrentTask = {
                                name: currentDeterminedIntent,
                                objective: `Processar intenção: ${currentDeterminedIntent}`, 
                                currentStep: 'inicio', 
                            };
                            if (currentDeterminedIntent === 'content_plan' && incomingText.length > 20) { 
                                newCurrentTask.objective = `Criar plano de conteúdo baseado em: "${incomingText.substring(0, 100)}..."`;
                            }
                            dialogueStateUpdateForTaskStart.currentTask = newCurrentTask;
                        } else {
                            logger.debug(`${msgTAG} Intenção '${currentDeterminedIntent}' corresponde à currentTask ativa. Mantendo.`);
                        }
                    } else if (dialogueState.currentTask && !COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent) && currentDeterminedIntent !== 'general') {
                        logger.info(`${msgTAG} Nova intenção '${currentDeterminedIntent}' não relacionada à currentTask ativa (${dialogueState.currentTask.name}). Limpando currentTask.`);
                        dialogueStateUpdateForTaskStart.currentTask = null;
                    }
                }
                logger.info(`${msgTAG} Resultado da re-determinação de intenção: ${JSON.stringify(intentResult)}`);
            } catch (intentError) { 
                logger.error(`${msgTAG} Erro ao re-determinar intenção:`, intentError); 
                currentDeterminedIntent = 'general'; 
                if (dialogueState.currentTask) { 
                    dialogueStateUpdateForTaskStart.currentTask = null;
                }
            }
        } else {
            logger.info(`${msgTAG} Usando 'determinedIntent' ('${currentDeterminedIntent}') do payload QStash para User ${userId}.`);
            if (currentDeterminedIntent && (currentDeterminedIntent.startsWith('user_') || COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent))) {
                try {
                    const tempIntentResult = await determineIntent(normText, user, incomingText, dialogueState, greeting, userId);
                    if (tempIntentResult.type === 'intent_determined') {
                        intentResult = tempIntentResult; 
                         if (COMPLEX_TASK_INTENTS.includes(currentDeterminedIntent)) {
                            if (!dialogueState.currentTask || dialogueState.currentTask.name !== currentDeterminedIntent) {
                                logger.info(`${msgTAG} [Payload] Nova tarefa complexa '${currentDeterminedIntent}' detectada. Definindo currentTask.`);
                                const newCurrentTask: stateService.CurrentTask = { name: currentDeterminedIntent, objective: `Processar intenção: ${currentDeterminedIntent}`, currentStep: 'inicio' };
                                if (currentDeterminedIntent === 'content_plan' && incomingText.length > 20) { newCurrentTask.objective = `Criar plano de conteúdo baseado em: "${incomingText.substring(0, 100)}..."`; }
                                dialogueStateUpdateForTaskStart.currentTask = newCurrentTask;
                            }
                         }
                    }
                } catch (e) {
                    logger.error(`${msgTAG} Erro ao tentar obter detalhes da intenção (vinda do payload):`, e);
                }
            }
        }
        
        if (intentResult && intentResult.type === 'intent_determined' && currentDeterminedIntent) {
            const { extractedPreference, extractedGoal, extractedFact, memoryUpdateRequestContent } = intentResult;
            let updatedUserFromMemoryOp: IUser | null = null;
            try {
                if (currentDeterminedIntent === 'user_stated_preference' && extractedPreference) {
                    logger.info(`${msgTAG} Intenção 'user_stated_preference' detectada. Tentando persistir preferência: ${JSON.stringify(extractedPreference)} para User ${userId}`);
                    const prefPayload: Partial<IUserPreferences> = {};
                    const key = extractedPreference.field;
                    const value = extractedPreference.value;
                    if (key === 'preferredFormats' || key === 'dislikedTopics') {
                        (prefPayload as any)[key] = [value]; 
                    } else {
                        (prefPayload as any)[key] = value;
                    }
                    updatedUserFromMemoryOp = await dataService.updateUserPreferences(userId, prefPayload);
                    if (updatedUserFromMemoryOp) logger.info(`${msgTAG} Preferência do usuário salva com sucesso: ${key} = ${value}`);
                } else if (currentDeterminedIntent === 'user_shared_goal' && extractedGoal) {
                    logger.info(`${msgTAG} Intenção 'user_shared_goal' detectada. Tentando persistir objetivo: "${extractedGoal}" para User ${userId}`);
                    updatedUserFromMemoryOp = await dataService.addUserLongTermGoal(userId, extractedGoal);
                    if (updatedUserFromMemoryOp) logger.info(`${msgTAG} Objetivo de longo prazo salvo com sucesso: "${extractedGoal}"`);
                } else if (currentDeterminedIntent === 'user_mentioned_key_fact' && extractedFact) {
                    logger.info(`${msgTAG} Intenção 'user_mentioned_key_fact' detectada. Tentando persistir fato chave: "${extractedFact}" para User ${userId}`);
                    updatedUserFromMemoryOp = await dataService.addUserKeyFact(userId, extractedFact);
                    if (updatedUserFromMemoryOp) logger.info(`${msgTAG} Fato chave salvo com sucesso: "${extractedFact}"`);
                } else if (currentDeterminedIntent === 'user_requests_memory_update' && memoryUpdateRequestContent) {
                    logger.info(`${msgTAG} Intenção 'user_requests_memory_update' detectada. Tentando persistir como fato chave: "${memoryUpdateRequestContent}" para User ${userId}`);
                    updatedUserFromMemoryOp = await dataService.addUserKeyFact(userId, memoryUpdateRequestContent);
                    if (updatedUserFromMemoryOp) logger.info(`${msgTAG} Conteúdo de solicitação de memória salvo como fato chave: "${memoryUpdateRequestContent}"`);
                }
                if (updatedUserFromMemoryOp) {
                    user = updatedUserFromMemoryOp; 
                    logger.info(`${msgTAG} Objeto User local atualizado após operação de memória bem-sucedida.`);
                }
            } catch (memoryError) {
                logger.error(`${msgTAG} Erro ao persistir informação de memória para User ${userId}:`, memoryError);
            }
        }

        if (Object.keys(dialogueStateUpdateForTaskStart).length > 0) {
            await stateService.updateDialogueState(userId, dialogueStateUpdateForTaskStart);
            dialogueState = await stateService.getDialogueState(userId); 
            logger.debug(`${msgTAG} Estado do diálogo atualizado com informações de currentTask: ${JSON.stringify(dialogueState.currentTask)}`);
        }

        if (responseTextForSpecialHandled) { 
            logger.info(`${msgTAG} Enviando resposta special_handled: "${responseTextForSpecialHandled.slice(0,50)}..."`);
            await sendWhatsAppMessage(fromPhone, responseTextForSpecialHandled);
            const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: incomingText };
            const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: responseTextForSpecialHandled };
            const updatedHistory = [...historyMessages, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
            await stateService.setConversationHistory(userId, updatedHistory);
            await stateService.clearPendingActionState(userId); 
            
            let dialogueUpdateForSummaryAndExpertise: Partial<stateService.IDialogueState> = { lastInteraction: Date.now() };
            
            const currentDialogueStateForCounters = await stateService.getDialogueState(userId);

            const currentSummaryTurnCounter = currentDialogueStateForCounters.summaryTurnCounter || 0;
            const newSummaryTurnCounter = currentSummaryTurnCounter + 1;

            if (newSummaryTurnCounter >= SUMMARY_GENERATION_INTERVAL) {
                logger.info(`${msgTAG} [SpecialHandled] Intervalo de sumarização atingido (${newSummaryTurnCounter}). Gerando resumo...`);
                const summary = await generateConversationSummary(updatedHistory, userName);
                if (summary) {
                    dialogueUpdateForSummaryAndExpertise.conversationSummary = summary;
                    logger.debug(`${msgTAG} [SpecialHandled] Resumo gerado: "${summary.substring(0,100)}..."`);
                } else {
                    logger.warn(`${msgTAG} [SpecialHandled] Geração de resumo retornou vazio.`);
                }
                dialogueUpdateForSummaryAndExpertise.summaryTurnCounter = 0; 
            } else {
                dialogueUpdateForSummaryAndExpertise.summaryTurnCounter = newSummaryTurnCounter;
            }
            dialogueUpdateForSummaryAndExpertise.currentTask = currentDialogueStateForCounters.currentTask; 
            
            const currentExpertiseTurnCounter = currentDialogueStateForCounters.expertiseInferenceTurnCounter || 0;
            const newExpertiseTurnCounter = currentExpertiseTurnCounter + 1;
            if (newExpertiseTurnCounter >= EXPERTISE_INFERENCE_INTERVAL) {
                 logger.info(`${msgTAG} [SpecialHandled] Intervalo de inferência de expertise atingido (${newExpertiseTurnCounter}). Resetando contador.`);
                 dialogueUpdateForSummaryAndExpertise.expertiseInferenceTurnCounter = 0; 
            } else {
                dialogueUpdateForSummaryAndExpertise.expertiseInferenceTurnCounter = newExpertiseTurnCounter;
            }
            
            await stateService.updateDialogueState(userId, dialogueUpdateForSummaryAndExpertise);
            logger.debug(`${msgTAG} [SpecialHandled] Contadores de sumário e expertise atualizados.`);
            
            return NextResponse.json({ success: true }, { status: 200 });
        }

        let effectiveIncomingText = incomingText; 
        let effectiveIntent = currentDeterminedIntent as DeterminedIntent; 

        if (currentDeterminedIntent === 'user_confirms_pending_action') {
            logger.info(`${msgTAG} Usuário confirmou ação pendente. lastAIQuestionType: ${dialogueState.lastAIQuestionType}, Contexto: ${JSON.stringify(pendingActionContextFromIntent)}`);
            if (dialogueState.lastAIQuestionType === 'confirm_fetch_day_stats' && pendingActionContextFromIntent?.originalUserQuery) {
                effectiveIncomingText = `Sim, por favor, quero saber sobre ${pendingActionContextFromIntent.originalUserQuery}. Mostre-me o desempenho por dia da semana.`;
                effectiveIntent = 'ASK_BEST_TIME';
            } else if (dialogueState.lastAIQuestionType === 'clarify_community_inspiration_objective' && pendingActionContextFromIntent) {
                const originalProposal = (pendingActionContextFromIntent as any)?.proposal || "um tema relevante";
                const originalContext = (pendingActionContextFromIntent as any)?.context || "uma abordagem específica";
                effectiveIncomingText = `Para a inspiração sobre proposta '${originalProposal}' e contexto '${originalContext}', confirmo que quero focar em '${incomingText.trim()}'. Por favor, busque exemplos.`;
                effectiveIntent = 'ask_community_inspiration'; 
                logger.info(`${msgTAG} Ação 'clarify_community_inspiration_objective' confirmada. Texto efetivo para IA: "${effectiveIncomingText.substring(0,100)}..."`);
                if (dialogueState.currentTask?.name === 'ask_community_inspiration') {
                    await stateService.updateDialogueState(userId, { 
                        currentTask: { 
                            ...dialogueState.currentTask, 
                            parameters: { 
                                ...(dialogueState.currentTask.parameters || {}), 
                                primaryObjectiveAchieved_Qualitative: incomingText.trim() 
                            },
                            currentStep: 'objective_clarified' 
                        } 
                    });
                    dialogueState = await stateService.getDialogueState(userId); 
                }

            } else if (pendingActionContextFromIntent?.originalSuggestion) {
                 effectiveIncomingText = `Sim, pode prosseguir com: "${pendingActionContextFromIntent.originalSuggestion}"`;
                 effectiveIntent = 'general';
            } else {
                effectiveIncomingText = "Sim, por favor, prossiga.";
                effectiveIntent = 'general';
            }
            logger.info(`${msgTAG} Texto efetivo para IA (pós-confirmação): "${effectiveIncomingText.slice(0,50)}...", Intenção: ${effectiveIntent}`);
            await stateService.clearPendingActionState(userId); 
        } else if (currentDeterminedIntent === 'user_denies_pending_action') {
            logger.info(`${msgTAG} Usuário negou ação pendente (lastAIQuestionType: ${dialogueState.lastAIQuestionType}).`);
            await stateService.clearPendingActionState(userId); 
            
            const currentDialogueStateForDenial = await stateService.getDialogueState(userId);
            let dialogueUpdateAfterDenial: Partial<stateService.IDialogueState> = { 
                lastInteraction: Date.now(),
                currentTask: currentDialogueStateForDenial.currentTask 
            };

            if (currentDialogueStateForDenial.currentTask && currentDialogueStateForDenial.lastAIQuestionType?.startsWith(`confirm_${currentDialogueStateForDenial.currentTask.name}`)) {
                logger.info(`${msgTAG} Usuário negou ação relacionada à currentTask '${currentDialogueStateForDenial.currentTask.name}'. Limpando currentTask.`);
                dialogueUpdateAfterDenial.currentTask = null;
            }

            const denialResponse = pickRandom(["Entendido. Como posso te ajudar então?", "Ok. O que você gostaria de fazer a seguir?", "Sem problemas. Em que mais posso ser útil hoje?"]);
            await sendWhatsAppMessage(fromPhone, denialResponse);
            const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: incomingText };
            const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: denialResponse };
            const updatedHistory = [...historyMessages, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
            
            const currentSummaryTurnCounter = currentDialogueStateForDenial.summaryTurnCounter || 0;
            const newSummaryTurnCounter = currentSummaryTurnCounter + 1;
            if (newSummaryTurnCounter >= SUMMARY_GENERATION_INTERVAL) {
                logger.info(`${msgTAG} [UserDenies] Intervalo de sumarização atingido (${newSummaryTurnCounter}). Gerando resumo...`);
                const summary = await generateConversationSummary(updatedHistory, userName);
                if (summary) { dialogueUpdateAfterDenial.conversationSummary = summary; }
                dialogueUpdateAfterDenial.summaryTurnCounter = 0; 
            } else {
                dialogueUpdateAfterDenial.summaryTurnCounter = newSummaryTurnCounter;
            }
            
            const currentExpertiseTurnCounter = currentDialogueStateForDenial.expertiseInferenceTurnCounter || 0;
            const newExpertiseTurnCounterForDenial = currentExpertiseTurnCounter + 1;
            if (newExpertiseTurnCounterForDenial >= EXPERTISE_INFERENCE_INTERVAL) {
                 logger.info(`${msgTAG} [UserDenies] Intervalo de inferência de expertise atingido (${newExpertiseTurnCounterForDenial}). Resetando contador.`);
                 dialogueUpdateAfterDenial.expertiseInferenceTurnCounter = 0; 
            } else {
                dialogueUpdateAfterDenial.expertiseInferenceTurnCounter = newExpertiseTurnCounterForDenial;
            }

            await stateService.setConversationHistory(userId, updatedHistory);
            await stateService.updateDialogueState(userId, dialogueUpdateAfterDenial);
            logger.debug(`${msgTAG} [UserDenies] Contadores de sumário e expertise atualizados.`);
                        
            return NextResponse.json({ success: true }, { status: 200 });
        } else if (dialogueState.lastAIQuestionType) {
            logger.info(`${msgTAG} Usuário não respondeu diretamente à ação pendente (${dialogueState.lastAIQuestionType}). Limpando estado pendente.`);
            await stateService.clearPendingActionState(userId);
            dialogueState = await stateService.getDialogueState(userId); 
        }
        
        const isLightweightIntentForDynamicAck = effectiveIntent === 'social_query' || 
                                                 effectiveIntent === 'meta_query_personal' || 
                                                 effectiveIntent === 'generate_proactive_alert';
        
        if (!isLightweightIntentForDynamicAck && 
            effectiveIntent !== 'user_confirms_pending_action' && 
            effectiveIntent !== 'user_denies_pending_action' &&
            effectiveIntent !== 'greeting' 
            ) {
            try {
                // ATUALIZADO v2.9.3: Passa dialogueState para generateDynamicAcknowledgementInWorker
                // O dialogueState aqui já foi carregado no início do bloco 'else' de taskType
                const dynamicAckMessage = await generateDynamicAcknowledgementInWorker(userName, incomingText, userId, dialogueState);
                if (dynamicAckMessage) {
                    logger.debug(`${msgTAG} Enviando reconhecimento dinâmico (gerado por IA) para ${fromPhone}: "${dynamicAckMessage.substring(0,70)}..."`);
                    await sendWhatsAppMessage(fromPhone, dynamicAckMessage);
                }
            } catch (ackError) {
                logger.error(`${msgTAG} Falha ao gerar/enviar reconhecimento dinâmico via IA (não fatal):`, ackError);
            }
        } else {
            logger.debug(`${msgTAG} Pulando quebra-gelo dinâmico para intenção: ${effectiveIntent}`);
        }

        const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
        const enrichedContext = { user, historyMessages: limitedHistoryMessages, dialogueState: dialogueState };

        let finalText = '';
        let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
        let reader: ReadableStreamDefaultReader<string> | null = null;
        let streamTimeout: NodeJS.Timeout | null = null;

        try {
            logger.debug(`${msgTAG} Chamando askLLMWithEnrichedContext com texto: "${effectiveIncomingText.slice(0,50)}...", intenção: ${effectiveIntent}, currentTask: ${JSON.stringify(dialogueState.currentTask)}`);
            const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(
                enrichedContext, effectiveIncomingText, effectiveIntent
            );
            historyPromise = hp;
            reader = stream.getReader();
            streamTimeout = setTimeout(() => { logger.warn(`${msgTAG} Timeout stream...`); streamTimeout = null; reader?.cancel().catch(()=>{/*ignore*/}); }, STREAM_READ_TIMEOUT_MS);
            while (true) { 
                 let value: string | undefined; let done: boolean | undefined;
                 try { const result = await reader.read(); if (streamTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
                 catch (readError: any) { logger.error(`${msgTAG} Erro reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro stream read: ${readError.message}`); }
                 if (done) { break; } if (typeof value === 'string') { finalText += value; } else { logger.warn(`${msgTAG} 'value' undefined mas 'done' false.`); }
            }
            if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
            if (finalText.trim().length === 0) { finalText = 'Hum... não consegui gerar uma resposta completa agora.'; }
        } catch (err: any) { 
            logger.error(`${msgTAG} Erro durante chamada/leitura LLM:`, err);
            if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
            finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
        } finally { 
            if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${msgTAG} Erro releaseLock:`, e); } }
            if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
        }
        
        let dialogueStateUpdatePayload: Partial<stateService.IDialogueState> = { lastInteraction: Date.now() };
        const currentTaskBeforeAI = dialogueState.currentTask; 

        if (finalText && effectiveIntent !== 'social_query' && effectiveIntent !== 'meta_query_personal' && effectiveIntent !== 'user_confirms_pending_action' && effectiveIntent !== 'user_denies_pending_action') {
            const pendingActionInfo = aiResponseSuggestsPendingAction(finalText); 
            if (pendingActionInfo.suggests && pendingActionInfo.actionType) {
                logger.info(`${msgTAG} Resposta IA sugere ação pendente: ${pendingActionInfo.actionType}. Contexto: ${JSON.stringify(pendingActionInfo.pendingActionContext)}`);
                dialogueStateUpdatePayload.lastAIQuestionType = pendingActionInfo.actionType;
                dialogueStateUpdatePayload.pendingActionContext = pendingActionInfo.pendingActionContext;
                if (currentTaskBeforeAI) {
                    dialogueStateUpdatePayload.currentTask = { ...currentTaskBeforeAI, currentStep: `aguardando_confirmacao_sobre_${pendingActionInfo.actionType}` };
                }
            } else {
                dialogueStateUpdatePayload.lastAIQuestionType = undefined; 
                dialogueStateUpdatePayload.pendingActionContext = undefined;
                logger.info(`${msgTAG} Resposta da IA não sugere nova ação pendente. Limpando flags.`);
                if (currentTaskBeforeAI) {
                    logger.info(`${msgTAG} IA não sugere nova ação e havia tarefa '${currentTaskBeforeAI.name}'. Considerando tarefa concluída/interrompida.`);
                    dialogueStateUpdatePayload.currentTask = null; 
                }
            }
        } else { 
            dialogueStateUpdatePayload.lastAIQuestionType = undefined;
            dialogueStateUpdatePayload.pendingActionContext = undefined;
            if (currentTaskBeforeAI && (effectiveIntent === 'user_confirms_pending_action' || (effectiveIntent === 'social_query' || effectiveIntent === 'meta_query_personal'))) {
                if (effectiveIntent === 'social_query' || effectiveIntent === 'meta_query_personal') {
                    logger.info(`${msgTAG} Query leve '${effectiveIntent}' recebida. Limpando currentTask '${currentTaskBeforeAI.name}' se existir.`);
                    dialogueStateUpdatePayload.currentTask = null;
                }
            }
        }
        
        await sendWhatsAppMessage(fromPhone, finalText);
        logger.info(`${msgTAG} Resposta final enviada para ${fromPhone}.`);
        
        let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
        try { 
             logger.debug(`${msgTAG} Iniciando persistência no Redis para User ${userId}...`);
             if (historyPromise) { 
                 try {  
                    finalHistoryForSaving = await historyPromise; 
                    logger.debug(`${msgTAG} historyPromise resolvida com ${finalHistoryForSaving.length} mensagens.`); 
                } catch (historyError) { 
                    logger.error(`${msgTAG} Erro ao obter histórico final da historyPromise:`, historyError); 
                    const userMessageFallback: ChatCompletionMessageParam = { role: 'user', content: effectiveIncomingText };
                    const assistantMessageFallback: ChatCompletionMessageParam = { role: 'assistant', content: finalText };
                    finalHistoryForSaving = [...historyMessages, userMessageFallback, assistantMessageFallback].slice(-HISTORY_LIMIT); 
                } 
             } else { 
                 logger.warn(`${msgTAG} historyPromise não encontrada. Montando histórico básico.`); 
                 const userMessageNoPromise: ChatCompletionMessageParam = { role: 'user', content: effectiveIncomingText };
                 const assistantMessageNoPromise: ChatCompletionMessageParam = { role: 'assistant', content: finalText };
                 finalHistoryForSaving = [...historyMessages, userMessageNoPromise, assistantMessageNoPromise].slice(-HISTORY_LIMIT); 
             }
            
            const dialogueStateForSummary = await stateService.getDialogueState(userId); 
            const currentSummaryTurnCounterForPersistence = dialogueStateForSummary.summaryTurnCounter || 0;
            const newSummaryTurnCounterForPersistence = currentSummaryTurnCounterForPersistence + 1;

            if (newSummaryTurnCounterForPersistence >= SUMMARY_GENERATION_INTERVAL) {
                logger.info(`${msgTAG} Intervalo de sumarização atingido (${newSummaryTurnCounterForPersistence}). Gerando resumo...`);
                const summary = await generateConversationSummary(finalHistoryForSaving, userName);
                if (summary) {
                    dialogueStateUpdatePayload.conversationSummary = summary; 
                    logger.debug(`${msgTAG} Resumo gerado: "${summary.substring(0,100)}..."`);
                } else {
                    logger.warn(`${msgTAG} Geração de resumo retornou vazio.`);
                }
                dialogueStateUpdatePayload.summaryTurnCounter = 0; 
            } else {
                dialogueStateUpdatePayload.summaryTurnCounter = newSummaryTurnCounterForPersistence; 
            }

             const cacheKeyForPersistence = `resp:${fromPhone}:${effectiveIncomingText.trim().slice(0, 100)}`; 
             const persistencePromises = [ 
                 stateService.updateDialogueState(userId, dialogueStateUpdatePayload), 
                 stateService.setInCache(cacheKeyForPersistence, finalText, CACHE_TTL_SECONDS), 
                 stateService.incrementUsageCounter(userId), 
             ];
             if (finalHistoryForSaving.length > 0) { 
                 persistencePromises.push(stateService.setConversationHistory(userId, finalHistoryForSaving)); 
             } else { 
                 logger.warn(`${msgTAG} Pulando salvamento histórico (array vazio).`); 
             }
             await Promise.allSettled(persistencePromises); 
             logger.debug(`${msgTAG} Persistência Redis (sumário, cache, contador, histórico, estado geral) concluída.`);
        } catch (persistError) { 
            logger.error(`${msgTAG} Erro persistência Redis (não fatal):`, persistError); 
        }

        try {
            const dialogueStateForExpertise = await stateService.getDialogueState(userId);
            const currentInDbExpertiseLevel = user.inferredExpertiseLevel; 

            const currentExpertiseTurnCounter = dialogueStateForExpertise.expertiseInferenceTurnCounter || 0;
            const newExpertiseTurnCounter = currentExpertiseTurnCounter + 1;
        
            let updateForExpertiseCounterOnly: Partial<stateService.IDialogueState> = { 
                expertiseInferenceTurnCounter: newExpertiseTurnCounter 
            };
        
            if (newExpertiseTurnCounter >= EXPERTISE_INFERENCE_INTERVAL) {
                logger.info(`${msgTAG} Intervalo de inferência de expertise atingido (${newExpertiseTurnCounter}) para User ${userId}. Inferindo nível...`);
                
                if (finalHistoryForSaving && finalHistoryForSaving.length > 0) {
                    const inferredLevel = await inferUserExpertiseLevel(finalHistoryForSaving, userName);
                    
                    if (inferredLevel && currentInDbExpertiseLevel !== inferredLevel) { 
                        logger.info(`${msgTAG} Nível de expertise inferido: '${inferredLevel}' para User ${userId} (anterior: '${currentInDbExpertiseLevel}'). Atualizando no DB.`);
                        await dataService.updateUserExpertiseLevel(userId, inferredLevel);
                    } else if (inferredLevel) {
                        logger.info(`${msgTAG} Nível de expertise inferido ('${inferredLevel}') é o mesmo já registrado para User ${userId} ou nulo. Nenhuma atualização no DB.`);
                    } else {
                         logger.warn(`${msgTAG} Inferência de nível de expertise retornou nulo para User ${userId}.`);
                    }
                } else {
                    logger.warn(`${msgTAG} Histórico final para inferência de expertise está vazio ou indisponível. Pulando inferência.`);
                }
                updateForExpertiseCounterOnly.expertiseInferenceTurnCounter = 0; 
            }
        
            await stateService.updateDialogueState(userId, updateForExpertiseCounterOnly);
            logger.debug(`${msgTAG} Contador de turnos para inferência de expertise atualizado para: ${updateForExpertiseCounterOnly.expertiseInferenceTurnCounter} para User ${userId}.`);
        
        } catch (expertiseError) {
            logger.error(`${msgTAG} Erro durante o processo de inferência ou atualização do nível de expertise para User ${userId}:`, expertiseError);
        }


        logger.info(`${msgTAG} Tarefa de mensagem normal concluída para User ${userId}.`);
        return NextResponse.json({ success: true }, { status: 200 });
    }

  } catch (error) { 
    logger.error(`${TAG} Erro GERAL não tratado na API worker:`, error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
  
  logger.error(`${TAG} Código atingiu o final da função POST inesperadamente.`);
  return NextResponse.json({ error: 'Server ended without an explicit response.' }, { status: 500 });
}
