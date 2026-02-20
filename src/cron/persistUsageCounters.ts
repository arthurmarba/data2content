import { connectToDatabase } from '@/app/lib/mongoose';
import { createClient } from 'redis';
import mongoose from 'mongoose';
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

  const SCAN_COUNT = 500;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let scannedKeys = 0;
  let persistedUsers = 0;
  let totalMessages = 0;
  let batchCount = 0;

  for await (const chunk of redis.scanIterator({ MATCH: 'usage:*', COUNT: SCAN_COUNT })) {
    const keys = Array.isArray(chunk) ? chunk : [chunk];
    if (!keys.length) {
      continue;
    }

    batchCount += 1;
    scannedKeys += keys.length;

    try {
      const values = await redis.mGet(keys);
      const incrementsByUser = new Map<string, number>();

      keys.forEach((key, idx) => {
        const userId = key.split(':')[1];
        if (!userId || !mongoose.isValidObjectId(userId)) {
          return;
        }

        const count = parseInt(values[idx] || '0', 10);
        if (!Number.isFinite(count) || count <= 0) {
          return;
        }

        incrementsByUser.set(userId, (incrementsByUser.get(userId) || 0) + count);
      });

      if (incrementsByUser.size > 0) {
        const snapshotOps = Array.from(incrementsByUser.entries()).map(([userId, count]) => ({
          updateOne: {
            filter: { user: userId, date: today },
            update: { $inc: { messageCount: count } },
            upsert: true,
          },
        }));
        const userOps = Array.from(incrementsByUser.entries()).map(([userId, count]) => ({
          updateOne: {
            filter: { _id: userId },
            update: { $inc: { totalMessages: count } },
          },
        }));

        await Promise.all([
          UserUsageSnapshot.bulkWrite(snapshotOps, { ordered: false }),
          User.bulkWrite(userOps, { ordered: false }),
        ]);

        persistedUsers += incrementsByUser.size;
        totalMessages += Array.from(incrementsByUser.values()).reduce((sum, count) => sum + count, 0);
      }

      const deletePipeline = redis.multi();
      keys.forEach((key) => {
        deletePipeline.del(key);
      });
      await deletePipeline.exec();
    } catch (e) {
      logger.error(`${TAG} Error processing usage keys batch ${batchCount}`, e);
    }
  }

  logger.info(
    `${TAG} Processed ${scannedKeys} usage keys in ${batchCount} batches. Persisted ${totalMessages} messages for ${persistedUsers} users.`
  );
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
