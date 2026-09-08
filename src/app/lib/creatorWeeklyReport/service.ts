import { createHash } from 'node:crypto';
import ContentReadingState from '@/app/models/ContentReadingState';
import MapaSeed from '@/app/models/MapaSeed';
import User from '@/app/models/User';
import DailyMetricSnapshot from '@/app/models/DailyMetricSnapshot';
import { buildProfileEvolution, isoDate, type ReadingStateInput } from './evolution';
import mongoose from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import CreatorWeeklyReport from "@/app/models/CreatorWeeklyReport";
import { lastClosedWeek, type WeekWindow } from "@/app/lib/relatorio/weekWindow";
import { buildCreatorWeeklyReport, type CreatorWeeklyReportMetricInput } from "./engine";
import {
  CREATOR_WEEKLY_REPORT_SCHEMA_VERSION,
  type CreatorWeeklyReportDocumentSnapshot,
  type CreatorWeeklyReportPayload,
} from "./types";

function assertUserId(userId: string) {
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    throw new Error("creator_weekly_report_invalid_user_id");
  }
}

function serializeReport(document: any): CreatorWeeklyReportDocumentSnapshot {
  return {
    id: String(document._id),
    userId: String(document.userId),
    report: document.payload as CreatorWeeklyReportPayload,
    createdAt: new Date(document.createdAt).toISOString(),
    updatedAt: new Date(document.updatedAt).toISOString(),
  };
}

export async function getLatestCreatorWeeklyReport(
  userId: string,
): Promise<CreatorWeeklyReportDocumentSnapshot | null> {
  assertUserId(userId);
  await connectToDatabase();
  const document = await CreatorWeeklyReport.findOne({ userId })
    .sort({ periodEndsAt: -1 })
    .lean();
  return document ? serializeReport(document) : null;
}

