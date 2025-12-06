// @/app/lib/stateService.ts - v1.9.15 (Refina schema Zod para fallbackInsightsHistory)
// - ATUALIZADO: IDialogueStateSchema agora usa .default([]) para fallbackInsightsHistory.
// - ATUALIZADO: Removida verificação redundante de fallbackInsightsHistory em getDialogueState.
// - Baseado na v1.9.14 (Adiciona validação de schema com Zod para dados do Redis).
// - CORRIGIDO: Erro de tipo em getConversationHistory (v1.9.16)

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import mongoose from 'mongoose';
import { Redis } from '@upstash/redis';
import { z } from 'zod'; // Importando Zod
import { logger } from '@/app/lib/logger';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import ThreadModel, { IThread } from '@/app/models/Thread';
import MessageModel, { IMessage } from '@/app/models/Message';
import { connectToDatabase } from '@/app/lib/mongoose';


let redisClient: Redis | null = null;

// Função para inicializar e retornar o cliente (Singleton)
function getClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

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
    redisClient = null;
    throw error;
  }
}

// --- Schemas Zod para Validação ---

const CurrentTaskSchema = z.object({
  name: z.string(),
  objective: z.string().optional(),
  parameters: z.record(z.any()).optional(),
  currentStep: z.string().optional(),
});
type CurrentTask = z.infer<typeof CurrentTaskSchema>;

const ILastResponseContextSchema = z.object({
  topic: z.string().optional(),
  entities: z.array(z.string()).optional(),
  referencedMetricId: z.string().optional(),
  timestamp: z.number(),
  wasQuestion: z.boolean().optional(),
});
type ILastResponseContext = z.infer<typeof ILastResponseContextSchema>;


const IFallbackInsightHistoryEntrySchema = z.object({
  type: z.string(),
  timestamp: z.number(),
});
type IFallbackInsightHistoryEntry = z.infer<typeof IFallbackInsightHistoryEntrySchema>;

const IDialogueStateSchema = z.object({
  lastInteraction: z.number().optional(),
  lastGreetingSent: z.number().optional(),
  recentPlanIdeas: z.array(z.object({ identifier: z.string(), description: z.string() })).nullable().optional(),
  recentPlanTimestamp: z.number().optional(),
  lastOfferedScriptIdea: z.object({
    aiGeneratedIdeaDescription: z.string(),
    originalSource: z.any(),
    timestamp: z.number(),
  }).nullable().optional(),
  lastAIQuestionType: z.union([
    z.literal('confirm_fetch_day_stats'),
    z.literal('confirm_another_action'),
    z.literal('clarify_community_inspiration_objective'),
    z.string()
  ]).optional(),
  pendingActionContext: z.record(z.any()).nullable().optional(),
  conversationSummary: z.string().optional(),
  summaryTurnCounter: z.number().optional(),
  currentTask: CurrentTaskSchema.nullable().optional(),
  expertiseInferenceTurnCounter: z.number().optional(),
  currentProcessingMessageId: z.string().nullable().optional(),
  interruptSignalForMessageId: z.string().nullable().optional(),
  currentProcessingQueryExcerpt: z.string().nullable().optional(),
  lastRadarAlertType: z.string().nullable().optional(),
  lastResponseContext: ILastResponseContextSchema.nullable().optional(),
  fallbackInsightsHistory: z.array(IFallbackInsightHistoryEntrySchema).default([]),
  lastResponseError: z.string().optional(),
});
type IDialogueState = z.infer<typeof IDialogueStateSchema>;

const ChatCompletionMessageParamSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'function', 'tool']),
  content: z.string().nullable(),
  name: z.string().optional(),
  function_call: z.any().optional(),
  tool_calls: z.any().optional(),
  tool_call_id: z.string().optional(),
});
const ConversationHistorySchema = z.array(ChatCompletionMessageParamSchema);


