/**
 * @fileoverview Serviço principal para obter respostas do consultor Tuca.
 * Versão otimizada para buscar métricas proativamente e enviá-las no contexto inicial do LLM.
 * Timeout de leitura do stream aumentado.
 * @version 4.3.1
 */

import { logger } from '@/app/lib/logger';
import { normalizeText } from './intentService';
// Importa a função adaptada do orquestrador
import { askLLMWithEnrichedContext } from './aiOrchestrator';
import * as stateService from '@/app/lib/stateService';
import * as dataService from './dataService'; // Garanta que getLatestAggregatedReport está aqui
import { UserNotFoundError } from '@/app/lib/errors';
import { getRandomGreeting } from './intentService';
import { IUser } from '@/app/models/User'; // Assumindo que IUser está em models
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions'; // Ajuste se usar outro provedor
import { AggregatedReport } from './reportHelpers'; // Garanta que o tipo está correto

// Configurações
const CACHE_TTL_SECONDS = Number(process.env.CACHE_TTL_SECONDS) || 60 * 5; // 5 minutos

// *** TIMEOUT AJUSTADO ***
// Aumenta o timeout para dar mais tempo para o LLM gerar respostas complexas após function calls.
// Exemplo: 90 segundos (ajuste conforme necessário)
const STREAM_READ_TIMEOUT_MS = Number(process.env.STREAM_READ_TIMEOUT_MS) || 90_000; // Aumentado de 50s para 90s (ou via env var)


/**
 * @interface EnrichedContext
 * @description Define a estrutura do contexto enviado ao LLM, incluindo dados do usuário e métricas.
 */
interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.DialogueState; // Estado da conversa (ex: último tópico)
    latestReport?: AggregatedReport | null; // Último relatório agregado
}

/**
 * Obtém a resposta do consultor Tuca para uma mensagem recebida.
 * Busca proativamente o último relatório de métricas do usuário.
 * @param {string} fromPhone Número de telefone do remetente.
 * @param {string} incoming Mensagem recebida do usuário.
 * @returns {Promise<string>} A resposta do consultor.
 */
