/**
 * @fileoverview Serviço principal para obter respostas do consultor Tuca.
 * Integra AdDealInsights no contexto enviado para a IA.
 * @version 4.4.0
 */

import { logger } from '@/app/lib/logger';
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from './intentService';
import { askLLMWithEnrichedContext } from './aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import * as dataService from './dataService'; // Agora inclui getAdDealInsights
import { UserNotFoundError } from '@/app/lib/errors';
import { IUser } from '@/app/models/User';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { AggregatedReport } from './reportHelpers';
import { AdDealInsights } from './dataService'; // *** IMPORTAÇÃO ADICIONADA ***
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';

// Configurações
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10;

/**
 * @interface EnrichedContext
 * @description Define a estrutura do contexto enviado ao LLM.
 * *** ATUALIZADO: Inclui AdDealInsights ***
 */
interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.DialogueState;
    latestReport?: AggregatedReport | null;
    adDealInsights?: AdDealInsights | null; // <<< NOVO CAMPO >>>
}

/**
 * Obtém a resposta do consultor Tuca para uma mensagem recebida.
 * Busca proativamente métricas e insights de publicidade.
 * @param {string} fromPhone Número de telefone do remetente.
 * @param {string} incoming Mensagem recebida do usuário.
 * @returns {Promise<string>} A resposta do consultor.
 */
