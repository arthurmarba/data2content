/**
 * @fileoverview Orquestrador de chamadas à API OpenAI com Function Calling e Streaming.
 * Otimizado para buscar dados sob demanda via funções.
 * @version 0.8.2 (Retorna Promise para histórico final + Zod validation)
 */

import OpenAI from 'openai';
import type {
    ChatCompletionMessageParam,
    ChatCompletionChunk,
    ChatCompletionAssistantMessageParam,
} from 'openai/resources/chat/completions';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { functionSchemas, functionExecutors } from './aiFunctions';
import { getSystemPrompt } from '@/app/lib/promptSystemFC';
import { IUser } from '@/app/models/User';
import * as stateService from '@/app/lib/stateService'; // Usado apenas para o tipo DialogueState na interface
import { functionValidators } from './aiFunctionSchemas.zod'; // Import mapa de validadores Zod

// Configuração do cliente OpenAI e constantes
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const TEMP = Number(process.env.OPENAI_TEMP) || 0.7;
const TOKENS = Number(process.env.OPENAI_MAXTOK) || 900;
const MAX_ITERS = 6;
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 45_000;

/**
 * @interface EnrichedContext (Simplificada)
 */
interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.DialogueState; // Mantido caso seja usado no futuro
}

/**
 * Retorno de askLLMWithEnrichedContext.
 * Inclui o stream da resposta e uma Promise que resolve com o histórico final.
 */
interface AskLLMResult {
    stream: ReadableStream<string>;
    historyPromise: Promise<ChatCompletionMessageParam[]>; // <<< Promise para o histórico final
}

/**
 * Envia uma mensagem ao LLM com Function Calling em modo streaming.
 * Retorna o stream da resposta imediatamente e uma Promise para o histórico final.
 */