export async function getConsultantResponse(
    fromPhone: string,
    incoming: string
): Promise<string> {
    // Define uma TAG mais específica para esta versão
    const TAG = '[consultantService 4.3.1]';
    const start = Date.now();
    logger.info(`${TAG} ⇢ ${fromPhone.slice(-4)}… «${incoming.slice(0, 40)}»`);

    // --- 0. Normalização e Cache da Resposta ---
    const norm = normalizeText(incoming.trim());
    if (!norm) {
        logger.warn(`${TAG} Mensagem normalizada vazia.`);
        return `${getRandomGreeting('')} Pode repetir, por favor? Não entendi bem.`;
    }

    const cacheKey = `resp:${fromPhone}:${norm.slice(0, 100)}`;
    try {
        const cached = await stateService.getFromCache(cacheKey);
        if (cached) {
            logger.info(`${TAG} (cache hit) ${Date.now() - start} ms`);
            return cached; // Retorna resposta do cache
        }
        logger.info(`${TAG} (cache miss)`);
    } catch (cacheError) {
        logger.error(`${TAG} Erro ao buscar do cache Redis:`, cacheError);
        // Continua mesmo com erro no cache
    }

    // --- 1. Carregar Dados do Usuário ---
    let user: IUser;
    try {
        user = await dataService.lookupUser(fromPhone);
        logger.debug(`${TAG} Usuário ${user._id} carregado.`);
    } catch (e) {
        logger.error(`${TAG} Erro em lookupUser:`, e);
        if (e instanceof UserNotFoundError) {
            // Mantém a mensagem amigável para novos usuários
            return 'Olá! Parece que é nosso primeiro contato por aqui. Para começar, preciso fazer seu cadastro rápido. Pode me confirmar seu nome completo, por favor?';
        }
        // Outros erros podem ser problemas temporários
        return 'Tive um problema ao buscar seus dados. Poderia tentar novamente em alguns instantes? Se persistir, fale com o suporte. 🙏';
    }
    const uid = user._id.toString();

    // --- 2. Carregar Contexto da Conversa (Estado e Histórico) ---
    let dialogueState: stateService.DialogueState = {};
    let historyString: string = '';
    try {
        // Busca estado e histórico em paralelo
        [dialogueState, historyString] = await Promise.all([
            stateService.getDialogueState(uid),
            stateService.getConversationHistory(uid),
        ]);
        logger.debug(`${TAG} Estado carregado. Histórico tem ${historyString.length} chars.`);
    } catch (stateError) {
        logger.error(`${TAG} Erro ao buscar estado/histórico do Redis:`, stateError);
        // Não crítico, continua sem estado/histórico se falhar
    }

    // --- 3. Preparar Histórico de Mensagens para o LLM ---
    const historyMessages: ChatCompletionMessageParam[] = [];
    if (historyString) {
        try {
            const lines = historyString.trim().split('\n');
            let currentRole: 'user' | 'assistant' | null = null;
            let currentContent = '';
            for (const line of lines) {
                if (line.startsWith('User: ')) {
                    if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() });
                    currentRole = 'user';
                    currentContent = line.substring(6);
                } else if (line.startsWith('Assistant: ')) {
                    if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() });
                    currentRole = 'assistant';
                    currentContent = line.substring(11);
                } else if (currentRole) {
                    // Continua o conteúdo da mensagem anterior se não for um novo prefixo
                    currentContent += '\n' + line;
                }
            }
            // Adiciona a última mensagem pendente
            if (currentRole) historyMessages.push({ role: currentRole, content: currentContent.trim() });
            logger.debug(`${TAG} Histórico convertido para ${historyMessages.length} mensagens.`);
        } catch (parseError) {
            logger.error(`${TAG} Erro ao parsear histórico:`, parseError);
            // Limpa o histórico em caso de erro de parse para não enviar dados inválidos
            historyMessages.length = 0;
        }
    }

    // --- 4. Carregar Dados de Métricas (Relatório Agregado) ---
    let latestReport: AggregatedReport | null = null;
    try {
        // Chama a nova função em dataService
        latestReport = await dataService.getLatestAggregatedReport(uid);
        if (latestReport) {
            // Log apenas se o relatório for encontrado e tiver dados
            logger.debug(`${TAG} Relatório agregado carregado (Overall Stats: ${!!latestReport.overallStats}).`);
        } else {
            logger.info(`${TAG} Nenhum relatório agregado recente encontrado para o usuário ${uid}.`);
        }
    } catch (reportError) {
        logger.error(`${TAG} Erro ao buscar relatório agregado:`, reportError);
        // Não crítico, o LLM será instruído a lidar com a ausência de dados
    }

    // --- 5. Preparar Contexto Enriquecido para o LLM ---
    const enrichedContext: EnrichedContext = {
        user: user, // Dados do usuário (nome, etc.)
        historyMessages: historyMessages, // Histórico da conversa formatado
        dialogueState: dialogueState, // Estado atual da conversa
        latestReport: latestReport, // Último relatório (pode ser null)
    };

    // --- 6. Chamar o LLM com o Contexto Enriquecido e Processar Resposta ---
    let finalText = '';
    let historyFromLLM: ChatCompletionMessageParam[] = []; // Armazena o histórico retornado pelo LLM
    let readCounter = 0; // Contador de chunks lidos do stream
    let streamTimeout: NodeJS.Timeout | null = null;
    let reader: ReadableStreamDefaultReader<string> | null = null;

    try {
        logger.debug(`${TAG} Chamando askLLMWithEnrichedContext...`);
        // Chama a função adaptada no orquestrador
        const { stream, history: updatedHistory } = await askLLMWithEnrichedContext(
            enrichedContext, // Passa todo o contexto
            incoming // Passa a mensagem atual do usuário
        );
        // Guarda o histórico retornado (pode conter chamadas de função e a resposta final)
        historyFromLLM = updatedHistory;
        logger.debug(`${TAG} askLLMWithEnrichedContext retornou. Iniciando leitura do stream...`);

        reader = stream.getReader();

        // Define um timeout para a leitura do stream (AGORA MAIOR)
        streamTimeout = setTimeout(() => {
            logger.warn(`${TAG} Timeout (${STREAM_READ_TIMEOUT_MS}ms) durante leitura do stream. Cancelando reader.`);
            streamTimeout = null; // Evita clear duplo no finally
            reader?.cancel(`Stream reading timeout after ${STREAM_READ_TIMEOUT_MS}ms`)
                  .catch(e => logger.error(`${TAG} Erro ao cancelar reader no timeout:`, e));
        }, STREAM_READ_TIMEOUT_MS);

        // Loop para ler os chunks do stream
        while (true) {
            readCounter++;
            let value: string | undefined;
            let done: boolean | undefined;

            try {
                const result = await reader.read();
                // Se o timeout já ocorreu, ignora o resultado tardio
                if (streamTimeout === null && !result.done) {
                    logger.warn(`${TAG} [Leitura ${readCounter}] Leitura retornou após timeout/cancelamento, ignorando chunk.`);
                    continue; // Ignora este chunk e tenta ler o próximo (ou finalizar)
                }
                value = result.value;
                done = result.done;

            } catch (readError: any) {
                // Erros comuns aqui incluem cancelamento pelo timeout
                logger.error(`${TAG} [Leitura ${readCounter}] Erro em reader.read(): ${readError.message}`);
                if (streamTimeout) clearTimeout(streamTimeout);
                streamTimeout = null;
                // Considera erro fatal para a leitura
                throw new Error(`Erro ao ler stream: ${readError.message}`);
            }

            if (done) {
                logger.debug(`${TAG} [Leitura ${readCounter}] Stream finalizado (done=true).`);
                break; // Sai do loop while
            }

            if (typeof value === 'string') {
                finalText += value; // Acumula o texto da resposta
            } else {
                // Isso não deveria acontecer se done é false, loga como aviso
                logger.warn(`${TAG} [Leitura ${readCounter}] Recebido 'value' undefined, mas 'done' é false.`);
            }
        }

        // Limpa o timeout se o stream terminou antes do tempo limite
        if (streamTimeout) {
            clearTimeout(streamTimeout);
            logger.debug(`${TAG} Leitura do stream concluída antes do timeout.`);
        }

        logger.debug(`${TAG} Texto final montado: ${finalText.length} chars.`);

        // Verifica se a resposta final não está vazia
        if (finalText.trim().length === 0) {
            logger.warn(`${TAG} Stream finalizado mas finalText está vazio após ${readCounter} leituras.`);
            // Pode ser um problema no LLM ou na função chamada
            return 'Hum... não consegui gerar uma resposta completa agora. Pode tentar de novo?';
        }

    } catch (err: any) {
        logger.error(`${TAG} Erro durante chamada ao LLM ou leitura do stream (após ${readCounter} leituras):`, err);
        // Garante que o timeout seja limpo em caso de erro
        if (streamTimeout) clearTimeout(streamTimeout);
        streamTimeout = null;
        // Retorna mensagem de erro genérica para o usuário
        return 'Ops! Tive uma dificuldade técnica aqui. Poderia tentar sua pergunta novamente em alguns instantes? 🙏';
    } finally {
        // Garante a liberação do lock do reader
        if (reader) {
            try {
                await reader.releaseLock();
            } catch (releaseError) {
                // Loga o erro mas não impede o fluxo
                logger.error(`${TAG} Erro (não fatal) ao liberar reader lock no finally:`, releaseError);
            }
        }
    }

    // --- 7. Persistência Pós-Resposta ---
    try {
        logger.debug(`${TAG} Iniciando persistência no Redis...`);
        // Idealmente, o orchestrator deveria retornar o estado atualizado após chamadas de função.
        // Se não retornar, usamos o estado que tínhamos antes da chamada.
        const nextState = { ...(enrichedContext.dialogueState || {}), lastInteraction: Date.now() };

        // Usa o histórico retornado pelo orchestrator, que inclui a interação completa
        const newHistoryString = historyFromLLM
            .filter(msg => msg.role === 'user' || (msg.role === 'assistant' && typeof msg.content === 'string' && msg.content.trim().length > 0)) // Garante que assistant content existe e não é vazio
            .map(msg => {
                // Formata corretamente, tratando possíveis conteúdos não-string (embora filtrados)
                const rolePrefix = msg.role === 'user' ? 'User' : 'Assistant';
                const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content); // Fallback para JSON se não for string
                return `${rolePrefix}: ${content}`;
            })
            .join('\n');

        // Executa as operações de persistência em paralelo (sem esperar todas)
        await Promise.allSettled([
            stateService.updateDialogueState(uid, nextState),
            stateService.setConversationHistory(uid, newHistoryString),
            stateService.setInCache(cacheKey, finalText, CACHE_TTL_SECONDS),
            stateService.incrementUsageCounter(uid), // Incrementa contador de uso
        ]);
        logger.debug(`${TAG} Persistência no Redis concluída.`);
    } catch (persistError) {
        logger.error(`${TAG} Erro durante a persistência no Redis (não fatal):`, persistError);
        // Loga o erro mas retorna a resposta ao usuário mesmo assim
    }

    // --- Finalização ---
    const duration = Date.now() - start;
    logger.info(`${TAG} ✓ ok ${duration} ms. Retornando ${finalText.length} chars.`);
    return finalText; // Retorna a resposta final para o usuário
}


