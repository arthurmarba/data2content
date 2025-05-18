// @/app/lib/stateService.ts - v1.9.1 (Correção de Log de Erro)
// - CORRIGIDO: Prevenção de erro 'substring is not a function' nos logs de erro de parse JSON,
//   garantindo que a variável seja uma string antes de usar .substring().
// - Mantém funcionalidades da v1.9.0.

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
    redisClient = null; // Reset client on failure so it can be retried
    throw error;
  }
}

// --- Cache ---

export async function getFromCache(key: string): Promise<string | null> {
  const TAG = '[stateService][getFromCache v1.9.1]';
  try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando chave: ${key}`);
    const value = await redis.get<string>(key);
    if (value !== null) { 
        logger.debug(`${TAG} Resultado para ${key}: ${value.slice(0, 50)}...`);
    } else {
        logger.debug(`${TAG} Resultado para ${key}: null`);
    }
    return value;
  } catch (error) {
     logger.error(`${TAG} Erro para key ${key}:`, error);
     return null;
  }
}

export async function setInCache(key: string, value: string, ttlSeconds: number): Promise<void> {
   const TAG = '[stateService][setInCache v1.9.1]';
   try {
    const redis = getClient();
    logger.debug(`${TAG} Definindo chave: ${key} com TTL: ${ttlSeconds}s`);
    await redis.set(key, value, { ex: ttlSeconds });
    logger.debug(`${TAG} Chave ${key} definida com sucesso.`);
  } catch (error) {
     logger.error(`${TAG} Erro para key ${key}:`, error);
  }
}

// --- Estado do Diálogo ---

export interface CurrentTask {
  name: string; 
  objective?: string; 
  parameters?: Record<string, any>; 
  currentStep?: string; 
}

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
  lastAIQuestionType?: 'confirm_fetch_day_stats' | 'confirm_another_action' | 'clarify_community_inspiration_objective' | string; 
  pendingActionContext?: Record<string, any> | string | null; 
  conversationSummary?: string; 
  summaryTurnCounter?: number;  
  currentTask?: CurrentTask | null; 
  expertiseInferenceTurnCounter?: number; 
}

const getDefaultDialogueState = (): IDialogueState => ({
    summaryTurnCounter: 0,
    expertiseInferenceTurnCounter: 0,
});

export async function getDialogueState(userId: string): Promise<IDialogueState> {
  const TAG = '[stateService][getDialogueState v1.9.1]'; 
  const key = `state:${userId}`;
  let rawDataFromRedis: string | null = null; // Variável para armazenar o dado bruto para logging no catch
  try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando estado para user: ${userId} (key: ${key})`);
    rawDataFromRedis = await redis.get<string>(key); 

    if (!rawDataFromRedis) {
        logger.debug(`${TAG} Nenhum estado encontrado para user: ${userId}. Retornando estado padrão.`);
        return getDefaultDialogueState(); 
    }

    // Log do tamanho dos dados ANTES de tentar o parse
    logger.debug(`${TAG} Estado encontrado para user: ${userId} (${rawDataFromRedis.length} chars), parseando JSON...`);
    try {
      const parsedData = JSON.parse(rawDataFromRedis);
      return {
        ...getDefaultDialogueState(), 
        ...parsedData                
      } as IDialogueState;
    } catch (parseError: any) {
      // CORREÇÃO: Usar rawDataFromRedis que sabemos que é string (ou null, já tratado)
      const dataSnippet = typeof rawDataFromRedis === 'string' ? rawDataFromRedis.substring(0, 200) : 'N/A (data not a string or null)';
      logger.error(`${TAG} Erro ao parsear JSON do estado para ${userId}: ${parseError.message}. Data (início): "${dataSnippet}..."`);
      return getDefaultDialogueState(); 
    }
  } catch (error: any) {
     logger.error(`${TAG} Erro ao buscar estado no Redis para user ${userId}:`, error);
     return getDefaultDialogueState(); 
  }
}

export async function updateDialogueState(userId: string, newStatePartial: Partial<IDialogueState>): Promise<void> {
   const TAG = '[stateService][updateDialogueState v1.9.1]'; 
   const key = `state:${userId}`;
   try {
    const redis = getClient();
    const currentState = await getDialogueState(userId); 
    
    const mergedState: IDialogueState = { 
        ...currentState, 
        ...newStatePartial 
    }; 
    
    if (newStatePartial.hasOwnProperty('currentTask') && newStatePartial.currentTask === null) {
        mergedState.currentTask = null; 
        logger.debug(`${TAG} Campo 'currentTask' explicitamente definido como null para user: ${userId}.`);
    }

    if (!newStatePartial.lastInteraction) {
        mergedState.lastInteraction = Date.now();
    }

    const stateJson = JSON.stringify(mergedState); 
    logger.debug(`${TAG} Atualizando estado para user: ${userId} (key: ${key}). Estado parcial recebido: ${JSON.stringify(newStatePartial)}. Estado mesclado (início): ${stateJson.substring(0,200)}...`);
    await redis.set(key, stateJson, { ex: 60 * 60 * 24 * 2 }); // Adicionada expiração de 2 dias
    logger.info(`${TAG} Estado mesclado e atualizado para user ${userId}.`);
  } catch (error: any) {
     logger.error(`${TAG} Erro ao atualizar estado para user ${userId}:`, error);
  }
}

