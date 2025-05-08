/**
 * @fileoverview Serviço principal para obter respostas do consultor Tuca.
 * Otimizado para buscar dados sob demanda via Function Calling.
 * @version 4.5.0
 */

import { logger } from '@/app/lib/logger';
import { normalizeText, determineIntent, getRandomGreeting, IntentResult, DeterminedIntent } from './intentService';
import { askLLMWithEnrichedContext } from './aiOrchestrator'; // Responsável por chamar a IA e lidar com funções
import * as stateService from '@/app/lib/stateService';
import * as dataService from './dataService'; // Usado para lookupUser
import { UserNotFoundError } from '@/app/lib/errors';
import { IUser } from '@/app/models/User';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { sendWhatsAppMessage } from '@/app/lib/whatsappService';

// Importação de functionExecutors (mantida da correção anterior)
import { functionExecutors } from '@/app/lib/aiFunctions';

// Configurações
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5;
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000;
const HISTORY_LIMIT = Number(process.env.LLM_HISTORY_LIMIT) || 10;

/**
 * @interface EnrichedContext (Simplificada)
 * @description Define a estrutura do contexto enviado ao LLM (sem dados proativos).
 */
interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.DialogueState;
}

/**
 * Obtém a resposta do consultor Tuca para uma mensagem recebida.
 * NÃO busca mais dados proativamente; a IA solicitará via Function Calling.
 * @param {string} fromPhone Número de telefone do remetente.
 * @param {string} incoming Mensagem recebida do usuário.
 * @returns {Promise<string>} A resposta do consultor.
 */
