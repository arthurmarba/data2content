/**
 * @fileoverview Orquestrador de chamadas à API OpenAI com Function Calling e Streaming.
 * Otimizado para buscar dados sob demanda via funções.
 * @version 0.8.0
 */

import OpenAI from 'openai';
import type {
    ChatCompletionMessageParam,
    ChatCompletionChunk,
    ChatCompletionAssistantMessageParam,
    ChatCompletionSystemMessageParam,
    ChatCompletion,
} from 'openai/resources/chat/completions';
import { logger } from '@/app/lib/logger';
import { functionSchemas, functionExecutors } from './aiFunctions'; // Funções disponíveis para o LLM
import { getSystemPrompt } from '@/app/lib/promptSystemFC'; // Prompt base do Tuca (precisará ser atualizado no Passo 3)
import { IUser } from '@/app/models/User'; // Tipo do usuário
// import { AggregatedReport } from './reportHelpers'; // Não mais necessário aqui
// import { AdDealInsights } from './dataService'; // Não mais necessário aqui
import * as stateService from '@/app/lib/stateService'; // Para tipo DialogueState

// Configuração do cliente OpenAI e constantes
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // Modelo default
const TEMP = Number(process.env.OPENAI_TEMP) || 0.7; // Temperatura default
const TOKENS = Number(process.env.OPENAI_MAXTOK) || 900; // Máximo de tokens na resposta
const MAX_ITERS = 6; // Máximo de chamadas de função em loop
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 45_000; // Timeout da API

/**
 * @interface EnrichedContext (Simplificada)
 * @description Define a estrutura do contexto recebido pelo orquestrador (sem dados proativos).
 */
interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.DialogueState;
    // latestReport e adDealInsights removidos daqui
}

/**
 * Envia uma mensagem ao LLM com Function Calling em modo streaming,
 * utilizando um contexto simplificado. A IA solicitará dados via funções.
 *
 * @param {EnrichedContext} enrichedContext Objeto contendo dados do usuário, histórico e estado.
 * @param {string} incomingText Mensagem atual enviada pelo usuário.
 * @returns {Promise<{ stream: ReadableStream<string>, history: ChatCompletionMessageParam[] }>}
 * Um ReadableStream com os deltas de conteúdo da resposta e o histórico completo da interação (incluindo chamadas de função).
 */
