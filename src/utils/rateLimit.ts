// src/utils/rateLimit.ts

import { createClient, RedisClientType } from 'redis';
import { logger } from '@/app/lib/logger';

let client: RedisClientType | null = null;
let connectionAttempted = false; // Flag para evitar múltiplas tentativas de conexão

function getClient(): RedisClientType | null {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn('[rateLimit] REDIS_URL not configured. Rate limiting disabled.');
    return null;
  }
  
  // Evita criar múltiplos clientes se a primeira tentativa já ocorreu
  if (connectionAttempted) return client; 

  client = createClient({ url });
  connectionAttempted = true; // Marca que a tentativa de conexão foi feita

  client.on('error', (err) => logger.error('[rateLimit] Redis Client Error', err));
  
  client.connect().catch((err) => {
    // O 'error' event já cobre isso, mas mantemos um log inicial para clareza.
    logger.error('[rateLimit] Initial connection to Redis failed', err);
    // Não precisa fazer mais nada, o status 'isReady' cuidará do resto.
  });

  return client;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const redis = getClient();
  if (!redis) {
    // Rate limit desativado por falta de URL
    return { allowed: true, remaining: limit };
  }
  
  // <<< ALTERAÇÃO PRINCIPAL: Verificamos se o cliente está pronto >>>
  // Se o cliente não estiver pronto (não conectado), pulamos o rate limit.
  // Isso evita que a aplicação trave ao tentar usar uma conexão indisponível.
  if (!redis.isReady) {
    logger.warn(`[rateLimit] Redis not ready. Skipping rate limit check for key: ${key}`);
    return { allowed: true, remaining: limit };
  }

  try {
    // O restante da lógica só executa se o Redis estiver pronto.
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (err) {
    // Este catch agora só vai pegar erros de comando, não de conexão.
    logger.error(`[rateLimit] Error during Redis command for key ${key}`, err);
    return { allowed: true, remaining: limit }; // Permite a passagem em caso de erro
  }
}

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  keyPrefix?: string;
}

interface RateLimiter {
  check: (identifier: string) => Promise<void>;
}

export default function rateLimit(options: RateLimiterOptions): RateLimiter {
  const { windowMs, max, keyPrefix = 'rate_limit' } = options;
  const windowSeconds = Math.max(1, Math.floor(windowMs / 1000));

  return {
    async check(identifier: string) {
      const key = `${keyPrefix}:${identifier}`;
      const result = await checkRateLimit(key, max, windowSeconds);
      if (!result.allowed) {
        const error = new Error('Too many requests');
        (error as Error & { status?: number }).status = 429;
        throw error;
      }
    },
  };
}
