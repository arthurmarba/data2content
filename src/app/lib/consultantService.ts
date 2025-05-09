// @/app/lib/consultantService.ts – Proposta de v4.6.0+
// --------------------------------------------------
/**
 * @fileoverview Serviço principal para obter respostas do consultor Tuca.
 * Otimizado para:
 * - Respostas diretas para interações simples.
 * - Contexto leve para IA em perguntas sociais/meta.
 * - Mensagem de "processando" condicional e variada para queries complexas.
 * @version 4.6.0
 */

import { logger } from '@/app/lib/logger';
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from './intentService'; // Assumindo que DeterminedIntent agora inclui 'social_query' e 'meta_query_personal'
import { askLLMWithEnrichedContext } from './aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import * as dataService from './dataService';
import { UserNotFoundError } from '@/app/lib/errors';
import { IUser } from '@/app/models/User';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';
import { functionExecutors } from '@/app/lib/aiFunctions'; // Mantido

// --- ADICIONADO: Configurações para mensagem de processamento ---
const PROCESSING_MESSAGE_DELAY_MS = 1800; // 1.8 segundos de espera antes de enviar "processando"
const pickRandom = <T>(arr: T[]): T => { // Helper local se não quiser importar
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

// Configurações existentes
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10;

interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.DialogueState;
    // ADICIONADO OPCIONAL: Passar a intenção para o orchestrator, se ele precisar saber
    // determinedIntent?: DeterminedIntent;
}