export async function getConsultantResponse(
    fromPhone: string,
    incoming: string
): Promise<string> {
    const TAG = '[consultantService 4.5.0]';
    const start = Date.now();
    const rawText = incoming;
    logger.info(`${TAG} ⇢ ${fromPhone.slice(-4)}… «${rawText.slice(0, 40)}»`);

    const norm = normalizeText(rawText.trim());
    if (!norm) {
        logger.warn(`${TAG} Mensagem normalizada vazia.`);
        return `${getRandomGreeting('')} Pode repetir, por favor? Não entendi bem.`;
    }

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

    let dialogueState: stateService.DialogueState = {};
    try {
        dialogueState = await stateService.getDialogueState(uid);
        logger.debug(`${TAG} Estado carregado.`);
    } catch (stateError) {
        logger.error(`${TAG} Erro ao buscar estado do Redis:`, stateError);
    }

    let intentResult: IntentResult;
    let determinedIntent: DeterminedIntent | null = null;
    try {
        intentResult = await determineIntent(norm, user, rawText, dialogueState, greeting, uid);
        if (intentResult.type === 'special_handled') {
            logger.info(`${TAG} Intenção tratada como caso especial: ${intentResult.response.slice(0, 50)}...`);
            return intentResult.response;
        } else {
            determinedIntent = intentResult.intent;
            logger.info(`${TAG} Intenção determinada: ${determinedIntent}`);
        }
    } catch (intentError) {
        logger.error(`${TAG} Erro ao determinar intenção:`, intentError);
        determinedIntent = 'general';
    }

    let historyString: string = '';
    try {
        historyString = await stateService.getConversationHistory(uid);
        logger.debug(`${TAG} Histórico bruto tem ${historyString.length} chars.`);
    } catch (histError) {
        logger.error(`${TAG} Erro ao buscar histórico do Redis:`, histError);
    }

    let historyMessages: ChatCompletionMessageParam[] = [];
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

    const enrichedContext: EnrichedContext = {
        user: user,
        historyMessages: limitedHistoryMessages,
        dialogueState: dialogueState,
    };

    try {
        let processingMessage = `Ok, ${userName}! Recebi seu pedido. 👍\nEstou verificando as informações e já te respondo...`;
        switch (determinedIntent) {
            case 'script_request': processingMessage = `Ok, ${userName}! Pedido de roteiro recebido. 👍\nEstou a estruturar as ideias...`; break;
            case 'content_plan': processingMessage = `Ok, ${userName}! Recebi seu pedido de plano de conteúdo. 👍\nEstou a organizar a agenda...`; break;
            case 'ranking_request': processingMessage = `Entendido, ${userName}! Você quer um ranking. 👍\nEstou a buscar os dados para comparar...`; break;
            case 'report': case 'ASK_BEST_PERFORMER': case 'ASK_BEST_TIME': processingMessage = `Certo, ${userName}! Recebi seu pedido de análise/relatório. 👍\nEstou a buscar e compilar os dados...`; break;
            case 'content_ideas': processingMessage = `Legal, ${userName}! Buscando ideias de conteúdo para você. 👍\nEstou a verificar as tendências...`; break;
        }
        logger.debug(`${TAG} Enviando mensagem de processamento (intenção: ${determinedIntent}) para ${fromPhone}...`);
        await sendWhatsAppMessage(fromPhone, processingMessage);
    } catch (sendError) {
        logger.error(`${TAG} Falha ao enviar mensagem inicial de processamento (não fatal):`, sendError);
    }

    let finalText = '';
    let historyFromLLM: ChatCompletionMessageParam[] = [];
    let reader: ReadableStreamDefaultReader<string> | null = null;
    let streamTimeout: NodeJS.Timeout | null = null;

    try {
        logger.debug(`${TAG} Chamando askLLMWithEnrichedContext com histórico limitado (${limitedHistoryMessages.length} msgs) e contexto simplificado...`);
        const { stream, history: updatedHistory } = await askLLMWithEnrichedContext(
            enrichedContext,
            rawText
        );
        historyFromLLM = updatedHistory;
        logger.debug(`${TAG} askLLMWithEnrichedContext retornou. Iniciando leitura do stream...`);
        reader = stream.getReader();
        streamTimeout = setTimeout(() => { logger.warn(`${TAG} Timeout (${STREAM_READ_TIMEOUT_MS}ms) durante leitura do stream...`); streamTimeout = null; reader?.cancel().catch(e => logger.error(`${TAG} Erro ao cancelar reader:`, e)); }, STREAM_READ_TIMEOUT_MS);
        // eslint-disable-next-line no-constant-condition
        while (true) {
             let value: string | undefined; let done: boolean | undefined;
             try { const result = await reader.read(); if (streamTimeout === null && !result.done) { continue; } value = result.value; done = result.done; }
             catch (readError: any) { logger.error(`${TAG} Erro em reader.read(): ${readError.message}`); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; throw new Error(`Erro ao ler stream: ${readError.message}`); }
             if (done) { break; } if (typeof value === 'string') { finalText += value; } else { logger.warn(`${TAG} 'value' undefined mas 'done' false.`); }
        }
        if (streamTimeout) { clearTimeout(streamTimeout); }
        logger.debug(`${TAG} Texto final montado: ${finalText.length} chars.`);
        if (finalText.trim().length === 0) { finalText = 'Hum... tive um problema ao gerar a resposta final.'; }
    } catch (err: any) { logger.error(`${TAG} Erro durante chamada/leitura LLM:`, err); if (streamTimeout) clearTimeout(streamTimeout); streamTimeout = null; finalText = 'Ops! Tive uma dificuldade técnica.';
    } finally { if (reader) { try { await reader.releaseLock(); } catch (e) { logger.error(`${TAG} Erro releaseLock:`, e); } } }

    try {
         logger.debug(`${TAG} Iniciando persistência no Redis...`);
         const nextState = { ...(dialogueState || {}), lastInteraction: Date.now() };
         const newHistoryString = historyFromLLM.filter(msg => msg.role === 'user' || (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim().length > 0) || msg.role === 'function' || (msg.role === 'assistant' && msg.function_call)).map(msg => {
            if(msg.role === 'assistant' && msg.function_call) { return `Assistant (Function Call): ${msg.function_call.name}(${msg.function_call.arguments})`; }
            if(msg.role === 'function') { return `Function (${msg.name}): ${typeof msg.content === 'string' ? msg.content.slice(0, 150) + '...' : '...'}`; }
            return `${msg.role === 'user' ? 'User' : 'Assistant'}: ${typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content)}`;
         }).join('\n');
         await Promise.allSettled([ stateService.updateDialogueState(uid, nextState), stateService.setConversationHistory(uid, newHistoryString), stateService.setInCache(cacheKey, finalText, CACHE_TTL_SECONDS), stateService.incrementUsageCounter(uid), ]);
         logger.debug(`${TAG} Persistência no Redis concluída (histórico salvo: ${historyFromLLM.length} msgs).`);
    } catch (persistError) { logger.error(`${TAG} Erro persistência (não fatal):`, persistError); }

    const duration = Date.now() - start;
    logger.info(`${TAG} ✓ ok ${duration} ms. Retornando ${finalText.length} chars.`);
    return finalText;
}

// ----- Função de Resumo Semanal (Opcional) -----
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

      // --- CORREÇÃO APLICADA AQUI ---
      // Verifica se o executor da função existe antes de chamá-lo
      const getAggregatedReportExecutor = functionExecutors.getAggregatedReport;
      if (!getAggregatedReportExecutor) {
          logger.error(`${TAG} Executor para 'getAggregatedReport' não está definido em functionExecutors.`);
          return `Não foi possível gerar o resumo semanal: funcionalidade de relatório indisponível. Por favor, contate o suporte.`;
      }
      reportData = await getAggregatedReportExecutor({}, lookedUpUser);
      // --- FIM DA CORREÇÃO ---

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