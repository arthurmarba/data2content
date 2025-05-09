// @/app/lib/stateService.ts - v1.6.0 (Estado de Diálogo Aprimorado com Ações Pendentes)

import { Redis } from '@upstash/redis';
import { logger } from '@/app/lib/logger';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

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

// --- Cache (sem alterações) ---

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

// --- Estado do Diálogo (MODIFICADO) ---

// ATUALIZADO: Interface IDialogueState para incluir campos de ação pendente
export interface IDialogueState {
  lastInteraction?: number;
  lastGreetingSent?: number;
  recentPlanIdeas?: { identifier: string; description: string }[] | null;
  recentPlanTimestamp?: number;
  lastOfferedScriptIdea?: {
    aiGeneratedIdeaDescription: string;
    originalSource: any;
    timestamp: number;
  } | null;
  // ADICIONADO: Para rastrear perguntas da IA que aguardam confirmação do usuário
  lastAIQuestionType?: 'confirm_fetch_day_stats' | 'confirm_another_action' | string; // Tipo da pergunta/ação pendente
  pendingActionContext?: Record<string, any> | string | null; // Contexto necessário para executar a ação se confirmada
}

export async function getDialogueState(userId: string): Promise<IDialogueState> {
  const TAG = '[stateService][getDialogueState v1.6.0]'; // Versão atualizada
  const key = `state:${userId}`; // Mantendo o padrão de chave original
  try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando estado para user: ${userId} (key: ${key})`);
    const data = await redis.get<string>(key);
    if (!data) {
        logger.debug(`${TAG} Nenhum estado encontrado para user: ${userId}`);
        return {}; // Retorna objeto vazio se não encontrado
    }
    logger.debug(`${TAG} Estado encontrado para user: ${userId}, parseando JSON...`);
    try {
      return JSON.parse(data) as IDialogueState; // Cast para a interface atualizada
    } catch (parseError) {
      logger.error(`${TAG} Erro ao parsear JSON do estado para ${userId}:`, parseError);
      return {}; // Retorna objeto vazio em caso de erro de parse
    }
  } catch (error) {
     logger.error(`${TAG} Erro ao buscar estado no Redis para user ${userId}:`, error);
     return {}; // Retorna objeto vazio em caso de erro do Redis
  }
}

/**
 * Atualiza o estado do diálogo para um usuário, mesclando o novo estado parcial com o existente.
 */
export async function updateDialogueState(userId: string, newState: Partial<IDialogueState>): Promise<void> {
   const TAG = '[stateService][updateDialogueState v1.6.0]'; // Versão atualizada
   const key = `state:${userId}`;
   try {
    const redis = getClient();
    const currentState = await getDialogueState(userId); // Busca o estado atual
    const mergedState = { ...currentState, ...newState }; // Mescla com o novo estado parcial
    const stateJson = JSON.stringify(mergedState);
    logger.debug(`${TAG} Atualizando estado para user: ${userId} (key: ${key}), novo estado parcial: ${JSON.stringify(newState)}, estado mesclado tamanho: ${stateJson.length}`);
    await redis.set(key, stateJson);
    logger.debug(`${TAG} Estado mesclado e atualizado para user ${userId}.`);
  } catch (error) {
     logger.error(`${TAG} Erro ao atualizar estado para user ${userId}:`, error);
  }
}

/**
 * ADICIONADO: Limpa os campos de ação pendente do estado do diálogo.
 */
export async function clearPendingActionState(userId: string): Promise<void> {
    const TAG = '[stateService][clearPendingActionState v1.6.0]';
    try {
        const currentState = await getDialogueState(userId);
        // Cria um novo objeto de estado sem as chaves de ação pendente
        const { lastAIQuestionType, pendingActionContext, ...restOfState } = currentState;
        
        // Verifica se realmente havia algo para limpar, para evitar reescrita desnecessária
        if (lastAIQuestionType !== undefined || pendingActionContext !== undefined) {
            const newStateJson = JSON.stringify(restOfState);
            const key = `state:${userId}`;
            const redis = getClient();
            await redis.set(key, newStateJson);
            logger.info(`${TAG} Estado de ação pendente limpo para user ${userId}.`);
        } else {
            logger.debug(`${TAG} Nenhum estado de ação pendente para limpar para user ${userId}.`);
        }
    } catch (error) {
        logger.error(`${TAG} Erro ao limpar estado de ação pendente para user ${userId}:`, error);
    }
}


// --- Histórico de Conversas (sem alterações na lógica, apenas nos comentários de versão se desejar) ---

export async function getConversationHistory(
  userId: string
): Promise<ChatCompletionMessageParam[]> {
   const TAG = '[stateService][getConversationHistory v1.5]';
   const key = `history:${userId}`;
   try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando histórico para user: ${userId} (key: ${key})`);
    const historyJson = await redis.get<string>(key);

    if (!historyJson) {
      logger.debug(`${TAG} Nenhum histórico JSON encontrado para user ${userId}.`);
      return [];
    }
    logger.debug(`${TAG} Histórico JSON encontrado (${historyJson.length} chars), parseando...`);
    try {
      const historyArray = JSON.parse(historyJson) as ChatCompletionMessageParam[];
      if (!Array.isArray(historyArray)) {
          logger.error(`${TAG} Dado do histórico para ${userId} não é um array após parse JSON.`);
          return [];
      }
      logger.debug(`${TAG} Histórico parseado com sucesso (${historyArray.length} mensagens) para user ${userId}.`);
      return historyArray;
    } catch (parseError) {
      logger.error(`${TAG} Erro ao parsear JSON do histórico para ${userId}.`, parseError);
      return [];
    }
  } catch (error) {
     logger.error(`${TAG} Erro ao buscar histórico no Redis para user ${userId}:`, error);
     return [];
  }
}

export async function setConversationHistory(
    userId: string,
    history: ChatCompletionMessageParam[]
): Promise<void> {
  const TAG = '[stateService][setConversationHistory v1.5]';
  const key = `history:${userId}`;
  try {
    const redis = getClient();
    const historyJson = JSON.stringify(history);
    logger.debug(`${TAG} Definindo histórico JSON para user: ${userId} (key: ${key}), ${history.length} mensagens, tamanho JSON: ${historyJson.length}`);
    await redis.set(key, historyJson);
    logger.debug(`${TAG} Histórico JSON definido para user ${userId}.`);
  } catch (error) {
     logger.error(`${TAG} Erro ao salvar histórico JSON no Redis para user ${userId}:`, error);
  }
}

// --- Contador de Uso (sem alterações) ---

export async function incrementUsageCounter(userId: string): Promise<void> {
   const TAG = '[stateService][incrementUsageCounter]';
   const key = `usage:${userId}`; // Usando um prefixo mais explícito se desejar, ex: `d2c:usage:${userId}`
   try {
    const redis = getClient();
    logger.debug(`${TAG} Incrementando contador para user: ${userId} (key: ${key})`);
    const newValue = await redis.incr(key);
    logger.debug(`${TAG} Contador incrementado para user ${userId}. Novo valor: ${newValue}`);
  } catch (error) {
     logger.error(`${TAG} Erro para user ${userId}:`, error);
  }
}
