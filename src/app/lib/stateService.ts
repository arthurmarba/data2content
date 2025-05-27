// @/app/lib/stateService.ts - v1.9.12 (Implementa Fase 1 do Plano de Aprimoramento de Fallback Insights)
// - Adicionada interface IFallbackInsightHistoryEntry.
// - Adicionado campo fallbackInsightsHistory à IDialogueState.
// - Inicializado fallbackInsightsHistory em getDefaultDialogueState.
// - Baseado na v1.9.11.

import dotenv from 'dotenv';
// Carrega variáveis de ambiente do .env.local (ou .env se .env.local não existir ou não tiver as vars)
// É importante que isso seja feito antes que UPSTASH_URL e UPSTASH_TOKEN sejam lidos de process.env
dotenv.config({ path: '.env.local' });

import { Redis } from '@upstash/redis';
import { logger } from '@/app/lib/logger';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Removida a definição de UPSTASH_URL e UPSTASH_TOKEN como constantes globais do módulo aqui.
// Elas serão lidas dentro de getClient().

let redisClient: Redis | null = null;

// Função para inicializar e retornar o cliente (Singleton)
function getClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  // Ler as variáveis de ambiente DENTRO da função getClient
  const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    logger.error('[stateService][@upstash/redis] Variáveis UPSTASH_REDIS_REST_URL ou UPSTASH_REDIS_REST_TOKEN não definidas. Verifique .env.local e a inicialização do dotenv.');
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
  const TAG = '[stateService][getFromCache v1.9.12]'; // Version bump
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
   const TAG = '[stateService][setInCache v1.9.12]'; // Version bump
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

export interface ILastResponseContext {
  topic?: string;
  entities?: string[];
  referencedMetricId?: string;
  timestamp: number;
  wasQuestion?: boolean;
}

// NOVO: Interface para o histórico de insights de fallback (Passo 1.1)
export interface IFallbackInsightHistoryEntry {
  type: string;      // Identificador único do tipo de insight (ex: "follower_growth", "top_post")
  timestamp: number; // Timestamp de quando o insight foi enviado
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
  lastRadarAlertType?: string | null;
  lastResponseContext?: ILastResponseContext | null;
  fallbackInsightsHistory?: IFallbackInsightHistoryEntry[]; // NOVO CAMPO (Passo 1.1)
}

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
    lastRadarAlertType: null,
    lastResponseContext: null,
    fallbackInsightsHistory: [], // INICIALIZAÇÃO DO NOVO CAMPO (Passo 1.2)
});

export async function getDialogueState(userId: string): Promise<IDialogueState> {
  const TAG = '[stateService][getDialogueState v1.9.12]'; // Version bump
  const key = `state:${userId}`;
  let rawDataFromRedis: unknown = null;
  let finalStateToReturn: IDialogueState;

  try {
    const redis = getClient();
    logger.debug(`${TAG} User ${userId}: Buscando estado (key: ${key})`);
    rawDataFromRedis = await redis.get(key);

    if (rawDataFromRedis === null || rawDataFromRedis === undefined) {
        logger.debug(`${TAG} User ${userId}: Nenhum estado encontrado. Retornando estado padrão.`);
        finalStateToReturn = getDefaultDialogueState();
    } else if (typeof rawDataFromRedis === 'object' && !Array.isArray(rawDataFromRedis)) {
        logger.debug(`${TAG} User ${userId}: Estado encontrado (já como objeto), mesclando com padrões.`);
        const defaultState = getDefaultDialogueState(); // Garante que fallbackInsightsHistory: [] esteja no default
        const currentState = rawDataFromRedis as Partial<IDialogueState>;
        if (currentState.lastResponseContext && typeof currentState.lastResponseContext.wasQuestion !== 'boolean') {
            currentState.lastResponseContext.wasQuestion = undefined;
        }
        finalStateToReturn = {
            ...defaultState,
            ...currentState
        };
    } else if (typeof rawDataFromRedis === 'string') {
        logger.debug(`${TAG} User ${userId}: Estado encontrado (${rawDataFromRedis.length} chars como string), parseando JSON...`);
        try {
          const parsedData = JSON.parse(rawDataFromRedis) as Partial<IDialogueState>;
          if (typeof parsedData === 'object' && parsedData !== null) {
            const defaultState = getDefaultDialogueState(); // Garante que fallbackInsightsHistory: [] esteja no default
            if (parsedData.lastResponseContext && typeof parsedData.lastResponseContext.wasQuestion !== 'boolean') {
                parsedData.lastResponseContext.wasQuestion = undefined;
            }
            finalStateToReturn = {
              ...defaultState,
              ...parsedData
            } as IDialogueState;
          } else {
            logger.error(`${TAG} User ${userId}: JSON parseado do estado (string) não resultou em um objeto. Data: "${rawDataFromRedis.substring(0,200)}..."`);
            finalStateToReturn = getDefaultDialogueState();
          }
        } catch (parseError: any) {
          const dataSnippet = rawDataFromRedis.substring(0, 200);
          logger.error(`${TAG} User ${userId}: Erro ao parsear JSON do estado (string): ${parseError.message}. Data (início): "${dataSnippet}..."`);
          finalStateToReturn = getDefaultDialogueState();
        }
    } else {
        logger.warn(`${TAG} User ${userId}: Tipo de dado inesperado (${typeof rawDataFromRedis}) recebido do Redis para estado. Retornando estado padrão. Conteúdo (início): ${String(rawDataFromRedis).substring(0,100)}`);
        finalStateToReturn = getDefaultDialogueState();
    }

    // Verificação para Passo 1.3: Confirmar que o campo é inicializado como [] se não existir no Redis.
    // A lógica acima, ao mesclar com getDefaultDialogueState(), já garante isso.
    // Se fallbackInsightsHistory não vier do Redis, ele será preenchido com `[]` do defaultState.
    if (!finalStateToReturn.fallbackInsightsHistory) {
        logger.warn(`${TAG} User ${userId}: fallbackInsightsHistory não estava definido após mesclagem, definindo para array vazio. Isso não deveria ocorrer se getDefaultDialogueState() foi usado corretamente na mesclagem.`);
        finalStateToReturn.fallbackInsightsHistory = [];
    }


    if (finalStateToReturn.lastResponseContext) {
        const lrc = finalStateToReturn.lastResponseContext;
        logger.debug(`${TAG} User ${userId}: lastResponseContext recuperado - Timestamp: ${lrc.timestamp}, Topic: "${lrc.topic ? lrc.topic.substring(0,30) + '...' : 'N/A'}", WasQuestion: ${lrc.wasQuestion}`);
    } else {
        logger.debug(`${TAG} User ${userId}: Nenhum lastResponseContext no estado recuperado.`);
    }
    return finalStateToReturn;

  } catch (error: any) {
     logger.error(`${TAG} User ${userId}: Erro GERAL ao buscar estado no Redis:`, error);
     finalStateToReturn = getDefaultDialogueState();
     logger.debug(`${TAG} User ${userId}: Retornando estado padrão devido a erro. lastResponseContext será null.`);
     return finalStateToReturn;
  }
}

