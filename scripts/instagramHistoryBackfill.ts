/**
 * Puxa o histórico antigo do Instagram de um criador: posts além da janela da
 * sincronização periódica e os 30 dias de novos seguidores anteriores. É o mesmo
 * trabalho que roda sozinho na conexão — aqui, para quem conectou antes dele.
 *
 * Só chamadas ao Instagram: nenhum post antigo vai para classificação ou leitura de IA.
 *
 * Uso:
 *   npm run backfill:instagram-history -- <userId> [--dry-run]
 *
 * Sem --dry-run, grava no banco real.
 */
import mongoose from 'mongoose';
import { runInstagramHistoryBackfillStep } from '@/app/lib/instagram/sync/historyBackfill';

async function main() {
  const args = process.argv.slice(2);
  const userId = args.find((arg) => !arg.startsWith('-')) ?? '';
  const dryRun = args.includes('--dry-run');
  if (!mongoose.isValidObjectId(userId)) {
    console.log('Uso: npm run backfill:instagram-history -- <userId> [--dry-run]');
    process.exit(1);
  }

  let after: string | null = null;
  const total = { pagesRead: 0, postsSaved: 0, postsWithoutInsights: 0, followerDaysSaved: 0 };
  for (;;) {
    const step = await runInstagramHistoryBackfillStep({ userId, after, dryRun });
    total.pagesRead += step.pagesRead;
    total.postsSaved += step.postsSaved;
    total.postsWithoutInsights += step.postsWithoutInsights;
    total.followerDaysSaved += step.followerDaysSaved;
    console.log(`passo: ${step.status} · ${step.pagesRead} páginas · ${step.postsSaved} posts antigos`);
    if (step.status !== 'continue') {
      if (step.status === 'rate_limited') console.log('O Instagram pediu pausa. Rode de novo em uma hora; o que já foi gravado é pulado.');
      if (step.status === 'failed') console.log(`Falhou: ${step.error}`);
      if (step.status === 'skipped') console.log(`Pulado: ${step.reason}`);
      break;
    }
    after = step.after;
  }

  console.log(`${dryRun ? '[simulação] ' : ''}Total: ${total.pagesRead} páginas, ${total.postsSaved} posts antigos ${dryRun ? 'seriam gravados' : 'gravados'} (${total.postsWithoutInsights} sem números), ${total.followerDaysSaved} dias de novos seguidores.`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
