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
  {
    id: 'billing-expire-trials',
    destination: 'https://data2content.ai/api/cron/expire-trials',
    cron: '0 6 * * *',
    method: 'POST',
    body: '[BILLING_EXPIRE_TRIALS] Marcar trials expirados como inativos',
  },
  // [DESATIVADO] whatsapp-tips-4x-week: dicas baseadas em métricas de performance.
  // Removido por conflito com a filosofia do produto — 1 mensagem/semana via mapa-whatsapp-weekly.
  {
    id: 'instagram-refresh-data-2x-day',
    destination: 'https://data2content.ai/api/cron/refresh-instagram-data',
    cron: '0 */12 * * *',
    method: 'POST',
    body: '[INSTAGRAM_REFRESH] Atualizar dados e renovar tokens próximos do vencimento',
  },
  {
    id: 'content-intelligence-recovery',
    destination: 'https://data2content.ai/api/cron/recover-content-intelligence',
    cron: '20 */6 * * *',
    method: 'POST',
    body: '[CONTENT_INTELLIGENCE] Recuperar classificações e leituras de vídeo pendentes dos assinantes',
  },
  // O mês grátis do d2cVIP é cupom, não trial — o Stripe não manda o aviso de
  // "seu teste está acabando". Sem este job a primeira cobrança chega em
  // silêncio, um mês depois da pessoa ter visto R$ 0,00 na tela. Diário porque
  // o benefício é concedido em qualquer dia; a idempotência mora na metadata da
  // assinatura, então rodar todo dia não gera aviso repetido.
  {
    id: 'billing-free-month-ending',
    destination: 'https://data2content.ai/api/cron/notify-free-month-ending',
    cron: '0 13 * * *', // 10:00 BRT — horário de gente acordada, não de madrugada
    method: 'POST',
    body: '[BILLING_FREE_MONTH] Avisar quem entrou com mês grátis que a cobrança está chegando',
  },
  // ── Narrative Map crons ─────────────────────────────────────────────────────
  {
    id: 'narrative-weekly-map-summary',
    destination: 'https://data2content.ai/api/cron/weekly-map-summary',
    cron: '0 11 * * 1', // Segunda 08:00 BRT (UTC-3)
    method: 'POST',
    body: '[NARRATIVE_MAP_SUMMARY] Gerar resumo semanal do mapa para criadores',
  },
  {
    id: 'narrative-regenerate-content-ideas',
    destination: 'https://data2content.ai/api/cron/regenerate-content-ideas',
    cron: '0 12 * * 1', // Segunda 09:00 BRT — após weekly-map-summary
    method: 'POST',
    body: '[NARRATIVE_IDEAS] Regenerar pautas frescas para criadores Pro com mapa confirmado',
  },
  // [DESATIVADO] narrative-whatsapp-weekly-newsletter: newsletter Gemini baseada no sistema de mapa legado.
  // Substituída por mapa-whatsapp-weekly (MapaSeed + GPT) — 1 mensagem única por semana.
  {
    id: 'mapa-whatsapp-weekly',
    destination: 'https://data2content.ai/api/cron/weekly-mapa-whatsapp',
    cron: '30 12 * * 1', // Segunda 09:30 BRT — após pautas regeneradas (09:00); única mensagem da semana
    method: 'POST',
    body: '[MAPA_WHATSAPP] Mensagem semanal do mapa narrativo — única mensagem WhatsApp da semana',
  },
  // ── Relatório Semanal ───────────────────────────────────────────────────────
  // Segunda 00h BRT: depois da semana encerrar, confere os vídeos contra o mapa de
  // cada criador, ANTES do close-week (01h), para o snapshot já sair com assets e
  // tons preenchidos. Rodar depois da meia-noite é essencial: `lastClosedWeek()` só
  // passa a apontar para a semana recém-encerrada após a virada de domingo.
  // ~94 vídeos/semana ≈ US$ 0,47. Sem backfill: a janela de 90 dias inclui a semana
  // corrente, então o ranking popula já na primeira execução.
  {
    id: 'relatorio-semanal-cenas',
    destination: 'https://data2content.ai/api/cron/weekly-scene-evaluation',
    cron: '0 3 * * 1', // Segunda 00:00 BRT = segunda 03:00 UTC
    method: 'POST',
    body: '[RELATORIO_SEMANAL] Conferir os vídeos da semana contra o mapa dos criadores',
  },
  // Segunda 01h BRT: uma hora depois do fan-out de cenas. Congela o snapshot da
  // semana que terminou no domingo, sem cortar a última hora de posts da semana.
  // ATENÇÃO: semana que não roda aqui é irrecuperável — `Metric.stats` é cumulativo e
  // reescrito a cada sync, então o ranking de uma semana passada não pode ser
  // reconstruído com os números que ela tinha. Se este job falhar, refazer no mesmo
  // dia com ?week=<chave>.
  {
    id: 'relatorio-semanal-close-week',
    destination: 'https://data2content.ai/api/cron/weekly-report-close',
    cron: '0 4 * * 1', // Segunda 01:00 BRT = segunda 04:00 UTC
    method: 'POST',
    body: '[RELATORIO_SEMANAL] Congelar o snapshot da semana por território',
  },
  {
    id: 'creator-weekly-reports',
    destination: 'https://data2content.ai/api/cron/creator-weekly-reports',
    cron: '15 4 * * 1', // Segunda 01:15 BRT — após o fechamento das métricas.
    method: 'POST',
    body: '[CREATOR_WEEKLY_REPORT] Materializar os relatórios individuais da semana',
  },
] as const;

async function createCrons() {
  if (!process.env.QSTASH_TOKEN) {
    throw new Error('Missing QSTASH_TOKEN environment variable.');
  }

  if (!process.env.ADMIN_TOKEN) {
    throw new Error('Missing ADMIN_TOKEN environment variable.');
  }

  const requestedIds = new Set(
    process.argv
      .slice(2)
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean),
  );
  const unknownIds = [...requestedIds].filter(
    (id) => !CRONS.some((task) => task.id === id),
  );
  if (unknownIds.length > 0) {
    throw new Error(`Unknown schedule id(s): ${unknownIds.join(', ')}`);
  }

  const selectedCrons = requestedIds.size > 0
    ? CRONS.filter((task) => requestedIds.has(task.id))
    : CRONS;
  const existingSchedules = await qstash.schedules.list();
  const duplicateDestinations: string[] = [];

  for (const task of selectedCrons) {
    const existingForDestination = existingSchedules.filter(
      (schedule) => schedule.destination === task.destination,
    );
    if (existingForDestination.length > 1) {
      duplicateDestinations.push(task.destination);
      console.error(
        `Skipping ${task.id}: ${existingForDestination.length} schedules already target ${task.destination}. ` +
        'Deduplicate them explicitly before reconciling this destination.',
      );
      continue;
    }

    const scheduleId = existingForDestination[0]?.scheduleId ?? task.id;
    console.log(`${existingForDestination.length === 0 ? 'Creating' : 'Updating'} QStash schedule: ${task.id}`);
    await qstash.schedules.create({
      scheduleId,
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

  if (duplicateDestinations.length > 0) {
    throw new Error(
      `Duplicate QStash destinations require manual cleanup: ${duplicateDestinations.join(', ')}`,
    );
  }

  console.log(`✅ ${selectedCrons.length} scheduled job(s) reconciled successfully.`);
}

createCrons().catch((error) => {
  console.error('Failed to create QStash schedules.', error);
  process.exitCode = 1;
});
