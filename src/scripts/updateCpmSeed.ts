import 'dotenv/config';
import path from 'path';
import { promises as fs } from 'fs';
import * as Sentry from '@sentry/nextjs';

import { connectToDatabase } from '../app/lib/mongoose';
import { logger } from '../app/lib/logger';
import { computeSeedSnapshot } from '../app/lib/cpm/seedSnapshot';

async function ensureDirectory(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function main() {
  const TAG = '[updateCpmSeed]';
  try {
    await connectToDatabase();
    logger.info(`${TAG} Connected to database.`);

    const result = await computeSeedSnapshot();
    if (!result) {
      const message = '[CPM_SEED_UPDATE] skipped: no dynamic data available yet.';
      logger.warn(message);
      Sentry.captureMessage(message, 'info');
      return;
    }
    const { snapshot: updatedSeed, dynamicSegments, totalSegments } = result;

    const timestamp = new Date().toISOString().split('T')[0];
    const directory = path.resolve(process.cwd(), 'data', 'seed-history');
    await ensureDirectory(directory);

    const filePath = path.join(directory, `seed-${timestamp}.json`);
    await fs.writeFile(filePath, JSON.stringify(updatedSeed, null, 2), 'utf8');

    const message = `[CPM_SEED_UPDATE] snapshot saved to ${filePath} (dynamicSegments=${dynamicSegments}, totalSegments=${totalSegments})`;
    logger.info(message);
    Sentry.captureMessage(message, 'info');

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(updatedSeed, null, 2));
  } catch (error) {
    logger.error('[updateCpmSeed] Failed to update seed CPM', error);
    process.exitCode = 1;
  }
}

void main();
