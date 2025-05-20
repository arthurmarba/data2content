// @/app/lib/stateService.ts - v1.9.5 (Adiciona lastRadarAlertType ao IDialogueState)
// - MODIFICADO: Interface IDialogueState agora inclui lastRadarAlertType.
// - MODIFICADO: Função getDefaultDialogueState agora inicializa lastRadarAlertType.
// - Mantém funcionalidades da v1.9.4.

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
  const TAG = '[stateService][getFromCache v1.9.5]'; // Atualizado para v1.9.5 para consistência, embora a lógica não tenha mudado.
  try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando chave: ${key}`);
    const value = await redis.get<string | null>(key);
    if (value !== null && typeof value === 'string') {
        logger.debug(`${TAG} Resultado para ${key}: ${value.slice(0, 50)}...`);
        return value;
    } else if (value !== null) {
        logger.warn(`${TAG} Resultado para ${key} (tipo inesperado): ${typeof value}. Retornando null.`);
        return null;
    }
    else {
        logger.debug(`${TAG} Resultado para ${key}: null`);
        return null;
    }
  } catch (error) {
     logger.error(`${TAG} Erro para key ${key}:`, error);
     return null;
  }
}

export async function setInCache(key: string, value: string, ttlSeconds: number): Promise<void> {
   const TAG = '[stateService][setInCache v1.9.5]'; // Atualizado para v1.9.5
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
  currentProcessingMessageId?: string | null;
  interruptSignalForMessageId?: string | null;
  currentProcessingQueryExcerpt?: string | null;

  // --- CAMPO ADICIONADO PARA O RADAR TUCA ---
  lastRadarAlertType?: string | null; // Armazena o tipo do último alerta do radar enviado na sessão atual
}

/**
 * MODIFICADO v1.9.5: Função agora inicializa lastRadarAlertType.
 * Retorna o estado de diálogo padrão.
 */
export const getDefaultDialogueState = (): IDialogueState => ({ 
    summaryTurnCounter: 0,
    expertiseInferenceTurnCounter: 0,
    lastInteraction: undefined,
    lastGreetingSent: undefined,
    recentPlanIdeas: null,
    recentPlanTimestamp: undefined,
    lastOfferedScriptIdea: null,
    lastAIQuestionType: undefined,
    pendingActionContext: null,
    conversationSummary: undefined,
    currentTask: null,
    currentProcessingMessageId: null,
    interruptSignalForMessageId: null,
    currentProcessingQueryExcerpt: null,
    // --- INICIALIZAÇÃO DO NOVO CAMPO ---
    lastRadarAlertType: null, // Ou undefined, dependendo da preferência
});

export async function getDialogueState(userId: string): Promise<IDialogueState> {
  const TAG = '[stateService][getDialogueState v1.9.5]'; // Atualizado para v1.9.5
  const key = `state:${userId}`;
  let rawDataFromRedis: unknown = null;
  try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando estado para user: ${userId} (key: ${key})`);
    rawDataFromRedis = await redis.get(key);

    if (rawDataFromRedis === null || rawDataFromRedis === undefined) {
        logger.debug(`${TAG} Nenhum estado encontrado para user: ${userId}. Retornando estado padrão.`);
        return getDefaultDialogueState(); 
    }

    if (typeof rawDataFromRedis === 'object' && !Array.isArray(rawDataFromRedis)) {
        logger.debug(`${TAG} Estado encontrado para user: ${userId} (já como objeto), mesclando com padrões.`);
        // Garante que o estado retornado sempre tenha todas as chaves de getDefaultDialogueState
        const defaultState = getDefaultDialogueState();
        const currentState = rawDataFromRedis as Partial<IDialogueState>; // Cast para Partial para segurança
        return {
            ...defaultState,
            ...currentState // Sobrescreve defaults com valores do Redis
        };
    }

    if (typeof rawDataFromRedis === 'string') {
        logger.debug(`${TAG} Estado encontrado para user: ${userId} (${rawDataFromRedis.length} chars como string), parseando JSON...`);
        try {
          const parsedData = JSON.parse(rawDataFromRedis);
          if (typeof parsedData === 'object' && parsedData !== null) {
            // Garante que o estado retornado sempre tenha todas as chaves de getDefaultDialogueState
            const defaultState = getDefaultDialogueState();
            return {
              ...defaultState,
              ...parsedData // Sobrescreve defaults com valores parseados
            } as IDialogueState;
          } else {
            logger.error(`${TAG} JSON parseado do estado (string) para ${userId} não resultou em um objeto. Data: "${rawDataFromRedis.substring(0,200)}..."`);
            return getDefaultDialogueState();
          }
        } catch (parseError: any) {
          const dataSnippet = rawDataFromRedis.substring(0, 200);
          logger.error(`${TAG} Erro ao parsear JSON do estado (string) para ${userId}: ${parseError.message}. Data (início): "${dataSnippet}..."`);
          return getDefaultDialogueState();
        }
    }

    logger.warn(`${TAG} Tipo de dado inesperado (${typeof rawDataFromRedis}) recebido do Redis para estado do user ${userId}. Retornando estado padrão. Conteúdo (início): ${String(rawDataFromRedis).substring(0,100)}`);
    return getDefaultDialogueState();

  } catch (error: any) {
     logger.error(`${TAG} Erro GERAL ao buscar estado no Redis para user ${userId}:`, error);
     return getDefaultDialogueState();
  }
}

