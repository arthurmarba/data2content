// @/app/lib/stateService.ts - v1.4 (Usando @upstash/redis SDK)

import { Redis } from '@upstash/redis'; // Importa o SDK oficial do Upstash
import { logger } from '@/app/lib/logger';

// Variáveis de ambiente para o SDK @upstash/redis
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient: Redis | null = null; // Cliente @upstash/redis

// Função para inicializar e retornar o cliente (Singleton)
function getClient(): Redis {
  // Se o cliente já existe, retorna ele
  if (redisClient) {
    return redisClient;
  }

  // Verifica se as variáveis de ambiente estão definidas
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    logger.error('[stateService][@upstash/redis] Variáveis UPSTASH_REDIS_REST_URL ou UPSTASH_REDIS_REST_TOKEN não definidas.');
    throw new Error('Configuração do Upstash Redis incompleta no ambiente.');
  }

  logger.info('[stateService][@upstash/redis] Criando nova instância do cliente Redis via REST API...');

  try {
    // Cria a instância do cliente Redis usando as credenciais REST
    redisClient = new Redis({
      url: UPSTASH_URL,
      token: UPSTASH_TOKEN,
    });

    logger.info('[stateService][@upstash/redis] Cliente Redis (REST) inicializado.');
    // Nota: O cliente REST não mantém uma conexão persistente como ioredis,
    // então não há eventos 'connect', 'ready', 'error' da mesma forma.
    // Cada comando é uma requisição HTTPS separada.
    return redisClient;

  } catch (error) {
    logger.error('[stateService][@upstash/redis] Falha ao criar instância do cliente Redis:', error);
    redisClient = null; // Garante que não fique com instância inválida
    throw error; // Propaga o erro
  }
}

// --- Funções existentes adaptadas para usar o novo getClient ---
// A API do @upstash/redis é muito similar à do ioredis para comandos básicos.

/**
 * Cache simples (para respostas).
 */
export async function getFromCache(key: string): Promise<string | null> {
  const TAG = '[stateService][getFromCache]';
  try {
    const redis = getClient(); // Obtém o cliente @upstash/redis
    logger.debug(`${TAG} Buscando chave: ${key}`);
    const value = await redis.get<string>(key); // Usa redis.get<Type>()
    logger.debug(`${TAG} Resultado para ${key}: ${value ? value.slice(0, 50)+'...' : 'null'}`);
    return value;
  } catch (error) {
     logger.error(`${TAG} Erro para key ${key}:`, error);
     // Em caso de erro com o cliente REST, pode ser útil resetar a instância
     // redisClient = null; // Descomente se quiser forçar recriação na próxima chamada
     return null;
  }
}

export async function setInCache(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
   const TAG = '[stateService][setInCache]';
   try {
    const redis = getClient(); // Obtém o cliente @upstash/redis
    logger.debug(`${TAG} Definindo chave: ${key} com TTL: ${ttlSeconds}s`);
    // Usa redis.set com opções para TTL (EX = seconds)
    await redis.set(key, value, { ex: ttlSeconds });
    logger.debug(`${TAG} Chave ${key} definida com sucesso.`);
  } catch (error) {
     logger.error(`${TAG} Erro para key ${key}:`, error);
     // redisClient = null; // Descomente se quiser forçar recriação
  }
}

/**
 * Estado da conversa (salvo como JSON em Redis).
 */
export interface DialogueState {
  lastInteraction?: number;
  lastGreetingSent?: number;
  recentPlanIdeas?: { identifier: string; description: string }[] | null;
  recentPlanTimestamp?: number;
  lastOfferedScriptIdea?: {
    aiGeneratedIdeaDescription: string;
    originalSource: any;
    timestamp: number;
  } | null;
}

export async function getDialogueState(
  userId: string
): Promise<DialogueState> {
  const TAG = '[stateService][getDialogueState]';
  const key = `state:${userId}`;
  try {
    const redis = getClient(); // Obtém o cliente @upstash/redis
    logger.debug(`${TAG} Buscando estado para user: ${userId} (key: ${key})`);
    const data = await redis.get<string>(key);
    if (!data) {
        logger.debug(`${TAG} Nenhum estado encontrado para user: ${userId}`);
        return {};
    }
    logger.debug(`${TAG} Estado encontrado para user: ${userId}, parseando JSON...`);
    try {
      return JSON.parse(data);
    } catch (parseError) {
      logger.error(`${TAG} Erro ao parsear JSON do estado para ${userId}:`, parseError);
      return {};
    }
  } catch (error) {
     logger.error(`${TAG} Erro para user ${userId}:`, error);
     // redisClient = null; // Descomente se quiser forçar recriação
     return {};
  }
}

export async function updateDialogueState(
  userId: string,
  state: DialogueState
): Promise<void> {
   const TAG = '[stateService][updateDialogueState]';
   const key = `state:${userId}`;
   try {
    const redis = getClient(); // Obtém o cliente @upstash/redis
    const stateJson = JSON.stringify(state);
    logger.debug(`${TAG} Atualizando estado para user: ${userId} (key: ${key}), tamanho: ${stateJson.length}`);
    await redis.set(key, stateJson);
    logger.debug(`${TAG} Estado atualizado para user: ${userId}`);
  } catch (error) {
     logger.error(`${TAG} Erro para user ${userId}:`, error);
     // redisClient = null; // Descomente se quiser forçar recriação
  }
}

/**
 * Histórico de conversas (string única).
 */
export async function getConversationHistory(
  userId: string
): Promise<string> {
   const TAG = '[stateService][getConversationHistory]';
   const key = `history:${userId}`;
   try {
    const redis = getClient(); // Obtém o cliente @upstash/redis
    logger.debug(`${TAG} Buscando histórico para user: ${userId} (key: ${key})`);
    const history = await redis.get<string>(key);
    logger.debug(`${TAG} Histórico encontrado para user ${userId}: ${history ? history.length + ' chars' : 'nenhum'}`);
    return history || '';
  } catch (error) {
     logger.error(`${TAG} Erro para user ${userId}:`, error);
     // redisClient = null; // Descomente se quiser forçar recriação
     return '';
  }
}

/**
 * Define/sobrescreve o histórico completo da conversa para um usuário.
 */
export async function setConversationHistory(userId: string, history: string): Promise<void> {
  const TAG = '[stateService][setConversationHistory]';
  const key = `history:${userId}`;
  try {
    const redis = getClient(); // Obtém o cliente @upstash/redis
    logger.debug(`${TAG} Definindo histórico para user: ${userId} (key: ${key}), tamanho: ${history.length}`);
    await redis.set(key, history); // Pode adicionar { ex: ttlSeconds } aqui se necessário
    logger.debug(`${TAG} Histórico definido para user ${userId}.`);
  } catch (error) {
     logger.error(`${TAG} Erro para user ${userId}:`, error);
     // redisClient = null; // Descomente se quiser forçar recriação
  }
}

/**
 * Contador de uso (por usuário).
 */
export async function incrementUsageCounter(
  userId: string
): Promise<void> {
   const TAG = '[stateService][incrementUsageCounter]';
   const key = `usage:${userId}`;
   try {
    const redis = getClient(); // Obtém o cliente @upstash/redis
    logger.debug(`${TAG} Incrementando contador para user: ${userId} (key: ${key})`);
    const newValue = await redis.incr(key);
    logger.debug(`${TAG} Contador incrementado para user ${userId}. Novo valor: ${newValue}`);
  } catch (error) {
     logger.error(`${TAG} Erro para user ${userId}:`, error);
     // redisClient = null; // Descomente se quiser forçar recriação
  }
}