export async function askLLMWithEnrichedContext(
    enrichedContext: EnrichedContext,
    incomingText: string
): Promise<AskLLMResult> { // <<< TIPO DE RETORNO ATUALIZADO
    const fnTag = '[askLLMWithEnrichedContext v0.8.2]'; // Versão atualizada
    const { user, historyMessages } = enrichedContext;
    logger.info(`${fnTag} Iniciando para usuário ${user._id}. Texto: "${incomingText.slice(0, 50)}..." Usando modelo: ${MODEL}`);

    // Monta o Histórico Inicial
    const initialMsgs: ChatCompletionMessageParam[] = [
        { role: 'system', content: getSystemPrompt(user.name || 'usuário') },
        ...historyMessages,
        { role: 'user', content: incomingText }
    ];
    logger.debug(`${fnTag} Histórico inicial montado com ${initialMsgs.length} mensagens.`);

    // Cria o Stream para a resposta de texto
    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();

    // --- Cria a Promise para o Histórico Final ---
    let resolveHistoryPromise: (history: ChatCompletionMessageParam[]) => void;
    let rejectHistoryPromise: (reason?: any) => void;
    const historyPromise = new Promise<ChatCompletionMessageParam[]>((resolve, reject) => {
        resolveHistoryPromise = resolve;
        rejectHistoryPromise = reject;
    });
    // --------------------------------------------

    // --- Inicia o Processamento da Conversa em Background ---
    // A função processTurn agora receberá um histórico inicial mais leve
    // Usamos .then() e .catch() na Promise retornada por processTurn para
    // resolver ou rejeitar nossa historyPromise.
    processTurn(initialMsgs, 0, null, writer, user)
        .then((finalHistory) => {
            // Sucesso: processTurn retornou o histórico final
            logger.debug(`${fnTag} processTurn concluído com sucesso. Fechando writer.`);
            writer.close();
            resolveHistoryPromise(finalHistory); // <<< Resolve a Promise com o histórico final
        })
        .catch(async (error) => {
            // Erro: processTurn falhou
            logger.error(`${fnTag} Erro durante processTurn:`, error);
            rejectHistoryPromise(error); // <<< Rejeita a Promise com o erro
            try {
                if (!writer.closed) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    await writer.write(`\n\n⚠️ Desculpe, ocorreu um erro interno ao processar sua solicitação: ${errorMessage}`);
                    logger.debug(`${fnTag} Abortando writer após erro.`);
                    await writer.abort(error);
                }
            } catch (abortError) {
                logger.error(`${fnTag} Erro ao escrever erro/abortar writer:`, abortError);
            }
        });

    // Retorna o stream e a promise do histórico imediatamente
    logger.debug(`${fnTag} Retornando stream e historyPromise imediatamente.`);
    return { stream: readable, historyPromise }; // <<< RETORNO ATUALIZADO

    // ============================================================
    // Função Interna Recursiva para Processar Turnos da Conversa
    // (Lógica interna mantida, incluindo validação Zod)
    // ============================================================
    async function processTurn(
        currentMsgs: ChatCompletionMessageParam[],
        iter: number,
        lastFnName: string | null,
        writer: WritableStreamDefaultWriter<string>,
        currentUser: IUser
    ): Promise<ChatCompletionMessageParam[]> { // Retorna o histórico final
        const turnTag = `[processTurn iter ${iter} v0.8.1]`; // Mantém versão Zod
        logger.debug(`${turnTag} Iniciando.`);

        if (iter >= MAX_ITERS) { /* ... (limite de iteração mantido) ... */ throw new Error(`Function-call loop excedeu MAX_ITERS (${MAX_ITERS})`); }

        const aborter = new AbortController();
        const timeout = setTimeout(() => { aborter.abort(); logger.warn(`${turnTag} Timeout API OpenAI atingido.`); }, OPENAI_TIMEOUT_MS);

        let completionStream: AsyncIterable<ChatCompletionChunk>;
        try {
            logger.debug(`${turnTag} Chamando OpenAI API (Modelo: ${MODEL}, Histórico: ${currentMsgs.length} msgs).`);
            completionStream = await openai.chat.completions.create(
                {
                    model: MODEL, temperature: TEMP, max_tokens: TOKENS, stream: true,
                    messages: currentMsgs, functions: [...functionSchemas], function_call: 'auto',
                },
                { signal: aborter.signal }
            );
        } catch (error: any) { /* ... (tratamento erro API mantido) ... */ clearTimeout(timeout); throw new Error(`Falha API OpenAI: ${error.name === 'AbortError' ? 'Timeout' : error.message}`); }
        finally { clearTimeout(timeout); }

        // Processamento do Stream
        let pendingAssistantMsg: ChatCompletionAssistantMessageParam | null = null;
        let functionCallName = '';
        let functionCallArgs = '';
        let streamReceivedContent = false;
        let lastFinishReason: ChatCompletionChunk.Choice['finish_reason'] | null | undefined = null;

        try {
            // ... (lógica de consumo do stream mantida exatamente como na versão Zod) ...
            logger.debug(`${turnTag} Iniciando consumo do stream da API...`);
            for await (const chunk of completionStream) {
                const choice = chunk.choices?.[0];
                if (!choice) continue;
                const delta = choice.delta;

                if (delta?.function_call) {
                    streamReceivedContent = true;
                    if (!pendingAssistantMsg) { pendingAssistantMsg = { role: 'assistant', content: null, function_call: { name: '', arguments: '' } }; }
                    if (delta.function_call.name) functionCallName += delta.function_call.name;
                    if (delta.function_call.arguments) functionCallArgs += delta.function_call.arguments;
                    continue;
                }

                if (delta?.content) {
                    streamReceivedContent = true;
                    if (!pendingAssistantMsg) { pendingAssistantMsg = { role: 'assistant', content: '' }; }
                    pendingAssistantMsg.content = (pendingAssistantMsg.content ?? '') + delta.content;
                    try { await writer.write(delta.content); }
                    catch (writeError) { logger.error(`${turnTag} Erro ao escrever no writer:`, writeError); throw writeError; }
                }

                if (choice.finish_reason) { lastFinishReason = choice.finish_reason; logger.debug(`${turnTag} Recebido finish_reason: ${lastFinishReason}`); }
            }
            logger.debug(`${turnTag} Fim do consumo do stream da API. Último Finish Reason: ${lastFinishReason}`);
        } catch (streamError) { logger.error(`${turnTag} Erro durante o consumo do stream:`, streamError); throw streamError; }


        // Pós-processamento do Stream
        if (!streamReceivedContent && lastFinishReason !== 'stop' && lastFinishReason !== 'length' && lastFinishReason !== 'function_call') {
             logger.error(`${turnTag} Stream finalizado sem conteúdo útil e com finish_reason inesperado: ${lastFinishReason}`);
             throw new Error('API da OpenAI não retornou conteúdo ou chamada de função válida.');
        }
        if (pendingAssistantMsg) {
            if (functionCallName || functionCallArgs) {
                pendingAssistantMsg.function_call = { name: functionCallName, arguments: functionCallArgs };
                pendingAssistantMsg.content = null;
            } else if (pendingAssistantMsg.content === '') {
                 logger.warn(`${turnTag} Mensagem assistente finalizada sem conteúdo/function call. Finish Reason: ${lastFinishReason}. Content=null.`);
                 pendingAssistantMsg.content = null;
            }
            currentMsgs.push(pendingAssistantMsg as ChatCompletionAssistantMessageParam);
        } else if (lastFinishReason === 'stop' || lastFinishReason === 'length') {
             logger.warn(`${turnTag} Stream finalizado (${lastFinishReason}) mas sem delta de assistente. Adicionando msg vazia.`);
             currentMsgs.push({ role: 'assistant', content: '' });
        } else if (!functionCallName && lastFinishReason !== 'function_call') {
             logger.error(`${turnTag} Estado inesperado no final do processamento do stream. Finish Reason: ${lastFinishReason}`);
        }

        // Tratamento da Chamada de Função (com Zod - mantido como na versão anterior)
        if (pendingAssistantMsg?.function_call) {
            const { name, arguments: rawArgs } = pendingAssistantMsg.function_call;
            logger.info(`${turnTag} API solicitou Function Call: ${name}. Args RAW: ${rawArgs.slice(0, 100)}...`);

            if (name === lastFnName) { /* ... (loop prevention) ... */ throw new Error(`Loop detectado: ${name}`);}

            let functionResult: unknown;
            const executor = functionExecutors[name as keyof typeof functionExecutors];
            const validator = functionValidators[name];

            if (!executor) {
                functionResult = { error: `Função "${name}" desconhecida.` };
                logger.error(`${turnTag} Executor não encontrado para "${name}".`);
            } else if (!validator) {
                 functionResult = { error: `Configuração interna inválida: Validador não encontrado para a função ${name}.` };
                 logger.error(`${turnTag} Validador Zod não encontrado para "${name}".`);
            } else {
                let validatedArgs: any;
                try {
                    const parsedJson = JSON.parse(rawArgs || '{}');
                    logger.debug(`${turnTag} Validando args para "${name}" com Zod...`);
                    const validationResult = validator.safeParse(parsedJson);

                    if (validationResult.success) {
                        validatedArgs = validationResult.data;
                        logger.info(`${turnTag} Args para "${name}" validados com SUCESSO:`, validatedArgs);
                        try {
                            logger.debug(`${turnTag} Executando executor para "${name}"...`);
                            functionResult = await executor(validatedArgs, currentUser);
                            logger.info(`${turnTag} Função "${name}" executada com sucesso.`);
                        } catch (execError: any) {
                            logger.error(`${turnTag} Erro ao executar a função "${name}":`, execError);
                            functionResult = { error: `Erro interno ao executar a função ${name}: ${execError.message || String(execError)}` };
                        }
                    } else {
                        logger.warn(`${turnTag} Erro de validação Zod para args da função "${name}":`, validationResult.error.errors);
                        const errorMessages = validationResult.error.errors.map(e => `${e.path.join('.') || 'argumento'}: ${e.message}`).join('; ');
                        functionResult = { error: `Argumentos inválidos para a função ${name}. Detalhes: ${errorMessages}` };
                    }
                } catch (parseError) {
                     logger.error(`${turnTag} Erro JSON.parse dos args para "${name}": ${rawArgs}`, parseError);
                     functionResult = { error: `Argumentos inválidos para ${name}. Esperava formato JSON.` };
                }
            }

            currentMsgs.push({ role: 'function', name: name, content: JSON.stringify(functionResult) });

            logger.debug(`${turnTag} Histórico antes da recursão (iter ${iter + 1}, ${currentMsgs.length} msgs).`);
            // Chama recursivamente E retorna a Promise resultante
            return processTurn(currentMsgs, iter + 1, name, writer, currentUser);
        }

        // Fim sem chamada de função
        logger.debug(`${turnTag} Turno concluído sem chamada de função.`);
        return currentMsgs; // Retorna o histórico final acumulado
    } // Fim da função processTurn
}