export async function getConsultantResponse(
    fromPhone: string,
    incoming: string
): Promise<string> {
    const TAG = '[consultantService 4.6.0]'; // ALTERADO: Versão
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
        userName = user.name || 'criador'; // Usa user.name que já é buscado
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

    let dialogueState: stateService.DialogueState = {};
    try {
        dialogueState = await stateService.getDialogueState(uid);
        logger.debug(`${TAG} Estado carregado.`);
    } catch (stateError) { logger.error(`${TAG} Erro ao buscar estado do Redis:`, stateError); }

    // --- 2.5 Determinar Intenção ---
    let intentResult: IntentResult;
    let determinedIntent: DeterminedIntent | null = null; // Será null se special_handled
    let responseTextForSpecialHandled: string | null = null;

    try {
        // `greeting` aqui é o "Oi NomeDoUsuario" já formatado, passado para intentService
        intentResult = await determineIntent(norm, user, rawText, dialogueState, greeting, uid);
        if (intentResult.type === 'special_handled') {
            logger.info(`${TAG} Intenção tratada como caso especial pela intentService.`);
            responseTextForSpecialHandled = intentResult.response;
        } else {
            determinedIntent = intentResult.intent;
            logger.info(`${TAG} Intenção determinada: ${determinedIntent}`);
        }
    } catch (intentError) {
        logger.error(`${TAG} Erro ao determinar intenção:`, intentError);
        determinedIntent = 'general'; // Default em caso de erro na determinação
    }

    // --- ADICIONADO: Retornar IMEDIATAMENTE se a intenção foi tratada como caso especial ---
    if (responseTextForSpecialHandled) {
        // Opcional, mas recomendado: Salvar esta interação no histórico para dar contexto futuro à IA
        try {
            const userMessageForHistory: ChatCompletionMessageParam = { role: 'user', content: rawText };
            const assistantResponseForHistory: ChatCompletionMessageParam = { role: 'assistant', content: responseTextForSpecialHandled };
            const currentHistory = await stateService.getConversationHistory(uid).catch(() => []);
            const updatedHistory = [...currentHistory, userMessageForHistory, assistantResponseForHistory].slice(-HISTORY_LIMIT);
            await stateService.setConversationHistory(uid, updatedHistory);
            logger.debug(`${TAG} Histórico salvo para interação special_handled.`);
        } catch(histSaveErr) {
            logger.error(`${TAG} Falha ao salvar histórico para special_handled (não fatal):`, histSaveErr);
        }
        // Atualiza o estado do diálogo (lastInteraction)
        await stateService.updateDialogueState(uid, { ...(dialogueState || {}), lastInteraction: Date.now() })
            .catch(err => logger.error(`${TAG} Falha ao atualizar estado para special_handled (não fatal):`, err));

        logger.info(`${TAG} ✓ ok (special_handled por intentService) ${Date.now() - start} ms`);
        return responseTextForSpecialHandled;
    }
    // Se chegou aqui, 'determinedIntent' não é null e precisa da IA.
    // --- FIM ADIÇÃO ---

    let historyMessages: ChatCompletionMessageParam[] = [];
    try {
        historyMessages = await stateService.getConversationHistory(uid);
        logger.debug(`${TAG} Histórico carregado com ${historyMessages.length} mensagens.`);
    } catch (histError) { logger.error(`${TAG} Erro ao buscar histórico do Redis:`, histError); }
    const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
    if (historyMessages.length > HISTORY_LIMIT) { logger.debug(`${TAG} Histórico limitado a ${HISTORY_LIMIT} msgs para envio.`); }

    // --- ALTERADO: Preparar Contexto e lógica da mensagem de "processando" ---
    const isLightweightQuery = determinedIntent === 'social_query' || determinedIntent === 'meta_query_personal';
    logger.info(`${TAG} Tipo de query para IA: ${isLightweightQuery ? 'Leve (social/meta)' : 'Padrão/Complexa'}`);

    const enrichedContext: EnrichedContext = { user, historyMessages: limitedHistoryMessages, dialogueState };
    // Se o aiOrchestrator precisar da intenção:
    // (enrichedContext as any).determinedIntent = determinedIntent;


    let processingMessageTimer: NodeJS.Timeout | null = null;
    let processingMessageHasBeenSent = false; // Flag para controlar se a mensagem foi enviada

    // Só considera enviar mensagem de processamento para queries NÃO leves
    if (!isLightweightQuery) {
        processingMessageTimer = setTimeout(async () => {
            // Apenas envia se a flag `processingMessageHasBeenSent` for false E o timer não foi cancelado
            if (processingMessageTimer && !processingMessageHasBeenSent) {
                try {
                    const message = pickRandom(GET_PROCESSING_MESSAGES_POOL(userName));
                    logger.debug(`${TAG} Enviando mensagem de processamento (intenção: ${determinedIntent}) para ${fromPhone} após ${PROCESSING_MESSAGE_DELAY_MS}ms.`);
                    await sendWhatsAppMessage(fromPhone, message);
                    processingMessageHasBeenSent = true; // Marca que a mensagem foi enviada
                } catch (sendError) {
                    logger.error(`${TAG} Falha ao enviar mensagem de processamento condicional (não fatal):`, sendError);
                }
            }
            processingMessageTimer = null; // Limpa a referência ao timer após execução ou cancelamento
        }, PROCESSING_MESSAGE_DELAY_MS);
    } else {
        logger.debug(`${TAG} Pulando mensagem de processamento para intenção leve: ${determinedIntent}`);
    }
    // --- FIM ALTERAÇÃO ---

    let finalText = '';
    let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let streamTimeout: NodeJS.Timeout | null = null;

    try {
        logger.debug(`${TAG} Chamando askLLMWithEnrichedContext (intenção: ${determinedIntent})...`);
        // ALTERADO: Passar `determinedIntent` para `askLLMWithEnrichedContext`
        // É responsabilidade do aiOrchestrator usar essa informação para, por exemplo, não fazer data fetching para 'social_query'
        const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(
            enrichedContext,
            rawText,
            determinedIntent as DeterminedIntent // Agora sabemos que não é null
        );
        historyPromise = hp;

        // --- ADICIONADO: Cancelar timer da mensagem de processamento se a IA respondeu rápido ---
        if (processingMessageTimer) {
            logger.debug(`${TAG} Resposta da IA recebida, cancelando timer da mensagem de processamento.`);
            clearTimeout(processingMessageTimer);
            processingMessageTimer = null; // Importante para a lógica dentro do callback do setTimeout
        }
        // --- FIM ADIÇÃO ---

        logger.debug(`${TAG} askLLMWithEnrichedContext retornou. Lendo stream...`);
        reader = stream.getReader();
        // ... (resto da lógica de leitura do stream e timeout do stream permanece igual) ...
        streamTimeout = setTimeout(() => { logger.warn(`${TAG} Timeout stream read...`); streamTimeout = null; reader?.cancel().catch(()=>{/*ignore*/}); }, STREAM_READ_TIMEOUT_MS);
        // eslint-disable-next-line no-constant-condition
        while (true) {
             let value: string | undefined; let done: boolean | undefined;
             try { const result = await reader.read(); if (streamTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
             catch (readError: any) { logger.error(`${TAG} Erro reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro stream read: ${readError.message}`); }
             if (done) { break; } if (typeof value === 'string') { finalText += value; } else { logger.warn(`${TAG} 'value' undefined mas 'done' false.`); }
        }
        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; } // ALTERADO: Garante limpeza do streamTimeout
        logger.debug(`${TAG} Texto final montado: ${finalText.length} chars.`);
        if (finalText.trim().length === 0) { finalText = 'Hum... não consegui gerar uma resposta completa agora.'; }

    } catch (err: any) {
        logger.error(`${TAG} Erro durante chamada/leitura LLM:`, err);
        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; } // Limpa timeout do stream
        // ADICIONADO: Limpar também o timer da mensagem de processamento em caso de erro na LLM
        if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; }
        finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
    } finally {
        if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${TAG} Erro releaseLock:`, e); } }
        // ADICIONADO: Garantir limpeza final dos timers se ainda existirem (dupla checagem)
        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
        if (processingMessageTimer) { clearTimeout(processingMessageTimer); processingMessageTimer = null; }
    }

    // --- 7. Persistência Pós-Resposta --- (lógica existente mantida, parece correta)
    // ... (código de persistência existente) ...
    let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
    try {
         logger.debug(`${TAG} Iniciando persistência no Redis...`);
         const nextState = { ...(dialogueState || {}), lastInteraction: Date.now() };
         const cacheKeyForPersistence = `resp:${fromPhone}:${rawText.trim().slice(0, 100)}`;

         if (historyPromise) {
             try {
                 logger.debug(`${TAG} Aguardando historyPromise para salvar...`);
                 finalHistoryForSaving = await historyPromise;
                 logger.debug(`${TAG} historyPromise resolvida com ${finalHistoryForSaving.length} mensagens.`);
             } catch (historyError) {
                 logger.error(`${TAG} Erro ao obter histórico final da historyPromise (não será salvo):`, historyError);
                 finalHistoryForSaving = []; // Evita erro se historyPromise falhar
             }
         } else { logger.warn(`${TAG} historyPromise não encontrada para salvar histórico.`); }

         const persistencePromises = [
             stateService.updateDialogueState(uid, nextState),
             stateService.setInCache(cacheKeyForPersistence, finalText, CACHE_TTL_SECONDS),
             stateService.incrementUsageCounter(uid),
         ];
         if (finalHistoryForSaving.length > 0) {
              logger.debug(`${TAG} Adicionando setConversationHistory com ${finalHistoryForSaving.length} msgs JSON.`);
              persistencePromises.push(stateService.setConversationHistory(uid, finalHistoryForSaving));
         } else {
            // Se historyPromise falhou mas temos a mensagem do usuário e a resposta da IA,
            // poderíamos tentar salvar ao menos isso.
            // No entanto, historyPromise DEVE retornar o histórico completo incluindo a última interação.
            // Se não retornou, é melhor não arriscar inconsistência, a menos que haja uma lógica robusta aqui.
            logger.warn(`${TAG} Pulando salvamento do histórico principal devido à ausência/falha de historyPromise.`);
         }
         await Promise.allSettled(persistencePromises);
         logger.debug(`${TAG} Persistência no Redis concluída.`);
    } catch (persistError) { logger.error(`${TAG} Erro persistência Redis (não fatal):`, persistError); }


    const duration = Date.now() - start;
    logger.info(`${TAG} ✓ ok ${duration} ms. Retornando ${finalText.length} chars.`);
    return finalText;
}

// ----- Função de Resumo Semanal (Opcional - Mantida como estava na última versão) -----
// (Sem alterações aqui, apenas para manter o arquivo completo)
export async function generateStrategicWeeklySummary(
  userName: string,
  userId: string
): Promise<string> {
    const TAG = '[weeklySummary v4.5.0]';
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
        // Corrigido para garantir que lookedUpUser seja IUser, se necessário, ajuste a tipagem ou a lógica de busca
        reportData = await getAggregatedReportExecutor({}, lookedUpUser); 
        // ... (resto da função generateStrategicWeeklySummary)
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
        // Esta parte precisaria de uma chamada real à IA, similar ao askLLMWithEnrichedContext,
        // mas com um prompt específico e sem streaming necessariamente.
        logger.warn(`${TAG} Chamada direta à IA para resumo não implementada/configurada completamente para produção.`);
        let exampleInsights = '[Insight 1], [Insight 2], [Insight 3]';
        if (typeof overallStatsForPrompt === 'object' && overallStatsForPrompt !== null) {
            const keys = Object.keys(overallStatsForPrompt);
            exampleInsights = keys.slice(0,3).map(key => `[Insight sobre ${key}]`).join(', ');
        }
        // Simulando uma resposta que viria da IA
        // Para uma implementação real, você chamaria sua função de IA aqui com o PROMPT.
        return `Aqui estão os destaques da semana para ${userName} (simulado): \n- ${exampleInsights.replace(/, /g, '\n- ') || 'Insights gerais baseados nos dados.'}`;
    } catch (e: any) {
        logger.error(`${TAG} Erro ao gerar resumo semanal para ${userName}:`, e);
        return `Não consegui gerar o resumo semanal para ${userName} agora devido a um erro: ${e.message || String(e)}`;
    }
}