// --- Cache ---
export async function getFromCache(key: string): Promise<string | null> {
  const TAG = '[stateService][getFromCache v1.9.12]';
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
  const TAG = '[stateService][setInCache v1.9.12]';
  try {
    const redis = getClient();
    logger.debug(`${TAG} Definindo chave: ${key} com TTL: ${ttlSeconds}s`);
    await redis.set(key, value, { ex: ttlSeconds });
    logger.debug(`${TAG} Chave ${key} definida com sucesso.`);
  } catch (error) {
    logger.error(`${TAG} Erro para key ${key}:`, error);
  }
}

export async function deleteFromCache(key: string): Promise<void> {
  const TAG = '[stateService][deleteFromCache v1.9.17]';
  try {
    const redis = getClient();
    logger.debug(`${TAG} Deletando chave: ${key}`);
    await redis.del(key);
    logger.debug(`${TAG} Chave ${key} deletada com sucesso.`);
  } catch (error) {
    logger.error(`${TAG} Erro ao deletar key ${key}:`, error);
  }
}

// --- Estado do Diálogo ---

export type { CurrentTask, ILastResponseContext, IFallbackInsightHistoryEntry, IDialogueState };


export const getDefaultDialogueState = (): IDialogueState => ({
  summaryTurnCounter: 0,
  expertiseInferenceTurnCounter: 0,
  recentPlanIdeas: null,
  lastOfferedScriptIdea: null,
  pendingActionContext: null,
  currentTask: null,
  currentProcessingMessageId: null,
  interruptSignalForMessageId: null,
  currentProcessingQueryExcerpt: null,
  lastRadarAlertType: null,
  lastResponseContext: null,
  fallbackInsightsHistory: [],
  lastResponseError: undefined,
  lastInteraction: undefined,
  lastGreetingSent: undefined,
  recentPlanTimestamp: undefined,
  lastAIQuestionType: undefined,
  conversationSummary: undefined,
});

export async function getDialogueState(userId: string): Promise<IDialogueState> {
  const TAG = '[stateService][getDialogueState v1.9.15]';
  const key = `state:${userId}`;
  const defaultState = getDefaultDialogueState();
  let dataToValidate: unknown = null;

  try {
    const redis = getClient();
    logger.debug(`${TAG} User ${userId}: Buscando estado (key: ${key})`);
    const rawDataFromRedis = await redis.get(key);

    if (rawDataFromRedis === null || rawDataFromRedis === undefined) {
      logger.debug(`${TAG} User ${userId}: Nenhum estado encontrado no Redis. Retornando estado padrão.`);
      return defaultState;
    }

    if (typeof rawDataFromRedis === 'string') {
      logger.debug(`${TAG} User ${userId}: Estado encontrado (${String(rawDataFromRedis).length} chars como string), parseando JSON...`);
      try {
        dataToValidate = JSON.parse(rawDataFromRedis);
      } catch (parseError: any) {
        const dataSnippet = rawDataFromRedis.substring(0, 200);
        logger.error(`${TAG} User ${userId}: Erro ao parsear JSON do estado (string): ${parseError.message}. Data (início): "${dataSnippet}..." Retornando estado padrão.`);
        return defaultState;
      }
    } else {
      dataToValidate = rawDataFromRedis;
    }

    const validationResult = IDialogueStateSchema.safeParse(dataToValidate);
    if (validationResult.success) {
      logger.debug(`${TAG} User ${userId}: Estado validado com Zod com sucesso. Mesclando com padrões.`);
      const validatedState = { ...defaultState, ...validationResult.data };
      if (validatedState.lastResponseContext && typeof validatedState.lastResponseContext.wasQuestion !== 'boolean') {
        validatedState.lastResponseContext.wasQuestion = undefined;
      }
      if (validatedState.lastResponseContext) {
        const lrc = validatedState.lastResponseContext;
        logger.debug(`${TAG} User ${userId}: lastResponseContext recuperado - Timestamp: ${lrc.timestamp}, Topic: "${lrc.topic ? lrc.topic.substring(0, 30) + '...' : 'N/A'}", WasQuestion: ${lrc.wasQuestion}`);
      } else {
        logger.debug(`${TAG} User ${userId}: Nenhum lastResponseContext no estado recuperado.`);
      }
      return validatedState as IDialogueState;
    } else {
      logger.warn(`${TAG} User ${userId}: Estado do Redis falhou na validação Zod. Retornando estado padrão. Erros:`, validationResult.error.format());
      return defaultState;
    }

  } catch (error: any) {
    logger.error(`${TAG} User ${userId}: Erro GERAL ao buscar/validar estado no Redis:`, error);
    logger.debug(`${TAG} User ${userId}: Retornando estado padrão devido a erro geral.`);
    return defaultState;
  }
}

