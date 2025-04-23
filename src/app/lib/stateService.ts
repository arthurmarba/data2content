// @/app/lib/stateService.ts - v1.3 (Correção de tipo implícito)

import Redis from 'ioredis'; // Importa a biblioteca ioredis
import { logger } from '@/app/lib/logger';

const REDIS_URL = process.env.REDIS_URL;
let redisClient: Redis | null = null; // Cliente ioredis, pode ser null inicialmente
let connectionPromise: Promise<Redis> | null = null; // Promessa para evitar corridas

// Função para garantir conexão única e robusta com ioredis
async function getClient(): Promise<Redis> {
  // Se já conectado e pronto, retorna o cliente
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }
  // Se já existe uma promessa de conexão, aguarda ela
  if (connectionPromise) {
    logger.debug('[stateService][ioredis] Aguardando promessa de conexão existente...');
    return connectionPromise;
  }

  // Cria a promessa de conexão
  connectionPromise = new Promise((resolve, reject) => {
    if (!REDIS_URL) {
      logger.error('[stateService][ioredis] REDIS_URL não definida no ambiente.');
      connectionPromise = null; // Limpa a promessa para permitir nova tentativa
      return reject(new Error('REDIS_URL não está configurada.'));
    }

    // Se o cliente já existe mas não está pronto (ex: 'connecting', 'reconnecting', 'close')
    // O ioredis tenta reconectar automaticamente, então podemos apenas esperar ou logar.
    // Se estiver 'end', precisamos criar um novo.
    if (redisClient && redisClient.status !== 'end') {
        logger.warn(`[stateService][ioredis] Cliente existe com status ${redisClient.status}. Aguardando ficar pronto ou reconectar.`);
        // Eventualmente o status deve mudar para 'ready' ou 'error'/'end'
        // Se já estiver 'ready', o if no início da função retornaria.
        // Se a conexão falhar permanentemente, o 'error' ou 'end' será tratado.
        // Por segurança, adicionamos um timeout para a promessa não ficar pendurada indefinidamente.
        const timeoutId = setTimeout(() => {
             logger.error(`[stateService][ioredis] Timeout esperando cliente existente ficar pronto (status: ${redisClient?.status}).`);
             connectionPromise = null; // Permite nova tentativa
             reject(new Error(`Timeout esperando cliente Redis existente (status: ${redisClient?.status})`));
        }, 15000); // Timeout de 15 segundos (ajuste conforme necessário)

        redisClient.once('ready', () => {
            clearTimeout(timeoutId);
            if(redisClient) resolve(redisClient); // Resolve se ficar pronto
        });
        redisClient.once('error', (err) => {
            clearTimeout(timeoutId);
            logger.error('[stateService][ioredis] Erro no cliente existente enquanto aguardava:', err);
            connectionPromise = null; // Permite nova tentativa
            reject(err);
        });
         redisClient.once('end', () => {
            clearTimeout(timeoutId);
            logger.warn('[stateService][ioredis] Conexão encerrada no cliente existente enquanto aguardava.');
            redisClient = null; // Limpa para criar novo
            connectionPromise = null; // Permite nova tentativa
            reject(new Error("Conexão Redis encerrada enquanto aguardava."));
        });
        return; // Sai da função Promise, pois estamos esperando eventos do cliente existente
    }

    // Cria um novo cliente ioredis se não existir ou se o status for 'end'
    logger.info('[stateService][ioredis] Criando nova instância ioredis...');
    const newClient = new Redis(REDIS_URL, {
        lazyConnect: true, // Conecta apenas quando necessário
        showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
        maxRetriesPerRequest: 3,
        connectTimeout: 10000,
        // TLS é habilitado automaticamente para URLs rediss://
    });

    newClient.on('connect', () => {
        logger.info('[stateService][ioredis] Conectando ao Redis...');
    });

    newClient.on('ready', () => {
        logger.info('[stateService][ioredis] Cliente ioredis pronto.');
        redisClient = newClient; // Armazena a instância conectada
        resolve(redisClient); // Resolve a promessa com o cliente pronto
    });

    newClient.on('error', (err) => {
      logger.error('[stateService][ioredis] Erro de conexão ioredis:', err);
      // Não limpa a promessa aqui, pois o ioredis pode tentar reconectar.
      // Se a conexão inicial falhar, o connect() abaixo rejeitará.
      // Se for um erro posterior, a próxima chamada a getClient tratará.
    });

    newClient.on('close', () => {
        logger.warn('[stateService][ioredis] Conexão ioredis fechada.');
        // Não limpa o cliente aqui necessariamente, pode reconectar
    });

    // --- CORREÇÃO AQUI ---
    newClient.on('reconnecting', (time: number) => { // Adicionado ': number' ao parâmetro time
        logger.info(`[stateService][ioredis] Reconectando ao Redis em ${time}ms...`);
    });
    // --- FIM DA CORREÇÃO ---

    newClient.on('end', () => {
        logger.warn('[stateService][ioredis] Conexão ioredis encerrada permanentemente.');
        if (redisClient === newClient) {
            redisClient = null; // Limpa a instância global se for a mesma
        }
        connectionPromise = null; // Permite nova tentativa na próxima chamada
        // Não rejeita a promessa aqui, pois pode ser um encerramento esperado ou erro já tratado.
    });

    // Tenta conectar explicitamente (importante com lazyConnect: true)
    newClient.connect().catch(err => {
        logger.error('[stateService][ioredis] Falha na conexão inicial explícita:', err);
        connectionPromise = null; // Limpa a promessa para permitir nova tentativa
        reject(err); // Rejeita a promessa se a conexão inicial falhar
    });
  });

  return connectionPromise;
}


