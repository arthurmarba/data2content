/**
 * @fileoverview Configurações centralizadas e inicialização de clientes.
 * @version 2.0.0
 * @description Este arquivo exporta as instâncias de clientes (OpenAI, Redis)
 * e as variáveis de ambiente necessárias para a Central de Inteligência do Admin.
 *
 * ## Melhorias na Versão 2.0.0:
 * - **Validação de Variáveis de Ambiente:** Adicionada verificação da existência
 * da `OPENAI_API_KEY` na inicialização.
 * - **Gerenciamento de Conexão:** A lógica do cliente Redis agora loga o status
 * da conexão (connect, reconnecting), além de erros.
 * - **Logs Estruturados:** Padronização dos logs com uma tag de serviço.
 */

import OpenAI from 'openai';
import { createClient } from 'redis';
import { logger } from '../logger';

const SERVICE_TAG = '[AdminAIConfig]';

// --- Validação e Configuração do OpenAI ---
if (!process.env.OPENAI_API_KEY) {
    logger.warn(`${SERVICE_TAG} A variável de ambiente OPENAI_API_KEY não está definida. As chamadas à API da OpenAI irão falhar.`);
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  // Evita que a chave seja exposta em logs de erro no navegador em produção.
  dangerouslyAllowBrowser: process.env.NODE_ENV !== 'production',
});

export const MODEL = process.env.OPENAI_ADMIN_MODEL || 'gpt-4o';

// --- Configuração do Cache (Redis) ---
export const CACHE_ENABLED = process.env.ADMIN_AI_CACHE_ENABLED === 'true';
export const CACHE_EXPIRATION_SECONDS = 3600; // 1 hora
export const CACHE_TIMEOUT_MS = 1000; // Timeout para operações Redis

/**
 * Cria e configura uma instância do cliente Redis.
 * Gerencia os eventos de conexão e erros.
 * @returns Uma instância do cliente Redis ou null se o cache estiver desabilitado.
 */
const createRedisClient = () => {
  if (!CACHE_ENABLED) {
    logger.info(`${SERVICE_TAG} O cache Redis está desabilitado via variável de ambiente.`);
    return null;
  }
  if (!process.env.REDIS_URL) {
    logger.warn(`${SERVICE_TAG} O cache está habilitado, mas a REDIS_URL não está definida. O cache não funcionará.`);
    return null;
  }
  
  const client = createClient({ url: process.env.REDIS_URL });

  client.on('connect', () => logger.info(`${SERVICE_TAG}[Redis] Conectando ao servidor...`));
  client.on('ready', () => logger.info(`${SERVICE_TAG}[Redis] Cliente pronto e conectado com sucesso.`));
  client.on('reconnecting', () => logger.warn(`${SERVICE_TAG}[Redis] Reconectando ao servidor...`));
  client.on('error', (err) => logger.error(`${SERVICE_TAG}[Redis] Erro de conexão.`, err));
  
  // Conecta de forma assíncrona para não bloquear a inicialização da aplicação.
  client.connect().catch(err => {
      logger.error(`${SERVICE_TAG}[Redis] Falha crítica na conexão inicial.`, err);
  });

  return client;
};

export const redisClient = createRedisClient();
