import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { Types } from 'mongoose';
import { connectToDatabase } from '@/app/lib/mongoose';
import MetricModel from '@/app/models/Metric';
import { logger } from '@/app/lib/logger';
import { getInstagramConnectionDetails } from '@/app/lib/instagram/db/userActions';
import { fetchSingleInstagramMedia } from '@/app/lib/instagram/api/fetchers';
import { refreshSinglePubliMetric } from '@/app/lib/instagram/sync/singleMetricSync';

const TAG = '[auditVideoPostDates]';
const DISPLAY_TIMEZONE = 'America/Sao_Paulo';

type ReasonCode =
  | 'METRIC_DATE_INVALID'
  | 'MEDIA_FETCH_FAILED'
  | 'IG_TIMESTAMP_MISSING_OR_INVALID'
  | 'DAY_MISMATCH';

type SuspiciousItem = {
  metricId: string;
  instagramMediaId: string;
  reason: ReasonCode;
  metricPostDateIso: string | null;
  igTimestampIso: string | null;
  metricDaySP: string | null;
  igDaySP: string | null;
  diffHoursAbs: number | null;
  fetchError?: string;
};

type ResyncResult = {
  instagramMediaId: string;
  metricId: string;
  success: boolean;
  message: string;
};

function getArg(name: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`);
}

function toDate(value: unknown): Date | null {
  const d = value instanceof Date ? value : (typeof value === 'string' ? new Date(value) : null);
  if (!d || Number.isNaN(d.getTime())) return null;
  return d;
}

function dayKeySP(date: Date | null): string | null {
  if (!date) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function escapeCsv(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const escaped = raw.replace(/"/g, '""');
  return `"${escaped}"`;
}

function toCsv(rows: SuspiciousItem[]): string {
  const header = [
    'metricId',
    'instagramMediaId',
    'reason',
    'metricPostDateIso',
    'igTimestampIso',
    'metricDaySP',
    'igDaySP',
    'diffHoursAbs',
    'fetchError',
  ];
  const lines = rows.map((r) =>
    [
      r.metricId,
      r.instagramMediaId,
      r.reason,
      r.metricPostDateIso,
      r.igTimestampIso,
      r.metricDaySP,
      r.igDaySP,
      r.diffHoursAbs,
      r.fetchError ?? '',
    ].map(escapeCsv).join(',')
  );
  return [header.join(','), ...lines].join('\n');
}

async function main() {
  const userId = getArg('userId');
  const limit = Number(getArg('limit') || 500);
  const resync = hasFlag('resync');
  const resyncLimit = Number(getArg('resyncLimit') || 20);
  const outDir = getArg('outDir') || path.join(process.cwd(), 'tmp', 'audits');

  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new Error('Use --userId com um ObjectId válido.');
  }

  const userObjectId = new Types.ObjectId(userId);
  await connectToDatabase();

  const connection = await getInstagramConnectionDetails(userObjectId);
  const accessToken = connection?.accessToken;
  if (!accessToken) {
    throw new Error('Usuário sem token de Instagram conectado. Não foi possível auditar.');
  }

  const metrics = await MetricModel.find({
    user: userObjectId,
    source: 'api',
    type: { $in: ['REEL', 'VIDEO'] },
    instagramMediaId: { $exists: true, $nin: [null, ''] },
  })
    .select('_id instagramMediaId postDate source type updatedAt')
    .sort({ postDate: -1 })
    .limit(limit)
    .lean<Array<{ _id: Types.ObjectId; instagramMediaId?: string; postDate?: Date }>>();

  logger.info(`${TAG} Auditando ${metrics.length} métricas para user=${userId}.`);

  const suspicious: SuspiciousItem[] = [];

  for (const metric of metrics) {
    const mediaId = metric.instagramMediaId;
    if (!mediaId) continue;

    const metricDate = toDate(metric.postDate ?? null);
    if (!metricDate) {
      suspicious.push({
        metricId: metric._id.toString(),
        instagramMediaId: mediaId,
        reason: 'METRIC_DATE_INVALID',
        metricPostDateIso: null,
        igTimestampIso: null,
        metricDaySP: null,
        igDaySP: null,
        diffHoursAbs: null,
      });
      continue;
    }

    const mediaResult = await fetchSingleInstagramMedia(mediaId, accessToken);
    if (!mediaResult.success || !mediaResult.data?.[0]) {
      suspicious.push({
        metricId: metric._id.toString(),
        instagramMediaId: mediaId,
        reason: 'MEDIA_FETCH_FAILED',
        metricPostDateIso: metricDate.toISOString(),
        igTimestampIso: null,
        metricDaySP: dayKeySP(metricDate),
        igDaySP: null,
        diffHoursAbs: null,
        fetchError: mediaResult.error || 'empty media payload',
      });
      continue;
    }

    const igRaw = mediaResult.data[0].timestamp;
    const igDate = toDate(igRaw ?? null);
    if (!igDate) {
      suspicious.push({
        metricId: metric._id.toString(),
        instagramMediaId: mediaId,
        reason: 'IG_TIMESTAMP_MISSING_OR_INVALID',
        metricPostDateIso: metricDate.toISOString(),
        igTimestampIso: null,
        metricDaySP: dayKeySP(metricDate),
        igDaySP: null,
        diffHoursAbs: null,
      });
      continue;
    }

    const metricDay = dayKeySP(metricDate);
    const igDay = dayKeySP(igDate);
    if (metricDay !== igDay) {
      suspicious.push({
        metricId: metric._id.toString(),
        instagramMediaId: mediaId,
        reason: 'DAY_MISMATCH',
        metricPostDateIso: metricDate.toISOString(),
        igTimestampIso: igDate.toISOString(),
        metricDaySP: metricDay,
        igDaySP: igDay,
        diffHoursAbs: Math.round(Math.abs(metricDate.getTime() - igDate.getTime()) / 3600000),
      });
    }
  }

  const nowTag = new Date().toISOString().replaceAll(':', '-');
  await fs.mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `video-postdate-audit-${userId}-${nowTag}.json`);
  const csvPath = path.join(outDir, `video-postdate-audit-${userId}-${nowTag}.csv`);

  const report = {
    userId,
    timezone: DISPLAY_TIMEZONE,
    scannedAt: new Date().toISOString(),
    scannedCount: metrics.length,
    suspiciousCount: suspicious.length,
    suspicious,
  };

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  await fs.writeFile(csvPath, toCsv(suspicious), 'utf-8');

  logger.info(`${TAG} Relatório JSON salvo em: ${jsonPath}`);
  logger.info(`${TAG} Relatório CSV salvo em: ${csvPath}`);

  if (!resync) {
    logger.info(`${TAG} Dry run finalizado. Use --resync para reprocessar itens suspeitos.`);
    return;
  }

  const candidates = suspicious
    .filter((item) => item.reason === 'DAY_MISMATCH')
    .slice(0, Math.max(0, resyncLimit));
  logger.info(`${TAG} Iniciando resync de ${candidates.length} itens suspeitos (limite=${resyncLimit}).`);

  const resyncResults: ResyncResult[] = [];
  for (const item of candidates) {
    const result = await refreshSinglePubliMetric(userId, item.instagramMediaId);
    resyncResults.push({
      instagramMediaId: item.instagramMediaId,
      metricId: item.metricId,
      success: result.success,
      message: result.message,
    });
  }

  const resyncPath = path.join(outDir, `video-postdate-resync-${userId}-${nowTag}.json`);
  await fs.writeFile(
    resyncPath,
    JSON.stringify(
      {
        userId,
        executedAt: new Date().toISOString(),
        requested: candidates.length,
        successCount: resyncResults.filter((r) => r.success).length,
        failureCount: resyncResults.filter((r) => !r.success).length,
        results: resyncResults,
      },
      null,
      2
    ),
    'utf-8'
  );

  logger.info(`${TAG} Resultado de resync salvo em: ${resyncPath}`);
}

main()
  .catch((error) => {
    logger.error(`${TAG} Falha no script:`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
