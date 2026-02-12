import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const TAG = '[auditVideoPostDates]';
const DISPLAY_TIMEZONE = 'America/Sao_Paulo';
const API_VERSION = 'v22.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

const FEED_MEDIA_INSIGHTS_METRICS =
  'reach,views,likes,comments,saved,shares,total_interactions,profile_activity,profile_visits,follows';
const REEL_INSIGHTS_METRICS =
  'reach,views,likes,comments,saved,shares,total_interactions,ig_reels_avg_watch_time,ig_reels_video_view_total_time';
const STORY_INSIGHTS_METRICS =
  'reach,views,likes,comments,saved,shares,total_interactions,navigation,replies,follows,profile_activity,profile_visits';

const REASONS = {
  METRIC_DATE_INVALID: 'METRIC_DATE_INVALID',
  MEDIA_FETCH_FAILED: 'MEDIA_FETCH_FAILED',
  IG_TIMESTAMP_MISSING_OR_INVALID: 'IG_TIMESTAMP_MISSING_OR_INVALID',
  DAY_MISMATCH: 'DAY_MISMATCH',
  INSIGHTS_FETCH_FAILED: 'INSIGHTS_FETCH_FAILED',
  VIEWS_MISMATCH: 'VIEWS_MISMATCH',
};

function getArg(name) {
  const args = process.argv.slice(2);
  const idx = args.indexOf(`--${name}`);
  if (idx < 0) return undefined;
  return args[idx + 1];
}

function hasFlag(name) {
  return process.argv.slice(2).includes(`--${name}`);
}

function toDate(value) {
  const date = value instanceof Date ? value : (typeof value === 'string' ? new Date(value) : null);
  if (!date || Number.isNaN(date.getTime())) return null;
  return date;
}