// --- Funções existentes adaptadas para usar o novo getClient ---

/**
 * Cache simples (para respostas).
 */
export async function getFromCache(key: string): Promise<string | null> {
  try {
    const redis = await getClient(); // Usa o novo getClient
    return await redis.get(key);
  } catch (error) {
     logger.error(`[stateService] Erro em getFromCache para key ${key}:`, error);
     return null;
  }
}

export async function setInCache(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
   try {
    const redis = await getClient(); // Usa o novo getClient
    await redis.set(key, value, 'EX', ttlSeconds); // Sintaxe do ioredis para TTL
  } catch (error) {
     logger.error(`[stateService] Erro em setInCache para key ${key}:`, error);
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
  const key = `state:${userId}`;
  try {
    const redis = await getClient(); // Usa o novo getClient
    const data = await redis.get(key);
    if (!data) return {};
    try {
      return JSON.parse(data);
    } catch (parseError) {
      logger.error(`[stateService] Erro ao parsear JSON do estado para ${userId}:`, parseError);
      return {};
    }
  } catch (error) {
     logger.error(`[stateService] Erro em getDialogueState para user ${userId}:`, error);
     return {};
  }
}

export async function updateDialogueState(
  userId: string,
  state: DialogueState
): Promise<void> {
   const key = `state:${userId}`;
   try {
    const redis = await getClient(); // Usa o novo getClient
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
    const redis = await getClient(); // Usa o novo getClient
    return (await redis.get(key)) || '';
  } catch (error) {
     logger.error(`[stateService] Erro em getConversationHistory para user ${userId}:`, error);
     return '';
  }
}

/**
 * Define/sobrescreve o histórico completo da conversa para um usuário.
 */
export async function setConversationHistory(userId: string, history: string): Promise<void> {
  const key = `history:${userId}`;
  try {
    const redis = await getClient(); // Usa o novo getClient
    await redis.set(key, history); // Pode adicionar 'EX', ttlSeconds aqui se necessário
    logger.debug(`[stateService] Histórico atualizado para user ${userId}. Tamanho: ${history.length}`);
  } catch (error) {
     logger.error(`[stateService] Erro em setConversationHistory para user ${userId}:`, error);
  }
}

/**
 * Contador de uso (por usuário).
 */
export async function incrementUsageCounter(
  userId: string
): Promise<void> {
   const key = `usage:${userId}`;
   try {
    const redis = await getClient(); // Usa o novo getClient
    await redis.incr(key);
  } catch (error) {
     logger.error(`[stateService] Erro em incrementUsageCounter para user ${userId}:`, error);
  }
}
