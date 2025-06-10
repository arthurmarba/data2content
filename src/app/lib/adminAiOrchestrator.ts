/**
 * @fileoverview Orquestrador de chamadas à API OpenAI para a Central de Inteligência.
 * @version 4.0.0 - Corrigida a ordem de streaming de texto e visualizações.
 */

import OpenAI from 'openai';
import type { ChatCompletionMessageParam, ChatCompletionChunk } from 'openai/resources/chat/completions';
import { logger } from '@/app/lib/logger';
import { adminFunctionSchemas, adminFunctionExecutors } from './adminAiFunctions';
import { getAdminSystemPrompt } from './adminPromptSystem';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = process.env.OPENAI_ADMIN_MODEL || 'gpt-4o';
const TEMP = 0.3;
const SERVICE_TAG = '[adminAiOrchestrator v4.0.0]';
const VISUALIZATION_DELIMITER = '---JSON_VISUALIZATIONS---';

export interface AdminAIContext {
  adminName: string;
}

interface AdminLLMResult {
  stream: ReadableStream<string>;
  historyPromise: Promise<ChatCompletionMessageParam[]>;
}

function determineAdminIntent(query: string): 'data_query' | 'general_chat' {
    const dataKeywords = ['ranking', 'top', 'performance', 'dados', 'métrica', 'engajamento', 'qual', 'liste', 'mostre-me', 'compare', 'encontre', 'exemplos'];
    const lowerCaseQuery = query.toLowerCase();
    if (dataKeywords.some(keyword => lowerCaseQuery.includes(keyword))) {
        return 'data_query';
    }
    return 'general_chat';
}

export async function askAdminLLM(
  context: AdminAIContext,
  incomingText: string,
  historyMessages: ChatCompletionMessageParam[]
): Promise<AdminLLMResult> {
  const TAG = `${SERVICE_TAG}[askAdminLLM]`;
  const { adminName } = context;
  logger.info(`${TAG} Iniciando para admin '${adminName}'.`);

  const initialMsgs: ChatCompletionMessageParam[] = [
    { role: 'system', content: getAdminSystemPrompt(adminName) },
    ...historyMessages,
    { role: 'user', content: incomingText },
  ];

  const { readable, writable } = new TransformStream<string, string>();
  const writer = writable.getWriter();

  let resolveHistory: (h: ChatCompletionMessageParam[]) => void;
  const historyPromise = new Promise<ChatCompletionMessageParam[]>(res => { resolveHistory = res; });
  
  const intent = determineAdminIntent(incomingText);
  logger.info(`${TAG} Intenção determinada: ${intent}`);

  processTurn(initialMsgs, 0, writer, intent)
    .then(finalHistory => {
      logger.debug(`${TAG} Processamento concluído. Fechando writer.`);
      writer.close();
      resolveHistory(finalHistory);
    })
    .catch(async (error) => {
      logger.error(`${TAG} Erro durante o processamento:`, error);
      if (!writer.closed) {
        await writer.write(`\n\n⚠️ Erro: ${error.message}`);
        await writer.abort(error);
      }
      resolveHistory(initialMsgs);
    });

  return { stream: readable, historyPromise };
}

async function processTurn(
  currentMsgs: ChatCompletionMessageParam[],
  iter: number,
  writer: WritableStreamDefaultWriter<string>,
  intent: 'data_query' | 'general_chat'
): Promise<ChatCompletionMessageParam[]> {
  const turnTag = `${SERVICE_TAG}[processTurn iter ${iter}]`;
  if (iter >= 5) {
    throw new Error("Atingido o máximo de iterações de função.");
  }

  const payload: OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming = {
    model: MODEL,
    temperature: TEMP,
    stream: true,
    messages: currentMsgs,
  };

  if (intent === 'data_query') {
      logger.info(`${turnTag} Intenção é 'data_query', habilitando funções.`);
      payload.functions = adminFunctionSchemas;
      payload.function_call = 'auto';
  } else {
      logger.info(`${turnTag} Intenção é 'general_chat', funções desabilitadas.`);
  }

  const completionStream = await openai.chat.completions.create(payload);

  let functionCallName = '';
  let functionCallArgs = '';
  let fullDeltaContent = '';

  for await (const chunk of completionStream) {
    const delta = chunk.choices?.[0]?.delta;
    if (delta?.function_call) {
      if (delta.function_call.name) functionCallName += delta.function_call.name;
      if (delta.function_call.arguments) functionCallArgs += delta.function_call.arguments;
    }
    if (delta?.content) {
      fullDeltaContent += delta.content;
      await writer.write(delta.content);
    }
  }

  if (functionCallName) {
    logger.info(`${turnTag} IA solicitou chamada de função: ${functionCallName}`);
    currentMsgs.push({ role: 'assistant', content: null, function_call: { name: functionCallName, arguments: functionCallArgs } });
    
    const executor = adminFunctionExecutors[functionCallName];
    if (executor) {
      const parsedArgs = JSON.parse(functionCallArgs || '{}');
      const functionResult = await executor(parsedArgs) as any;
      
      let nextPromptContent = '';
      if (functionResult.error) {
          nextPromptContent = JSON.stringify({ error: functionResult.error });
      } else {
          nextPromptContent = JSON.stringify({ summary: functionResult.summary });
      }

      currentMsgs.push({ role: 'function', name: functionCallName, content: nextPromptContent });
      
      // CORREÇÃO: A chamada recursiva agora acontece ANTES de escrever os dados visuais.
      // Ela irá lidar com o streaming da resposta de texto final.
      const finalHistory = await processTurn(currentMsgs, iter + 1, writer, 'data_query');

      // AGORA, após o texto ter sido enviado, nós enviamos os dados de visualização.
      if (functionResult.visualizations && functionResult.visualizations.length > 0) {
        logger.info(`${turnTag} Escrevendo JSON de visualização no final do stream.`);
        await writer.write(VISUALIZATION_DELIMITER + JSON.stringify(functionResult.visualizations));
      }
      
      return finalHistory;
    }
  }
  
  if (fullDeltaContent) {
    currentMsgs.push({ role: 'assistant', content: fullDeltaContent });
  }

  return currentMsgs;
}
