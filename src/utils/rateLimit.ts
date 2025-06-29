import { createClient, RedisClientType } from 'redis';
import { logger } from '@/app/lib/logger';

let client: RedisClientType | null = null;

function getClient(): RedisClientType | null {
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn('[rateLimit] REDIS_URL not configured. Rate limiting disabled.');
    return null;
  }

  client = createClient({ url });
  client.on('error', (err) => logger.error('[rateLimit] Redis error', err));
  client.connect().catch((err) => {
    logger.error('[rateLimit] Failed to connect to Redis', err);
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

  try {
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, windowSeconds);
    }
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  } catch (err) {
    logger.error('[rateLimit] Error during rate limit check', err);
    return { allowed: true, remaining: limit };
  }
}
