/**
 * Enfileira o histórico antigo do Instagram para todos os criadores conectados que
 * ainda não o têm (mesma regra da conexão: só chamadas ao Instagram, sem IA, até
 * dois anos). Roda nos workers de produção, não nesta máquina: cada vídeo antigo
 * baixa o começo do arquivo para ler a duração.
 *
 * Os envios são espaçados para não abrir dezenas de funções ao mesmo tempo contra
 * o Atlas gratuito (limite de conexões).
 *
 * Uso (APP_BASE_URL precisa apontar para produção):
 *   APP_BASE_URL=https://data2content.ai npx tsx --env-file=.env.local scripts/enqueueInstagramHistoryAll.ts [--dry-run]
 */
import mongoose from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';
import { needsHistoryBackfill } from '@/app/lib/instagram/sync/historyBackfill';
import { enqueueInstagramHistoryBackfill } from '@/app/lib/instagram/historyBackfillQueue';

/** Intervalo entre o início de um criador e o do seguinte. */
const STAGGER_SECONDS = 90;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectToDatabase();
  const users = await DbUser.find({
    isInstagramConnected: true,
    instagramAccountId: { $nin: [null, ''] },
    instagramAccessToken: { $nin: [null, ''] },
  }).select('username instagramAccountId instagramHistoryBackfill').lean<Array<{
    _id: mongoose.Types.ObjectId; username?: string; instagramAccountId: string;
    instagramHistoryBackfill?: { status?: string | null; instagramAccountId?: string | null };
  }>>();

  const pending = users.filter((user) => needsHistoryBackfill(user.instagramHistoryBackfill, user.instagramAccountId));
  console.log(`${dryRun ? '[simulação] ' : ''}conectados: ${users.length} · sem histórico: ${pending.length}`);
  if (dryRun) return;

  let queued = 0;
  for (const [index, user] of pending.entries()) {
    const ok = await enqueueInstagramHistoryBackfill({ userId: String(user._id) }, index * STAGGER_SECONDS);
    if (ok) queued += 1;
    else console.log(`não enfileirado: @${user.username}`);
  }
  console.log(`enfileirados: ${queued} · último começa em ~${Math.round(((pending.length - 1) * STAGGER_SECONDS) / 60)} min`);
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
