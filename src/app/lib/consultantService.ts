/**
 * @fileoverview Serviço principal para obter respostas do consultor Tuca.
 * Otimizado para buscar dados sob demanda via Function Calling.
 * @version 4.5.3 (Corrige nome de variável em cacheKey)
 */

import { logger } from '@/app/lib/logger';
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from './intentService';
import { askLLMWithEnrichedContext } from './aiOrchestrator'; // Responsável por chamar a IA e lidar com funções
import * as stateService from '@/app/lib/stateService';
import * as dataService from './dataService'; // Usado para lookupUser
import { UserNotFoundError } from '@/app/lib/errors';
import { IUser } from '@/app/models/User';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions'; // Importa o tipo de mensagem
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';

// Importação de functionExecutors (mantida da correção anterior)
import { functionExecutors } from '@/app/lib/aiFunctions';

// Configurações
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10; // Limite de mensagens *enviadas* para a IA

/**
 * @interface EnrichedContext (Simplificada)
 */
interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[]; // <<< Array de mensagens
    dialogueState?: stateService.DialogueState;
}

/**
 * Obtém a resposta do consultor Tuca para uma mensagem recebida.
 */
export async function getConsultantResponse(
    fromPhone: string,
    incoming: string // <<< Nome do parâmetro é 'incoming'
): Promise<string> {
    const TAG = '[consultantService 4.5.3]'; // Versão atualizada
    const start = Date.now();
    const rawText = incoming; // <<< Valor atribuído a 'rawText'
    logger.info(`${TAG} ⇢ ${fromPhone.slice(-4)}… «${rawText.slice(0, 40)}»`);

    const norm = normalizeText(rawText.trim());
    if (!norm) {
        logger.warn(`${TAG} Mensagem normalizada vazia.`);
        return `${getRandomGreeting('')} Pode repetir, por favor? Não entendi bem.`;
    }

    // --- 1. Carregar Dados do Usuário (Corrigido) ---
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

    // --- 1.5 Verificar Cache ---
    const cacheKey = `resp:${fromPhone}:${norm.slice(0, 100)}`;
    try {
        const cached = await stateService.getFromCache(cacheKey);
        if (cached) { logger.info(`${TAG} (cache hit) ${Date.now() - start} ms`); return cached; }
        logger.info(`${TAG} (cache miss)`);
    } catch (cacheError) { logger.error(`${TAG} Erro ao buscar do cache Redis:`, cacheError); }

    // --- 2. Carregar Contexto da Conversa (Estado) ---
    let dialogueState: stateService.DialogueState = {};
    try {
        dialogueState = await stateService.getDialogueState(uid);
        logger.debug(`${TAG} Estado carregado.`);
    } catch (stateError) { logger.error(`${TAG} Erro ao buscar estado do Redis:`, stateError); }

    // --- 2.5 Determinar Intenção ---
    let intentResult: IntentResult;
    let determinedIntent: DeterminedIntent | null = null;
    try {
        intentResult = await determineIntent(norm, user, rawText, dialogueState, greeting, uid);
        if (intentResult.type === 'special_handled') { logger.info(`${TAG} Intenção tratada como caso especial...`); return intentResult.response; }
        else { determinedIntent = intentResult.intent; logger.info(`${TAG} Intenção determinada: ${determinedIntent}`); }
    } catch (intentError) { logger.error(`${TAG} Erro ao determinar intenção:`, intentError); determinedIntent = 'general'; }

    // --- 3. Carregar Histórico (Versão JSON) ---
    let historyMessages: ChatCompletionMessageParam[] = [];
    try {
        historyMessages = await stateService.getConversationHistory(uid);
        logger.debug(`${TAG} Histórico carregado com ${historyMessages.length} mensagens.`);
    } catch (histError) { logger.error(`${TAG} Erro ao buscar histórico do Redis:`, histError); }
    const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
    if (historyMessages.length > HISTORY_LIMIT) { logger.debug(`${TAG} Histórico limitado a ${HISTORY_LIMIT} msgs para envio.`); }

    // --- 5. Preparar Contexto ---
    const enrichedContext: EnrichedContext = { user, historyMessages: limitedHistoryMessages, dialogueState };

    // --- 5.5 Enviar Mensagem de Processamento ---
    try {
        let processingMessage = `Ok, ${userName}! Recebi seu pedido. 👍\nEstou verificando as informações e já te respondo...`;
        switch (determinedIntent) { /* ... (lógica mantida) ... */ }
        logger.debug(`${TAG} Enviando mensagem de processamento (intenção: ${determinedIntent}) para ${fromPhone}...`);
        // await sendWhatsAppMessage(fromPhone, processingMessage);
    } catch (sendError) { logger.error(`${TAG} Falha ao enviar mensagem inicial (não fatal):`, sendError); }

    // --- 6. Chamar LLM e Processar Resposta ---
    let finalText = '';
    let historyPromise: Promise<ChatCompletionMessageParam[]> | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let streamTimeout: NodeJS.Timeout | null = null;

    try {
        logger.debug(`${TAG} Chamando askLLMWithEnrichedContext...`);
        const { stream, historyPromise: hp } = await askLLMWithEnrichedContext(enrichedContext, rawText);
        historyPromise = hp;
        logger.debug(`${TAG} askLLMWithEnrichedContext retornou. Lendo stream...`);
        reader = stream.getReader();
        streamTimeout = setTimeout(() => { logger.warn(`${TAG} Timeout stream read...`); streamTimeout = null; reader?.cancel().catch(/*...*/); }, STREAM_READ_TIMEOUT_MS);
        // eslint-disable-next-line no-constant-condition
        while (true) {
             let value: string | undefined; let done: boolean | undefined;
             try { const result = await reader.read(); if (streamTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
             catch (readError: any) { logger.error(`${TAG} Erro reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro stream read: ${readError.message}`); }
             if (done) { break; } if (typeof value === 'string') { finalText += value; } else { logger.warn(`${TAG} 'value' undefined mas 'done' false.`); }
        }
        if (streamTimeout) { clearTimeout(streamTimeout); }
        logger.debug(`${TAG} Texto final montado: ${finalText.length} chars.`);
        if (finalText.trim().length === 0) { finalText = 'Hum... não consegui gerar uma resposta completa agora.'; }
    } catch (err: any) {
        logger.error(`${TAG} Erro durante chamada/leitura LLM:`, err);
        if (streamTimeout) { clearTimeout(streamTimeout); streamTimeout = null; }
        finalText = 'Ops! Tive uma dificuldade técnica ao gerar sua resposta.';
    } finally {
        if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${TAG} Erro releaseLock:`, e); } }
    }

    // --- 7. Persistência Pós-Resposta ---
    let finalHistoryForSaving: ChatCompletionMessageParam[] = [];
    try {
         logger.debug(`${TAG} Iniciando persistência no Redis...`);
         const nextState = { ...(dialogueState || {}), lastInteraction: Date.now() };
         // CORREÇÃO APLICADA AQUI: Usa rawText ou incoming
         const cacheKeyForPersistence = `resp:${fromPhone}:${rawText.trim().slice(0, 100)}`; // <<< CORRIGIDO

         if (historyPromise) {
             try {
                 logger.debug(`${TAG} Aguardando historyPromise para salvar...`);
                 finalHistoryForSaving = await historyPromise;
                 logger.debug(`${TAG} historyPromise resolvida com ${finalHistoryForSaving.length} mensagens.`);
             } catch (historyError) {
                 logger.error(`${TAG} Erro ao obter histórico final da historyPromise (não será salvo):`, historyError);
                 finalHistoryForSaving = [];
             }
         } else { logger.warn(`${TAG} historyPromise não encontrada para salvar histórico.`); }

         const persistencePromises = [
             stateService.updateDialogueState(uid, nextState),
             stateService.setInCache(cacheKeyForPersistence, finalText, CACHE_TTL_SECONDS), // Usa a chave corrigida
             stateService.incrementUsageCounter(uid),
         ];
         if (finalHistoryForSaving.length > 0) {
              logger.debug(`${TAG} Adicionando setConversationHistory com ${finalHistoryForSaving.length} msgs JSON.`);
              persistencePromises.push(stateService.setConversationHistory(uid, finalHistoryForSaving));
         } else { logger.warn(`${TAG} Pulando salvamento do histórico.`); }
         await Promise.allSettled(persistencePromises);
         logger.debug(`${TAG} Persistência no Redis concluída.`);
    } catch (persistError) { logger.error(`${TAG} Erro persistência Redis (não fatal):`, persistError); }

    // --- Finalização ---
    const duration = Date.now() - start;
    logger.info(`${TAG} ✓ ok ${duration} ms. Retornando ${finalText.length} chars.`);
    return finalText;
}


// ----- Função de Resumo Semanal (Opcional - Mantida como estava na última versão) -----
// (Sem alterações aqui)
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
        logger.warn(`${TAG} Chamada direta à IA para resumo não implementada/configurada.`);
        let exampleInsights = '[Insight 1], [Insight 2], [Insight 3]';
        if (typeof overallStatsForPrompt === 'object' && overallStatsForPrompt !== null) {
            const keys = Object.keys(overallStatsForPrompt);
            exampleInsights = keys.slice(0,3).map(key => `[Insight sobre ${key}]`).join(', ');
        }
        return `Resumo semanal para ${userName} (simulado): ${exampleInsights || 'Insights gerais baseados nos dados.'}`;
    } catch (e: any) {
        logger.error(`${TAG} Erro ao gerar resumo semanal para ${userName}:`, e);
        return `Não consegui gerar o resumo semanal para ${userName} agora devido a um erro: ${e.message || String(e)}`;
    }
}