export async function updateDialogueState(userId: string, newStatePartial: Partial<IDialogueState>): Promise<void> {
  const TAG = '[stateService][updateDialogueState v1.9.15]';
  const key = `state:${userId}`;
  try {
    const redis = getClient();
    const currentState = await getDialogueState(userId);

    const mergedState: IDialogueState = {
      ...currentState,
      ...newStatePartial
    };

    if (!newStatePartial.hasOwnProperty('lastInteraction')) {
      mergedState.lastInteraction = Date.now();
    }

    if (newStatePartial.lastResponseContext && typeof newStatePartial.lastResponseContext.wasQuestion !== 'boolean') {
      if (mergedState.lastResponseContext) {
        mergedState.lastResponseContext.wasQuestion = undefined;
      }
    }

    if (newStatePartial.lastResponseContext) {
      const lrcPartial = newStatePartial.lastResponseContext;
      logger.debug(`${TAG} User ${userId}: newStatePartial.lastResponseContext fornecido - Timestamp: ${lrcPartial.timestamp}, Topic: "${lrcPartial.topic ? lrcPartial.topic.substring(0, 30) + '...' : 'N/A'}", WasQuestion: ${lrcPartial.wasQuestion}`);
    }
    if (mergedState.lastResponseContext) {
      const lrcMerged = mergedState.lastResponseContext;
      logger.debug(`${TAG} User ${userId}: mergedState.lastResponseContext a ser salvo - Timestamp: ${lrcMerged.timestamp}, Topic: "${lrcMerged.topic ? lrcMerged.topic.substring(0, 30) + '...' : 'N/A'}", WasQuestion: ${lrcMerged.wasQuestion}`);
    }

    logger.debug(`${TAG} User ${userId}: fallbackInsightsHistory a ser salvo: ${JSON.stringify(mergedState.fallbackInsightsHistory)}`);
    logger.debug(`${TAG} User ${userId}: lastResponseError a ser salvo: ${mergedState.lastResponseError}`);

    const validationResult = IDialogueStateSchema.safeParse(mergedState);
    if (!validationResult.success) {
      logger.error(`${TAG} User ${userId}: Estado mesclado FINAL falhou na validação Zod ANTES de salvar. Não salvando. Erros:`, validationResult.error.format());
      throw new Error("Estado mesclado inválido, não foi salvo no Redis.");
    }

    const stateJson = JSON.stringify(validationResult.data);
    logger.debug(`${TAG} User ${userId}: Atualizando estado (key: ${key}). Estado parcial recebido (keys): ${Object.keys(newStatePartial).join(', ')}. Estado mesclado (início): ${stateJson.substring(0, 200)}...`);
    await redis.set(key, stateJson, { ex: 60 * 60 * 24 * 2 });
    logger.info(`${TAG} User ${userId}: Estado mesclado, validado e atualizado.`);
  } catch (error: any) {
    logger.error(`${TAG} User ${userId}: Erro ao atualizar estado:`, error);
  }
}

export async function clearPendingActionState(userId: string): Promise<void> {
  const TAG = '[stateService][clearPendingActionState v1.9.12]';
  logger.debug(`${TAG} Limpando estado de ação pendente para User ${userId}.`);
  await updateDialogueState(userId, {
    lastAIQuestionType: undefined,
    pendingActionContext: null,
  });
  logger.info(`${TAG} Solicitação para limpar estado de ação pendente enviada para user ${userId}.`);
}

