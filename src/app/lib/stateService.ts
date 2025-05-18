// @/app/lib/stateService.ts - v1.9.0 (Correção de Parse JSON)
// - CORRIGIDO: getDialogueState retorna um estado padrão mais completo em caso de erro/ausência de dados.
// - CORRIGIDO: Melhorado o logging de erro em getDialogueState e getConversationHistory ao falhar o parse do JSON.
// - Mantém funcionalidades da v1.8.1.

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
  const TAG = '[stateService][getFromCache v1.9.0]';
  try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando chave: ${key}`);
    const value = await redis.get<string>(key);
    if (value !== null) { // Log only if value is not null
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
   const TAG = '[stateService][setInCache v1.9.0]';
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

// Define um estado padrão completo para ser usado em caso de falha ou ausência de dados
const getDefaultDialogueState = (): IDialogueState => ({
    summaryTurnCounter: 0,
    expertiseInferenceTurnCounter: 0,
    // Outros campos podem ter seus padrões aqui se necessário, ex:
    // lastInteraction: undefined, 
    // currentTask: null,
});

export async function getDialogueState(userId: string): Promise<IDialogueState> {
  const TAG = '[stateService][getDialogueState v1.9.0]'; 
  const key = `state:${userId}`;
  try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando estado para user: ${userId} (key: ${key})`);
    const data = await redis.get<string>(key); // data is string | null

    if (!data) {
        logger.debug(`${TAG} Nenhum estado encontrado para user: ${userId}. Retornando estado padrão.`);
        return getDefaultDialogueState(); 
    }

    logger.debug(`${TAG} Estado encontrado para user: ${userId} (${data.length} chars), parseando JSON...`);
    try {
      const parsedData = JSON.parse(data);
      // Garante que os contadores essenciais existam, usando o default se não estiverem no objeto parseado.
      return {
        ...getDefaultDialogueState(), // Começa com os padrões
        ...parsedData                // Sobrescreve com os dados do Redis
      } as IDialogueState;
    } catch (parseError: any) {
      logger.error(`${TAG} Erro ao parsear JSON do estado para ${userId}: ${parseError.message}. Data (início): "${data.substring(0, 200)}..."`);
      // Em caso de erro de parse, considera o dado corrompido e retorna o padrão.
      // Opcional: deletar a chave corrompida do Redis: await redis.del(key);
      return getDefaultDialogueState(); 
    }
  } catch (error: any) {
     logger.error(`${TAG} Erro ao buscar estado no Redis para user ${userId}:`, error);
     return getDefaultDialogueState(); 
  }
}

export async function updateDialogueState(userId: string, newStatePartial: Partial<IDialogueState>): Promise<void> {
   const TAG = '[stateService][updateDialogueState v1.9.0]'; 
   const key = `state:${userId}`;
   try {
    const redis = getClient();
    // getDialogueState agora retorna um estado completo e válido, mesmo que tenha que usar o padrão.
    const currentState = await getDialogueState(userId); 
    
    const mergedState: IDialogueState = { 
        ...currentState, 
        ...newStatePartial // Aplica as atualizações parciais
    }; 
    
    // Trata explicitamente a limpeza de currentTask se newStatePartial.currentTask for null
    if (newStatePartial.hasOwnProperty('currentTask') && newStatePartial.currentTask === null) {
        mergedState.currentTask = null; 
        logger.debug(`${TAG} Campo 'currentTask' explicitamente definido como null para user: ${userId}.`);
    }

    // Garante que lastInteraction seja sempre atualizado se não estiver no newStatePartial
    if (!newStatePartial.lastInteraction) {
        mergedState.lastInteraction = Date.now();
    }

    const stateJson = JSON.stringify(mergedState); // Isso já estava correto.
    logger.debug(`${TAG} Atualizando estado para user: ${userId} (key: ${key}). Estado parcial recebido: ${JSON.stringify(newStatePartial)}. Estado mesclado (início): ${stateJson.substring(0,200)}...`);
    await redis.set(key, stateJson); // Defina uma expiração se apropriado, ex: { ex: 60 * 60 * 24 * 2 } para 2 dias
    logger.info(`${TAG} Estado mesclado e atualizado para user ${userId}.`);
  } catch (error: any) {
     logger.error(`${TAG} Erro ao atualizar estado para user ${userId}:`, error);
  }
}

