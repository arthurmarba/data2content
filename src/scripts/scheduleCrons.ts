import { config as loadEnv } from 'dotenv';
import { Client } from '@upstash/qstash';

// Load environment variables from `.env` (if present) and then `.env.local` without overriding.
loadEnv();
loadEnv({ path: '.env.local', override: false });

const qstash = new Client({
  token: process.env.QSTASH_TOKEN!,
});

const ADMIN_AUTH = `Bearer ${process.env.ADMIN_TOKEN}`;
const BASE_URL = 'https://data2content.ai/api/admin';

const CRONS = [
  {
    id: 'cpm-weekly-snapshot',
    destination: `${BASE_URL}/cpm-history/snapshot`,
    cron: '0 3 * * 0',
    method: 'POST',
    body: '[CPM_HISTORY_SNAPSHOT] Registrar médias semanais de CPM',
  },
  {
    id: 'cpm-daily-monitor',
    destination: `${BASE_URL}/seed-usage`,
    cron: '0 5 * * *',
    method: 'GET',
    body: '[CPM_MONITOR] Acompanhar seed usage diário',
  },
  {
    id: 'cpm-monthly-update',
    destination: `${BASE_URL}/seed/update`,
    cron: '0 4 1 * *',
    method: 'POST',
    body: '[CPM_SEED_UPDATE] Atualizar benchmarks',
  },
  {
    id: 'cpm-cleanup',
    destination: `${BASE_URL}/cpm-history/cleanup`,
    cron: '0 2 15 * *',
    method: 'POST',
    body: '[CPM_CLEANUP] Remover snapshots antigos',
  },
] as const;

async function createCrons() {
  if (!process.env.QSTASH_TOKEN) {
    throw new Error('Missing QSTASH_TOKEN environment variable.');
  }

  if (!process.env.ADMIN_TOKEN) {
    throw new Error('Missing ADMIN_TOKEN environment variable.');
  }

  for (const task of CRONS) {
    console.log(`Creating QStash schedule: ${task.id}`);
    await qstash.schedules.create({
      destination: task.destination,
      cron: task.cron,
      body: task.body,
      method: task.method,
      headers: {
        'Upstash-Forward-Authorization': ADMIN_AUTH,
        'Content-Type': 'application/json',
      },
    });
  }

  console.log('✅ All CPM-related crons scheduled successfully.');
}

createCrons().catch((error) => {
  console.error('Failed to create QStash schedules.', error);
  process.exitCode = 1;
});