export async function getConversationHistory(
  userId: string
): Promise<ChatCompletionMessageParam[]> {
  const TAG = '[stateService][getConversationHistory v1.9.16]'; // Version updated for this fix
  const key = `history:${userId}`;
  try {
    const redis = getClient();
    logger.debug(`${TAG} Buscando histórico para user: ${userId} (key: ${key})`);
    const rawHistoryData = await redis.get(key);

    if (rawHistoryData === null || rawHistoryData === undefined) {
      logger.debug(`${TAG} Nenhum histórico JSON encontrado para user ${userId}. Retornando array vazio.`);
      return [];
    }

    let dataToValidate: unknown = null;
    if (typeof rawHistoryData === 'string') {
      logger.debug(`${TAG} Histórico JSON encontrado (${String(rawHistoryData).length} chars como string), parseando...`);
      try {
        dataToValidate = JSON.parse(rawHistoryData);
      } catch (parseError: any) {
        const historySnippet = rawHistoryData.substring(0, 200);
        logger.error(`${TAG} Erro ao parsear JSON do histórico (string) para ${userId}: ${parseError.message}. Data (início): "${historySnippet}..." Retornando [].`);
        return [];
      }
    } else {
      dataToValidate = rawHistoryData;
    }

    const validationResult = ConversationHistorySchema.safeParse(dataToValidate);
    if (validationResult.success) {
      logger.debug(`${TAG} Histórico validado com Zod com sucesso (${validationResult.data.length} mensagens) para user ${userId}.`);
      // CORREÇÃO APLICADA AQUI:
      return validationResult.data as ChatCompletionMessageParam[];
    } else {
      logger.warn(`${TAG} User ${userId}: Histórico do Redis falhou na validação Zod. Retornando array vazio. Erros:`, validationResult.error.format());
      return [];
    }

  } catch (error: any) {
    logger.error(`${TAG} Erro GERAL ao buscar/validar histórico no Redis para user ${userId}:`, error);
    return [];
  }
}

export async function setConversationHistory(
  userId: string,
  history: ChatCompletionMessageParam[]
): Promise<void> {
  const TAG = '[stateService][setConversationHistory v1.9.14]';
  const key = `history:${userId}`;
  try {
    const redis = getClient();
    // O tipo 'history' já é ChatCompletionMessageParam[], então a validação Zod aqui é mais para garantir
    // que a estrutura interna de cada mensagem ainda esteja correta antes de serializar.
    const validationResult = ConversationHistorySchema.safeParse(history);
    if (!validationResult.success) {
      logger.error(`${TAG} User ${userId}: Tentativa de salvar histórico inválido. Erros Zod:`, validationResult.error.format());
      // Considerar se deve lançar um erro ou apenas logar e retornar, dependendo da criticidade.
      return;
    }

    const historyJson = JSON.stringify(validationResult.data);
    logger.debug(`${TAG} Definindo histórico JSON para user: ${userId} (key: ${key}), ${validationResult.data.length} mensagens, tamanho JSON: ${historyJson.length}`);
    await redis.set(key, historyJson, { ex: 60 * 60 * 24 * 2 });
    logger.info(`${TAG} Histórico JSON validado e definido para user ${userId}.`);
  } catch (error: any) {
    logger.error(`${TAG} Erro ao salvar histórico JSON no Redis para user ${userId}:`, error);
  }
}

export async function incrementUsageCounter(userId: string): Promise<void> {
  const TAG = '[stateService][incrementUsageCounter v1.9.12]';
  const key = `usage:${userId}`;
  try {
    const redis = getClient();
    logger.debug(`${TAG} Incrementando contador para user: ${userId} (key: ${key})`);
    const newValue = await redis.incr(key);
    await redis.expire(key, 60 * 60 * 24 * 7);
    logger.debug(`${TAG} Contador incrementado para user ${userId}. Novo valor: ${newValue}`);
  } catch (error: any) {
    logger.error(`${TAG} Erro ao incrementar contador de uso para user ${userId}:`, error);
  }
}

// --- PERSISTENCE (MONGODB) ---

export async function createThread(userId: string, title?: string): Promise<IThread> {
  await connectToDatabase();
  const thread = await ThreadModel.create({
    userId,
    title: title || 'Nova Conversa',
    lastActivityAt: new Date(),
  });
  return thread;
}

