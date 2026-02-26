import mongoose from 'mongoose';
import { triggerDataRefresh } from '@/app/lib/instagram';
import { invalidateDashboardHomeSummaryCache } from '@/app/lib/cache/dashboardCache';
import { logger } from '@/app/lib/logger';

type ParsedArgs = {
  userId: string | null;
  invalidateCache: boolean;
  showHelp: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const showHelp = args.includes('--help') || args.includes('-h');
  const invalidateCache = !args.includes('--no-cache-invalidate');
  const userId = args.find((arg) => !arg.startsWith('-')) ?? null;

  return { userId, invalidateCache, showHelp };
}

function printUsage() {
  // eslint-disable-next-line no-console
  console.log(
    [
      'Uso:',
      '  npm run refresh:metrics:user -- <userId> [--no-cache-invalidate]',
      '',
      'Exemplos:',
      '  npm run refresh:metrics:user -- 65f1d8e0f7f5f44c0f9e1234',
      '  npm run refresh:metrics:user -- 65f1d8e0f7f5f44c0f9e1234 --no-cache-invalidate',
    ].join('\n')
  );
}

async function run() {
  const TAG = '[script refreshMetricsByUser]';
  const { userId, invalidateCache, showHelp } = parseArgs(process.argv);

  if (showHelp) {
    printUsage();
    return;
  }

  if (!userId) {
    logger.error(`${TAG} userId ausente.`);
    printUsage();
    process.exitCode = 1;
    return;
  }

  if (!mongoose.isValidObjectId(userId)) {
    logger.error(`${TAG} userId inválido: ${userId}`);
    process.exitCode = 1;
    return;
  }

  logger.info(`${TAG} Iniciando refresh para userId=${userId}...`);
  const result = await triggerDataRefresh(userId);

  if (!result.success) {
    logger.error(`${TAG} Falha no refresh para userId=${userId}. Motivo: ${result.message}`, result.details ?? {});
    process.exitCode = 1;
    return;
  }

  logger.info(`${TAG} Refresh concluído com sucesso para userId=${userId}. Mensagem: ${result.message}`);

  if (invalidateCache) {
    invalidateDashboardHomeSummaryCache(userId);
    logger.info(`${TAG} Cache de dashboard invalidado para userId=${userId}.`);
  }
}

run()
  .catch((error) => {
    logger.error('[script refreshMetricsByUser] erro não tratado', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
