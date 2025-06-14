/**
 * @fileoverview Orquestrador de chamadas à API OpenAI com Function Calling e Streaming.
 * Otimizado para buscar dados sob demanda via funções e modular comportamento por intenção.
 * ATUALIZADO: v0.9.9 - Inclui currentAlertDetails no contexto para a LLM em alertas proativos.
 * ATUALIZADO: v0.9.8 - Omite 'functions' e 'function_call' para intents leves.
 * @version 0.9.9
 */

import OpenAI from 'openai';
import type {
    ChatCompletionMessageParam,
    ChatCompletionChunk,
    ChatCompletionAssistantMessageParam,
    ChatCompletionFunctionCallOption,
    ChatCompletionCreateParamsStreaming 
} from 'openai/resources/chat/completions';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { functionSchemas, functionExecutors } from './aiFunctions';
import { getSystemPrompt } from '@/app/lib/promptSystemFC';
import { IUser, AlertDetails } from '@/app/models/User'; // AlertDetails importado
import * as stateService from '@/app/lib/stateService';
import { functionValidators } from './aiFunctionSchemas.zod';
import { DeterminedIntent } from './intentService';
// Importando EnrichedAIContext do local correto
import { EnrichedAIContext } from '@/app/api/whatsapp/process-response/types';


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

// Removida a interface EnrichedContext local, usaremos EnrichedAIContext de types.ts

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
    const fnTag = '[getQuickAcknowledgementLLMResponse v0.9.7]'; // Mantendo versão se não houver mudança aqui
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
        logger.error(`${fnTag} Falha na chamada à API OpenAI para quebra-gelo. Error Name: ${error.name}, Message: ${error.message}. Full Error Object:`, error);
        return null;
    }
}


/**
 * Envia uma mensagem ao LLM com Function Calling em modo streaming para a resposta principal.
 * MODIFICADO: Agora espera EnrichedAIContext que pode conter currentAlertDetails.
 */
