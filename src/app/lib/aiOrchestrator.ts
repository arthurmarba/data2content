/**
 * @fileoverview Orquestrador de chamadas à API OpenAI com Function Calling e Streaming.
 * Versão otimizada para receber contexto enriquecido (incluindo relatório de métricas).
 * Modelo padrão alterado para gpt-4o-mini.
 * @version 0.7.1
 */

import OpenAI from 'openai';
import type {
    ChatCompletionMessageParam,
    ChatCompletionChunk,
    ChatCompletionAssistantMessageParam,
    ChatCompletionSystemMessageParam, // Importa o tipo SystemMessageParam
    ChatCompletion,
} from 'openai/resources/chat/completions';
import { logger } from '@/app/lib/logger';
import { functionSchemas, functionExecutors } from './aiFunctions'; // Funções disponíveis para o LLM
import { getSystemPrompt } from '@/app/lib/promptSystemFC'; // Prompt base do Tuca
import { IUser } from '@/app/models/User'; // Tipo do usuário
import { AggregatedReport } from './reportHelpers'; // Tipo do relatório agregado
import * as stateService from '@/app/lib/stateService'; // Para tipo DialogueState

// Configuração do cliente OpenAI e constantes
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// *** MODELO ALTERADO AQUI ***
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // Modelo default agora é gpt-4o-mini
// *** FIM DA ALTERAÇÃO ***

const TEMP = Number(process.env.OPENAI_TEMP) || 0.7; // Temperatura default
const TOKENS = Number(process.env.OPENAI_MAXTOK) || 900; // Máximo de tokens na resposta
const MAX_ITERS = 6; // Máximo de chamadas de função em loop
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 45_000; // Timeout da API

/**
 * @interface EnrichedContext
 * @description Define a estrutura do contexto recebido pelo orquestrador.
 * (Idealmente, importar de um local compartilhado ou do consultantService)
 */
interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.DialogueState;
    latestReport?: AggregatedReport | null;
}

/**
 * Envia uma mensagem ao LLM com Function Calling em modo streaming,
 * utilizando um contexto enriquecido que inclui dados do usuário e métricas.
 *
 * @param {EnrichedContext} enrichedContext Objeto contendo dados do usuário, histórico, estado e último relatório.
 * @param {string} incomingText Mensagem atual enviada pelo usuário.
 * @returns {Promise<{ stream: ReadableStream<string>, history: ChatCompletionMessageParam[] }>}
 * Um ReadableStream com os deltas de conteúdo da resposta e o histórico completo da interação.
 */
