// src/utils/rateLimit.ts

import { createClient, RedisClientType } from 'redis';
import { logger } from '@/app/lib/logger';

let client: RedisClientType | null = null;
let connectionAttempted = false;
let redisUnavailable = false;
let disabledReasonLogged = false;
let notReadyLogged = false;
let connectionErrorLogged = false;

function logDisabledReason(message: string, meta?: Record<string, unknown>) {
  if (disabledReasonLogged) return;
  disabledReasonLogged = true;
  logger.warn(message, meta ?? {});
}

function isRedisUrlUsable(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (
      process.env.NODE_ENV === 'production' &&
      (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1')
    ) {
      logDisabledReason('[rateLimit] REDIS_URL points to a local address in production. Rate limiting disabled.', {
        hostname,
      });
      return false;
    }
    return true;
  } catch {
    logDisabledReason('[rateLimit] REDIS_URL is invalid. Rate limiting disabled.');
    return false;
  }
}

function getClient(): RedisClientType | null {
  if (redisUnavailable) return null;
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    logDisabledReason('[rateLimit] REDIS_URL not configured. Rate limiting disabled.');
    return null;
  }

  if (!isRedisUrlUsable(url)) {
    redisUnavailable = true;
    return null;
  }

  if (connectionAttempted) return client;

  client = createClient({
    url,
    socket: {
      reconnectStrategy: false,
    },
  });
  connectionAttempted = true;

  client.on('ready', () => {
    notReadyLogged = false;
    connectionErrorLogged = false;
  });

  client.on('error', (err: any) => {
    if (connectionErrorLogged) return;
    connectionErrorLogged = true;
    logger.warn('[rateLimit] Redis unavailable. Rate limiting disabled for this runtime.', {
      error: err?.message ?? String(err),
      code: err?.code,
    });
  });

  client.connect().catch((err: any) => {
    redisUnavailable = true;
    client = null;
    logger.warn('[rateLimit] Initial connection to Redis failed. Rate limiting disabled for this runtime.', {
      error: err?.message ?? String(err),
      code: err?.code,
    });
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
    return { allowed: true, remaining: limit };
  }

  if (!redis.isReady) {
    if (!notReadyLogged) {
      notReadyLogged = true;
      logger.warn('[rateLimit] Redis not ready. Skipping rate limit checks until connection recovers.');
    }
    return { allowed: true, remaining: limit };
  }

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (err) {
    logger.warn('[rateLimit] Error during Redis command. Skipping rate limit check.', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
    return { allowed: true, remaining: limit };
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
