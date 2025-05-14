/**
 * @fileoverview Serviço principal para obter respostas do consultor Tuca.
 * Otimizado para:
 * - Respostas diretas para interações simples.
 * - Contexto leve para IA em perguntas sociais/meta.
 * - Mensagem de "processando" condicional e variada para queries complexas.
 * - Integração de resumo de histórico no contexto da IA.
 * @version 4.7.0 (Integração de Resumo de Histórico no Contexto da IA)
 */

import { logger } from '@/app/lib/logger';
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from './intentService';
import { askLLMWithEnrichedContext } from './aiOrchestrator';
import * as stateService from '@/app/lib/stateService'; // Espera-se stateService v1.7.1+
import * as dataService from './dataService';
import { UserNotFoundError } from '@/app/lib/errors';
import { IUser } from '@/app/models/User';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { functionExecutors } from '@/app/lib/aiFunctions';

// Configurações para mensagem de processamento
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

// Configurações existentes
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10; // Limite para o histórico recente de mensagens
const SUMMARY_MAX_HISTORY_FOR_CONTEXT = 6; // <<< NOVO: Quantas mensagens recentes enviar JUNTO com o resumo

interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.IDialogueState; 
}

export async function getConsultantResponse(
    fromPhone: string,
    incoming: string
): Promise<string> {
    const TAG = '[consultantService v4.7.0]'; 
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
        // dialogueState agora pode conter conversationSummary e summaryTurnCounter
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
        // A lógica de sumarização para special_handled já está no process-response/route.ts
        // Aqui apenas atualizamos lastInteraction. O process-response cuidará do summaryTurnCounter e do summary.
        await stateService.updateDialogueState(uid, { lastInteraction: Date.now() }); 
        
        logger.info(`${TAG} ✓ ok (special_handled por intentService) ${Date.now() - start} ms`);
        return responseTextForSpecialHandled;
    }

    let effectiveIncomingText = rawText;
    let effectiveIntent = determinedIntent as DeterminedIntent;

    if (determinedIntent === 'user_confirms_pending_action') {
        logger.info(`${TAG} Usuário confirmou ação pendente. Contexto original: ${JSON.stringify(pendingActionContextFromIntent)}`);
        if (dialogueState.lastAIQuestionType === 'confirm_fetch_day_stats' && pendingActionContextFromIntent?.originalUserQuery) {
            effectiveIncomingText = `Sim, por favor, quero saber sobre ${pendingActionContextFromIntent.originalUserQuery}. Mostre-me o desempenho por dia da semana.`;
            effectiveIntent = 'ASK_BEST_TIME';
        } else if (dialogueState.lastAIQuestionType === 'clarify_community_inspiration_objective' && pendingActionContextFromIntent) {
            // Esta lógica de reconstrução do texto para a IA pode ser aprimorada
            // ou a IA instruída a usar o pendingActionContext diretamente.
            // Por ora, mantemos a reconstrução se ela funcionar bem.
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
        // A lógica de sumarização para user_denies_pending_action já está no process-response/route.ts
        await stateService.updateDialogueState(uid, { lastInteraction: Date.now() });
        
        return denialResponse;
    } else if (dialogueState.lastAIQuestionType) {
        logger.info(`${TAG} Usuário não respondeu diretamente à ação pendente (${dialogueState.lastAIQuestionType}). Limpando estado pendente.`);
        await stateService.clearPendingActionState(uid);
        // Recarregar o estado após limpar para garantir que a IA veja o estado limpo
        dialogueState = await stateService.getDialogueState(uid);
    }

    // --- Montagem do Histórico para a IA com possível Resumo ---
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
        // Adiciona um número menor de mensagens recentes quando há um resumo
        historyForAI.push(...rawHistoryMessages.slice(-SUMMARY_MAX_HISTORY_FOR_CONTEXT));
    } else {
        // Sem resumo, usa o limite padrão de histórico
        historyForAI.push(...rawHistoryMessages.slice(-HISTORY_LIMIT));
    }
    // --- Fim da Montagem do Histórico para a IA ---

    // O dialogueState passado para enrichedContext deve ser o mais atualizado possível
    // (após qualquer clearPendingActionState ou recarregamento)
    const enrichedContext: EnrichedContext = { 
        user, 
        historyMessages: historyForAI, // <<< MODIFICADO: Usa historyForAI que pode conter o resumo
        dialogueState: dialogueState // dialogueState já foi atualizado se necessário
    };

    const isLightweightQuery = effectiveIntent === 'social_query' || effectiveIntent === 'meta_query_personal' || effectiveIntent === 'generate_proactive_alert';
    let processingMessageTimer: NodeJS.Timeout | null = null;
    let processingMessageHasBeenSent = false;

    if (!isLightweightQuery) {
        processingMessageTimer = setTimeout(async () => {
            if (processingMessageTimer && !processingMessageHasBeenSent) {
                try {
                    const message = pickRandom(GET_PROCESSING_MESSAGES_POOL(userName));
                    logger.debug(`${TAG} Enviando mensagem de processamento (intenção: ${effectiveIntent}) para ${fromPhone} após ${PROCESSING_MESSAGE_DELAY_MS}ms.`);
                    await sendWhatsAppMessage(fromPhone, message);
                    processingMessageHasBeenSent = true;
                } catch (sendError) {
                    logger.error(`${TAG} Falha ao enviar mensagem de processamento condicional (não fatal):`, sendError);
                }
            }
            processingMessageTimer = null;
        }, PROCESSING_MESSAGE_DELAY_MS);
    } else {
        logger.debug(`${TAG} Pulando mensagem de processamento para intenção leve: ${effectiveIntent}`);
    }

    let finalText = '';
    let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let streamTimeout: NodeJS.Timeout | null = null;

    try {
        logger.debug(`${TAG} Chamando askLLMWithEnrichedContext (intenção: ${effectiveIntent}). Texto efetivo: ${effectiveIncomingText.slice(0,50)}`);
        const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(
            enrichedContext, // enrichedContext agora contém o histórico com possível resumo
            effectiveIncomingText, 
            effectiveIntent
        );
        historyPromise = hp;

        if (processingMessageTimer) {
            logger.debug(`${TAG} Resposta da IA recebida, cancelando timer da mensagem de processamento.`);
            clearTimeout(processingMessageTimer);
            processingMessageTimer = null;
        }
        
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
        if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; }
        finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
    } finally {
        if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${TAG} Erro releaseLock:`, e); } }
        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
        if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; }
    }

    // A lógica de atualização do estado do diálogo (lastAIQuestionType, pendingActionContext, e AGORA TAMBÉM conversationSummary e summaryTurnCounter)
    // é primariamente responsabilidade do worker QStash (process-response/route.ts)
    // para garantir que o estado reflita o que foi efetivamente enviado e como a conversa progrediu.
    // Aqui, este serviço (consultantService) foca em obter a resposta da IA.
    // Apenas atualizamos lastInteraction e o histórico/cache básicos.

    let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
    try {
         logger.debug(`${TAG} Iniciando persistência no Redis (básica)...`);
         // Pega o estado mais recente, que pode ter sido atualizado pelo process-response se esta chamada for síncrona
         // ou o estado que este serviço conhece se for o ponto de entrada.
         const dialogueStateForSave = await stateService.getDialogueState(uid); 
         const nextStateToSave: Partial<stateService.IDialogueState> = { 
             ...dialogueStateForSave, // Mantém o que já está lá (incluindo summary e counter se atualizados por outro processo)
             lastInteraction: Date.now() // Apenas atualiza lastInteraction
         };
         
         const cacheKeyForPersistence = `resp:${fromPhone}:${effectiveIncomingText.trim().slice(0, 100)}`;

         if (historyPromise) {
             try {
                 finalHistoryForSaving = await historyPromise;
                 logger.debug(`${TAG} historyPromise resolvida com ${finalHistoryForSaving.length} mensagens.`);
             } catch (historyError) {
                 logger.error(`${TAG} Erro ao obter histórico final da historyPromise. Montando fallback:`, historyError);
                 // Monta um histórico de fallback se a promise falhar
                 finalHistoryForSaving = [...rawHistoryMessages.slice(-HISTORY_LIMIT + 2), {role: 'user', content: effectiveIncomingText}, {role: 'assistant', content: finalText}];
             }
         } else { 
             logger.warn(`${TAG} historyPromise não encontrada para salvar histórico. Montando fallback.`);
             finalHistoryForSaving = [...rawHistoryMessages.slice(-HISTORY_LIMIT + 2), {role: 'user', content: effectiveIncomingText}, {role: 'assistant', content: finalText}];
         }


         const persistencePromises = [
             stateService.updateDialogueState(uid, nextStateToSave), // Salva o estado com lastInteraction atualizado
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

// Função de Resumo Semanal (Mantida como estava na v4.6.1)
export async function generateStrategicWeeklySummary(
  userName: string,
  userId: string
): Promise<string> {
    const TAG = '[weeklySummary v4.6.1]'; 
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
        reportData = await getAggregatedReportExecutor({}, lookedUpUser); 
        let hasError = false;
        let statsAreMissing = true;
        if (typeof reportData === 'object' && reportData !== null) {
            if ('error' in reportData && (reportData as { error: any }).error) {
                hasError = true;
                logger.warn(`${TAG} Falha ao obter relatório agregado para ${userName}: ${(reportData as { error: any }).error}`);
            } else if ('overallStats' in reportData && (reportData as { overallStats: any }).overallStats) {
                statsAreMissing = false;
                overallStatsForPrompt = (reportData as { overallStats: any }).overallStats;
                logger.info(`${TAG} Relatório obtido com overallStats para resumo semanal de ${userName}.`);
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
