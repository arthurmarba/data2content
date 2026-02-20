import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { PipelineStage } from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ChatSessionModel from "@/app/models/ChatSession";
import ChatMessageLogModel from "@/app/models/ChatMessageLog";
import ChatMessageFeedbackModel from "@/app/models/ChatMessageFeedback";
import ChatSessionFeedbackModel from "@/app/models/ChatSessionFeedback";

type DateRange = { from?: Date; to?: Date };

function parseDateRange(searchParams: URLSearchParams): DateRange {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const parsedFrom = from ? new Date(from) : null;
  const parsedTo = to ? new Date(to) : null;
  return {
    from: parsedFrom && !isNaN(parsedFrom.getTime()) ? parsedFrom : undefined,
    to: parsedTo && !isNaN(parsedTo.getTime()) ? parsedTo : undefined,
  };
}

function buildSessionMatch(range: DateRange, filters: Record<string, any>) {
  const match: Record<string, any> = {};
  if (range.from || range.to) {
    match.startedAt = {};
    if (range.from) match.startedAt.$gte = range.from;
    if (range.to) match.startedAt.$lte = range.to;
  }
  if (filters.ragEnabled !== undefined) match.ragEnabled = filters.ragEnabled;
  if (filters.promptVariant) match.promptVariant = filters.promptVariant;
  if (filters.experimentId) match.experimentId = filters.experimentId;
  if (filters.modelVersion) match.modelVersion = filters.modelVersion;
  return match;
}

function prefixMatch(match: Record<string, any>, prefix: string) {
  const prefixed: Record<string, any> = {};
  for (const [key, value] of Object.entries(match)) {
    prefixed[`${prefix}.${key}`] = value;
  }
  return prefixed;
}

