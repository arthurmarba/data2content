import mongoose from 'mongoose';
import { triggerDataRefresh } from '@/app/lib/instagram';
import User from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';

type ParsedArgs = {
  activeOnly: boolean;
  limit: number | null;
  invalidateCache: boolean;
  showHelp: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const showHelp = args.includes('--help') || args.includes('-h');
  const activeOnly = args.includes('--active-only');
  const invalidateCache = !args.includes('--no-cache-invalidate');

  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const limit = limitArg ? Number.parseInt(limitArg.split('=')[1] ?? '', 10) : null;

  return {
    activeOnly,
    limit: Number.isFinite(limit) && (limit as number) > 0 ? (limit as number) : null,
    invalidateCache,
    showHelp,
  };
}

function printUsage() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Uso:',
      '  npm run refresh:metrics:all-users -- [--active-only] [--limit=50] [--no-cache-invalidate]',
      '',
      'Exemplos:',
      '  npm run refresh:metrics:all-users -- --active-only',
      '  npm run refresh:metrics:all-users -- --limit=25',
      '  npm run refresh:metrics:all-users -- --active-only --limit=100 --no-cache-invalidate',
    ].join('\n')
  );
}

async function run() {
  const TAG = '[script refreshMetricsAllConnectedUsers]';
  const { activeOnly, limit, invalidateCache, showHelp } = parseArgs(process.argv);

  if (showHelp) {
    printUsage();
    return;
  }

  await connectToDatabase();

  const baseFilter: Record<string, unknown> = {
    role: 'user',
    instagramAccessToken: { $nin: [null, ''] },
    instagramAccountId: { $nin: [null, ''] },
  };
  if (activeOnly) {
    baseFilter.planStatus = 'active';
  }

  let query = User.find(baseFilter).select('_id').sort({ _id: 1 }).lean();
  if (limit) {
    query = query.limit(limit);
  }
  const users = await query;

  logger.info(
    `${TAG} Iniciando refresh em lote para ${users.length} usuário(s) conectados. activeOnly=${activeOnly}, limit=${limit ?? 'none'}, invalidateCache=${invalidateCache}`
  );

  const { invalidateDashboardHomeSummaryCache } = await import('@/app/lib/cache/dashboardCache');
  let successCount = 0;
  let failedCount = 0;

  for (const user of users) {
    const userId = user._id.toString();
    try {
      const result = await triggerDataRefresh(userId);
      if (!result.success) {
        failedCount += 1;
        logger.error(`${TAG} Falha no refresh para userId=${userId}. Motivo: ${result.message}`);
        continue;
      }

      if (invalidateCache) {
        invalidateDashboardHomeSummaryCache(userId);
      }
      successCount += 1;
      logger.info(`${TAG} OK userId=${userId}`);
    } catch (error) {
      failedCount += 1;
      logger.error(`${TAG} Erro não tratado ao processar userId=${userId}`, error);
    }
  }

  logger.info(`${TAG} Finalizado. success=${successCount}, failed=${failedCount}, total=${users.length}`);
}

run()
  .catch((error) => {
    logger.error('[script refreshMetricsAllConnectedUsers] erro não tratado', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