export async function clearPendingActionState(userId: string): Promise<void> {
    const TAG = '[stateService][clearPendingActionState v1.9.0]'; 
    logger.debug(`${TAG} Limpando estado de ação pendente para User ${userId}.`);
    // updateDialogueState lida com a mesclagem e garante que outros campos sejam preservados.
    await updateDialogueState(userId, {
        lastAIQuestionType: undefined, // Explicitamente undefined para limpar
        pendingActionContext: undefined, // Explicitamente undefined para limpar
    });
    // O log dentro de updateDialogueState já indicará a atualização.
    // Se quiser um log específico aqui, pode adicionar.
    logger.info(`${TAG} Solicitação para limpar estado de ação pendente enviada para user ${userId}.`);
}


// --- Histórico de Conversas ---

export async function getConversationHistory(
  userId: string
): Promise<ChatCompletionMessageParam[]> {
   const TAG = '[stateService][getConversationHistory v1.9.0]';
   const key = `history:${userId}`;
   try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando histórico para user: ${userId} (key: ${key})`);
    const historyJson = await redis.get<string>(key); // historyJson is string | null

    if (!historyJson) {
      logger.debug(`${TAG} Nenhum histórico JSON encontrado para user ${userId}. Retornando array vazio.`);
      return [];
    }

    logger.debug(`${TAG} Histórico JSON encontrado (${historyJson.length} chars), parseando...`);
    try {
      const historyArray = JSON.parse(historyJson);
      if (!Array.isArray(historyArray)) {
          logger.error(`${TAG} Dado do histórico para ${userId} não é um array após parse JSON. Data (início): "${historyJson.substring(0,200)}..."`);
          // Opcional: deletar a chave corrompida: await redis.del(key);
          return [];
      }
      logger.debug(`${TAG} Histórico parseado com sucesso (${historyArray.length} mensagens) para user ${userId}.`);
      return historyArray as ChatCompletionMessageParam[];
    } catch (parseError: any) {
      logger.error(`${TAG} Erro ao parsear JSON do histórico para ${userId}: ${parseError.message}. Data (início): "${historyJson.substring(0,200)}..."`);
      // Opcional: deletar a chave corrompida: await redis.del(key);
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
  const TAG = '[stateService][setConversationHistory v1.9.0]';
  const key = `history:${userId}`;
  try {
    const redis = getClient();
    const historyJson = JSON.stringify(history); // Isso já estava correto.
    logger.debug(`${TAG} Definindo histórico JSON para user: ${userId} (key: ${key}), ${history.length} mensagens, tamanho JSON: ${historyJson.length}`);
    await redis.set(key, historyJson); // Defina uma expiração se apropriado, ex: { ex: 60 * 60 * 24 * 2 }
    logger.info(`${TAG} Histórico JSON definido para user ${userId}.`);
  } catch (error: any) {
     logger.error(`${TAG} Erro ao salvar histórico JSON no Redis para user ${userId}:`, error);
  }
}

// --- Contador de Uso ---

export async function incrementUsageCounter(userId: string): Promise<void> {
   const TAG = '[stateService][incrementUsageCounter v1.9.0]';
   // Nota: A chave original era `usage:${userId}`. Se você quiser contadores diários,
   // a chave `usage:${userId}:${new Date().toISOString().slice(0, 10)}` do exemplo anterior é uma boa ideia.
   // Vou manter a chave original por enquanto, conforme seu arquivo.
   const key = `usage:${userId}`; 
   try {
    const redis = getClient();
    logger.debug(`${TAG} Incrementando contador para user: ${userId} (key: ${key})`);
    const newValue = await redis.incr(key);
    // Considere adicionar uma expiração para este contador se ele não deve viver para sempre.
    // Ex: await redis.expire(key, 60 * 60 * 24 * 7); // Expira em 7 dias
    logger.debug(`${TAG} Contador incrementado para user ${userId}. Novo valor: ${newValue}`);
  } catch (error: any) {
     logger.error(`${TAG} Erro ao incrementar contador de uso para user ${userId}:`, error);
  }
}
