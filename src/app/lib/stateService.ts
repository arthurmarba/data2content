// @/app/lib/stateService.ts - v1.8.0 (Memória Ativa - Adiciona currentTask)
// - ADICIONADO: Interface CurrentTask e campo 'currentTask?: CurrentTask' à IDialogueState.
// - Mantém funcionalidades da v1.7.1.
// ATUALIZADO: v1.8.1 (ou sua próxima versão) - Adicionado expertiseInferenceTurnCounter à IDialogueState.

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

/**
 * NOVO: Interface para definir a estrutura de uma tarefa ativa.
 */
export interface CurrentTask {
  name: string; // Nome da tarefa/intenção principal (ex: 'content_plan', 'detailed_report_analysis')
  objective?: string; // Objetivo específico fornecido pelo usuário ou inferido para esta tarefa
  parameters?: Record<string, any>; // Parâmetros coletados ou necessários para a tarefa
  currentStep?: string; // Etapa atual dentro de uma tarefa de múltiplos passos
  // Outros campos relevantes para a tarefa podem ser adicionados aqui
}

// ATUALIZADO v1.8.1 (ou sua próxima versão): Interface IDialogueState para incluir expertiseInferenceTurnCounter
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
  currentTask?: CurrentTask | null; // ADICIONADO na v1.8.0: Para rastrear a tarefa complexa ativa
  expertiseInferenceTurnCounter?: number; // <<< ADICIONADO: Para inferência de nível de expertise >>>
}

export async function getDialogueState(userId: string): Promise<IDialogueState> {
  const TAG = '[stateService][getDialogueState v1.8.1]'; // Versão atualizada
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
      // Assegura que o objeto retornado está em conformidade com a interface IDialogueState atualizada
      const parsedData = JSON.parse(data);
      // Adiciona valores padrão para novos campos se eles não existirem nos dados antigos do Redis
      return {
        expertiseInferenceTurnCounter: 0, // Garante que o campo exista com um valor padrão
        ...parsedData // Sobrescreve com os dados do Redis, se existirem
      } as IDialogueState;
    } catch (parseError) {
      logger.error(`${TAG} Erro ao parsear JSON do estado para ${userId}:`, parseError);
      return { expertiseInferenceTurnCounter: 0 }; // Retorna com o campo padrão em caso de erro de parse
    }
  } catch (error) {
     logger.error(`${TAG} Erro ao buscar estado no Redis para user ${userId}:`, error);
     return { expertiseInferenceTurnCounter: 0 }; // Retorna com o campo padrão em caso de erro de Redis
  }
}

/**
 * Atualiza o estado do diálogo para um usuário, mesclando o novo estado parcial com o existente.
 */
export async function updateDialogueState(userId: string, newState: Partial<IDialogueState>): Promise<void> {
   const TAG = '[stateService][updateDialogueState v1.8.1]'; // Versão atualizada
   const key = `state:${userId}`;
   try {
    const redis = getClient();
    const currentState = await getDialogueState(userId); // getDialogueState agora garante que expertiseInferenceTurnCounter exista
    const mergedState = { ...currentState, ...newState }; 
    
    if (newState.hasOwnProperty('currentTask') && newState.currentTask === null) {
        mergedState.currentTask = null; 
        logger.debug(`${TAG} Campo 'currentTask' explicitamente definido como null para user: ${userId}.`);
    }

    const stateJson = JSON.stringify(mergedState);
    logger.debug(`${TAG} Atualizando estado para user: ${userId} (key: ${key}), novo estado parcial: ${JSON.stringify(newState)}, estado mesclado tamanho: ${stateJson.length}`);
    await redis.set(key, stateJson);
    logger.debug(`${TAG} Estado mesclado e atualizado para user ${userId}.`);
  } catch (error) {
     logger.error(`${TAG} Erro ao atualizar estado para user ${userId}:`, error);
  }
}

/**
 * Limpa os campos de ação pendente do estado do diálogo.
 * Nota: conversationSummary, summaryTurnCounter, currentTask e expertiseInferenceTurnCounter são mantidos.
 */
export async function clearPendingActionState(userId: string): Promise<void> {
    const TAG = '[stateService][clearPendingActionState v1.8.1]'; // Versão atualizada
    try {
        const currentState = await getDialogueState(userId); // getDialogueState agora garante que expertiseInferenceTurnCounter exista
        // Cria um novo objeto de estado sem as chaves de ação pendente
        // conversationSummary, summaryTurnCounter, currentTask e expertiseInferenceTurnCounter são mantidos.
        const { lastAIQuestionType, pendingActionContext, ...restOfState } = currentState;
        
        if (lastAIQuestionType !== undefined || pendingActionContext !== undefined) {
            const newStateToSave: IDialogueState = { 
                ...restOfState, // restOfState já contém expertiseInferenceTurnCounter de currentState
                lastAIQuestionType: undefined, 
                pendingActionContext: undefined 
            };
            const newStateJson = JSON.stringify(newStateToSave);
            const key = `state:${userId}`;
            const redis = getClient();
            await redis.set(key, newStateJson);
            logger.info(`${TAG} Estado de ação pendente limpo para user ${userId}. Outros campos como summary, currentTask e expertiseCounter foram mantidos.`);
        } else {
            logger.debug(`${TAG} Nenhum estado de ação pendente para limpar para user ${userId}.`);
        }
    } catch (error) {
        logger.error(`${TAG} Erro ao limpar estado de ação pendente para user ${userId}:`, error);
    }
}


// --- Histórico de Conversas (sem alterações na lógica) ---

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