export async function updateDialogueState(userId: string, newStatePartial: Partial<IDialogueState>): Promise<void> {
   const TAG = '[stateService][updateDialogueState v1.9.5]'; // Atualizado para v1.9.5
   const key = `state:${userId}`;
   try {
    const redis = getClient();
    // É crucial buscar o estado atual para mesclar corretamente, especialmente se getDefaultDialogueState evoluir.
    const currentState = await getDialogueState(userId); // getDialogueState já retorna o estado mesclado com defaults.

    const mergedState: IDialogueState = {
        ...currentState, // Inicia com o estado atual (que já inclui defaults para campos não presentes no Redis)
        ...newStatePartial // Aplica as atualizações parciais
    };

    // Lógica para garantir que 'null' explícito em newStatePartial realmente defina o campo como null
    // em vez de ser sobrescrito pelo default se o default for, por exemplo, undefined.
    // A lógica atual de getDialogueState + merge já deve lidar bem com isso,
    // pois getDefaultDialogueState() é a base.
    // Apenas precisamos garantir que, se newStatePartial tem uma chave, ela prevaleça.
    // O spread operator (...currentState, ...newStatePartial) já faz isso.

    // Se lastInteraction não for explicitamente passado em newStatePartial, atualize-o.
    if (!newStatePartial.hasOwnProperty('lastInteraction')) {
        mergedState.lastInteraction = Date.now();
    }
    // Se lastRadarAlertType não for explicitamente passado, mantém o valor atual (que pode ter vindo do Redis ou do default).
    // Se for passado em newStatePartial (ex: para limpar ou definir), ele será usado.

    const stateJson = JSON.stringify(mergedState);
    logger.debug(`${TAG} Atualizando estado para user: ${userId} (key: ${key}). Estado parcial recebido: ${JSON.stringify(newStatePartial)}. Estado mesclado (início): ${stateJson.substring(0,200)}...`);
    await redis.set(key, stateJson, { ex: 60 * 60 * 24 * 2 }); // TTL de 2 dias
    logger.info(`${TAG} Estado mesclado e atualizado para user ${userId}.`);
  } catch (error: any) {
     logger.error(`${TAG} Erro ao atualizar estado para user ${userId}:`, error);
  }
}

export async function clearPendingActionState(userId: string): Promise<void> {
    const TAG = '[stateService][clearPendingActionState v1.9.5]'; // Atualizado para v1.9.5
    logger.debug(`${TAG} Limpando estado de ação pendente para User ${userId}.`);
    await updateDialogueState(userId, {
        lastAIQuestionType: undefined, // Limpa
        pendingActionContext: undefined, // Limpa
    });
    logger.info(`${TAG} Solicitação para limpar estado de ação pendente enviada para user ${userId}.`);
}