export async function getConsultantResponse(
    fromPhone: string,
    incoming: string
): Promise<string> {
    // Define uma TAG mais específica para esta versão
    const TAG = '[consultantService 4.4.0]'; // Versão atualizada
    const start = Date.now();
    const rawText = incoming;
    logger.info(`${TAG} ⇢ ${fromPhone.slice(-4)}… «${rawText.slice(0, 40)}»`);

    // --- 0. Normalização ---
    const norm = normalizeText(rawText.trim());
    if (!norm) {
        logger.warn(`${TAG} Mensagem normalizada vazia.`);
        return `${getRandomGreeting('')} Pode repetir, por favor? Não entendi bem.`;
    }

    // --- 1. Carregar Dados do Usuário ---
    let user: IUser;
    try {
        user = await dataService.lookupUser(fromPhone);
        logger.debug(`${TAG} Usuário ${user._id} carregado.`);
    } catch (e) {
        logger.error(`${TAG} Erro em lookupUser:`, e);
        if (e instanceof UserNotFoundError) {
            return 'Olá! Parece que é nosso primeiro contato por aqui. Para começar, preciso fazer seu cadastro rápido. Pode me confirmar seu nome completo, por favor?';
        }
        return 'Tive um problema ao buscar seus dados. Poderia tentar novamente em alguns instantes? Se persistir, fale com o suporte. 🙏';
    }
    const uid = user._id.toString();
    const userName = user.name || 'criador';
    const greeting = getRandomGreeting(userName);

    // --- 1.5 Verificar Cache (Após ter o usuário para a chave) ---
    const cacheKey = `resp:${fromPhone}:${norm.slice(0, 100)}`;
    try {
        const cached = await stateService.getFromCache(cacheKey);
        if (cached) {
            logger.info(`${TAG} (cache hit) ${Date.now() - start} ms`);
            return cached;
        }
        logger.info(`${TAG} (cache miss)`);
    } catch (cacheError) {
        logger.error(`${TAG} Erro ao buscar do cache Redis:`, cacheError);
    }

    // --- 2. Carregar Contexto da Conversa (Estado) ---
    let dialogueState: stateService.DialogueState = {};
    try {
        dialogueState = await stateService.getDialogueState(uid);
        logger.debug(`${TAG} Estado carregado.`);
    } catch (stateError) {
        logger.error(`${TAG} Erro ao buscar estado do Redis:`, stateError);
    }

    // --- 2.5 Determinar Intenção e Lidar com Casos Especiais ---
    let intentResult: IntentResult;
    let determinedIntent: DeterminedIntent | null = null;
    try {
        intentResult = await determineIntent(norm, user, rawText, dialogueState, greeting, uid);

        if (intentResult.type === 'special_handled') {
            logger.info(`${TAG} Intenção tratada como caso especial: ${intentResult.response.slice(0, 50)}...`);
            await sendWhatsAppMessage(fromPhone, intentResult.response);
            return intentResult.response;
        } else {
            determinedIntent = intentResult.intent;
            logger.info(`${TAG} Intenção determinada: ${determinedIntent}`);
        }

    } catch (intentError) {
        logger.error(`${TAG} Erro ao determinar intenção:`, intentError);
        determinedIntent = 'general';
    }
    // -----------------------------------------------------------

    // --- 3. Carregar Histórico ---
    let historyString: string = '';
    try {
        historyString = await stateService.getConversationHistory(uid);
        logger.debug(`${TAG} Histórico bruto tem ${historyString.length} chars.`);
    } catch (histError) {
        logger.error(`${TAG} Erro ao buscar histórico do Redis:`, histError);
    }

    // --- 3.5 Preparar Histórico de Mensagens para o LLM (COM LIMITE) ---
    let historyMessages: ChatCompletionMessageParam[] = []; // Histórico completo parseado
    if (historyString) {
        try {
            const lines = historyString.trim().split('\n');
            let currentRole: 'user' | 'assistant' | null = null;
            let currentContent = '';
            for (const line of lines) {
                if (line.startsWith('User: ')) { if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() }); currentRole = 'user'; currentContent = line.substring(6); }
                else if (line.startsWith('Assistant: ')) { if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() }); currentRole = 'assistant'; currentContent = line.substring(11); }
                else if (currentRole) { currentContent += '\n' + line; }
            }
            if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() });
            logger.debug(`${TAG} Histórico completo convertido para ${historyMessages.length} mensagens.`);
        } catch (parseError) { logger.error(`${TAG} Erro ao parsear histórico:`, parseError); historyMessages.length = 0; }
    }
    const limitedHistoryMessages = historyMessages.slice(-HISTORY_LIMIT);
    if (historyMessages.length > HISTORY_LIMIT) { logger.debug(`${TAG} Histórico limitado a ${HISTORY_LIMIT} mensagens (original: ${historyMessages.length}).`); }
    // -----------------------------------------


    // --- 4. Carregar Dados de Métricas e Publicidade (em paralelo) ---
    let latestReport: AggregatedReport | null = null;
    let adDealInsights: AdDealInsights | null = null; // <<< VARIÁVEL ADICIONADA >>>
    try {
        logger.debug(`${TAG} Buscando relatório de métricas e insights de publicidade...`);
        [latestReport, adDealInsights] = await Promise.all([ // <<< CHAMADA PARALELA >>>
            dataService.getLatestAggregatedReport(uid),
            dataService.getAdDealInsights(uid) // <<< CHAMA A NOVA FUNÇÃO >>>
        ]);

        if (latestReport) { logger.debug(`${TAG} Relatório agregado carregado.`); }
        else { logger.info(`${TAG} Nenhum relatório agregado recente encontrado.`); }

        if (adDealInsights) { logger.debug(`${TAG} Insights de publicidade carregados.`); }
        else { logger.info(`${TAG} Nenhum insight de publicidade encontrado.`); }

    } catch (dataError) {
        logger.error(`${TAG} Erro ao buscar relatório ou insights de publicidade:`, dataError);
        // Continua mesmo se falhar, a IA será instruída a lidar com dados ausentes
    }
    // --------------------------------------------------------------------

    // --- 5. Preparar Contexto Enriquecido para o LLM ---
    const enrichedContext: EnrichedContext = {
        user: user,
        historyMessages: limitedHistoryMessages,
        dialogueState: dialogueState,
        latestReport: latestReport,
        adDealInsights: adDealInsights, // <<< ADICIONADO AO CONTEXTO >>>
    };

    // --- 5.5 ENVIAR MENSAGEM INICIAL DE PROCESSAMENTO (BASEADA NA INTENÇÃO) ---
    try {
        let processingMessage = `Ok, ${userName}! Recebi seu pedido. 👍\nEstou a analisar as informações e já te trago os insights...`; // Default
        switch (determinedIntent) {
            case 'script_request': processingMessage = `Ok, ${userName}! Pedido de roteiro recebido. 👍\nEstou a estruturar as ideias e já te mando o script...`; break;
            case 'content_plan': processingMessage = `Ok, ${userName}! Recebi seu pedido de plano de conteúdo. 👍\nEstou a organizar a agenda e já te apresento o planejamento...`; break;
            case 'ranking_request': processingMessage = `Entendido, ${userName}! Você quer um ranking. 👍\nEstou a comparar os dados e já te mostro os resultados ordenados...`; break;
            case 'report': case 'ASK_BEST_PERFORMER': case 'ASK_BEST_TIME': processingMessage = `Certo, ${userName}! Recebi seu pedido de análise/relatório. 👍\nEstou a compilar os dados e já te apresento os resultados...`; break;
            case 'content_ideas': processingMessage = `Legal, ${userName}! Buscando ideias de conteúdo para você. 👍\nEstou a verificar as tendências e já te trago algumas sugestões...`; break;
            case 'general': default: processingMessage = `Ok, ${userName}! Recebi sua mensagem. 👍\nEstou a processar e já te respondo...`; break;
        }
        logger.debug(`${TAG} Enviando mensagem de processamento (intenção: ${determinedIntent}) para ${fromPhone}...`);
        await sendWhatsAppMessage(fromPhone, processingMessage);
    } catch (sendError) {
        logger.error(`${TAG} Falha ao enviar mensagem inicial de processamento (não fatal):`, sendError);
    }
    // ----------------------------------------------------

    // --- 6. Chamar o LLM com o Contexto Enriquecido e Processar Resposta ---
    let finalText = '';
    let historyFromLLM: ChatCompletionMessageParam[] = [];
    let readCounter = 0;
    let streamTimeout: NodeJS.Timeout | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;

    try {
        logger.debug(`${TAG} Chamando askLLMWithEnrichedContext com histórico limitado (${limitedHistoryMessages.length} msgs)...`);
        const { stream, history: updatedHistory } = await askLLMWithEnrichedContext(
            enrichedContext, // <<< PASSA O CONTEXTO ENRIQUECIDO >>>
            rawText
        );
        historyFromLLM = updatedHistory;
        logger.debug(`${TAG} askLLMWithEnrichedContext retornou. Iniciando leitura do stream...`);

        reader = stream.getReader();

        streamTimeout = setTimeout(() => { /* ... lógica de timeout ... */ logger.warn(`${TAG} Timeout (${STREAM_READ_TIMEOUT_MS}ms) durante leitura do stream...`); streamTimeout = null; reader?.cancel().catch(e => logger.error(`${TAG} Erro ao cancelar reader:`, e)); }, STREAM_READ_TIMEOUT_MS);

        while (true) { /* ... loop de leitura ... */
             readCounter++; let value: string | undefined; let done: boolean | undefined;
             try { const result = await reader.read(); if (streamTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
             catch (readError: any) { logger.error(`${TAG} Erro em reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro ao ler stream: ${readError.message}`); }
             if (done) { break; } if (typeof value === 'string') { finalText += value; } else { logger.warn(`${TAG} 'value' undefined mas 'done' false.`); }
        }
        if (streamTimeout) { clearTimeout(streamTimeout); }
        logger.debug(`${TAG} Texto final montado: ${finalText.length} chars.`);
        if (finalText.trim().length === 0) { finalText = 'Hum... tive um problema ao gerar a resposta final.'; }

    } catch (err: any) { /* ... tratamento de erro ... */ logger.error(`${TAG} Erro durante chamada/leitura LLM:`, err); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; finalText = 'Ops! Tive uma dificuldade técnica.';
    } finally { /* ... releaseLock ... */ if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${TAG} Erro releaseLock:`, e); } } }

    // --- 7. Persistência Pós-Resposta ---
    try { /* ... lógica de persistência ... */
         logger.debug(`${TAG} Iniciando persistência no Redis...`);
         const nextState = { ...(dialogueState || {}), lastInteraction: Date.now() };
         const newHistoryString = historyFromLLM.filter(msg => msg.role === 'user' || (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim().length > 0)).map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`).join('\n');
         await Promise.allSettled([ stateService.updateDialogueState(uid, nextState), stateService.setConversationHistory(uid, newHistoryString), stateService.setInCache(cacheKey, finalText, CACHE_TTL_SECONDS), stateService.incrementUsageCounter(uid), ]);
         logger.debug(`${TAG} Persistência no Redis concluída (histórico salvo: ${historyFromLLM.length} msgs).`);
    } catch (persistError) { logger.error(`${TAG} Erro persistência (não fatal):`, persistError); }

    // --- Finalização ---
    const duration = Date.now() - start;
    logger.info(`${TAG} ✓ ok ${duration} ms. Retornando ${finalText.length} chars.`);
    return finalText;
}


