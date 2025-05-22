/**
 * @fileoverview Orquestrador de chamadas à API OpenAI com Function Calling e Streaming.
 * Otimizado para buscar dados sob demanda via funções e modular comportamento por intenção.
 * ATUALIZADO: Adicionada função getQuickAcknowledgementLLMResponse para gerar respostas curtas e rápidas (quebra-gelo).
 * @version 0.9.6 (Refina detecção de loop para permitir uma nova tentativa da mesma função após erro de validação)
 */

import OpenAI from 'openai';
import type {
    ChatCompletionMessageParam,
    ChatCompletionChunk,
    ChatCompletionAssistantMessageParam,
    ChatCompletionFunctionCallOption
} from 'openai/resources/chat/completions';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { functionSchemas, functionExecutors } from './aiFunctions';
import { getSystemPrompt } from '@/app/lib/promptSystemFC'; 
import { IUser } from '@/app/models/User';
import * as stateService from '@/app/lib/stateService';
import { functionValidators } from './aiFunctionSchemas.zod'; // Deve ser v1.3.2 com correções para findPostsByCriteria
import { DeterminedIntent } from './intentService';


// Configuração do cliente OpenAI e constantes
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'; 
const QUICK_ACK_MODEL = process.env.OPENAI_QUICK_ACK_MODEL || 'gpt-3.5-turbo'; 
const TEMP = Number(process.env.OPENAI_TEMP) || 0.7;
const QUICK_ACK_TEMP = Number(process.env.OPENAI_QUICK_ACK_TEMP) || 0.8; 
const TOKENS = Number(process.env.OPENAI_MAXTOK) || 900;
const QUICK_ACK_MAX_TOKENS = Number(process.env.OPENAI_QUICK_ACK_MAX_TOKENS) || 70; 
const MAX_ITERS = 6; // Máximo de iterações de chamada de função
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS) || 45_000;
const QUICK_ACK_TIMEOUT_MS = Number(process.env.OPENAI_QUICK_ACK_TIMEOUT_MS) || 10_000; 

/**
 * @interface EnrichedContext
 */
interface EnrichedContext {
    user: IUser;
    historyMessages: ChatCompletionMessageParam[];
    dialogueState?: stateService.IDialogueState;
    userName: string; 
}

/**
 * Retorno de askLLMWithEnrichedContext.
 */
interface AskLLMResult {
    stream: ReadableStream<string>;
    historyPromise: Promise<ChatCompletionMessageParam[]>;
}


/**
 * Gera uma resposta curta e rápida para reconhecimento inicial (quebra-gelo).
 */
export async function getQuickAcknowledgementLLMResponse(
    systemPrompt: string,
    userQuery: string,
    userNameForLog: string = "usuário" 
): Promise<string | null> {
    const fnTag = '[getQuickAcknowledgementLLMResponse v0.9.6]'; 
    logger.info(`${fnTag} Iniciando para ${userNameForLog}. Query: "${userQuery.slice(0, 50)}..." Usando modelo: ${QUICK_ACK_MODEL}`);

    const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery }
    ];

    const aborter = new AbortController();
    const timeout = setTimeout(() => { aborter.abort(); logger.warn(`${fnTag} Timeout API OpenAI atingido.`); }, QUICK_ACK_TIMEOUT_MS);

    try {
        const completion = await openai.chat.completions.create(
            {
                model: QUICK_ACK_MODEL,
                messages: messages,
                temperature: QUICK_ACK_TEMP,
                max_tokens: QUICK_ACK_MAX_TOKENS,
                stream: false, 
            },
            { signal: aborter.signal }
        );
        clearTimeout(timeout);

        const responseText = completion.choices[0]?.message?.content;
        if (responseText && responseText.trim() !== "") {
            logger.info(`${fnTag} Resposta de quebra-gelo gerada: "${responseText.slice(0, 70)}..."`);
            return responseText.trim();
        } else {
            logger.warn(`${fnTag} API da OpenAI retornou resposta vazia ou nula para o quebra-gelo.`);
            return null;
        }
    } catch (error: any) {
        clearTimeout(timeout);
        logger.error(`${fnTag} Falha na chamada à API OpenAI para quebra-gelo: ${error.name === 'AbortError' ? 'Timeout' : error.message}`);
        return null;
    }
}