export async function getConversationHistory(
  userId: string
): Promise<ChatCompletionMessageParam[]> {
   const TAG = '[stateService][getConversationHistory v1.9.5]'; // Atualizado para v1.9.5
   const key = `history:${userId}`;
   let rawHistoryData: unknown = null;
   try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando histórico para user: ${userId} (key: ${key})`);
    rawHistoryData = await redis.get(key);

    if (rawHistoryData === null || rawHistoryData === undefined) {
      logger.debug(`${TAG} Nenhum histórico JSON encontrado para user ${userId}. Retornando array vazio.`);
      return [];
    }

    if (Array.isArray(rawHistoryData)) {
        logger.debug(`${TAG} Histórico encontrado para user: ${userId} (já como array com ${rawHistoryData.length} mensagens).`);
        if (rawHistoryData.every(item => typeof item === 'object' && item !== null && 'role' in item && 'content' in item)) {
            return rawHistoryData as ChatCompletionMessageParam[];
        } else {
            logger.error(`${TAG} Histórico (já como array) para ${userId} contém elementos inválidos.`);
            return [];
        }
    }

    if (typeof rawHistoryData === 'string') {
        logger.debug(`${TAG} Histórico JSON encontrado (${rawHistoryData.length} chars como string), parseando...`);
        try {
          const historyArray = JSON.parse(rawHistoryData);
          if (!Array.isArray(historyArray)) {
              const historySnippet = rawHistoryData.substring(0,200);
              logger.error(`${TAG} Dado do histórico (string) para ${userId} não é um array após parse JSON. Data (início): "${historySnippet}..."`);
              return [];
          }
           if (historyArray.every(item => typeof item === 'object' && item !== null && 'role' in item && 'content' in item)) {
                logger.debug(`${TAG} Histórico parseado com sucesso (${historyArray.length} mensagens) para user ${userId}.`);
                return historyArray as ChatCompletionMessageParam[];
           } else {
                logger.error(`${TAG} Histórico (parseado de string) para ${userId} contém elementos inválidos após parse.`);
                return [];
           }
        } catch (parseError: any) {
          const historySnippet = rawHistoryData.substring(0,200);
          logger.error(`${TAG} Erro ao parsear JSON do histórico (string) para ${userId}: ${parseError.message}. Data (início): "${historySnippet}..."`);
          return [];
        }
    }

    logger.warn(`${TAG} Tipo de dado inesperado (${typeof rawHistoryData}) recebido do Redis para histórico do user ${userId}. Retornando array vazio. Conteúdo (início): ${String(rawHistoryData).substring(0,100)}`);
    return [];

  } catch (error: any) {
     logger.error(`${TAG} Erro GERAL ao buscar histórico no Redis para user ${userId}:`, error);
     return [];
  }
}

export async function setConversationHistory(
    userId: string,
    history: ChatCompletionMessageParam[]
): Promise<void> {
  const TAG = '[stateService][setConversationHistory v1.9.5]'; // Atualizado para v1.9.5
  const key = `history:${userId}`;
  try {
    const redis = getClient();
    const historyJson = JSON.stringify(history);
    logger.debug(`${TAG} Definindo histórico JSON para user: ${userId} (key: ${key}), ${history.length} mensagens, tamanho JSON: ${historyJson.length}`);
    await redis.set(key, historyJson, { ex: 60 * 60 * 24 * 2 }); // TTL de 2 dias
    logger.info(`${TAG} Histórico JSON definido para user ${userId}.`);
  } catch (error: any) {
     logger.error(`${TAG} Erro ao salvar histórico JSON no Redis para user ${userId}:`, error);
  }
}

export async function incrementUsageCounter(userId: string): Promise<void> {
   const TAG = '[stateService][incrementUsageCounter v1.9.5]'; // Atualizado para v1.9.5
   const key = `usage:${userId}`;
   try {
    const redis = getClient();
    logger.debug(`${TAG} Incrementando contador para user: ${userId} (key: ${key})`);
    const newValue = await redis.incr(key);
    await redis.expire(key, 60 * 60 * 24 * 7); // TTL de 7 dias
    logger.debug(`${TAG} Contador incrementado para user ${userId}. Novo valor: ${newValue}`);
  } catch (error: any) {
     logger.error(`${TAG} Erro ao incrementar contador de uso para user ${userId}:`, error);
  }
}
