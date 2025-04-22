// @/app/lib/stateService.ts - v1.1 (com setConversationHistory)

import { createClient, RedisClientType } from 'redis';
import { logger } from '@/app/lib/logger';

const REDIS_URL = process.env.REDIS_URL;
let client: RedisClientType | undefined; // Permitir que seja undefined inicialmente
let connectionPromise: Promise<RedisClientType> | null = null; // Para evitar corridas de conexão

// Função para garantir conexão única e robusta
async function getClient(): Promise<RedisClientType> {
  // Se já conectado, retorna o cliente
  if (client && client.isReady) {
    return client;
  }
  // Se já existe uma promessa de conexão, aguarda ela
  if (connectionPromise) {
    return connectionPromise;
  }

  // Cria a promessa de conexão
  connectionPromise = new Promise(async (resolve, reject) => {
    if (!REDIS_URL) {
      logger.error('[stateService][redis] REDIS_URL não definida no ambiente.');
      return reject(new Error('REDIS_URL não está configurada.'));
    }

    // Cria um novo cliente
    const newClient = createClient({ url: REDIS_URL });

    newClient.on('error', (err) => {
      logger.error('[stateService][redis] Erro de conexão Redis:', err);
      // Limpa o cliente e a promessa em caso de erro para permitir nova tentativa
      client = undefined;
      connectionPromise = null;
      // Não rejeita a promessa aqui, pois o erro pode ser temporário
      // A tentativa de reconexão será feita na próxima chamada a getClient
    });

    newClient.on('connect', () => {
        logger.info('[stateService][redis] Conectando ao Redis...');
    });

    newClient.on('ready', () => {
        logger.info('[stateService][redis] Cliente Redis pronto.');
    });

    newClient.on('end', () => {
        logger.warn('[stateService][redis] Conexão Redis encerrada.');
         client = undefined; // Limpa para permitir reconexão
         connectionPromise = null;
    });

    try {
      await newClient.connect();
      client = newClient as RedisClientType; // Confirma o tipo após conectar
      resolve(client);
    } catch (err) {
      logger.error('[stateService][redis] Falha ao conectar ao Redis inicialmente:', err);
      client = undefined; // Garante que o cliente não seja definido em caso de falha
      connectionPromise = null;
      reject(err); // Rejeita a promessa se a conexão inicial falhar
    }
  });

  return connectionPromise;
}

/**
 * Cache simples (para respostas).
 */
export async function getFromCache(key: string): Promise<string | null> {
  try {
    const redis = await getClient();
    return await redis.get(key);
  } catch (error) {
     logger.error(`[stateService] Erro em getFromCache para key ${key}:`, error);
     return null; // Retorna null em caso de erro
  }
}

export async function setInCache(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
   try {
    const redis = await getClient();
    await redis.set(key, value, { EX: ttlSeconds });
  } catch (error) {
     logger.error(`[stateService] Erro em setInCache para key ${key}:`, error);
     // Não propaga o erro, apenas loga
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
  // Adicionar outros campos de estado conforme necessário
}

export async function getDialogueState(
  userId: string
): Promise<DialogueState> {
  const key = `state:${userId}`;
  try {
    const redis = await getClient();
    const data = await redis.get(key);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch (parseError) {
      logger.error(`[stateService] Erro ao parsear JSON do estado para ${userId}:`, parseError);
      return {}; // Retorna objeto vazio se o JSON for inválido
    }
  } catch (error) {
     logger.error(`[stateService] Erro em getDialogueState para user ${userId}:`, error);
     return {}; // Retorna objeto vazio em caso de erro no Redis
  }
}

export async function updateDialogueState(
  userId: string,
  state: DialogueState
): Promise<void> {
   const key = `state:${userId}`;
   try {
    const redis = await getClient();
    await redis.set(key, JSON.stringify(state));
  } catch (error) {
     logger.error(`[stateService] Erro em updateDialogueState para user ${userId}:`, error);
  }
}

/**
 * Histórico de conversas (string única).
 */
export async function getConversationHistory(
  userId: string
): Promise<string> {
   const key = `history:${userId}`;
   try {
    const redis = await getClient();
    // Retorna a string ou string vazia se a chave não existir
    return (await redis.get(key)) || '';
  } catch (error) {
     logger.error(`[stateService] Erro em getConversationHistory para user ${userId}:`, error);
     return ''; // Retorna string vazia em caso de erro
  }
}

// --- FUNÇÃO ADICIONADA ---
/**
 * Define/sobrescreve o histórico completo da conversa para um usuário.
 * @param userId ID do usuário.
 * @param history String contendo o histórico completo formatado.
 */
export async function setConversationHistory(userId: string, history: string): Promise<void> {
  const key = `history:${userId}`;
  try {
    const redis = await getClient();
    // Simplesmente define/sobrescreve o valor da chave do histórico
    // Você pode querer adicionar um TTL (EX) aqui se o histórico não precisar ser permanente
    await redis.set(key, history);
    logger.debug(`[stateService] Histórico atualizado para user ${userId}. Tamanho: ${history.length}`);
  } catch (error) {
     logger.error(`[stateService] Erro em setConversationHistory para user ${userId}:`, error);
  }
}
// --- FIM FUNÇÃO ADICIONADA ---

// Função antiga de append (pode ser removida ou mantida se útil em outro lugar)
// export async function updateConversationContext(
//   userId: string,
//   userMessage: string,
//   assistantMessage: string,
//   previousHistory: string
// ): Promise<void> {
//   const redis = await getClient();
//   const newHistory =
//     previousHistory +
//     `\nUser: ${userMessage}\nAssistant: ${assistantMessage}`;
//   await redis.set(`history:${userId}`, newHistory);
// }

/**
 * Contador de uso (por usuário).
 */
export async function incrementUsageCounter(
  userId: string
): Promise<void> {
   const key = `usage:${userId}`;
   try {
    const redis = await getClient();
    await redis.incr(key);
  } catch (error) {
     logger.error(`[stateService] Erro em incrementUsageCounter para user ${userId}:`, error);
  }
}
