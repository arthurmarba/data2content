/**
 * Leituras do lote que foram gravadas e ficaram com a etiqueta "batched".
 *
 * A coleta do lote gravava a leitura mas nunca mudava o estado para "complete"
 * (corrigido em 02/10/2026). Este script acerta só os itens em que o job marcou
 * o item como entregue E a leitura existe no banco. Nenhuma leitura nova de IA.
 *
 * Uso:
 *   npx tsx --env-file=.env.local scripts/corrigirEtiquetasDoLote.ts [--dry-run]
 */
import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import ContentReadingStateModel from '@/app/models/ContentReadingState';
import GeminiBatchJobModel from '@/app/models/GeminiBatchJob';
import PublishedContentEvidenceModel from '@/app/models/PublishedContentEvidence';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectToDatabase();

  const stuck = await ContentReadingStateModel.find({ state: 'batched' }).select('_id batchJobName').lean<Array<{ _id: string; batchJobName?: string | null }>>();
  const jobs = await GeminiBatchJobModel.find({ _id: { $in: [...new Set(stuck.map((s) => s.batchJobName).filter(Boolean))] } })
    .select('items.metricId items.state').lean<Array<{ _id: string; items?: Array<{ metricId: string; state: string }> }>>();
  const delivered = new Set(jobs.flatMap((job) => (job.items ?? [])
    .filter((item) => item.state === 'done')
    .map((item) => `${job._id}|${item.metricId}`)));
  const withReading = new Set((await PublishedContentEvidenceModel.find({
    metricId: { $in: stuck.filter((s) => mongoose.isValidObjectId(s._id)).map((s) => new mongoose.Types.ObjectId(s._id)) },
  }).select('metricId').lean<Array<{ metricId: unknown }>>()).map((row) => String(row.metricId)));

  const fixable = stuck.filter((s) => delivered.has(`${s.batchJobName}|${s._id}`) && withReading.has(s._id)).map((s) => s._id);
  console.log(`${dryRun ? '[simulação] ' : ''}presos: ${stuck.length} · com leitura gravada e entregue pelo lote: ${fixable.length}`);
  if (dryRun || !fixable.length) return;

  const epoch = new Date(0);
  const result = await ContentReadingStateModel.updateMany({ _id: { $in: fixable }, state: 'batched' }, { $set: {
    state: 'complete', reason: null, lastError: null, batchJobName: null,
    nextAttemptAt: epoch, leaseUntil: epoch, leaseToken: null,
  } });
  console.log(`marcadas como prontas: ${result.modifiedCount}`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
