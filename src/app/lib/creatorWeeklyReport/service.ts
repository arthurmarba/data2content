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
  const metrics = await Metric.find({
    user: userObjectId,
    postDate: { $gte: week.windowStartsAt, $lte: week.endsAt },
  })
    .select(
      "instagramMediaId postLink postDate description thumbnailUrl coverUrl stats sceneElements updatedAt",
    )
    .sort({ postDate: 1 })
    .lean<CreatorWeeklyReportMetricInput[]>();

  const newestMetricUpdatedAt = metrics.reduce<Date | null>((latest, metric) => {
    if (!metric.updatedAt) return latest;
    const updatedAt = new Date(metric.updatedAt);
    return !latest || updatedAt > latest ? updatedAt : latest;
  }, null);

  if (!params.force) {
    const existing = await CreatorWeeklyReport.findOne({
      userId: userObjectId,
      weekKey: week.weekKey,
      schemaVersion: CREATOR_WEEKLY_REPORT_SCHEMA_VERSION,
      status: { $in: ["ready", "partial"] },
    }).lean();
    const existingSource = existing?.sourceMetricsUpdatedAt
      ? new Date(existing.sourceMetricsUpdatedAt).getTime()
      : null;
    const currentSource = newestMetricUpdatedAt?.getTime() ?? null;
    if (existing && existingSource === currentSource) {
      return serializeReport(existing);
    }
  }

  const payload = buildCreatorWeeklyReport({ metrics, week, generatedAt: now });
  const document = await CreatorWeeklyReport.findOneAndUpdate(
    { userId: userObjectId, weekKey: week.weekKey },
    {
      $set: {
        status: payload.status,
        schemaVersion: CREATOR_WEEKLY_REPORT_SCHEMA_VERSION,
        periodStartsAt: week.startsAt,
        periodEndsAt: week.endsAt,
        generatedAt: now,
        sourceMetricsUpdatedAt: newestMetricUpdatedAt,
        coverage: payload.coverage,
        payload,
        safeErrorCode: null,
      },
      $inc: { attempts: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();

  if (!document) throw new Error("creator_weekly_report_write_failed");
  return serializeReport(document);
}

export async function getOrGenerateCreatorWeeklyReport(
  userId: string,
): Promise<CreatorWeeklyReportDocumentSnapshot> {
  return generateCreatorWeeklyReport({ userId });
}