export async function GET(req: Request) {
  const session = (await getServerSession(authOptions)) as any;
  const role = (session?.user as any)?.role || "";
  if (role.toLowerCase() !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const range = parseDateRange(searchParams);
  const filters = {
    ragEnabled:
      searchParams.get("ragEnabled") === "true"
        ? true
        : searchParams.get("ragEnabled") === "false"
          ? false
          : undefined,
    promptVariant: searchParams.get("promptVariant") || undefined,
    experimentId: searchParams.get("experimentId") || undefined,
    modelVersion: searchParams.get("modelVersion") || undefined,
  };

  await connectToDatabase();
  const matchSessions = buildSessionMatch(range, filters);
  const hasSessionFilters = Boolean(
    range.from ||
      range.to ||
      filters.ragEnabled !== undefined ||
      filters.promptVariant ||
      filters.experimentId ||
      filters.modelVersion
  );
  const joinedSessionMatch = prefixMatch(matchSessions, "session");

  const logMatch: Record<string, any> = {};
  if (matchSessions.startedAt) {
    logMatch.createdAt = matchSessions.startedAt;
  }
  if (filters.promptVariant) logMatch.promptVariant = filters.promptVariant;
  if (filters.experimentId) logMatch.experimentId = filters.experimentId;
  if (filters.modelVersion) logMatch.modelVersion = filters.modelVersion;
  if (filters.ragEnabled !== undefined) logMatch.ragEnabled = filters.ragEnabled;
  const joinedLogMatch = prefixMatch(logMatch, "log");
  const applyFeedbackLogFilter = Object.keys(logMatch).length > 0;

  const csatPipeline: PipelineStage[] = [
    ...(hasSessionFilters
      ? [
          {
            $lookup: {
              from: "chat_sessions",
              localField: "sessionId",
              foreignField: "_id",
              as: "session",
            },
          },
          { $unwind: "$session" },
          { $match: joinedSessionMatch },
        ]
      : []),
    {
      $group: {
        _id: "$csat",
        count: { $sum: 1 },
      },
    },
  ];

  const feedbackPipeline: PipelineStage[] = [
    ...(applyFeedbackLogFilter
      ? [
          {
            $lookup: {
              from: "chat_message_logs",
              localField: "messageId",
              foreignField: "messageId",
              as: "log",
            },
          },
          { $unwind: "$log" },
          { $match: joinedLogMatch },
        ]
      : []),
    {
      $group: {
        _id: "$rating",
        count: { $sum: 1 },
      },
    },
  ];

  const thumbsDownInsightsPipeline: PipelineStage[] = [
    {
      $lookup: {
        from: "chat_message_logs",
        localField: "messageId",
        foreignField: "messageId",
        as: "log",
      },
    },
    { $unwind: "$log" },
    { $match: { rating: "down", ...joinedLogMatch } },
    {
      $facet: {
        intentsWithThumbsDown: [
          {
            $group: {
              _id: { intent: "$log.intent", fallback: "$log.fallbackReason" },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ],
        contextSourcesWithThumbsDown: [
          { $unwind: { path: "$log.contextSourcesUsed", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: "$log.contextSourcesUsed",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ],
        thumbsDownReasons: [
          {
            $group: {
              _id: { $ifNull: ["$reasonCode", "$reason"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ],
      },
    },
  ];

  const scriptInsightsPipeline: PipelineStage[] = [
    {
      $match: {
        ...logMatch,
        role: "assistant",
        intent: { $in: ["script_request", "humor_script_request", "proactive_script_accept"] },
      },
    },
    {
      $facet: {
        scriptFallbackLevels: [
          {
            $group: {
              _id: { $ifNull: ["$scriptFallbackLevel", "none"] },
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
        ],
        scriptRepairIssues: [
          { $unwind: { path: "$scriptRepairIssues", preserveNullAndEmptyArrays: false } },
          {
            $group: {
              _id: "$scriptRepairIssues",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ],
      },
    },
  ];

  const now = new Date();
  const [
    sessionKpiAgg,
    csatAgg,
    messageStatsAgg,
    feedbackAgg,
    thumbsDownInsightsAgg,
    fallbackBreakdown,
    topFallbackQuestions,
    scriptInsightsAgg,
    latenciesAgg,
    firstResponseAgg,
    timeSeries,
  ] = await Promise.all([
    ChatSessionModel.aggregate([
      { $match: matchSessions },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          csatPromptedCount: { $sum: { $cond: [{ $ifNull: ["$csatPromptedAt", false] }, 1, 0] } },
          csatSubmittedCount: { $sum: { $cond: [{ $eq: ["$csatSubmitted", true] }, 1, 0] } },
          avgDuration: {
            $avg: {
              $subtract: [{ $ifNull: ["$endedAt", now] }, "$startedAt"],
            },
          },
        },
      },
    ]),
    ChatSessionFeedbackModel.aggregate(csatPipeline),
    ChatMessageLogModel.aggregate([
      { $match: logMatch },
      {
        $group: {
          _id: "$sessionId",
          count: { $sum: 1 },
          fallbacks: { $sum: { $cond: [{ $eq: ["$hadFallback", true] }, 1, 0] } },
        },
      },
      {
        $group: {
          _id: null,
          sessionBuckets: { $sum: 1 },
          totalMessages: { $sum: "$count" },
          fallbackSessions: { $sum: { $cond: [{ $gt: ["$fallbacks", 0] }, 1, 0] } },
        },
      },
    ]),
    ChatMessageFeedbackModel.aggregate(feedbackPipeline),
    ChatMessageFeedbackModel.aggregate(thumbsDownInsightsPipeline),
    ChatMessageLogModel.aggregate([
      { $match: { ...logMatch, hadFallback: true } },
      {
        $group: {
          _id: "$fallbackReason",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]),
    ChatMessageLogModel.aggregate([
      { $match: { ...logMatch, hadFallback: true } },
      {
        $project: {
          content: 1,
          fallbackReason: 1,
          intent: 1,
          hash: { $substr: ["$content", 0, 120] },
        },
      },
      {
        $group: {
          _id: { fallbackReason: "$fallbackReason", intent: "$intent", hash: "$hash" },
          count: { $sum: 1 },
          sample: { $first: "$content" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]),
    ChatMessageLogModel.aggregate(scriptInsightsPipeline),
    ChatMessageLogModel.aggregate([
      { $match: { ...logMatch, role: "assistant" } },
      {
        $group: {
          _id: null,
          llm: { $push: "$llmLatencyMs" },
          total: { $push: "$totalLatencyMs" },
        },
      },
    ]),
    ChatMessageLogModel.aggregate([
      { $match: logMatch },
      { $sort: { createdAt: 1 } },
      {
        $group: {
          _id: "$sessionId",
          firstAssistant: { $first: { $cond: [{ $eq: ["$role", "assistant"] }, "$createdAt", null] } },
          firstUser: { $first: { $cond: [{ $eq: ["$role", "user"] }, "$createdAt", null] } },
        },
      },
      {
        $project: {
          deltaMs: {
            $cond: [
              { $and: ["$firstAssistant", "$firstUser"] },
              { $subtract: ["$firstAssistant", "$firstUser"] },
              null,
            ],
          },
        },
      },
    ]),
    ChatSessionModel.aggregate([
      { $match: matchSessions },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$startedAt" } },
          sessions: { $sum: 1 },
          csatPrompted: { $sum: { $cond: [{ $ifNull: ["$csatPromptedAt", false] }, 1, 0] } },
          csatSubmitted: { $sum: { $cond: [{ $eq: ["$csatSubmitted", true] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const sessionKpis = sessionKpiAgg[0];
  const totalSessions = sessionKpis?.totalSessions ?? 0;
  const csatPromptedCount = sessionKpis?.csatPromptedCount ?? 0;
  const csatSubmittedCount = sessionKpis?.csatSubmittedCount ?? 0;
  const avgDuration = sessionKpis?.avgDuration ?? 0;

  const csatCounts: Record<string, number> = {};
  csatAgg.forEach((c) => {
    csatCounts[String(c._id)] = c.count;
  });
  const csatTotal = Object.entries(csatCounts).reduce((acc, [, c]) => acc + c, 0);
  const csatAvg = csatTotal
    ? Object.entries(csatCounts).reduce((acc, [score, c]) => acc + Number(score) * c, 0) / csatTotal
    : null;

  const messageSummary = messageStatsAgg[0];
  const messagesPerSession = messageSummary?.sessionBuckets
    ? messageSummary.totalMessages / messageSummary.sessionBuckets
    : 0;
  const fallbackSessions = messageSummary?.fallbackSessions ?? 0;
  const fallbackRate = totalSessions ? fallbackSessions / totalSessions : 0;

  let thumbsUp = 0;
  let thumbsDown = 0;
  feedbackAgg.forEach((f) => {
    if (f._id === "up") thumbsUp = f.count;
    if (f._id === "down") thumbsDown = f.count;
  });

  const percentile = (arr: number[], p: number) => {
    const clean = arr.filter((n) => typeof n === "number" && !isNaN(n)).sort((a, b) => a - b);
    if (!clean.length) return null;
    const idx = (clean.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return clean[lower];
    const lowerVal = clean[lower];
    if (typeof lowerVal !== "number") return null;
    const upperVal = typeof clean[upper] === "number" ? clean[upper] : lowerVal;
    return lowerVal + (upperVal - lowerVal) * (idx - lower);
  };

  const llmLatencies = latenciesAgg[0]?.llm || [];
  const totalLatencies = latenciesAgg[0]?.total || [];
  const tfr = firstResponseAgg.map((i) => i.deltaMs).filter((n) => typeof n === "number");
  const thumbsDownInsights = thumbsDownInsightsAgg[0] || {};
  const scriptInsights = scriptInsightsAgg[0] || {};
  const topIntents = thumbsDownInsights.intentsWithThumbsDown || [];
  const topContextSources = thumbsDownInsights.contextSourcesWithThumbsDown || [];
  const topDownReasons = thumbsDownInsights.thumbsDownReasons || [];
  const scriptFallbackLevels = scriptInsights.scriptFallbackLevels || [];
  const scriptRepairIssues = scriptInsights.scriptRepairIssues || [];

  return NextResponse.json({
    kpis: {
      totalSessions,
      csatPromptedCount,
      csatSubmittedCount,
      csatCoverage: totalSessions ? csatPromptedCount / totalSessions : 0,
      csatResponseRate: totalSessions ? csatSubmittedCount / totalSessions : 0,
      csatAvg,
      csatDistribution: csatCounts,
      messagesPerSession,
      avgSessionDurationMs: avgDuration,
      fallbackRate,
      thumbsUp,
      thumbsDown,
      llmLatencyP50: percentile(llmLatencies, 0.5),
      llmLatencyP95: percentile(llmLatencies, 0.95),
      totalLatencyP50: percentile(totalLatencies, 0.5),
      totalLatencyP95: percentile(totalLatencies, 0.95),
      timeToFirstAssistantP50: percentile(tfr, 0.5),
      timeToFirstAssistantP95: percentile(tfr, 0.95),
    },
    top: {
      intentsWithThumbsDown: topIntents,
      fallbackReasons: fallbackBreakdown,
      contextSourcesWithThumbsDown: topContextSources,
      thumbsDownReasons: topDownReasons,
      fallbackQuestions: topFallbackQuestions,
      scriptFallbackLevels,
      scriptRepairIssues,
    },
    timeseries: timeSeries,
  });
}
