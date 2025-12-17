import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase } from '../src/app/lib/mongoose';
import Metric from '../src/app/models/Metric';
import { logger } from '../src/app/lib/logger';

const BATCH_SIZE = 500;

const safeNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

const buildTotals = (stats: any) => {
  const likes = safeNumber(stats?.likes);
  const comments = safeNumber(stats?.comments);
  const saved = safeNumber(stats?.saved);
  const shares = safeNumber(stats?.shares);
  const totalInteractions = likes + comments + saved + shares;

  return {
    totalInteractions,
    engagement: safeNumber(stats?.engagement) || totalInteractions,
  };
};

async function run() {
  const TAG = '[backfillTotalInteractions]';
  await connectToDatabase();

  let processed = 0;

  while (true) {
    const docs = await Metric.find({
      $or: [
        { 'stats.total_interactions': { $exists: false } },
        { 'stats.total_interactions': null },
      ]
    })
      .select('_id stats')
      .limit(BATCH_SIZE)
      .lean();

    if (!docs.length) break;

    const ops = docs.map(doc => {
      const { totalInteractions, engagement } = buildTotals(doc.stats || {});
      const set: Record<string, number> = {
        'stats.total_interactions': totalInteractions,
      };

      if (doc.stats?.engagement === undefined || doc.stats?.engagement === null) {
        set['stats.engagement'] = engagement;
      }

      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: set },
        }
      };
    });

    await Metric.bulkWrite(ops, { ordered: false });
    processed += docs.length;
    logger.info(`${TAG} Atualizados ${processed} documentos (lote ${docs.length}).`);
  }

  logger.info(`${TAG} Concluído. Total processado: ${processed}`);
}

run().catch(err => {
  logger.error('[backfillTotalInteractions] erro geral', err);
}).finally(() => mongoose.disconnect());