export async function updateDialogueState(userId: string, newStatePartial: Partial<IDialogueState>): Promise<void> {
   const TAG = '[stateService][updateDialogueState v1.9.12]'; // Version bump
   const key = `state:${userId}`;
   try {
    const redis = getClient();
    // MODIFICADO: getDialogueState já retorna um estado completo com padrões, incluindo fallbackInsightsHistory: [] se não existir.
    const currentState = await getDialogueState(userId);

    const mergedState: IDialogueState = {
        ...currentState, // currentState já tem fallbackInsightsHistory (potencialmente [])
        ...newStatePartial // newStatePartial pode ou não ter fallbackInsightsHistory
    };

    // Se newStatePartial.fallbackInsightsHistory for undefined, o valor de currentState.fallbackInsightsHistory (que é [] se não existia antes) será mantido.
    // Se newStatePartial.fallbackInsightsHistory for um array (mesmo que vazio), ele sobrescreverá.

    if (!newStatePartial.hasOwnProperty('lastInteraction')) {
        mergedState.lastInteraction = Date.now();
    }

    if (newStatePartial.lastResponseContext && typeof newStatePartial.lastResponseContext.wasQuestion !== 'boolean') {
        if (mergedState.lastResponseContext && typeof mergedState.lastResponseContext.wasQuestion !== 'boolean') {
             mergedState.lastResponseContext.wasQuestion = undefined;
        }
    }

    if (newStatePartial.lastResponseContext) {
        const lrcPartial = newStatePartial.lastResponseContext;
        logger.debug(`${TAG} User ${userId}: newStatePartial.lastResponseContext fornecido - Timestamp: ${lrcPartial.timestamp}, Topic: "${lrcPartial.topic ? lrcPartial.topic.substring(0,30) + '...' : 'N/A'}", WasQuestion: ${lrcPartial.wasQuestion}`);
    } else {
        logger.debug(`${TAG} User ${userId}: newStatePartial não continha lastResponseContext.`);
    }

    if (mergedState.lastResponseContext) {
        const lrcMerged = mergedState.lastResponseContext;
        logger.debug(`${TAG} User ${userId}: mergedState.lastResponseContext a ser salvo - Timestamp: ${lrcMerged.timestamp}, Topic: "${lrcMerged.topic ? lrcMerged.topic.substring(0,30) + '...' : 'N/A'}", WasQuestion: ${lrcMerged.wasQuestion}`);
    } else {
        logger.debug(`${TAG} User ${userId}: mergedState não contém lastResponseContext a ser salvo.`);
    }

    // Log do estado do fallbackInsightsHistory antes de salvar
    logger.debug(`${TAG} User ${userId}: fallbackInsightsHistory a ser salvo: ${JSON.stringify(mergedState.fallbackInsightsHistory)}`);


    const stateJson = JSON.stringify(mergedState);
    logger.debug(`${TAG} User ${userId}: Atualizando estado (key: ${key}). Estado parcial recebido (keys): ${Object.keys(newStatePartial).join(', ')}. Estado mesclado (início): ${stateJson.substring(0,200)}...`);
    await redis.set(key, stateJson, { ex: 60 * 60 * 24 * 2 }); // TTL de 2 dias
    logger.info(`${TAG} User ${userId}: Estado mesclado e atualizado.`);
  } catch (error: any) {
     logger.error(`${TAG} User ${userId}: Erro ao atualizar estado:`, error);
  }
}

export async function clearPendingActionState(userId: string): Promise<void> {
    const TAG = '[stateService][clearPendingActionState v1.9.12]'; // Version bump
    logger.debug(`${TAG} Limpando estado de ação pendente para User ${userId}.`);
    await updateDialogueState(userId, {
        lastAIQuestionType: undefined,
        pendingActionContext: undefined,
    });
    logger.info(`${TAG} Solicitação para limpar estado de ação pendente enviada para user ${userId}.`);
}

export async function getConversationHistory(
  userId: string
): Promise<ChatCompletionMessageParam[]> {
   const TAG = '[stateService][getConversationHistory v1.9.12]'; // Version bump
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
  const TAG = '[stateService][setConversationHistory v1.9.12]'; // Version bump
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
   const TAG = '[stateService][incrementUsageCounter v1.9.12]'; // Version bump
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
