/**
 * @fileoverview Orquestrador de chamadas à API OpenAI com Function Calling e Streaming.
 * Versão otimizada para receber contexto enriquecido (incluindo relatório de métricas).
 * @version 0.7.0-Optimized
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
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'; // Modelo default
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
    const fnTag = '[askLLMWithEnrichedContext v0.7.0]';
    const { user, historyMessages, dialogueState, latestReport } = enrichedContext;
    logger.info(`${fnTag} Iniciando para usuário ${user._id}. Texto: "${incomingText.slice(0, 50)}..."`);

    // --- Monta o Histórico Inicial para o LLM ---
    const initialMsgs: ChatCompletionMessageParam[] = [];

    // 1. Adiciona o prompt do sistema base
    initialMsgs.push({ role: 'system', content: getSystemPrompt(user.name || 'usuário') });

    // 2. *** NOVO: Adiciona os dados do relatório como mensagem de sistema ***
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
        // Opcional: Adicionar mensagem informando ausência de dados?
        // initialMsgs.push({ role: 'system', content: "[AVISO: Não há dados de relatório agregado recente disponíveis para este usuário.]" });
    }

    // 3. Adiciona o histórico da conversa anterior
    initialMsgs.push(...historyMessages);

    // 4. Adiciona a mensagem atual do usuário
    initialMsgs.push({ role: 'user', content: incomingText });

    logger.debug(`${fnTag} Histórico inicial montado com ${initialMsgs.length} mensagens.`);

    // --- Cria o Stream de Resposta ---
    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();

    // --- Inicia o Processamento da Conversa em Background ---
    // A função processTurn agora recebe o histórico inicial completo
    const processingPromise = processTurn(initialMsgs, 0, null, writer, user) // Passa o 'user' para execução de funções
        .then(() => {
            logger.debug(`${fnTag} processTurn concluído com sucesso. Fechando writer.`);
            return writer.close(); // Fecha o stream quando o processamento termina
        })
        .catch(async (error) => {
            logger.error(`${fnTag} Erro durante processTurn:`, error);
            try {
                // Tenta abortar o stream em caso de erro
                if (!writer.closed) {
                    logger.debug(`${fnTag} Abortando writer devido a erro.`);
                    await writer.abort(error);
                }
            } catch (abortError) {
                logger.error(`${fnTag} Erro ao abortar writer:`, abortError);
            }
        });

    // Retorna o stream imediatamente para o consultantService começar a ler
    // O histórico retornado é o 'initialMsgs', que será atualizado dentro de processTurn
    logger.debug(`${fnTag} Retornando stream imediatamente e histórico inicial.`);
    return { stream: readable, history: initialMsgs };

    // ============================================================
    // Função Interna Recursiva para Processar Turnos da Conversa
    // ============================================================
    async function processTurn(
        currentMsgs: ChatCompletionMessageParam[], // Recebe o histórico atual
        iter: number, // Contador de iteração (para evitar loops)
        lastFnName: string | null, // Nome da última função chamada (para detectar loops)
        writer: WritableStreamDefaultWriter<string>, // Writer do stream de resposta
        currentUser: IUser // Passa o usuário para executar funções no contexto correto
    ): Promise<void> {
        const turnTag = `[processTurn iter ${iter} v0.7.0]`;
        logger.debug(`${turnTag} Iniciando.`);

        // --- Verificação de Limite de Iterações ---
        if (iter >= MAX_ITERS) {
            logger.error(`${turnTag} Limite de iterações (${MAX_ITERS}) excedido.`);
            throw new Error(`Function-call loop excedeu MAX_ITERS (${MAX_ITERS})`);
        }

        // --- Configuração do Timeout e AbortController ---
        const aborter = new AbortController();
        const timeout = setTimeout(() => {
            logger.warn(`${turnTag} Timeout da API OpenAI (${OPENAI_TIMEOUT_MS}ms) atingido. Abortando chamada.`);
            aborter.abort();
        }, OPENAI_TIMEOUT_MS);

        // --- Chamada à API OpenAI ---
        let completionStream: AsyncIterable<ChatCompletionChunk>;
        try {
            logger.debug(`${turnTag} Chamando OpenAI API (Histórico: ${currentMsgs.length} msgs).`);
            completionStream = await openai.chat.completions.create(
                {
                    model: MODEL,
                    temperature: TEMP,
                    max_tokens: TOKENS,
                    stream: true,
                    messages: currentMsgs, // Usa o histórico atualizado
                    functions: [...functionSchemas], // Funções disponíveis
                    function_call: 'auto', // Deixa o modelo decidir se chama função
                },
                { signal: aborter.signal } // Permite abortar a chamada
            );
        } catch (error: any) {
            logger.error(`${turnTag} Erro na chamada OpenAI API:`, error);
            clearTimeout(timeout); // Limpa o timeout se a chamada falhar
            // Melhora a mensagem de erro
            const errorMessage = error.name === 'AbortError' ? 'Timeout da API atingido' : (error.message || String(error));
            throw new Error(`Falha na comunicação com a API OpenAI: ${errorMessage}`);
        } finally {
            // Garante que o timeout seja limpo após a chamada (sucesso ou erro)
            clearTimeout(timeout);
        }

        // --- Processamento do Stream da Resposta ---
        let pendingAssistantMsg: ChatCompletionAssistantMessageParam | null = null;
        let functionCallName = '';
        let functionCallArgs = '';
        let streamReceivedContent = false; // Flag para verificar se algo útil veio no stream
        let lastFinishReason: ChatCompletionChunk.Choice['finish_reason'] | null | undefined = null;

        try {
            logger.debug(`${turnTag} Iniciando consumo do stream da API...`);
            for await (const chunk of completionStream) {
                const choice = chunk.choices?.[0];
                if (!choice) continue; // Pula chunks sem choices
                const delta = choice.delta;

                // --- Lida com Chamada de Função ---
                if (delta?.function_call) {
                    streamReceivedContent = true; // Marca que recebemos algo útil
                    // Inicializa a mensagem do assistente se ainda não existir
                    if (!pendingAssistantMsg) {
                        pendingAssistantMsg = { role: 'assistant', content: null, function_call: { name: '', arguments: '' } };
                    }
                    // Acumula nome e argumentos da função
                    if (delta.function_call.name) functionCallName += delta.function_call.name;
                    if (delta.function_call.arguments) functionCallArgs += delta.function_call.arguments;
                    continue; // Próximo chunk
                }

                // --- Lida com Conteúdo de Texto ---
                if (delta?.content) {
                    streamReceivedContent = true; // Marca que recebemos algo útil
                    // Inicializa a mensagem do assistente se ainda não existir
                    if (!pendingAssistantMsg) {
                        pendingAssistantMsg = { role: 'assistant', content: '' };
                    }
                    // Acumula o conteúdo (garante que content não seja null)
                    pendingAssistantMsg.content = (pendingAssistantMsg.content ?? '') + delta.content;

                    // Escreve o delta de conteúdo no stream de resposta para o cliente
                    try {
                        await writer.write(delta.content);
                    } catch (writeError) {
                        logger.error(`${turnTag} Erro ao escrever no writer (stream pode ter sido fechado/abortado):`, writeError);
                        // Se não conseguir escrever, provavelmente o cliente desconectou ou houve erro.
                        // Propaga o erro para interromper o processamento.
                        throw writeError;
                    }
                }

                // Guarda o motivo de finalização (pode vir em um chunk separado)
                if (choice.finish_reason) {
                    lastFinishReason = choice.finish_reason;
                    logger.debug(`${turnTag} Recebido finish_reason: ${lastFinishReason}`);
                }

            } // Fim do loop for await
            logger.debug(`${turnTag} Fim do consumo do stream da API. Último Finish Reason: ${lastFinishReason}`);

        } catch (streamError) {
            logger.error(`${turnTag} Erro durante o consumo do stream:`, streamError);
            // Propaga o erro para o catch do processingPromise, que abortará o writer
            throw streamError;
        }

        // --- Validação Pós-Stream ---
        // Verifica se recebemos alguma informação útil (texto ou function call)
        if (!streamReceivedContent && lastFinishReason !== 'stop' && lastFinishReason !== 'length' && lastFinishReason !== 'function_call') {
             logger.error(`${turnTag} Stream finalizado sem conteúdo útil e com finish_reason inesperado: ${lastFinishReason}`);
             throw new Error('API da OpenAI não retornou conteúdo ou chamada de função válida.');
        }
        // Se a mensagem do assistente foi iniciada mas terminou sem conteúdo ou function call, loga aviso
        if (pendingAssistantMsg && !pendingAssistantMsg.content && !functionCallName) {
             logger.warn(`${turnTag} Mensagem do assistente finalizada sem conteúdo textual ou function call. Finish Reason: ${lastFinishReason}`);
             // Garante que existe uma mensagem de assistente (mesmo vazia) para adicionar ao histórico
             if (!pendingAssistantMsg.content) pendingAssistantMsg.content = null; // Ou string vazia? OpenAI espera null para fcall
        }


        // --- Monta a Mensagem Final do Assistente (se houver) ---
        if (pendingAssistantMsg) {
            // Se acumulamos nome/args de função, monta o objeto function_call
            if (functionCallName || functionCallArgs) {
                pendingAssistantMsg.function_call = { name: functionCallName, arguments: functionCallArgs };
                pendingAssistantMsg.content = null; // Content deve ser null se houver function_call
            }
            // Adiciona a mensagem completa do assistente ao histórico
            // (Faz cast seguro pois validamos os campos)
            currentMsgs.push(pendingAssistantMsg as ChatCompletionAssistantMessageParam);
        } else if (lastFinishReason === 'stop' || lastFinishReason === 'length') {
            // Caso raro: stream terminou sem delta, mas com finish_reason 'stop'/'length'.
            // Adiciona uma msg vazia para registrar o turno.
             logger.warn(`${turnTag} Stream finalizado com ${lastFinishReason} mas sem nenhum delta de assistente recebido. Adicionando msg vazia.`);
             currentMsgs.push({ role: 'assistant', content: '' });
        } else {
             logger.error(`${turnTag} Estado inesperado no final do processamento do stream. Finish Reason: ${lastFinishReason}`);
             // Considerar lançar erro se for crítico
        }


        // --- Executa Function Call (se houver) ---
        if (pendingAssistantMsg?.function_call) {
            const { name, arguments: rawArgs } = pendingAssistantMsg.function_call;
            logger.info(`${turnTag} API solicitou Function Call: ${name}. Args: ${rawArgs.slice(0, 100)}...`);

            // Detecção de Loop Simples
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
                    // Parseia os argumentos (com tratamento de erro)
                    let args = {};
                    try {
                        args = JSON.parse(rawArgs || '{}');
                    } catch (parseError) {
                         logger.error(`${turnTag} Erro ao parsear argumentos JSON para a função "${name}": ${rawArgs}`, parseError);
                         throw new Error(`Argumentos inválidos para a função ${name}.`);
                    }
                    // Executa a função passando o usuário atual
                    functionResult = await executor(args, currentUser);
                    logger.debug(`${turnTag} Função "${name}" executada com sucesso.`);
                } catch (execError: any) {
                    logger.error(`${turnTag} Erro ao executar a função "${name}":`, execError);
                    // Retorna uma mensagem de erro clara para o LLM
                    functionResult = { error: `Erro ao executar a função ${name}: ${execError.message || String(execError)}` };
                }
            }

            // Adiciona o resultado da função ao histórico
            currentMsgs.push({
                role: 'function',
                name: name,
                content: JSON.stringify(functionResult), // Envia o resultado como string JSON
            });

            // Chama processTurn recursivamente para o próximo passo
            logger.debug(`${turnTag} Histórico antes da recursão (iter ${iter + 1}, ${currentMsgs.length} msgs).`);
            await processTurn(currentMsgs, iter + 1, name, writer, currentUser);
            return; // Encerra esta chamada após iniciar a recursão
        }

        // --- Fim do Turno (sem function call) ---
        logger.debug(`${turnTag} Turno concluído sem chamada de função.`);
        // O histórico (currentMsgs) já foi atualizado com a resposta final do assistente.
        // O writer será fechado pelo .then() do processingPromise.
    } // Fim da função processTurn
}