export async function generateCreatorWeeklyReport(params: {
  userId: string;
  week?: WeekWindow;
  force?: boolean;
  now?: Date;
}): Promise<CreatorWeeklyReportDocumentSnapshot> {
  assertUserId(params.userId);
  await connectToDatabase();

  const now = params.now ?? new Date();
  const week = params.week ?? lastClosedWeek(now);
  const userObjectId = new mongoose.Types.ObjectId(params.userId);
  const existing = await CreatorWeeklyReport.findOne({ userId: userObjectId, weekKey: week.weekKey }).lean();
  const metrics = await Metric.find({
    user: userObjectId,
    postDate: { $gte: week.windowStartsAt, $lte: now },
  })
    .select(
      "instagramMediaId postLink postDate type description thumbnailUrl coverUrl stats sceneElements classificationStatus createdAt updatedAt",
    )
    .sort({ postDate: 1 })
    .lean<CreatorWeeklyReportMetricInput[]>();

  const [states, map, user, snapshots] = await Promise.all([
    ContentReadingState.find({ _id: { $in: ['provider:gemini', ...metrics.map(metric => String(metric._id))] } }).select('_id state reason nextAttemptAt').lean(),
    MapaSeed.findOne({ userId: userObjectId }).select('instagramEnrichedAt videoEnrichedAt').lean(),
    User.findById(userObjectId).select('lastInstagramSyncAttempt lastInstagramSyncSuccess instagramSyncErrorMsg').lean(),
    DailyMetricSnapshot.aggregate([
      { $match: { metric: { $in: metrics.map(metric => metric._id) }, date: { $gte: week.windowStartsAt, $lte: now } } },
      { $lookup: { from: Metric.collection.name, localField: 'metric', foreignField: '_id', as: 'post', pipeline: [{ $project: { postDate: 1 } }] } },
      { $unwind: '$post' },
      { $match: { $expr: { $and: [
        { $gte: [{ $subtract: ['$date', '$post.postDate'] }, 7 * 86400000] },
        { $lte: [{ $subtract: ['$date', '$post.postDate'] }, 9 * 86400000] },
      ] } } },
      { $sort: { date: 1 } },
      { $group: { _id: '$metric', capturedAt: { $first: '$date' }, shares: { $first: '$cumulativeShares' }, saved: { $first: '$cumulativeSaved' }, views: { $first: '$cumulativeViews' } } },
    ]),
  ]);
  const byId = new Map(snapshots.map(snapshot => [String(snapshot._id), snapshot]));
  for (const metric of metrics) metric.d7Stats = byId.get(String(metric._id)) ?? null;
  const mapReviewedAt = [isoDate(map?.instagramEnrichedAt), isoDate(map?.videoEnrichedAt)].filter(Boolean).sort().at(-1) ?? null;
  const evolution = buildProfileEvolution({ metrics, now, week, states: states as ReadingStateInput[],
    providerPaused: states.some(state => state._id === 'provider:gemini' && state.state !== 'healthy'),
    metricsSyncedAt: user?.lastInstagramSyncSuccess === true ? user.lastInstagramSyncAttempt : null,
    metricsPartial: Boolean(user?.instagramSyncErrorMsg), mapReviewedAt,
  });
  const withEvolution = (document: any): CreatorWeeklyReportDocumentSnapshot => {
    const result = serializeReport(document);
    return { ...result, report: { ...result.report, evolution } };
  };
  const weeklyMetrics = metrics.filter(metric => new Date(metric.postDate) <= week.endsAt);
  const sourceRevision = createHash('sha256').update(JSON.stringify({
    schema: CREATOR_WEEKLY_REPORT_SCHEMA_VERSION, evaluatedDay: now.toISOString().slice(0, 10), week: week.weekKey, metrics: weeklyMetrics,
  })).digest('hex');

  const newestMetricUpdatedAt = weeklyMetrics.reduce<Date | null>((latest, metric) => {
    if (!metric.updatedAt) return latest;
    const updatedAt = new Date(metric.updatedAt);
    return !latest || updatedAt > latest ? updatedAt : latest;
  }, null);

  if (!params.force && existing?.sourceRevision === sourceRevision) return withEvolution(existing);

  const payload = buildCreatorWeeklyReport({ metrics: weeklyMetrics, week, generatedAt: now });
  const values = {
    status: payload.status, schemaVersion: CREATOR_WEEKLY_REPORT_SCHEMA_VERSION,
    periodStartsAt: week.startsAt, periodEndsAt: week.endsAt, generatedAt: now,
    sourceMetricsUpdatedAt: newestMetricUpdatedAt, sourceRevision,
    coverage: payload.coverage, payload, safeErrorCode: null,
  };
  if (!existing) {
    try {
      const document = await CreatorWeeklyReport.create({ ...values, userId: userObjectId, weekKey: week.weekKey, attempts: 1 });
      return withEvolution(document);
    } catch (error: any) {
      if (error?.code !== 11000) throw error;
      const winner = await CreatorWeeklyReport.findOne({ userId: userObjectId, weekKey: week.weekKey }).lean();
      if (!winner) throw error;
      return withEvolution(winner);
    }
  }
  // Compare-and-swap: uma geração que começou sobre versão antiga não substitui
  // a escrita de outro worker. O payload legado permanece disponível para auditoria.
  const document = await CreatorWeeklyReport.findOneAndUpdate(
    { _id: existing._id, updatedAt: existing.updatedAt },
    { $set: { ...values, ...(existing.schemaVersion !== CREATOR_WEEKLY_REPORT_SCHEMA_VERSION && !existing.previousPayload ? { previousPayload: existing.payload } : {}) }, $inc: { attempts: 1 } },
    { new: true },
  ).lean();
  const winner = document ?? await CreatorWeeklyReport.findById(existing._id).lean();
  if (!winner) throw new Error('creator_weekly_report_write_failed');
  return withEvolution(winner);
}

export async function getOrGenerateCreatorWeeklyReport(
  userId: string,
): Promise<CreatorWeeklyReportDocumentSnapshot> {
  return generateCreatorWeeklyReport({ userId });
}