export async function clearPendingActionState(userId: string): Promise<void> {
    const TAG = '[stateService][clearPendingActionState v1.9.1]'; 
    logger.debug(`${TAG} Limpando estado de ação pendente para User ${userId}.`);
    await updateDialogueState(userId, {
        lastAIQuestionType: undefined, 
        pendingActionContext: undefined, 
    });
    logger.info(`${TAG} Solicitação para limpar estado de ação pendente enviada para user ${userId}.`);
}


// --- Histórico de Conversas ---

export async function getConversationHistory(
  userId: string
): Promise<ChatCompletionMessageParam[]> {
   const TAG = '[stateService][getConversationHistory v1.9.1]';
   const key = `history:${userId}`;
   let rawHistoryJson: string | null = null; // Variável para armazenar o dado bruto
   try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando histórico para user: ${userId} (key: ${key})`);
    rawHistoryJson = await redis.get<string>(key); 

    if (!rawHistoryJson) {
      logger.debug(`${TAG} Nenhum histórico JSON encontrado para user ${userId}. Retornando array vazio.`);
      return [];
    }

    logger.debug(`${TAG} Histórico JSON encontrado (${rawHistoryJson.length} chars), parseando...`);
    try {
      const historyArray = JSON.parse(rawHistoryJson);
      if (!Array.isArray(historyArray)) {
          // CORREÇÃO: Usar rawHistoryJson para o snippet
          const historySnippet = typeof rawHistoryJson === 'string' ? rawHistoryJson.substring(0,200) : 'N/A (history data not a string or null)';
          logger.error(`${TAG} Dado do histórico para ${userId} não é um array após parse JSON. Data (início): "${historySnippet}..."`);
          return [];
      }
      logger.debug(`${TAG} Histórico parseado com sucesso (${historyArray.length} mensagens) para user ${userId}.`);
      return historyArray as ChatCompletionMessageParam[];
    } catch (parseError: any) {
      // CORREÇÃO: Usar rawHistoryJson para o snippet
      const historySnippet = typeof rawHistoryJson === 'string' ? rawHistoryJson.substring(0,200) : 'N/A (history data not a string or null)';
      logger.error(`${TAG} Erro ao parsear JSON do histórico para ${userId}: ${parseError.message}. Data (início): "${historySnippet}..."`);
      return [];
    }
  } catch (error: any) {
     logger.error(`${TAG} Erro ao buscar histórico no Redis para user ${userId}:`, error);
     return [];
  }
}

export async function setConversationHistory(
    userId: string,
    history: ChatCompletionMessageParam[]
): Promise<void> {
  const TAG = '[stateService][setConversationHistory v1.9.1]';
  const key = `history:${userId}`;
  try {
    const redis = getClient();
    const historyJson = JSON.stringify(history); 
    logger.debug(`${TAG} Definindo histórico JSON para user: ${userId} (key: ${key}), ${history.length} mensagens, tamanho JSON: ${historyJson.length}`);
    await redis.set(key, historyJson, { ex: 60 * 60 * 24 * 2 }); // Adicionada expiração de 2 dias
    logger.info(`${TAG} Histórico JSON definido para user ${userId}.`);
  } catch (error: any) {
     logger.error(`${TAG} Erro ao salvar histórico JSON no Redis para user ${userId}:`, error);
  }
}

// --- Contador de Uso ---

export async function incrementUsageCounter(userId: string): Promise<void> {
   const TAG = '[stateService][incrementUsageCounter v1.9.1]';
   const key = `usage:${userId}`; 
   try {
    const redis = getClient();
    logger.debug(`${TAG} Incrementando contador para user: ${userId} (key: ${key})`);
    const newValue = await redis.incr(key);
    await redis.expire(key, 60 * 60 * 24 * 7); // Expira em 7 dias
    logger.debug(`${TAG} Contador incrementado para user ${userId}. Novo valor: ${newValue}`);
  } catch (error: any) {
     logger.error(`${TAG} Erro ao incrementar contador de uso para user ${userId}:`, error);
  }
}