// ----- Função de Resumo Semanal (Opcional) -----
// Mantida como exemplo, mas idealmente usaria o mesmo fluxo do Tuca para análises.

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

  // Prompt simples para resumo direto das métricas gerais.
  // Para análises mais profundas, seria melhor chamar askLLMWithEnrichedContext.
  const PROMPT = `Como consultor estratégico, resuma em 3 bullets concisos os principais destaques (positivos ou pontos de atenção) das métricas gerais de ${userName} desta semana, baseado nestes dados: ${JSON.stringify(
    report.overallStats
  )}. Foco em insights acionáveis.`;

  try {
    // Usar uma chamada direta à IA pode ser mais simples para um resumo básico.
    // Se precisar de análise complexa ou acesso a outras funções, use o fluxo principal.
    // Substitua 'callOpenAIForQuestion' pela sua função real de chamada direta à IA.
    // return await callOpenAIForQuestion(PROMPT); // Descomente e ajuste se necessário
    logger.warn(`${TAG} Chamada direta à IA para resumo não implementada/configurada.`);
    return `Resumo semanal para ${userName} (simulado): [Insight 1 baseado em ${Object.keys(report.overallStats)[0]}], [Insight 2 baseado em ${Object.keys(report.overallStats)[1]}], [Insight 3 baseado em ${Object.keys(report.overallStats)[2]}]`; // Placeholder
  } catch (e) {
    logger.error(`${TAG} Erro ao gerar resumo semanal para ${userName}:`, e);
    return `Não consegui gerar o resumo semanal para ${userName} agora devido a um erro.`;
  }
}