export async function askLLMWithEnrichedContext(
    enrichedContext: EnrichedContext,
    incomingText: string
): Promise<{
    stream: ReadableStream<string>;
    history: ChatCompletionMessageParam[];
}> {
    const fnTag = '[askLLMWithEnrichedContext v0.7.1]'; // Versão atualizada
    const { user, historyMessages, dialogueState, latestReport } = enrichedContext;
    logger.info(`${fnTag} Iniciando para usuário ${user._id}. Texto: "${incomingText.slice(0, 50)}..." Usando modelo: ${MODEL}`); // Log do modelo

    // --- Monta o Histórico Inicial para o LLM ---
    const initialMsgs: ChatCompletionMessageParam[] = [];

    // 1. Adiciona o prompt do sistema base
    initialMsgs.push({ role: 'system', content: getSystemPrompt(user.name || 'usuário') });

    // 2. Adiciona os dados do relatório como mensagem de sistema
    if (latestReport && latestReport.overallStats) {
        logger.debug(`${fnTag} Adicionando dados do relatório ao contexto do LLM.`);
        const reportContext: ChatCompletionSystemMessageParam = {
            role: 'system',
            content: `[DADOS DO ÚLTIMO RELATÓRIO AGREGADO DO USUÁRIO ${user.name || user._id}]
OBS: Use estes dados como base principal para suas análises e recomendações de desempenho. Compare com o histórico da conversa e conhecimento geral quando apropriado.
${JSON.stringify(latestReport.overallStats, null, 2)}
[FIM DOS DADOS DO RELATÓRIO]`
        };
        initialMsgs.push(reportContext);
    } else {
        logger.debug(`${fnTag} Nenhum relatório recente para adicionar ao contexto.`);
    }

    // 3. Adiciona o histórico da conversa anterior (limitado pelo consultantService)
    initialMsgs.push(...historyMessages);

    // 4. Adiciona a mensagem atual do usuário
    initialMsgs.push({ role: 'user', content: incomingText });

    logger.debug(`${fnTag} Histórico inicial montado com ${initialMsgs.length} mensagens.`);

    // --- Cria o Stream de Resposta ---
    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();

    // --- Inicia o Processamento da Conversa em Background ---
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
    return { stream: readable, history: initialMsgs };

    // ============================================================
    // Função Interna Recursiva para Processar Turnos da Conversa
    // ============================================================
    async function processTurn(
        currentMsgs: ChatCompletionMessageParam[],
        iter: number,
        lastFnName: string | null,
        writer: WritableStreamDefaultWriter<string>,
        currentUser: IUser
    ): Promise<void> {
        const turnTag = `[processTurn iter ${iter} v0.7.1]`; // Versão atualizada
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
            logger.debug(`${turnTag} Chamando OpenAI API (Modelo: ${MODEL}, Histórico: ${currentMsgs.length} msgs).`); // Log do modelo
            completionStream = await openai.chat.completions.create(
                {
                    model: MODEL, // Usa a constante MODEL definida acima
                    temperature: TEMP,
                    max_tokens: TOKENS,
                    stream: true,
                    messages: currentMsgs,
                    functions: [...functionSchemas],
                    function_call: 'auto',
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
        // (Restante da função processTurn continua igual à versão anterior)
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

                if (delta?.function_call) {
                    streamReceivedContent = true;
                    if (!pendingAssistantMsg) {
                        pendingAssistantMsg = { role: 'assistant', content: null, function_call: { name: '', arguments: '' } };
                    }
                    if (delta.function_call.name) functionCallName += delta.function_call.name;
                    if (delta.function_call.arguments) functionCallArgs += delta.function_call.arguments;
                    continue;
                }

                if (delta?.content) {
                    streamReceivedContent = true;
                    if (!pendingAssistantMsg) {
                        pendingAssistantMsg = { role: 'assistant', content: '' };
                    }
                    pendingAssistantMsg.content = (pendingAssistantMsg.content ?? '') + delta.content;
                    try {
                        await writer.write(delta.content);
                    } catch (writeError) {
                        logger.error(`${turnTag} Erro ao escrever no writer (stream pode ter sido fechado/abortado):`, writeError);
                        throw writeError;
                    }
                }

                if (choice.finish_reason) {
                    lastFinishReason = choice.finish_reason;
                    logger.debug(`${turnTag} Recebido finish_reason: ${lastFinishReason}`);
                }

            }
            logger.debug(`${turnTag} Fim do consumo do stream da API. Último Finish Reason: ${lastFinishReason}`);

        } catch (streamError) {
            logger.error(`${turnTag} Erro durante o consumo do stream:`, streamError);
            throw streamError;
        }

        if (!streamReceivedContent && lastFinishReason !== 'stop' && lastFinishReason !== 'length' && lastFinishReason !== 'function_call') {
             logger.error(`${turnTag} Stream finalizado sem conteúdo útil e com finish_reason inesperado: ${lastFinishReason}`);
             throw new Error('API da OpenAI não retornou conteúdo ou chamada de função válida.');
        }
        if (pendingAssistantMsg && !pendingAssistantMsg.content && !functionCallName) {
             logger.warn(`${turnTag} Mensagem do assistente finalizada sem conteúdo textual ou function call. Finish Reason: ${lastFinishReason}`);
             if (!pendingAssistantMsg.content) pendingAssistantMsg.content = null;
        }

        if (pendingAssistantMsg) {
            if (functionCallName || functionCallArgs) {
                pendingAssistantMsg.function_call = { name: functionCallName, arguments: functionCallArgs };
                pendingAssistantMsg.content = null;
            }
            currentMsgs.push(pendingAssistantMsg as ChatCompletionAssistantMessageParam);
        } else if (lastFinishReason === 'stop' || lastFinishReason === 'length') {
             logger.warn(`${turnTag} Stream finalizado com ${lastFinishReason} mas sem nenhum delta de assistente recebido. Adicionando msg vazia.`);
             currentMsgs.push({ role: 'assistant', content: '' });
        } else {
             logger.error(`${turnTag} Estado inesperado no final do processamento do stream. Finish Reason: ${lastFinishReason}`);
        }


        if (pendingAssistantMsg?.function_call) {
            const { name, arguments: rawArgs } = pendingAssistantMsg.function_call;
            logger.info(`${turnTag} API solicitou Function Call: ${name}. Args: ${rawArgs.slice(0, 100)}...`);

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
                        args = JSON.parse(rawArgs || '{}');
                    } catch (parseError) {
                         logger.error(`${turnTag} Erro ao parsear argumentos JSON para a função "${name}": ${rawArgs}`, parseError);
                         throw new Error(`Argumentos inválidos para a função ${name}.`);
                    }
                    functionResult = await executor(args, currentUser);
                    logger.debug(`${turnTag} Função "${name}" executada com sucesso.`);
                } catch (execError: any) {
                    logger.error(`${turnTag} Erro ao executar a função "${name}":`, execError);
                    functionResult = { error: `Erro ao executar a função ${name}: ${execError.message || String(execError)}` };
                }
            }

            currentMsgs.push({
                role: 'function',
                name: name,
                content: JSON.stringify(functionResult),
            });

            logger.debug(`${turnTag} Histórico antes da recursão (iter ${iter + 1}, ${currentMsgs.length} msgs).`);
            await processTurn(currentMsgs, iter + 1, name, writer, currentUser);
            return;
        }

        logger.debug(`${turnTag} Turno concluído sem chamada de função.`);
    } // Fim da função processTurn
}

