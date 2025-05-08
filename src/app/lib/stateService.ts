// @/app/lib/stateService.ts - v1.5 (Histórico como JSON)

import { Redis } from '@upstash/redis';
import { logger } from '@/app/lib/logger';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'; // <<< Importa o tipo

// Variáveis de ambiente para o SDK @upstash/redis
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

let redisClient: Redis | null = null;

// Função para inicializar e retornar o cliente (Singleton)
function getClient(): Redis {
  if (redisClient) {
    return redisClient;
  }
  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    logger.error('[stateService][@upstash/redis] Variáveis UPSTASH_REDIS_REST_URL ou UPSTASH_REDIS_REST_TOKEN não definidas.');
    throw new Error('Configuração do Upstash Redis incompleta no ambiente.');
  }
  logger.info('[stateService][@upstash/redis] Criando nova instância do cliente Redis via REST API...');
  try {
    redisClient = new Redis({ url: UPSTASH_URL, token: UPSTASH_TOKEN });
    logger.info('[stateService][@upstash/redis] Cliente Redis (REST) inicializado.');
    return redisClient;
  } catch (error) {
    logger.error('[stateService][@upstash/redis] Falha ao criar instância do cliente Redis:', error);
    redisClient = null;
    throw error;
  }
}

// --- Cache e Estado (sem alterações) ---

export async function getFromCache(key: string): Promise<string | null> {
  const TAG = '[stateService][getFromCache]';
  try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando chave: ${key}`);
    const value = await redis.get<string>(key);
    logger.debug(`${TAG} Resultado para ${key}: ${value ? value.slice(0, 50)+'...' : 'null'}`);
    return value;
  } catch (error) {
     logger.error(`${TAG} Erro para key ${key}:`, error);
     return null;
  }
}

export async function setInCache(key: string, value: string, ttlSeconds: number): Promise<void> {
   const TAG = '[stateService][setInCache]';
   try {
    const redis = getClient();
    logger.debug(`${TAG} Definindo chave: ${key} com TTL: ${ttlSeconds}s`);
    await redis.set(key, value, { ex: ttlSeconds });
    logger.debug(`${TAG} Chave ${key} definida com sucesso.`);
  } catch (error) {
     logger.error(`${TAG} Erro para key ${key}:`, error);
  }
}

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

export async function getDialogueState(userId: string): Promise<DialogueState> {
  const TAG = '[stateService][getDialogueState]';
  const key = `state:${userId}`;
  try {
    const redis = getClient();
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
     return {};
  }
}

export async function updateDialogueState(userId: string, state: DialogueState): Promise<void> {
   const TAG = '[stateService][updateDialogueState]';
   const key = `state:${userId}`;
   try {
    const redis = getClient();
    const stateJson = JSON.stringify(state);
    logger.debug(`${TAG} Atualizando estado para user: ${userId} (key: ${key}), tamanho: ${stateJson.length}`);
    await redis.set(key, stateJson);
    logger.debug(`${TAG} Estado atualizado para user: ${userId}`);
  } catch (error) {
     logger.error(`${TAG} Erro para user ${userId}:`, error);
  }
}

// --- Histórico de Conversas (MODIFICADO PARA JSON) ---

/**
 * Busca o histórico de conversas (array de mensagens) para um usuário.
 * Retorna um array vazio se não houver histórico ou ocorrer erro no parse.
 */
export async function getConversationHistory(
  userId: string
): Promise<ChatCompletionMessageParam[]> { // <<< RETORNA ARRAY
   const TAG = '[stateService][getConversationHistory v1.5]'; // Versão atualizada
   const key = `history:${userId}`;
   try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando histórico para user: ${userId} (key: ${key})`);
    const historyJson = await redis.get<string>(key); // Busca como string JSON

    if (!historyJson) {
      logger.debug(`${TAG} Nenhum histórico JSON encontrado para user ${userId}.`);
      return []; // Retorna array vazio
    }

    logger.debug(`${TAG} Histórico JSON encontrado (${historyJson.length} chars), parseando...`);
    try {
      // Tenta parsear a string JSON para o array de mensagens
      const historyArray = JSON.parse(historyJson) as ChatCompletionMessageParam[];
      // Validação básica (opcional, mas recomendada)
      if (!Array.isArray(historyArray)) {
          logger.error(`${TAG} Dado do histórico para ${userId} não é um array após parse JSON.`);
          return [];
      }
      logger.debug(`${TAG} Histórico parseado com sucesso (${historyArray.length} mensagens) para user ${userId}.`);
      return historyArray;
    } catch (parseError) {
      logger.error(`${TAG} Erro ao parsear JSON do histórico para ${userId}. Dados podem estar em formato antigo (string) ou corrompidos.`, parseError);
      // Aqui você pode decidir o que fazer com dados antigos/corrompidos.
      // Por enquanto, retornamos array vazio.
      // TODO: Considerar uma migração ou tratamento específico para dados no formato string antigo, se necessário.
      return []; // Retorna array vazio em caso de erro de parse
    }
  } catch (error) {
     logger.error(`${TAG} Erro ao buscar histórico no Redis para user ${userId}:`, error);
     return []; // Retorna array vazio em caso de erro do Redis
  }
}

/**
 * Define/sobrescreve o histórico completo da conversa para um usuário,
 * salvando como uma string JSON.
 */
export async function setConversationHistory(
    userId: string,
    history: ChatCompletionMessageParam[] // <<< ACEITA ARRAY
): Promise<void> {
  const TAG = '[stateService][setConversationHistory v1.5]'; // Versão atualizada
  const key = `history:${userId}`;
  try {
    const redis = getClient();
    // Converte o array de mensagens para uma string JSON
    const historyJson = JSON.stringify(history);
    logger.debug(`${TAG} Definindo histórico JSON para user: ${userId} (key: ${key}), ${history.length} mensagens, tamanho JSON: ${historyJson.length}`);
    // Salva a string JSON no Redis (pode adicionar TTL se quiser que expire)
    // await redis.set(key, historyJson, { ex: SEU_TTL_EM_SEGUNDOS });
    await redis.set(key, historyJson);
    logger.debug(`${TAG} Histórico JSON definido para user ${userId}.`);
  } catch (error) {
     logger.error(`${TAG} Erro ao salvar histórico JSON no Redis para user ${userId}:`, error);
  }
}

// --- Contador de Uso (sem alterações) ---

export async function incrementUsageCounter(userId: string): Promise<void> {
   const TAG = '[stateService][incrementUsageCounter]';
   const key = `usage:${userId}`;
   try {
    const redis = getClient();
    logger.debug(`${TAG} Incrementando contador para user: ${userId} (key: ${key})`);
    const newValue = await redis.incr(key);
    logger.debug(`${TAG} Contador incrementado para user ${userId}. Novo valor: ${newValue}`);
  } catch (error) {
     logger.error(`${TAG} Erro para user ${userId}:`, error);
  }
}