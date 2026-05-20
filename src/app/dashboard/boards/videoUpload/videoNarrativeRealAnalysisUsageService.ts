import { Types } from "mongoose";
import CreatorVideoNarrativeRealAnalysisUsage from "@/app/models/CreatorVideoNarrativeRealAnalysisUsage";
import type { VideoNarrativeGeminiAllowlistUser } from "./videoNarrativeGeminiAllowlist";
import {
  evaluateVideoNarrativeRealAnalysisUsagePolicy,
  type VideoNarrativeRealAnalysisUsageDecision,
} from "./videoNarrativeRealAnalysisUsagePolicy";

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;
type UsageModelLike = typeof CreatorVideoNarrativeRealAnalysisUsage;

export type VideoNarrativeRealAnalysisUsageSnapshot = {
  userId: string;
  dateKey: string;
  monthKey: string;
  dailyCount: number;
  monthlyCount: number;
  lastAttemptAt?: Date | null;
  lastSuccessAt?: Date | null;
  lastFailureAt?: Date | null;
};

function getDateKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function getMonthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

function toObjectId(userId: string): Types.ObjectId {
  return new Types.ObjectId(userId);
}

function emptyUsage(userId: string, now: Date): VideoNarrativeRealAnalysisUsageSnapshot {
  return {
    userId,
    dateKey: getDateKey(now),
    monthKey: getMonthKey(now),
    dailyCount: 0,
    monthlyCount: 0,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
  };
}

async function sumMonthlyCount(params: {
  userId: string;
  monthKey: string;
  model: UsageModelLike;
}): Promise<number> {
  const aggregateResult = await params.model.aggregate([
    { $match: { userId: toObjectId(params.userId), monthKey: params.monthKey } },
    { $group: { _id: "$userId", total: { $sum: "$dailyCount" } } },
  ]);
  const total = aggregateResult[0]?.total;
  return typeof total === "number" && Number.isFinite(total) ? total : 0;
}

export async function getVideoNarrativeRealAnalysisUsageForUser(params: {
  userId: string;
  now?: Date;
  model?: UsageModelLike;
}): Promise<VideoNarrativeRealAnalysisUsageSnapshot> {
  const now = params.now ?? new Date();
  const model = params.model ?? CreatorVideoNarrativeRealAnalysisUsage;
  const dateKey = getDateKey(now);
  const monthKey = getMonthKey(now);
  const doc = await model.findOne({ userId: toObjectId(params.userId), dateKey }).lean();
  const monthlyCount = await sumMonthlyCount({ userId: params.userId, monthKey, model });

  return {
    ...emptyUsage(params.userId, now),
    dailyCount: typeof doc?.dailyCount === "number" ? doc.dailyCount : 0,
    monthlyCount,
    lastAttemptAt: doc?.lastAttemptAt ?? null,
    lastSuccessAt: doc?.lastSuccessAt ?? null,
    lastFailureAt: doc?.lastFailureAt ?? null,
  };
}

export async function assertCanRunVideoNarrativeRealAnalysis(params: {
  user: VideoNarrativeGeminiAllowlistUser & { planStatus?: string | null };
  env?: EnvLike;
  now?: Date;
  model?: UsageModelLike;
}): Promise<VideoNarrativeRealAnalysisUsageDecision> {
  if (!params.user.id) {
    return evaluateVideoNarrativeRealAnalysisUsagePolicy({
      user: params.user,
      env: params.env,
      now: params.now,
      usage: null,
    });
  }

  const usage = await getVideoNarrativeRealAnalysisUsageForUser({
    userId: params.user.id,
    now: params.now,
    model: params.model,
  });

  return evaluateVideoNarrativeRealAnalysisUsagePolicy({
    user: params.user,
    usage,
    env: params.env,
    now: params.now,
  });
}

export async function recordVideoNarrativeRealAnalysisAttempt(params: {
  userId: string;
  now?: Date;
  model?: UsageModelLike;
}): Promise<VideoNarrativeRealAnalysisUsageSnapshot> {
  const now = params.now ?? new Date();
  const model = params.model ?? CreatorVideoNarrativeRealAnalysisUsage;
  const dateKey = getDateKey(now);
  const monthKey = getMonthKey(now);

  const doc = await model.findOneAndUpdate(
    { userId: toObjectId(params.userId), dateKey },
    {
      $setOnInsert: { userId: toObjectId(params.userId), dateKey, monthKey },
      $set: { lastAttemptAt: now, monthKey },
      $inc: { dailyCount: 1 },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  const monthlyCount = await sumMonthlyCount({ userId: params.userId, monthKey, model });
  await model.updateOne({ _id: doc._id }, { $set: { monthlyCount } });

  return {
    userId: params.userId,
    dateKey,
    monthKey,
    dailyCount: doc.dailyCount,
    monthlyCount,
    lastAttemptAt: doc.lastAttemptAt ?? now,
    lastSuccessAt: doc.lastSuccessAt ?? null,
    lastFailureAt: doc.lastFailureAt ?? null,
  };
}

export async function recordVideoNarrativeRealAnalysisSuccess(params: {
  userId: string;
  now?: Date;
  model?: UsageModelLike;
}): Promise<void> {
  const now = params.now ?? new Date();
  await (params.model ?? CreatorVideoNarrativeRealAnalysisUsage).updateOne(
    { userId: toObjectId(params.userId), dateKey: getDateKey(now) },
    { $set: { lastSuccessAt: now, monthKey: getMonthKey(now) } },
    { upsert: false },
  );
}

export async function recordVideoNarrativeRealAnalysisFailure(params: {
  userId: string;
  reason: string;
  now?: Date;
  model?: UsageModelLike;
}): Promise<void> {
  const now = params.now ?? new Date();
  await (params.model ?? CreatorVideoNarrativeRealAnalysisUsage).updateOne(
    { userId: toObjectId(params.userId), dateKey: getDateKey(now) },
    {
      $set: {
        lastFailureAt: now,
        lastFailureReasonCode: params.reason.slice(0, 80),
        monthKey: getMonthKey(now),
      },
    },
    { upsert: false },
  );
}
