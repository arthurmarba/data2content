import { connectToDatabase } from '@/app/lib/mongoose';
import { createClient } from 'redis';
import { logger } from '@/app/lib/logger';
import UserUsageSnapshot from '@/app/models/UserUsageSnapshot';
import User from '@/app/models/User';

const redisUrl = process.env.REDIS_URL || '';
const redis = createClient({ url: redisUrl });
redis.on('error', err => logger.error('[persistUsageCounters][Redis]', err));

export async function persistUsageCounters() {
  const TAG = '[cron persistUsageCounters]';
  await connectToDatabase();
  if (!redis.isReady) {
    await redis.connect();
  }
  const keys = await redis.keys('usage:*');
  logger.info(`${TAG} ${keys.length} usage keys found`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  for (const key of keys) {
    const userId = key.split(':')[1];
    try {
      const countStr = await redis.get(key);
      const count = parseInt(countStr || '0', 10);
      if (!count || isNaN(count)) {
        await redis.del(key);
        continue;
      }
      await UserUsageSnapshot.updateOne(
        { user: userId, date: today },
        { $inc: { messageCount: count } },
        { upsert: true }
      );
      await User.updateOne({ _id: userId }, { $inc: { totalMessages: count } });
      await redis.del(key);
      logger.info(`${TAG} Persisted ${count} messages for user ${userId}`);
    } catch (e) {
      logger.error(`${TAG} Error processing key ${key}`, e);
    }
  }
}

export default persistUsageCounters;

if (process.argv[1] && process.argv[1].endsWith('persistUsageCounters.ts')) {
  persistUsageCounters()
    .catch(err => {
      logger.error('[cron persistUsageCounters] unhandled error', err);
    })
    .finally(() => {
      redis.quit();
    });
}
