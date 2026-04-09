import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import AIGeneratedPost from "@/app/models/AIGeneratedPost";

const DEFAULT_WINDOW_DAYS = 30;
const MAX_WINDOW_DAYS = 365;
const LOW_PERCEIVED_QUALITY_THRESHOLD = 0.72;
const SCRIPT_STRATEGIES = ["my_scripts_create", "my_scripts_adjust"] as const;

function parseWindowDays(searchParams: URLSearchParams): number {
  const raw = Number(searchParams.get("days") || DEFAULT_WINDOW_DAYS);
  if (!Number.isFinite(raw)) return DEFAULT_WINDOW_DAYS;
  const normalized = Math.floor(raw);
  return Math.max(1, Math.min(MAX_WINDOW_DAYS, normalized));
}

function buildScriptsMatch(startDate: Date) {
  return {
    strategy: { $in: Array.from(SCRIPT_STRATEGIES) },
    createdAt: { $gte: startDate },
  };
}

function roundMetric(value: unknown, decimals = 2): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  const factor = 10 ** decimals;
  return Math.round(parsed * factor) / factor;
}

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions)) as any;
  if ((session?.user as any)?.role?.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const windowDays = parseWindowDays(url.searchParams);
  const startDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const matchStage = buildScriptsMatch(startDate);

  await connectToDatabase();

  const [
    overviewAgg,
    sourceAgg,
    initialIssuesAgg,
    finalIssuesAgg,
    recentCasesAgg,
  ] = await Promise.all([
    AIGeneratedPost.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRuns: { $sum: 1 },
          createRuns: { $sum: { $cond: [{ $eq: ["$strategy", "my_scripts_create"] }, 1, 0] } },
          adjustRuns: { $sum: { $cond: [{ $eq: ["$strategy", "my_scripts_adjust"] }, 1, 0] } },
          reviewAttempted: {
            $sum: { $cond: [{ $eq: ["$promptContext.diagnostics.semanticReviewAttempted", true] }, 1, 0] },
          },
          reviewRetried: {
            $sum: { $cond: [{ $eq: ["$promptContext.diagnostics.semanticReviewRetried", true] }, 1, 0] },
          },
          acceptedAfterRetry: {
            $sum: { $cond: [{ $eq: ["$promptContext.diagnostics.semanticReviewAcceptedAfterRetry", true] }, 1, 0] },
          },
          finalPassCount: {
            $sum: { $cond: [{ $eq: ["$promptContext.diagnostics.semanticFinalPasses", true] }, 1, 0] },
          },
          finalFailCount: {
            $sum: { $cond: [{ $eq: ["$promptContext.diagnostics.semanticFinalPasses", false] }, 1, 0] },
          },
          lowPerceivedQualityCount: {
            $sum: {
              $cond: [
                {
                  $lt: [
                    { $ifNull: ["$promptContext.diagnostics.perceivedQualityScore", 1] },
                    LOW_PERCEIVED_QUALITY_THRESHOLD,
                  ],
                },
                1,
                0,
              ],
            },
          },
          avgInitialSemanticScore: { $avg: "$promptContext.diagnostics.semanticInitialOverallScore" },
          avgFinalSemanticScore: { $avg: "$promptContext.diagnostics.semanticFinalOverallScore" },
          avgPerceivedQualityScore: { $avg: "$promptContext.diagnostics.perceivedQualityScore" },
        },
      },
    ]),
    AIGeneratedPost.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$strategy",
          count: { $sum: 1 },
          reviewAttempted: {
            $sum: { $cond: [{ $eq: ["$promptContext.diagnostics.semanticReviewAttempted", true] }, 1, 0] },
          },
          reviewRetried: {
            $sum: { $cond: [{ $eq: ["$promptContext.diagnostics.semanticReviewRetried", true] }, 1, 0] },
          },
          acceptedAfterRetry: {
            $sum: { $cond: [{ $eq: ["$promptContext.diagnostics.semanticReviewAcceptedAfterRetry", true] }, 1, 0] },
          },
          avgFinalSemanticScore: { $avg: "$promptContext.diagnostics.semanticFinalOverallScore" },
          avgPerceivedQualityScore: { $avg: "$promptContext.diagnostics.perceivedQualityScore" },
        },
      },
      { $sort: { count: -1, _id: 1 } },
    ]),
    AIGeneratedPost.aggregate([
      { $match: { ...matchStage, "promptContext.diagnostics.semanticInitialIssues.0": { $exists: true } } },
      { $unwind: "$promptContext.diagnostics.semanticInitialIssues" },
      {
        $group: {
          _id: "$promptContext.diagnostics.semanticInitialIssues",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ]),
    AIGeneratedPost.aggregate([
      { $match: { ...matchStage, "promptContext.diagnostics.semanticFinalIssues.0": { $exists: true } } },
      { $unwind: "$promptContext.diagnostics.semanticFinalIssues" },
      {
        $group: {
          _id: "$promptContext.diagnostics.semanticFinalIssues",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1, _id: 1 } },
      { $limit: 12 },
    ]),
    AIGeneratedPost.aggregate([
      {
        $match: {
          ...matchStage,
          $or: [
            { "promptContext.diagnostics.semanticReviewAcceptedAfterRetry": true },
            { "promptContext.diagnostics.semanticFinalPasses": false },
            { "promptContext.diagnostics.perceivedQualityScore": { $lt: LOW_PERCEIVED_QUALITY_THRESHOLD } },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 12 },
      {
        $project: {
          _id: 0,
          id: { $toString: "$_id" },
          createdAt: 1,
          title: 1,
          strategy: 1,
          source: "$promptContext.source",
          semanticReviewAcceptedAfterRetry: "$promptContext.diagnostics.semanticReviewAcceptedAfterRetry",
          semanticFinalPasses: "$promptContext.diagnostics.semanticFinalPasses",
          semanticInitialOverallScore: "$promptContext.diagnostics.semanticInitialOverallScore",
          semanticFinalOverallScore: "$promptContext.diagnostics.semanticFinalOverallScore",
          perceivedQualityScore: "$promptContext.diagnostics.perceivedQualityScore",
          semanticRewriteBrief: "$promptContext.diagnostics.semanticRewriteBrief",
          semanticFinalIssues: "$promptContext.diagnostics.semanticFinalIssues",
        },
      },
    ]),
  ]);

  const overviewRaw = overviewAgg[0] || {};
  const reviewAttempted = Number(overviewRaw.reviewAttempted || 0);
  const overview = {
    totalRuns: Number(overviewRaw.totalRuns || 0),
    createRuns: Number(overviewRaw.createRuns || 0),
    adjustRuns: Number(overviewRaw.adjustRuns || 0),
    reviewAttempted,
    reviewRetried: Number(overviewRaw.reviewRetried || 0),
    acceptedAfterRetry: Number(overviewRaw.acceptedAfterRetry || 0),
    finalPassCount: Number(overviewRaw.finalPassCount || 0),
    finalFailCount: Number(overviewRaw.finalFailCount || 0),
    lowPerceivedQualityCount: Number(overviewRaw.lowPerceivedQualityCount || 0),
    reviewAttemptRate: reviewAttempted > 0 && overviewRaw.totalRuns ? reviewAttempted / Number(overviewRaw.totalRuns) : 0,
    retryRate: reviewAttempted > 0 ? Number(overviewRaw.reviewRetried || 0) / reviewAttempted : 0,
    acceptanceAfterRetryRate:
      Number(overviewRaw.reviewRetried || 0) > 0
        ? Number(overviewRaw.acceptedAfterRetry || 0) / Number(overviewRaw.reviewRetried || 0)
        : 0,
    finalPassRate: reviewAttempted > 0 ? Number(overviewRaw.finalPassCount || 0) / reviewAttempted : 0,
    avgInitialSemanticScore: roundMetric(overviewRaw.avgInitialSemanticScore),
    avgFinalSemanticScore: roundMetric(overviewRaw.avgFinalSemanticScore),
    avgPerceivedQualityScore: roundMetric(overviewRaw.avgPerceivedQualityScore, 3),
  };

  const sources = sourceAgg.map((row: any) => ({
    source: row._id || "unknown",
    count: Number(row.count || 0),
    reviewAttempted: Number(row.reviewAttempted || 0),
    reviewRetried: Number(row.reviewRetried || 0),
    acceptedAfterRetry: Number(row.acceptedAfterRetry || 0),
    avgFinalSemanticScore: roundMetric(row.avgFinalSemanticScore),
    avgPerceivedQualityScore: roundMetric(row.avgPerceivedQualityScore, 3),
  }));

  const topInitialIssues = initialIssuesAgg.map((row: any) => ({
    issue: String(row._id || "Sem rótulo"),
    count: Number(row.count || 0),
  }));
  const topFinalIssues = finalIssuesAgg.map((row: any) => ({
    issue: String(row._id || "Sem rótulo"),
    count: Number(row.count || 0),
  }));

  const recentCases = recentCasesAgg.map((row: any) => ({
    id: row.id,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
    title: typeof row.title === "string" ? row.title : "Sem título",
    strategy: row.strategy || "unknown",
    source: row.source || "unknown",
    semanticReviewAcceptedAfterRetry: Boolean(row.semanticReviewAcceptedAfterRetry),
    semanticFinalPasses:
      typeof row.semanticFinalPasses === "boolean" ? row.semanticFinalPasses : null,
    semanticInitialOverallScore: roundMetric(row.semanticInitialOverallScore),
    semanticFinalOverallScore: roundMetric(row.semanticFinalOverallScore),
    perceivedQualityScore: roundMetric(row.perceivedQualityScore, 3),
    semanticRewriteBrief:
      typeof row.semanticRewriteBrief === "string" ? row.semanticRewriteBrief : null,
    semanticFinalIssues: Array.isArray(row.semanticFinalIssues)
      ? row.semanticFinalIssues.map((item: unknown) => String(item || "").trim()).filter(Boolean).slice(0, 4)
      : [],
  }));

  return NextResponse.json({
    windowDays,
    from: startDate.toISOString(),
    overview,
    sources,
    topInitialIssues,
    topFinalIssues,
    recentCases,
  });
}
