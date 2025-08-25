import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import { triggerDataRefresh } from '@/app/lib/instagram';
import { logger } from '@/app/lib/logger';

async function run() {
  const TAG = '[cron refreshMetrics]';
  await connectToDatabase();
  const users = await User.find({
    isInstagramConnected: true,
    instagramAccessToken: { $ne: null },
    instagramAccountId: { $ne: null }
  }).select('_id').lean();
  logger.info(`${TAG} ${users.length} usuarios encontrados`);
  for (const u of users) {
    const uid = u._id.toString();
    try {
      await triggerDataRefresh(uid);
      logger.info(`${TAG} Atualizado com sucesso para ${uid}`);
    } catch (err) {
      logger.error(`${TAG} Falha ao atualizar ${uid}`, err);
    }
  }
  logger.info(`${TAG} Finalizado`);
}

run().catch(err => {
  logger.error('[cron refreshMetrics] erro não tratado', err);
  process.exit(1);
}).then(() => {
  process.exit(0);
});