// ----- Função de Resumo Semanal (Opcional) -----
// (Mantida como está)
/**
 * Gera um resumo estratégico semanal baseado em um relatório agregado.
 * @param {string} userName Nome do usuário.
 * @param {AggregatedReport} report O relatório agregado.
 * @returns {Promise<string>} O resumo gerado pela IA.
 */
export async function generateStrategicWeeklySummary(
  userName: string,
  report: AggregatedReport
): Promise<string> {
  const TAG = '[weeklySummary]';
  if (!report?.overallStats) {
      logger.warn(`${TAG} OverallStats ausente no relatório para ${userName}.`);
      return 'Não foi possível gerar o resumo semanal: dados insuficientes no relatório.';
  }

  const PROMPT = `Como consultor estratégico, resuma em 3 bullets concisos os principais destaques (positivos ou pontos de atenção) das métricas gerais de ${userName} desta semana, baseado nestes dados: ${JSON.stringify(
    report.overallStats
  )}. Foco em insights acionáveis.`;

  try {
    // Substitua 'callOpenAIForQuestion' pela sua função real de chamada direta à IA.
    // return await callOpenAIForQuestion(PROMPT); // Descomente e ajuste se necessário
    logger.warn(`${TAG} Chamada direta à IA para resumo não implementada/configurada.`);
    return `Resumo semanal para ${userName} (simulado): [Insight 1 baseado em ${Object.keys(report.overallStats)[0]}], [Insight 2 baseado em ${Object.keys(report.overallStats)[1]}], [Insight 3 baseado em ${Object.keys(report.overallStats)[2]}]`; // Placeholder
  } catch (e) {
    logger.error(`${TAG} Erro ao gerar resumo semanal para ${userName}:`, e);
    return `Não consegui gerar o resumo semanal para ${userName} agora devido a um erro.`;
  }
}