export async function getUserThreads(userId: string, limit = 20, offset = 0): Promise<IThread[]> {
  await connectToDatabase();
  return ThreadModel.find({ userId })
    .sort({ lastActivityAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();
}

export async function getThread(threadId: string): Promise<IThread | null> {
  await connectToDatabase();
  return ThreadModel.findById(threadId).lean();
}

export async function updateThread(threadId: string, updates: Partial<IThread>): Promise<IThread | null> {
  await connectToDatabase();
  return ThreadModel.findByIdAndUpdate(threadId, updates, { new: true }).lean();
}

export async function deleteThread(threadId: string): Promise<void> {
  await connectToDatabase();
  await ThreadModel.findByIdAndDelete(threadId);
  await MessageModel.deleteMany({ threadId });

  // Also clear Redis
  const redis = getClient();
  await redis.del(`history:${threadId}`);
  await redis.del(`state:${threadId}`);
}

export async function persistMessage(threadId: string, message: ChatCompletionMessageParam): Promise<void> {
  try {
    await connectToDatabase();

    // Calculate rough tokens (just for referencing, accurate count is hard without tiktoken here)
    const content = message.content || '';
    const approxTokens = Math.ceil(content.length / 4);

    await MessageModel.create({
      threadId,
      role: message.role,
      content: content,
      tokens: approxTokens,
    });

    // Update thread activity
    await ThreadModel.findByIdAndUpdate(threadId, { lastActivityAt: new Date() });

  } catch (error) {
    logger.error(`[stateService] Failed to persist message for thread ${threadId}:`, error);
  }
}

export async function generateThreadTitle(threadId: string, firstUserMessage: string): Promise<void> {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) return;

    // Simple fetch to OpenAI to avoid importing the huge client if not needed, 
    // or reuse what we have. API route uses 'openai' package. 
    // Let's use a simple fetch for this background task to keep it lightweight or reuse logic.
    // Actually, we should probably just use the URL endpoint if possible, but here we are in service.

    const prompt = `Gere um título curto (máx 5 palavras) que resuma esta mensagem inicial de chat. O título deve ser em Português, sem aspas, sem "Título:". Mensagem: "${firstUserMessage.substring(0, 500)}"`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 15,
        temperature: 0.5
      })
    });

    if (response.ok) {
      const data = await response.json();
      const title = data.choices[0]?.message?.content?.trim();
      if (title) {
        await updateThread(threadId, { title });
      }
    }
  } catch (error) {
    logger.error(`[stateService] Failed to generate title for thread ${threadId}:`, error);
  }
}

export async function syncRedisToMongo(threadId: string, messages: ChatCompletionMessageParam[]): Promise<void> {
  // This function can be used to bulk sync if needed, but persistMessage is preferred per-turn.
  // Implementing purely for robustness if we want to "Flushing" the redis cache to Mongo.
  // For now, assume incremental persistence via persistMessage.
}

// Modified to support threadId as key and fallback to Mongo
export async function getConversationHistoryWithFallback(
  key: string, // Can be userId (legacy) or threadId
  useMongoFallback = false
): Promise<ChatCompletionMessageParam[]> {
  const history = await getConversationHistory(key);

  if (history.length === 0 && useMongoFallback) {
    // Try to load from MongoDB assuming key is threadId
    try {
      await connectToDatabase();
      if (mongoose.Types.ObjectId.isValid(key)) {
        const mongoMessages = await MessageModel.find({ threadId: key })
          .sort({ createdAt: 1 })
          .limit(50) // Safe limit
          .lean();

        if (mongoMessages.length > 0) {
          const mapped: ChatCompletionMessageParam[] = mongoMessages.map(m => ({
            role: m.role as any,
            content: m.content
          }));

          // Repopulate Redis
          await setConversationHistory(key, mapped);
          return mapped;
        }
      }
    } catch (e) {
      logger.error(`[stateService] Mongo fallback failed for key ${key}:`, e);
    }
  }

  return history;
}

