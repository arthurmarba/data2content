/**
 * Recalcula a retenção dos vídeos com o que já está no banco.
 *
 * Até 02/10/2026 a sincronização nunca gravava retenção: a conta rodava sem a
 * duração do vídeo. Os registros antigos ficaram com 0 — um número falso que
 * se lia como "ninguém assiste". Este script:
 *
 * 1. calcula tempo médio (ms) ÷ 1000 ÷ duração (s) onde as duas metades existem;
 * 2. troca por null os zeros falsos onde a conta não é possível (vídeo sem uma das
 *    metades, ou foto/carrossel, que não têm retenção).
 *
 * Nunca apaga um valor positivo. Não toca em updatedAt. Nenhuma chamada externa.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/recalcularRetencao.ts [--dry-run]
 */
import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';

const VIDEO_TYPES = ['REEL', 'VIDEO'];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectToDatabase();
  const metrics = MetricModel.collection;

  const computable = {
    type: { $in: VIDEO_TYPES },
    'stats.ig_reels_avg_watch_time': { $gt: 0 },
    'stats.video_duration_seconds': { $gt: 0 },
  };
  const videoFakeZero = {
    type: { $in: VIDEO_TYPES },
    'stats.retention_rate': 0,
    $nor: [{ 'stats.ig_reels_avg_watch_time': { $gt: 0 }, 'stats.video_duration_seconds': { $gt: 0 } }],
  };
  const notVideoWithRetention = {
    type: { $nin: VIDEO_TYPES },
    'stats.retention_rate': 0,
  };

  const counts = {
    calculaveis: await metrics.countDocuments(computable),
    videoZeroSemDado: await metrics.countDocuments(videoFakeZero),
    fotoComZero: await metrics.countDocuments(notVideoWithRetention),
  };
  console.log(`${dryRun ? '[simulação] ' : ''}${JSON.stringify(counts)}`);
  if (dryRun) return;

  const calculated = await metrics.updateMany(computable, [{
    $set: {
      'stats.retention_rate': {
        $round: [{ $divide: [{ $divide: ['$stats.ig_reels_avg_watch_time', 1000] }, '$stats.video_duration_seconds'] }, 4],
      },
    },
  }]);
  const videoNulled = await metrics.updateMany(videoFakeZero, { $set: { 'stats.retention_rate': null } });
  const photoNulled = await metrics.updateMany(notVideoWithRetention, { $set: { 'stats.retention_rate': null } });
  console.log(JSON.stringify({
    calculadas: calculated.modifiedCount,
    videosSemDadoViraramNull: videoNulled.modifiedCount,
    fotosViraramNull: photoNulled.modifiedCount,
  }));
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