export async function askLLMWithEnrichedContext(
    enrichedContext: EnrichedAIContext, // Tipo atualizado para EnrichedAIContext
    incomingText: string,
    intent: DeterminedIntent
): Promise<AskLLMResult> {
    const fnTag = '[askLLMWithEnrichedContext v0.9.9]'; // Versão atualizada
    const { user, historyMessages, userName, dialogueState, currentAlertDetails } = enrichedContext; // currentAlertDetails agora disponível
    logger.info(`${fnTag} Iniciando para usuário ${user._id} (Nome para prompt: ${userName}). Intenção: ${intent}. Texto: "${incomingText.slice(0, 50)}..." Usando modelo: ${MODEL}`);

    // ----- INÍCIO DA MODIFICAÇÃO PARA INCLUIR DETALHES DO ALERTA -----
    let alertContextSystemMessage: ChatCompletionMessageParam | null = null;
    if (intent === 'generate_proactive_alert' && currentAlertDetails) {
        try {
            // Stringify os detalhes do alerta. O promptSystemFC.ts já instrui a IA
            // a procurar por platformPostId ou originalPlatformPostId nestes detalhes.
            const detailsString = JSON.stringify(currentAlertDetails);
            const messageContent = `Contexto adicional para o alerta do Radar Tuca que você vai apresentar ao usuário:\nDetalhes específicos do alerta (JSON): ${detailsString}\nLembre-se de usar 'platformPostId' ou 'originalPlatformPostId' destes detalhes para criar o link do Instagram, se disponível, conforme suas instruções gerais para alertas.`;
            alertContextSystemMessage = { role: 'system', content: messageContent };
            logger.info(`${fnTag} Adicionando contexto de detalhes do alerta para LLM. Tamanho dos detalhes: ${detailsString.length} chars.`);
        } catch (stringifyError) {
            logger.error(`${fnTag} Erro ao stringificar currentAlertDetails:`, stringifyError);
            // Não quebrar, apenas logar. O alerta prosseguirá sem os detalhes específicos no prompt.
        }
    }
    // ----- FIM DA MODIFICAÇÃO -----

    const initialMsgs: ChatCompletionMessageParam[] = [
        { role: 'system', content: getSystemPrompt(userName || user.name || 'usuário') },
        // Adiciona a mensagem de contexto do alerta, se existir
        ...(alertContextSystemMessage ? [alertContextSystemMessage] : []), 
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

    // Passando enrichedContext (que agora é EnrichedAIContext) para processTurn
    processTurn(initialMsgs, 0, null, writer, user, intent, enrichedContext) 
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
    // MODIFICADO: Adicionado enrichedContext como parâmetro para ter acesso a currentAlertDetails se necessário no futuro dentro de processTurn
    // ============================================================
    async function processTurn(
        currentMsgs: ChatCompletionMessageParam[],
        iter: number,
        lastFnName: string | null,
        writer: WritableStreamDefaultWriter<string>,
        currentUser: IUser,
        currentIntent: DeterminedIntent,
        currentEnrichedContext: EnrichedAIContext // Adicionado para acesso futuro se necessário
    ): Promise<ChatCompletionMessageParam[]> {
        const turnTag = `[processTurn iter ${iter} v0.9.9]`; // Versão atualizada
        // O currentEnrichedContext.currentAlertDetails já foi usado para construir initialMsgs
        // Não há necessidade de usá-lo diretamente aqui novamente, a menos que a lógica de FC precise dele.
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

        const requestPayload: ChatCompletionCreateParamsStreaming = {
            model: MODEL,
            temperature: TEMP,
            max_tokens: TOKENS,
            stream: true,
            messages: currentMsgs,
        };

        // A intenção 'generate_proactive_alert' é leve e não deve usar function calling.
        // O currentAlertDetails já foi injetado no prompt de sistema.
        const isLightweightIntent = currentIntent === 'social_query' || currentIntent === 'meta_query_personal' || currentIntent === 'generate_proactive_alert';

        if (isLightweightIntent) {
            logger.info(`${turnTag} Intenção '${currentIntent}' é leve. Function calling desabilitado.`);
        } else {
            logger.info(`${turnTag} Intenção '${currentIntent}' permite function calling. Habilitando funções padrão.`);
            requestPayload.functions = [...functionSchemas];
            requestPayload.function_call = 'auto';
        }

        let completionStream: AsyncIterable<ChatCompletionChunk>;
        try {
            logger.debug(`${turnTag} Chamando OpenAI API (Modelo: ${requestPayload.model}, Histórico: ${requestPayload.messages.length} msgs). Function calling: ${(requestPayload as any).function_call ?? 'omitido'}, Functions count: ${(requestPayload as any).functions?.length ?? 'omitido'}`);
            completionStream = await openai.chat.completions.create(
                requestPayload, 
                { signal: aborter.signal }
            );
        } catch (error: any) {
            clearTimeout(timeout);
            logger.error(`${turnTag} Falha na chamada à API OpenAI. Error Name: ${error.name}, Message: ${error.message}. Full Error Object:`, error);
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
        } catch (streamError: any) {
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
                    logger.warn(`${turnTag} IA tentou function call (${functionCallName}) para intent leve ('${currentIntent}'), mas os parâmetros de função não foram enviados. Ignorando a chamada de função e tratando como texto.`);
                    if (pendingAssistantMsg.content === null || pendingAssistantMsg.content === '') {
                        pendingAssistantMsg.content = "Entendi."; 
                        try { await writer.write(pendingAssistantMsg.content); } catch(e) { /* ignore */ }
                    }
                    pendingAssistantMsg.function_call = undefined;
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

            if (name === lastFnName && iter > 1) {
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
            // Passando currentEnrichedContext para a chamada recursiva
            return processTurn(currentMsgs, iter + 1, name, writer, currentUser, currentIntent, currentEnrichedContext);
        } else if (pendingAssistantMsg?.function_call && isLightweightIntent) {
            logger.warn(`${turnTag} Function call recebida para intent leve '${currentIntent}', mas foi ignorada pois os parâmetros de função não foram enviados à API.`);
        }

        logger.debug(`${turnTag} Turno concluído sem chamada de função processada (ou para intent leve).`);
        return currentMsgs;
    } // Fim da função processTurn
}
