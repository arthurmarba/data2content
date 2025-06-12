/**
 * @fileoverview Ponto de entrada e orquestrador principal da IA do Admin.
 * @version 13.0.0 (Production Ready)
 * @description
 * ## Principais Melhorias na Versão 13.0.0:
 * - **Estabilidade de Produção:** O código foi finalizado e limpo após a
 * correção bem-sucedida do bug de congelamento da interface.
 * - **Arquitetura de Stream Robusta:** A arquitetura com `ReadableStream`
 * provou ser eficaz, garantindo o fechamento confiável da conexão em todos
 * os cenários.
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { logger } from '../logger';
import { AdminAIContext, AdminLLMResult, SERVICE_TAG } from './types';
import { getCachedData, setCachedData, generateCacheKey } from './cache';
import { AdminAIChatProcessor } from './chat-processor';

/**
 * Ponto de entrada principal para interagir com a Central de Inteligência.
 */
export function askAdminLLM(
  context: AdminAIContext,
  query: string,
  history: ChatCompletionMessageParam[]
): AdminLLMResult {
  const TAG = `${SERVICE_TAG}[askAdminLLM]`;

  const stream = new ReadableStream({
    async start(controller) {
      // O "writer" falso implementa a interface WritableStreamDefaultWriter
      // para ser compatível com o AdminAIChatProcessor.
      const writer: WritableStreamDefaultWriter<string> = {
        write: (chunk: string) => {
          try {
            controller.enqueue(chunk);
          } catch (e) {
            logger.warn(`${TAG} Falha ao enfileirar chunk, controller pode estar fechado.`, e);
          }
          return Promise.resolve();
        },
        close: () => Promise.resolve(),
        abort: (reason?: any) => {
          controller.error(reason);
          return Promise.resolve();
        },
        get closed() { return false as unknown as Promise<undefined>; },
        get desiredSize() { return controller.desiredSize; },
        get ready() { return Promise.resolve(undefined); },
        releaseLock: () => {},
      };

      try {
        logger.info(`${TAG} O stream iniciou. A lógica de processamento começa agora.`);
        const cacheKey = generateCacheKey(query, history);
        const cachedData = await getCachedData(cacheKey);

        if (cachedData) {
          logger.info(`${TAG} Cache HIT. Enfileirando dados cacheados.`);
          await writer.write(cachedData);
        } else {
          logger.info(`${TAG} Cache MISS. Iniciando novo processador de chat.`);
          const processor = new AdminAIChatProcessor(writer, context.adminName, history, query);

          logger.info(`${TAG} Executando processor.run()...`);
          const finalResponseForCache = await processor.run();
          logger.info(`${TAG} processor.run() concluído.`);
    
          if (finalResponseForCache) {
            await setCachedData(cacheKey, finalResponseForCache);
          }
        }
        logger.info(`${TAG} Lógica de processamento concluída com sucesso.`);
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : 'Ocorreu um erro desconhecido.';
        logger.error(`${TAG} Erro durante o processamento do stream:`, e);
        try {
          await writer.write(`Desculpe, ocorreu um erro ao processar sua solicitação: ${errorMessage}`);
        } catch(writeErr) {
          logger.error(`${TAG} Falha ao escrever mensagem de erro no stream.`, writeErr);
        }
      } finally {
        logger.info(`${TAG} Finalizando o stream. Fechando o controller.`);
        if (controller) {
            try {
                controller.close();
            } catch (e) {
                // Ignora o erro se o controller já estiver fechado.
            }
        }
      }
    },
  });

  return { stream };
}