export async function askLLMWithEnrichedContext(
    enrichedContext: EnrichedContext, // <<< Contexto agora não tem mais latestReport/adDealInsights
    incomingText: string
): Promise<{
    stream: ReadableStream<string>;
    history: ChatCompletionMessageParam[];
}> {
    const fnTag = '[askLLMWithEnrichedContext v0.8.0]'; // Versão atualizada
    // Desestrutura o contexto SIMPLIFICADO
    const { user, historyMessages, dialogueState } = enrichedContext; // <<< REMOVIDO latestReport, adDealInsights
    logger.info(`${fnTag} Iniciando para usuário ${user._id}. Texto: "${incomingText.slice(0, 50)}..." Usando modelo: ${MODEL}`);

    // --- Monta o Histórico Inicial para o LLM ---
    const initialMsgs: ChatCompletionMessageParam[] = [];

    // 1. Adiciona o prompt do sistema base
    initialMsgs.push({ role: 'system', content: getSystemPrompt(user.name || 'usuário') });

    // 2. REMOVIDO: Bloco que adicionava dados do relatório como mensagem de sistema
    // if (latestReport && latestReport.overallStats) { ... } // <<< REMOVIDO

    // 3. REMOVIDO: Bloco que adicionava insights de publicidade como mensagem de sistema
    // if (adDealInsights) { ... } // <<< REMOVIDO

    // 4. Adiciona o histórico da conversa anterior (limitado pelo consultantService)
    initialMsgs.push(...historyMessages);

    // 5. Adiciona a mensagem atual do usuário
    initialMsgs.push({ role: 'user', content: incomingText });

    logger.debug(`${fnTag} Histórico inicial montado com ${initialMsgs.length} mensagens (sem dados proativos).`);

    // --- Cria o Stream de Resposta ---
    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();

    // --- Inicia o Processamento da Conversa em Background ---
    // A função processTurn agora receberá um histórico inicial mais leve
    const processingPromise = processTurn(initialMsgs, 0, null, writer, user)
        .then(() => {
            logger.debug(`${fnTag} processTurn concluído com sucesso. Fechando writer.`);
            return writer.close();
        })
        .catch(async (error) => {
            logger.error(`${fnTag} Erro durante processTurn:`, error);
            try {
                if (!writer.closed) {
                    logger.debug(`${fnTag} Abortando writer devido a erro.`);
                    await writer.abort(error);
                }
            } catch (abortError) {
                logger.error(`${fnTag} Erro ao abortar writer:`, abortError);
            }
        });

    // Retorna o stream imediatamente
    logger.debug(`${fnTag} Retornando stream imediatamente e histórico inicial.`);
    // O histórico retornado aqui é apenas o inicial (prompt sistema, histórico anterior, msg usuário)
    // O histórico completo com as chamadas de função será construído dentro de processTurn
    return { stream: readable, history: initialMsgs };

    // ============================================================
    // Função Interna Recursiva para Processar Turnos da Conversa
    // ============================================================
    async function processTurn(
        currentMsgs: ChatCompletionMessageParam[],
        iter: number,
        lastFnName: string | null,
        writer: WritableStreamDefaultWriter<string>,
        currentUser: IUser // Passa o usuário para o executor da função
    ): Promise<void> {
        const turnTag = `[processTurn iter ${iter} v0.8.0]`; // Versão atualizada
        logger.debug(`${turnTag} Iniciando.`);

        if (iter >= MAX_ITERS) {
            logger.error(`${turnTag} Limite de iterações (${MAX_ITERS}) excedido.`);
            throw new Error(`Function-call loop excedeu MAX_ITERS (${MAX_ITERS})`);
        }

        const aborter = new AbortController();
        const timeout = setTimeout(() => {
            logger.warn(`${turnTag} Timeout da API OpenAI (${OPENAI_TIMEOUT_MS}ms) atingido. Abortando chamada.`);
            aborter.abort();
        }, OPENAI_TIMEOUT_MS);

        let completionStream: AsyncIterable<ChatCompletionChunk>;
        try {
            logger.debug(`${turnTag} Chamando OpenAI API (Modelo: ${MODEL}, Histórico: ${currentMsgs.length} msgs).`);
            // A chamada à API agora envia um histórico inicial mais leve
            completionStream = await openai.chat.completions.create(
                {
                    model: MODEL,
                    temperature: TEMP,
                    max_tokens: TOKENS,
                    stream: true,
                    messages: currentMsgs, // Passa o histórico atual da conversa
                    functions: [...functionSchemas], // Funções disponíveis
                    function_call: 'auto', // Deixa a IA decidir se chama uma função
                },
                { signal: aborter.signal }
            );
        } catch (error: any) {
            logger.error(`${turnTag} Erro na chamada OpenAI API:`, error);
            clearTimeout(timeout);
            const errorMessage = error.name === 'AbortError' ? 'Timeout da API atingido' : (error.message || String(error));
            throw new Error(`Falha na comunicação com a API OpenAI: ${errorMessage}`);
        } finally {
            clearTimeout(timeout);
        }

        // --- Processamento do Stream da Resposta ---
        let pendingAssistantMsg: ChatCompletionAssistantMessageParam | null = null;
        let functionCallName = '';
        let functionCallArgs = '';
        let streamReceivedContent = false;
        let lastFinishReason: ChatCompletionChunk.Choice['finish_reason'] | null | undefined = null;

        try {
            logger.debug(`${turnTag} Iniciando consumo do stream da API...`);
            for await (const chunk of completionStream) {
                const choice = chunk.choices?.[0];
                if (!choice) continue;
                const delta = choice.delta;

                // Acumula chamada de função
                if (delta?.function_call) {
                    streamReceivedContent = true; // Marca que recebemos algo útil
                    if (!pendingAssistantMsg) {
                        // Cria a mensagem do assistente PENDENTE com a chamada de função
                        pendingAssistantMsg = { role: 'assistant', content: null, function_call: { name: '', arguments: '' } };
                    }
                    if (delta.function_call.name) functionCallName += delta.function_call.name;
                    if (delta.function_call.arguments) functionCallArgs += delta.function_call.arguments;
                    continue; // Continua para o próximo chunk
                }

                // Acumula conteúdo textual
                if (delta?.content) {
                    streamReceivedContent = true; // Marca que recebemos algo útil
                    if (!pendingAssistantMsg) {
                         // Cria a mensagem do assistente PENDENTE com conteúdo
                        pendingAssistantMsg = { role: 'assistant', content: '' };
                    }
                    // Garante que content não seja null antes de concatenar
                    pendingAssistantMsg.content = (pendingAssistantMsg.content ?? '') + delta.content;
                    // Envia o pedaço de texto para o stream de saída
                    try {
                        await writer.write(delta.content);
                    } catch (writeError) {
                        logger.error(`${turnTag} Erro ao escrever no writer (stream pode ter sido fechado/abortado):`, writeError);
                        throw writeError; // Propaga o erro para interromper
                    }
                }

                // Guarda o motivo de finalização
                if (choice.finish_reason) {
                    lastFinishReason = choice.finish_reason;
                    logger.debug(`${turnTag} Recebido finish_reason: ${lastFinishReason}`);
                }

            } // Fim do loop for await
            logger.debug(`${turnTag} Fim do consumo do stream da API. Último Finish Reason: ${lastFinishReason}`);

        } catch (streamError) {
            logger.error(`${turnTag} Erro durante o consumo do stream:`, streamError);
            throw streamError; // Propaga o erro
        }

        // --- Pós-processamento do Stream ---

        // Verifica se algo útil foi recebido
        if (!streamReceivedContent && lastFinishReason !== 'stop' && lastFinishReason !== 'length' && lastFinishReason !== 'function_call') {
             logger.error(`${turnTag} Stream finalizado sem conteúdo útil e com finish_reason inesperado: ${lastFinishReason}`);
             throw new Error('API da OpenAI não retornou conteúdo ou chamada de função válida.');
        }

        // Garante que a mensagem pendente do assistente seja adicionada ao histórico
        if (pendingAssistantMsg) {
            // Completa a chamada de função se foi o que recebemos
            if (functionCallName || functionCallArgs) {
                pendingAssistantMsg.function_call = { name: functionCallName, arguments: functionCallArgs };
                pendingAssistantMsg.content = null; // Garante que content seja null se for func call
            } else if (pendingAssistantMsg.content === '') {
                 // Se não houve conteúdo textual nem func call, mas recebemos delta do assistente
                 logger.warn(`${turnTag} Mensagem do assistente finalizada sem conteúdo textual ou function call. Finish Reason: ${lastFinishReason}. Definindo content como null.`);
                 pendingAssistantMsg.content = null; // Define como null explicitamente
            }
            // Adiciona a mensagem completa (ou quase completa) do assistente ao histórico
            currentMsgs.push(pendingAssistantMsg as ChatCompletionAssistantMessageParam);
        } else if (lastFinishReason === 'stop' || lastFinishReason === 'length') {
             // Caso raro: stream finalizou normalmente mas não recebemos NENHUM delta do assistente
             logger.warn(`${turnTag} Stream finalizado com ${lastFinishReason} mas sem nenhum delta de assistente recebido. Adicionando msg vazia.`);
             currentMsgs.push({ role: 'assistant', content: '' }); // Adiciona msg vazia para manter paridade
        } else if (!functionCallName && lastFinishReason !== 'function_call') {
             // Se não foi stop, length, nem function_call, e não temos msg pendente, algo deu errado
             logger.error(`${turnTag} Estado inesperado no final do processamento do stream. Finish Reason: ${lastFinishReason}`);
             // Considerar lançar um erro aqui também? Depende se queremos tentar recuperar.
        }

        // --- Tratamento da Chamada de Função (se houver) ---
        if (pendingAssistantMsg?.function_call) {
            const { name, arguments: rawArgs } = pendingAssistantMsg.function_call;
            logger.info(`${turnTag} API solicitou Function Call: ${name}. Args: ${rawArgs.slice(0, 100)}...`);

            // Prevenção de Loop Simples
            if (name === lastFnName) {
                logger.error(`${turnTag} Loop detectado: Modelo pediu a função "${name}" duas vezes seguidas.`);
                throw new Error(`Loop detectado: modelo pediu a função "${name}" duas vezes seguidas.`);
            }

            let functionResult: unknown;
            const executor = functionExecutors[name as keyof typeof functionExecutors];

            if (!executor) {
                logger.error(`${turnTag} Executor para a função "${name}" não encontrado.`);
                functionResult = { error: `Função "${name}" desconhecida.` };
            } else {
                try {
                    logger.debug(`${turnTag} Executando a função "${name}"...`);
                    let args = {};
                    try {
                        // Tenta parsear os argumentos JSON fornecidos pela IA
                        args = JSON.parse(rawArgs || '{}');
                    } catch (parseError) {
                         logger.error(`${turnTag} Erro ao parsear argumentos JSON para a função "${name}": ${rawArgs}`, parseError);
                         // Retorna erro para a IA informando sobre os argumentos inválidos
                         functionResult = { error: `Argumentos inválidos fornecidos para a função ${name}. Verifique o formato JSON.` };
                         // Não lança exceção aqui, envia o erro de volta para a IA
                    }

                    // Só executa se o parse funcionou e não definimos erro acima
                    // CORREÇÃO APLICADA AQUI:
                    if (!(typeof functionResult === 'object' && functionResult !== null && 'error' in functionResult)) {
                        // Executa a função do backend (ex: getAggregatedReport, getDailyMetricHistory)
                        // Passa os argumentos parseados e o objeto 'user' atual
                        functionResult = await executor(args, currentUser);
                        logger.debug(`${turnTag} Função "${name}" executada com sucesso.`);
                    }

                } catch (execError: any) {
                    // Captura erros ocorridos DENTRO da execução da função no backend
                    logger.error(`${turnTag} Erro ao executar a função "${name}":`, execError);
                    functionResult = { error: `Erro ao executar a função ${name}: ${execError.message || String(execError)}` };
                }
            }

            // Adiciona o resultado da função ao histórico
            currentMsgs.push({
                role: 'function',
                name: name,
                content: JSON.stringify(functionResult), // Envia o resultado (ou erro) de volta para a IA
            });

            // Chama recursivamente processTurn para a IA gerar a resposta final com base no resultado da função
            logger.debug(`${turnTag} Histórico antes da recursão (iter ${iter + 1}, ${currentMsgs.length} msgs).`);
            await processTurn(currentMsgs, iter + 1, name, writer, currentUser); // Passa o nome da função executada
            return; // Importante retornar após a chamada recursiva
        }

        // Se não houve chamada de função, o turno está completo.
        logger.debug(`${turnTag} Turno concluído sem chamada de função.`);
    } // Fim da função processTurn
}