/**
 * Envia uma mensagem ao LLM com Function Calling em modo streaming para a resposta principal.
 */
export async function askLLMWithEnrichedContext(
    enrichedContext: EnrichedContext,
    incomingText: string,
    intent: DeterminedIntent
): Promise<AskLLMResult> {
    const fnTag = '[askLLMWithEnrichedContext v0.9.6]'; 
    const { user, historyMessages, userName } = enrichedContext;
    logger.info(`${fnTag} Iniciando para usuário ${user._id} (Nome para prompt: ${userName}). Intenção: ${intent}. Texto: "${incomingText.slice(0, 50)}..." Usando modelo: ${MODEL}`);

    const initialMsgs: ChatCompletionMessageParam[] = [
        { role: 'system', content: getSystemPrompt(userName || user.name || 'usuário') },
        ...historyMessages,
        { role: 'user', content: incomingText }
    ];
    logger.debug(`${fnTag} Histórico inicial montado com ${initialMsgs.length} mensagens.`);

    const { readable, writable } = new TransformStream<string, string>();
    const writer = writable.getWriter();

    let resolveHistoryPromise: (history: ChatCompletionMessageParam[]) => void;
    let rejectHistoryPromise: (reason?: any) => void;
    const historyPromise = new Promise<ChatCompletionMessageParam[]>((resolve, reject) => {
        resolveHistoryPromise = resolve;
        rejectHistoryPromise = reject;
    });

    processTurn(initialMsgs, 0, null, writer, user, intent)
        .then((finalHistory) => {
            logger.debug(`${fnTag} processTurn concluído com sucesso. Fechando writer.`);
            writer.close(); 
            resolveHistoryPromise(finalHistory);
        })
        .catch(async (error) => {
            logger.error(`${fnTag} Erro durante processTurn:`, error);
            rejectHistoryPromise(error); 
            try {
                if (!writer.closed) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    if (!errorMessage.includes("Writer is closed") && !errorMessage.includes("WritableStreamDefaultWriter.close")) {
                        await writer.write(`\n\n⚠️ Desculpe, ocorreu um erro interno ao processar sua solicitação.`);
                        logger.info(`${fnTag} Mensagem de erro genérica escrita no stream.`);
                    }
                    logger.debug(`${fnTag} Abortando writer após erro em processTurn.`);
                    await writer.abort(error);
                }
            } catch (abortError) {
                logger.error(`${fnTag} Erro ao escrever erro/abortar writer:`, abortError);
            }
        });

    logger.debug(`${fnTag} Retornando stream e historyPromise imediatamente.`);
    return { stream: readable, historyPromise };

    // ============================================================
    // Função Interna Recursiva para Processar Turnos da Conversa
    // ============================================================
    async function processTurn(
        currentMsgs: ChatCompletionMessageParam[],
        iter: number,
        lastFnName: string | null,
        writer: WritableStreamDefaultWriter<string>,
        currentUser: IUser, 
        currentIntent: DeterminedIntent
    ): Promise<ChatCompletionMessageParam[]> {
        const turnTag = `[processTurn iter ${iter} v0.9.6]`; 
        logger.debug(`${turnTag} Iniciando. Intenção atual do turno: ${currentIntent}`);

        if (iter >= MAX_ITERS) { 
            logger.warn(`${turnTag} Function-call loop excedeu MAX_ITERS (${MAX_ITERS}).`);
            const maxIterMessage = `Desculpe, parece que estou tendo dificuldades em processar sua solicitação após várias tentativas. Poderia tentar de outra forma?`;
            currentMsgs.push({role: 'assistant', content: maxIterMessage});
            try { await writer.write(maxIterMessage); }
            catch(e) { logger.error(`${turnTag} Erro ao escrever msg de MAX_ITERS:`, e); }
            return currentMsgs; 
        }

        const aborter = new AbortController();
        const timeout = setTimeout(() => { aborter.abort(); logger.warn(`${turnTag} Timeout API OpenAI atingido.`); }, OPENAI_TIMEOUT_MS);

        let functionsForAPI: OpenAI.Chat.Completions.ChatCompletionCreateParams.Function[] | undefined = undefined;
        let functionCallSetting: 'none' | 'auto' | ChatCompletionFunctionCallOption | undefined = undefined;

        const isLightweightIntent = currentIntent === 'social_query' || currentIntent === 'meta_query_personal' || currentIntent === 'generate_proactive_alert';

        if (isLightweightIntent) {
            logger.info(`${turnTag} Intenção '${currentIntent}' é leve. Desabilitando function calling explícito para esta chamada.`);
            functionsForAPI = undefined;
            functionCallSetting = 'none';
        } else {
            logger.info(`${turnTag} Intenção '${currentIntent}' permite function calling. Habilitando funções padrão.`);
            functionsForAPI = [...functionSchemas];
            functionCallSetting = 'auto';
        }

        let completionStream: AsyncIterable<ChatCompletionChunk>;
        try {
            logger.debug(`${turnTag} Chamando OpenAI API (Modelo: ${MODEL}, Histórico: ${currentMsgs.length} msgs). Function calling: ${functionCallSetting}`);
            completionStream = await openai.chat.completions.create(
                {
                    model: MODEL, temperature: TEMP, max_tokens: TOKENS, stream: true,
                    messages: currentMsgs,
                    functions: functionsForAPI,
                    function_call: functionCallSetting,
                },
                { signal: aborter.signal }
            );
        } catch (error: any) { 
            clearTimeout(timeout); 
            logger.error(`${turnTag} Falha na chamada à API OpenAI: ${error.name === 'AbortError' ? 'Timeout' : error.message}`);
            const apiCallFailMessage = "Desculpe, não consegui conectar com o serviço de IA no momento. Tente mais tarde.";
            currentMsgs.push({role: 'assistant', content: apiCallFailMessage});
            try { await writer.write(apiCallFailMessage); }
            catch(e) { logger.error(`${turnTag} Erro ao escrever msg de falha da API:`, e); }
            return currentMsgs;
        }
        
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
        } catch (streamError) { 
            logger.error(`${turnTag} Erro durante o consumo do stream:`, streamError); 
            const streamErrMessage = "Desculpe, houve um problema ao receber a resposta da IA. Tente novamente.";
            if (pendingAssistantMsg && typeof pendingAssistantMsg.content === 'string') {
                pendingAssistantMsg.content += `\n${streamErrMessage}`;
            } else {
                pendingAssistantMsg = {role: 'assistant', content: streamErrMessage};
            }
            currentMsgs.push(pendingAssistantMsg);
            try { await writer.write(`\n${streamErrMessage}`); }
            catch(e) { logger.error(`${turnTag} Erro ao escrever msg de erro de stream:`, e); }
            return currentMsgs;
        } finally {
            clearTimeout(timeout); 
        }

        if (!streamReceivedContent && lastFinishReason !== 'stop' && lastFinishReason !== 'length' && lastFinishReason !== 'function_call') {
             logger.error(`${turnTag} Stream finalizado sem conteúdo útil e com finish_reason inesperado: ${lastFinishReason}`);
             const noContentMessage = "A IA não forneceu uma resposta utilizável desta vez. Poderia tentar novamente?";
             currentMsgs.push({role: 'assistant', content: noContentMessage});
             try { await writer.write(noContentMessage); }
             catch(e) { logger.error(`${turnTag} Erro ao escrever msg de 'sem conteúdo útil':`, e); }
             return currentMsgs;
        }
        if (pendingAssistantMsg) {
            if (functionCallName || functionCallArgs) {
                if (isLightweightIntent) {
                    logger.warn(`${turnTag} IA tentou function call (${functionCallName}) para intent leve ('${currentIntent}'), apesar de function_call='none'. Isso não deveria acontecer. Ignorando a chamada de função.`);
                    if (pendingAssistantMsg.content === null || pendingAssistantMsg.content === '') {
                        pendingAssistantMsg.content = "Entendido."; 
                        try { await writer.write(pendingAssistantMsg.content); } catch(e) { /* ignore */ }
                    }
                } else {
                    pendingAssistantMsg.function_call = { name: functionCallName, arguments: functionCallArgs };
                    pendingAssistantMsg.content = null; 
                }
            } else if (pendingAssistantMsg.content === null || pendingAssistantMsg.content === '') {
                 if(lastFinishReason !== 'stop' && lastFinishReason !== 'length') {
                    logger.warn(`${turnTag} Mensagem assistente finalizada sem conteúdo/function call. Finish Reason: ${lastFinishReason}. Content será null/vazio.`);
                 }
            }
            currentMsgs.push(pendingAssistantMsg as ChatCompletionAssistantMessageParam);
        } else if (lastFinishReason === 'stop' || lastFinishReason === 'length') {
             logger.warn(`${turnTag} Stream finalizado (${lastFinishReason}) mas sem delta de assistente. Adicionando msg de assistente vazia de fallback.`);
             currentMsgs.push({ role: 'assistant', content: '' }); 
        } else if (!functionCallName && lastFinishReason !== 'function_call') {
             logger.error(`${turnTag} Estado inesperado no final do processamento do stream. Finish Reason: ${lastFinishReason}, sem function call name.`);
        }

        if (pendingAssistantMsg?.function_call && !isLightweightIntent) {
            const { name, arguments: rawArgs } = pendingAssistantMsg.function_call;
            logger.info(`${turnTag} API solicitou Function Call: ${name}. Args RAW: ${rawArgs.slice(0, 100)}...`);

            // ATUALIZADO: Detecção de Loop - permite uma nova tentativa (iter === 1) antes de intervir.
            if (name === lastFnName && iter > 1) { // Só considera loop se for a mesma função E iter > 1
                logger.warn(`${turnTag} Loop de função (após uma tentativa de correção) detectado e prevenido: ${name} chamada novamente.`);
                const loopErrorMessage = `Ainda estou tendo dificuldades com a função '${name}' após tentar corrigi-la. Poderia reformular sua solicitação ou focar em outro aspecto?`;
                currentMsgs.push({ role: 'assistant', content: loopErrorMessage });
                try { 
                    const lastMessageInHistory = currentMsgs[currentMsgs.length-2]; 
                    if(!(lastMessageInHistory?.role === 'assistant' && lastMessageInHistory.content)){
                         await writer.write(loopErrorMessage);
                    }
                }
                catch (writeError) { logger.error(`${turnTag} Erro ao escrever mensagem de loop detectado no writer:`, writeError); }
                return currentMsgs; 
            }

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
                        logger.info(`${turnTag} Args para "${name}" validados com SUCESSO.`);
                        try {
                            logger.debug(`${turnTag} Executando executor para "${name}"...`);
                            functionResult = await executor(validatedArgs, currentUser);
                            logger.info(`${turnTag} Função "${name}" executada com sucesso.`);
                        } catch (execError: any) {
                            logger.error(`${turnTag} Erro ao executar a função "${name}":`, execError);
                            functionResult = { error: `Erro interno ao executar a função ${name}: ${execError.message || String(execError)}` };
                        }
                    } else {
                        logger.warn(`${turnTag} Erro de validação Zod para args da função "${name}":`, validationResult.error.format()); 
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
            // Passa o nome da função atual como lastFnName para a próxima iteração
            return processTurn(currentMsgs, iter + 1, name, writer, currentUser, currentIntent); 
        } else if (pendingAssistantMsg?.function_call && isLightweightIntent) {
            logger.warn(`${turnTag} Function call recebida para intent leve '${currentIntent}', mas foi ignorada pois function calling deveria estar desabilitado. FC: ${pendingAssistantMsg.function_call.name}`);
        }

        logger.debug(`${turnTag} Turno concluído sem chamada de função processada (ou para intent leve).`);
        return currentMsgs;
    } // Fim da função processTurn
}