function dayKeySP(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function compactNumber(value) {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function normalizeStoredViews(metricDoc) {
  const views = compactNumber(metricDoc?.stats?.views);
  if (views && views > 0) return views;
  const videoViews = compactNumber(metricDoc?.stats?.video_views);
  if (videoViews && videoViews > 0) return videoViews;
  const reach = compactNumber(metricDoc?.stats?.reach);
  if (reach && reach > 0) return reach;
  return 0;
}

function escapeCsv(value) {
  const raw = value === null || value === undefined ? '' : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function toCsv(rows) {
  const header = [
    'metricId',
    'instagramMediaId',
    'reason',
    'metricPostDateIso',
    'igTimestampIso',
    'metricDaySP',
    'igDaySP',
    'metricViews',
    'igViews',
    'diffHoursAbs',
    'fetchError',
  ];
  const lines = rows.map((row) => [
    row.metricId,
    row.instagramMediaId,
    row.reason,
    row.metricPostDateIso,
    row.igTimestampIso,
    row.metricDaySP,
    row.igDaySP,
    row.metricViews ?? '',
    row.igViews ?? '',
    row.diffHoursAbs ?? '',
    row.fetchError ?? '',
  ].map(escapeCsv).join(','));
  return [header.join(','), ...lines].join('\n');
}

async function graphGetJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    const detail = payload?.error?.message || response.statusText || 'Unknown Graph API error';
    throw new Error(detail);
  }
  return payload;
}

function buildMediaUrl(mediaId, accessToken) {
  const fields = 'id,media_type,media_product_type,timestamp,caption,permalink,username,media_url,thumbnail_url,parent_id';
  return `${GRAPH_BASE_URL}/${mediaId}?fields=${fields}&access_token=${accessToken}`;
}

function metricsForMedia(media) {
  if (media?.media_product_type === 'REELS') return REEL_INSIGHTS_METRICS;
  if (media?.media_product_type === 'STORY') return STORY_INSIGHTS_METRICS;
  return FEED_MEDIA_INSIGHTS_METRICS;
}

async function fetchInsights(mediaId, media, accessToken) {
  const metrics = metricsForMedia(media);
  const url = `${GRAPH_BASE_URL}/${mediaId}/insights?metric=${metrics}&access_token=${accessToken}`;
  const payload = await graphGetJson(url);
  const stats = {};
  for (const item of payload?.data || []) {
    const key = item?.name;
    const values = Array.isArray(item?.values) ? item.values : [];
    if (!key || values.length === 0) continue;
    const lastEntry = values[values.length - 1];
    if (lastEntry && lastEntry.value !== undefined && lastEntry.value !== null) {
      stats[key] = lastEntry.value;
    }
  }
  if (typeof stats.total_interactions !== 'number') {
    const likes = Number(stats.likes || 0);
    const comments = Number(stats.comments || 0);
    const shares = Number(stats.shares || 0);
    const saved = Number(stats.saved || 0);
    stats.total_interactions = likes + comments + shares + saved;
  }
  return stats;
}

function normalizeIgViews(stats) {
  const views = compactNumber(stats?.views);
  if (views && views > 0) return views;
  const videoViews = compactNumber(stats?.video_views);
  if (videoViews && videoViews > 0) return videoViews;
  const plays = compactNumber(stats?.plays);
  if (plays && plays > 0) return plays;
  const reach = compactNumber(stats?.reach);
  if (reach && reach > 0) return reach;
  return 0;
}

function shouldFlagViewsMismatch(storedViews, igViews) {
  if (!Number.isFinite(storedViews) || !Number.isFinite(igViews)) return false;
  if (igViews <= 0) return false;
  if (storedViews <= 0) return true;
  const ratio = Math.abs(igViews - storedViews) / igViews;
  return ratio >= 0.05;
}

async function loadUserDoc(userObjectId) {
  const usersCollection = mongoose.connection.collection('users');
  return usersCollection.findOne(
    { _id: userObjectId },
    { projection: { instagramAccessToken: 1, instagramAccountId: 1, username: 1 } },
  );
}

async function writeReportFiles({ outDir, userId, suspicious, resyncResults = null }) {
  const nowTag = new Date().toISOString().replaceAll(':', '-');
  await fs.mkdir(outDir, { recursive: true });

  const auditJsonPath = path.join(outDir, `video-postdate-audit-${userId}-${nowTag}.json`);
  const auditCsvPath = path.join(outDir, `video-postdate-audit-${userId}-${nowTag}.csv`);
  await fs.writeFile(auditJsonPath, JSON.stringify({
    userId,
    timezone: DISPLAY_TIMEZONE,
    scannedAt: new Date().toISOString(),
    suspiciousCount: suspicious.length,
    suspicious,
  }, null, 2), 'utf-8');
  await fs.writeFile(auditCsvPath, toCsv(suspicious), 'utf-8');

  let resyncPath = null;
  if (resyncResults) {
    resyncPath = path.join(outDir, `video-postdate-resync-${userId}-${nowTag}.json`);
    await fs.writeFile(resyncPath, JSON.stringify(resyncResults, null, 2), 'utf-8');
  }

  return { auditJsonPath, auditCsvPath, resyncPath };
}

async function main() {
  const userId = getArg('userId');
  const limit = Math.max(1, Number(getArg('limit') || 500));
  const resync = hasFlag('resync');
  const resyncLimit = Math.max(1, Number(getArg('resyncLimit') || 20));
  const outDir = getArg('outDir') || path.join(process.cwd(), 'tmp', 'audits');

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error('Use --userId com um ObjectId válido.');
  }
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI não definida.');

  await mongoose.connect(mongoUri);
  const userDoc = await loadUserDoc(userObjectId);
  if (!userDoc) {
    throw new Error(`Usuário ${userId} não encontrado na coleção users deste ambiente.`);
  }
  const accessToken = userDoc.instagramAccessToken || null;
  if (!accessToken) {
    throw new Error(`Usuário ${userId} encontrado, mas sem instagramAccessToken neste ambiente.`);
  }

  const metricsCollection = mongoose.connection.collection('metrics');
  const metrics = await metricsCollection.find({
    user: userObjectId,
    source: 'api',
    type: { $in: ['REEL', 'VIDEO'] },
    instagramMediaId: { $exists: true, $nin: [null, ''] },
  }).project({
    _id: 1,
    instagramMediaId: 1,
    postDate: 1,
    stats: 1,
    updatedAt: 1,
  }).sort({ postDate: -1 }).limit(limit).toArray();

  console.log(`${TAG} Scanning ${metrics.length} metrics for user=${userId}`);

  const suspicious = [];
  const syncCandidates = [];

  for (const metric of metrics) {
    const mediaId = metric.instagramMediaId;
    const metricDate = toDate(metric.postDate);
    const metricViews = normalizeStoredViews(metric);

    if (!metricDate) {
      suspicious.push({
        metricId: String(metric._id),
        instagramMediaId: mediaId,
        reason: REASONS.METRIC_DATE_INVALID,
        metricPostDateIso: null,
        igTimestampIso: null,
        metricDaySP: null,
        igDaySP: null,
        metricViews,
        igViews: null,
        diffHoursAbs: null,
      });
      syncCandidates.push({ metricId: String(metric._id), instagramMediaId: mediaId });
      continue;
    }

    let media;
    try {
      media = await graphGetJson(buildMediaUrl(mediaId, accessToken));
    } catch (error) {
      suspicious.push({
        metricId: String(metric._id),
        instagramMediaId: mediaId,
        reason: REASONS.MEDIA_FETCH_FAILED,
        metricPostDateIso: metricDate.toISOString(),
        igTimestampIso: null,
        metricDaySP: dayKeySP(metricDate),
        igDaySP: null,
        metricViews,
        igViews: null,
        diffHoursAbs: null,
        fetchError: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const igDate = toDate(media.timestamp);
    if (!igDate) {
      suspicious.push({
        metricId: String(metric._id),
        instagramMediaId: mediaId,
        reason: REASONS.IG_TIMESTAMP_MISSING_OR_INVALID,
        metricPostDateIso: metricDate.toISOString(),
        igTimestampIso: null,
        metricDaySP: dayKeySP(metricDate),
        igDaySP: null,
        metricViews,
        igViews: null,
        diffHoursAbs: null,
      });
      continue;
    }

    const metricDay = dayKeySP(metricDate);
    const igDay = dayKeySP(igDate);
    if (metricDay !== igDay) {
      suspicious.push({
        metricId: String(metric._id),
        instagramMediaId: mediaId,
        reason: REASONS.DAY_MISMATCH,
        metricPostDateIso: metricDate.toISOString(),
        igTimestampIso: igDate.toISOString(),
        metricDaySP: metricDay,
        igDaySP: igDay,
        metricViews,
        igViews: null,
        diffHoursAbs: Math.round(Math.abs(metricDate.getTime() - igDate.getTime()) / 3600000),
      });
      syncCandidates.push({ metricId: String(metric._id), instagramMediaId: mediaId });
    }

    try {
      const igStats = await fetchInsights(mediaId, media, accessToken);
      const igViews = normalizeIgViews(igStats);
      if (shouldFlagViewsMismatch(metricViews, igViews)) {
        suspicious.push({
          metricId: String(metric._id),
          instagramMediaId: mediaId,
          reason: REASONS.VIEWS_MISMATCH,
          metricPostDateIso: metricDate.toISOString(),
          igTimestampIso: igDate.toISOString(),
          metricDaySP: metricDay,
          igDaySP: igDay,
          metricViews,
          igViews,
          diffHoursAbs: Math.round(Math.abs(metricDate.getTime() - igDate.getTime()) / 3600000),
        });
        syncCandidates.push({ metricId: String(metric._id), instagramMediaId: mediaId });
      }
    } catch (error) {
      suspicious.push({
        metricId: String(metric._id),
        instagramMediaId: mediaId,
        reason: REASONS.INSIGHTS_FETCH_FAILED,
        metricPostDateIso: metricDate.toISOString(),
        igTimestampIso: igDate.toISOString(),
        metricDaySP: metricDay,
        igDaySP: igDay,
        metricViews,
        igViews: null,
        diffHoursAbs: Math.round(Math.abs(metricDate.getTime() - igDate.getTime()) / 3600000),
        fetchError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const uniqueCandidates = Array.from(
    new Map(syncCandidates.map((item) => [item.instagramMediaId, item])).values(),
  );

  let resyncSummary = null;
  if (resync) {
    const candidates = uniqueCandidates.slice(0, resyncLimit);
    console.log(`${TAG} Resync enabled. Processing ${candidates.length} candidates...`);
    const results = [];

    for (const item of candidates) {
      const now = new Date();
      try {
        const media = await graphGetJson(buildMediaUrl(item.instagramMediaId, accessToken));
        const insights = await fetchInsights(item.instagramMediaId, media, accessToken);
        const parsedTimestamp = toDate(media.timestamp);

        const setOperation = {
          updatedAt: now,
          source: 'api',
          ...(media.permalink ? { postLink: media.permalink } : {}),
          ...(typeof media.caption === 'string' ? { description: media.caption } : {}),
          ...(parsedTimestamp ? { postDate: parsedTimestamp } : {}),
        };

        const statsSet = {};
        for (const [key, value] of Object.entries(insights)) {
          if (value !== null && value !== undefined) {
            statsSet[`stats.${key}`] = value;
          }
        }

        await metricsCollection.updateOne(
          { user: userObjectId, instagramMediaId: item.instagramMediaId },
          { $set: { ...setOperation, ...statsSet } },
        );

        results.push({
          metricId: item.metricId,
          instagramMediaId: item.instagramMediaId,
          success: true,
          message: 'Updated from Instagram API',
          updatedAt: now.toISOString(),
          viewsAfter: normalizeIgViews(insights),
          postDateAfter: parsedTimestamp ? parsedTimestamp.toISOString() : null,
        });
      } catch (error) {
        results.push({
          metricId: item.metricId,
          instagramMediaId: item.instagramMediaId,
          success: false,
          message: error instanceof Error ? error.message : String(error),
          updatedAt: now.toISOString(),
        });
      }
    }

    resyncSummary = {
      userId,
      executedAt: new Date().toISOString(),
      requested: candidates.length,
      successCount: results.filter((r) => r.success).length,
      failureCount: results.filter((r) => !r.success).length,
      results,
    };
  }

  const paths = await writeReportFiles({
    outDir,
    userId,
    suspicious,
    resyncResults: resyncSummary,
  });

  console.log(`${TAG} suspiciousCount=${suspicious.length}`);
  console.log(`${TAG} report json: ${paths.auditJsonPath}`);
  console.log(`${TAG} report csv : ${paths.auditCsvPath}`);
  if (paths.resyncPath) {
    console.log(`${TAG} resync json: ${paths.resyncPath}`);
  }
}

main()
  .catch((error) => {
    console.error(`${TAG} Failed:`, error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
