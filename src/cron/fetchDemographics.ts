import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { createClient } from 'redis';
import { logger } from '@/app/lib/logger';
import { fetchFollowerDemographics } from '@/services/instagramInsightsService';
import AudienceDemographicSnapshotModel from '@/app/models/demographics/AudienceDemographicSnapshot';
import { convertFollowerDemographics } from '@/utils/convertFollowerDemographics';

const redisUrl = process.env.REDIS_URL || '';
const redis = createClient({ url: redisUrl });
redis.on('error', err => logger.error('[fetchDemographics][Redis]', err));
redis.connect().catch(err => logger.error('[fetchDemographics][Redis] connect', err));

const TTL_SECONDS = 60 * 60 * 24; // 24h

async function run() {
  const TAG = '[cron fetchDemographics]';
  await connectToDatabase();
  const users = await User.find({ isInstagramConnected: true, instagramAccountId: { $ne: null }, instagramAccessToken: { $ne: null } })
    .select('instagramAccountId instagramAccessToken')
    .lean();
  logger.info(`${TAG} ${users.length} contas encontradas`);
  for (const u of users) {
    const accountId = u.instagramAccountId as string;
    const token = u.instagramAccessToken as string;
    try {
      const data = await fetchFollowerDemographics(accountId, token);
      const key = `demographics:${accountId}`;
      await redis.set(key, JSON.stringify(data), { EX: TTL_SECONDS });

      const demographicsForDb = convertFollowerDemographics(data);
      await AudienceDemographicSnapshotModel.create({
        user: u._id,
        instagramAccountId: accountId,
        recordedAt: new Date(),
        demographics: demographicsForDb,
      });

      logger.info(`${TAG} Dados salvos no cache e banco para ${accountId}`);
    } catch (e) {
      logger.error(`${TAG} Falha ao obter demografia para ${accountId}`, e);
    }
  }
  await redis.quit();
}

run().catch(err => {
  logger.error('[cron fetchDemographics] erro não tratado', err);
  redis.quit();
});
