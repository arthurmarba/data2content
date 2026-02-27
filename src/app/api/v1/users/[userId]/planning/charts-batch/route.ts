import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from "@/app/lib/cache/dashboardCache";
import { logger } from "@/app/lib/logger";
import { getUserReachInteractionTrendChartData } from "@/charts/getReachInteractionTrendChartData";
import getEngagementDistributionByFormatChartData from "@/charts/getEngagementDistributionByFormatChartData";
import { aggregateUserTimePerformance } from "@/utils/aggregateUserTimePerformance";
import { aggregateUserDurationPerformance } from "@/utils/aggregateUserDurationPerformance";
import { getAverageEngagementByGroupings } from "@/utils/getAverageEngagementByGrouping";
import {
  ALLOWED_PLANNING_OBJECTIVES,
  buildPlanningRecommendations,
  PlanningObjectiveMode,
  RecommendationFeedbackStatus,
} from "@/utils/buildPlanningRecommendations";
import { findUserPosts, toProxyUrl } from "@/app/lib/dataService/marketAnalysis/postsService";
import { timePeriodToDays } from "@/utils/timePeriodHelpers";
import { getStartDateFromTimePeriod } from "@/utils/dateHelpers";
import MetricModel from "@/app/models/Metric";
import PlanningRecommendationFeedbackModel from "@/app/models/PlanningRecommendationFeedback";
import { connectToDatabase } from "@/app/lib/dataService/connection";
import {
  ALLOWED_TIME_PERIODS,
  ALLOWED_ENGAGEMENT_METRICS,
  EngagementMetricField,
  TimePeriod,
} from "@/app/lib/constants/timePeriods";

export const dynamic = "force-dynamic";

const SERVICE_TAG = "[api/v1/users/planning/charts-batch]";
const DEFAULT_TIME_PERIOD: TimePeriod = "last_90_days";
const DEFAULT_GRANULARITY: "daily" | "weekly" = "weekly";
const DEFAULT_METRIC_FIELD = "stats.total_interactions";
const DEFAULT_MAX_SLICES = 7;
const MAX_PAGE_LIMIT = 200;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_LIMIT = 200;
const CACHE_SCHEMA_VERSION = "v4";

const DEFAULT_FORMAT_MAPPING: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  REEL: "Reel",
  CAROUSEL_ALBUM: "Carrossel",
};

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

function withServerTiming(
  response: NextResponse,
  timings: Array<{ name: string; durationMs: number }>,
  extraHeaders?: Record<string, string | undefined>
) {
  if (timings.length > 0) {
    response.headers.set(
      "Server-Timing",
      timings.map((timing) => `${timing.name};dur=${timing.durationMs.toFixed(1)}`).join(", ")
    );
  }
  if (extraHeaders) {
    for (const [key, value] of Object.entries(extraHeaders)) {
      if (!value) continue;
      response.headers.set(key, value);
    }
  }
  return response;
}

function isAllowedTimePeriod(period: any): period is TimePeriod {
  return ALLOWED_TIME_PERIODS.includes(period);
}

function isAllowedEngagementMetric(metric: any): metric is EngagementMetricField {
  return ALLOWED_ENGAGEMENT_METRICS.includes(metric);
}

function toPositiveInt(value: string | null, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function isAllowedPlanningObjective(value: any): value is PlanningObjectiveMode {
  return ALLOWED_PLANNING_OBJECTIVES.includes(value);
}

function normalizeActionId(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "").slice(0, 80);
}

async function getRecommendationFeedbackByAction(
  userId: string,
  objectiveMode: PlanningObjectiveMode,
  timePeriod: TimePeriod
): Promise<Record<string, RecommendationFeedbackStatus>> {
  await connectToDatabase();
  const rows = await PlanningRecommendationFeedbackModel.find({
    userId: new Types.ObjectId(userId),
    objectiveMode,
    timePeriod,
  })
    .select("actionId status")
    .lean();

  return rows.reduce<Record<string, RecommendationFeedbackStatus>>((acc, row: any) => {
    const actionId = normalizeActionId(row?.actionId);
    const status = row?.status;
    if (!actionId) return acc;
    if (status !== "applied" && status !== "not_applied") return acc;
    acc[actionId] = status;
    return acc;
  }, {});
}

function extractThumbnail(v: any): string | undefined {
  const fromChildren =
    Array.isArray(v?.children) &&
    (v.children.find((c: any) => c?.thumbnail_url || c?.media_url)?.thumbnail_url ||
      v.children.find((c: any) => c?.media_type && c.media_type !== "VIDEO" && c?.media_url)?.media_url ||
      v.children[0]?.thumbnail_url ||
      v.children[0]?.media_url);

  return (
    v.thumbnailUrl ||
    v.coverUrl ||
    v.previewUrl ||
    v.imageUrl ||
    v.thumbnail_url ||
    v.mediaPreviewUrl ||
    v.media_url ||
    v.preview_image_url ||
    v.display_url ||
    fromChildren
  );
}

function normalizeThumb(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("/api/proxy/thumbnail/")) return url;
  if (/^https?:\/\//i.test(url)) return toProxyUrl(url);
  return url;
}

type ChartsBatchComputeTimings = {
  trendMs?: number;
  timeMs?: number;
  durationMs?: number;
  formatMs?: number;
  groupingsMs?: number;
  postsMs?: number;
  normalizeMs?: number;
  strategicDeltasMs?: number;
};

type PeriodAggregateMetrics = {
  postsCount: number;
  avgInteractionsPerPost: number;
  avgSavesPerPost: number;
  avgCommentsPerPost: number;
};

type StrategicMetricDelta = {
  currentAvg: number | null;
  previousAvg: number | null;
  deltaRatio: number | null;
  currentPosts: number;
  previousPosts: number;
  hasMinimumSample: boolean;
};

const STRATEGIC_DELTA_MIN_SAMPLE = 3;
const SUPPORTED_POST_TYPES = ["REEL", "VIDEO", "IMAGE", "CAROUSEL_ALBUM"];

const toSafeNumber = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function buildMetricDelta(
  currentAvgRaw: number,
  previousAvgRaw: number,
  currentPosts: number,
  previousPosts: number
): StrategicMetricDelta {
  const currentAvg = Number.isFinite(currentAvgRaw) ? currentAvgRaw : 0;
  const previousAvg = Number.isFinite(previousAvgRaw) ? previousAvgRaw : 0;
  return {
    currentAvg,
    previousAvg,
    deltaRatio: previousAvg > 0 ? (currentAvg - previousAvg) / previousAvg : null,
    currentPosts,
    previousPosts,
    hasMinimumSample: currentPosts >= STRATEGIC_DELTA_MIN_SAMPLE && previousPosts >= STRATEGIC_DELTA_MIN_SAMPLE,
  };
}

function getEquivalentPeriodRange(timePeriod: TimePeriod, referenceDate = new Date()) {
  if (timePeriod === "all_time") return null;
  const currentEnd = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    23,
    59,
    59,
    999
  );
  const currentStart = getStartDateFromTimePeriod(currentEnd, timePeriod);
  if (!(currentStart instanceof Date) || Number.isNaN(currentStart.getTime())) return null;
  const rangeMs = currentEnd.getTime() - currentStart.getTime() + 1;
  if (!Number.isFinite(rangeMs) || rangeMs <= 0) return null;

  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - rangeMs + 1);

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  };
}

async function aggregatePeriodMetrics(userObjectId: Types.ObjectId, startDate: Date, endDate: Date): Promise<PeriodAggregateMetrics> {
  const aggregated = await MetricModel.aggregate([
    {
      $match: {
        user: userObjectId,
        type: { $in: SUPPORTED_POST_TYPES },
        postDate: { $gte: startDate, $lte: endDate },
      },
    },
    {
      $project: {
        likes: { $ifNull: ["$stats.likes", 0] },
        comments: { $ifNull: ["$stats.comments", 0] },
        shares: { $ifNull: ["$stats.shares", 0] },
        saves: { $ifNull: ["$stats.saved", { $ifNull: ["$stats.saves", 0] }] },
        totalInteractionsRaw: "$stats.total_interactions",
      },
    },
    {
      $addFields: {
        totalInteractions: {
          $ifNull: ["$totalInteractionsRaw", { $add: ["$likes", "$comments", "$shares", "$saves"] }],
        },
      },
    },
    {
      $group: {
        _id: null,
        postsCount: { $sum: 1 },
        interactionsSum: { $sum: "$totalInteractions" },
        savesSum: { $sum: "$saves" },
        commentsSum: { $sum: "$comments" },
      },
    },
  ]);

  const row = aggregated[0];
  const postsCount = toSafeNumber(row?.postsCount);
  const interactionsSum = toSafeNumber(row?.interactionsSum);
  const savesSum = toSafeNumber(row?.savesSum);
  const commentsSum = toSafeNumber(row?.commentsSum);
  return {
    postsCount,
    avgInteractionsPerPost: postsCount > 0 ? interactionsSum / postsCount : 0,
    avgSavesPerPost: postsCount > 0 ? savesSum / postsCount : 0,
    avgCommentsPerPost: postsCount > 0 ? commentsSum / postsCount : 0,
  };
}

async function computeStrategicDeltas(userId: string, timePeriod: TimePeriod) {
  const range = getEquivalentPeriodRange(timePeriod);
  if (!range) return null;

  const userObjectId = new Types.ObjectId(userId);
  const [currentMetrics, previousMetrics] = await Promise.all([
    aggregatePeriodMetrics(userObjectId, range.currentStart, range.currentEnd),
    aggregatePeriodMetrics(userObjectId, range.previousStart, range.previousEnd),
  ]);

  return {
    mode: "equivalent_period",
    range: {
      currentStart: range.currentStart.toISOString(),
      currentEnd: range.currentEnd.toISOString(),
      previousStart: range.previousStart.toISOString(),
      previousEnd: range.previousEnd.toISOString(),
    },
    metrics: {
      interactionsPerPost: buildMetricDelta(
        currentMetrics.avgInteractionsPerPost,
        previousMetrics.avgInteractionsPerPost,
        currentMetrics.postsCount,
        previousMetrics.postsCount
      ),
      savesPerPost: buildMetricDelta(
        currentMetrics.avgSavesPerPost,
        previousMetrics.avgSavesPerPost,
        currentMetrics.postsCount,
        previousMetrics.postsCount
      ),
      commentsPerPost: buildMetricDelta(
        currentMetrics.avgCommentsPerPost,
        previousMetrics.avgCommentsPerPost,
        currentMetrics.postsCount,
        previousMetrics.postsCount
      ),
    },
  };
}

export async function GET(
  request: Request,
  { params }: { params: { userId: string } }
) {
  const startedAt = nowMs();
  const timings: Array<{ name: string; durationMs: number }> = [];
  const { userId } = params;

  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "User ID inválido ou ausente." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const timePeriodParam = searchParams.get("timePeriod");
  const granularityParam = searchParams.get("granularity");
  const metricParam = searchParams.get("metric");
  const engagementMetricParam = searchParams.get("engagementMetricField");
  const maxSlicesParam = searchParams.get("maxSlices");
  const pageParam = searchParams.get("page");
  const limitParam = searchParams.get("limit");
  const objectiveModeParam = searchParams.get("objectiveMode");

  const timePeriod: TimePeriod = isAllowedTimePeriod(timePeriodParam) ? timePeriodParam : DEFAULT_TIME_PERIOD;
  if (timePeriodParam && !isAllowedTimePeriod(timePeriodParam)) {
    return NextResponse.json(
      { error: `timePeriod inválido. Permitidos: ${ALLOWED_TIME_PERIODS.join(", ")}` },
      { status: 400 }
    );
  }

  const granularity: "daily" | "weekly" =
    granularityParam === "daily" || granularityParam === "weekly"
      ? granularityParam
      : DEFAULT_GRANULARITY;
  if (granularityParam && granularityParam !== "daily" && granularityParam !== "weekly") {
    return NextResponse.json({ error: "granularity inválido. Permitidos: daily, weekly." }, { status: 400 });
  }

  const engagementMetricField: EngagementMetricField = isAllowedEngagementMetric(engagementMetricParam)
    ? engagementMetricParam
    : (DEFAULT_METRIC_FIELD as EngagementMetricField);
  if (engagementMetricParam && !isAllowedEngagementMetric(engagementMetricParam)) {
    return NextResponse.json(
      { error: `engagementMetricField inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(", ")}` },
      { status: 400 }
    );
  }

  const metricField = metricParam || DEFAULT_METRIC_FIELD;
  const page = toPositiveInt(pageParam, DEFAULT_PAGE);
  const limit = Math.min(toPositiveInt(limitParam, DEFAULT_PAGE_LIMIT), MAX_PAGE_LIMIT);
  const maxSlices = toPositiveInt(maxSlicesParam, DEFAULT_MAX_SLICES);
  const objectiveMode: PlanningObjectiveMode = isAllowedPlanningObjective(objectiveModeParam)
    ? objectiveModeParam
    : "engagement";
  if (objectiveModeParam && !isAllowedPlanningObjective(objectiveModeParam)) {
    return NextResponse.json(
      {
        error: `objectiveMode inválido. Permitidos: ${ALLOWED_PLANNING_OBJECTIVES.join(", ")}`,
      },
      { status: 400 }
    );
  }
  const periodInDaysValue = timePeriodToDays(timePeriod);

  try {
    const cacheWrapStartedAt = nowMs();
    const cacheKey = `${SERVICE_TAG}:${JSON.stringify({
      v: CACHE_SCHEMA_VERSION,
      userId,
      timePeriod,
      granularity,
      metricField,
      engagementMetricField,
      maxSlices,
      page,
      limit,
    })}`;

    const { value, hit } = await dashboardCache.wrap(
      cacheKey,
      async () => {
        const computeTimings: ChartsBatchComputeTimings = {};
        const timed = async <T>(name: keyof ChartsBatchComputeTimings, fn: () => Promise<T>): Promise<T> => {
          const started = nowMs();
          try {
            return await fn();
          } finally {
            computeTimings[name] = nowMs() - started;
          }
        };

        const [
          trendData,
          timeData,
          durationData,
          formatData,
          groupedCharts,
          postsResult,
          strategicDeltas,
        ] = await Promise.all([
          timed("trendMs", () => getUserReachInteractionTrendChartData(userId, timePeriod, granularity, {})),
          timed("timeMs", () => aggregateUserTimePerformance(userId, periodInDaysValue, metricField, {})),
          timed("durationMs", () => aggregateUserDurationPerformance(userId, periodInDaysValue)),
          timed("formatMs", () =>
            getEngagementDistributionByFormatChartData(
              userId,
              timePeriod,
              engagementMetricField,
              DEFAULT_FORMAT_MAPPING,
              maxSlices
            )
          ),
          timed("groupingsMs", () =>
            getAverageEngagementByGroupings(
              userId,
              timePeriod,
              engagementMetricField,
              ["proposal", "tone", "references", "context"]
            )
          ),
          timed("postsMs", () =>
            findUserPosts({
              userId,
              timePeriod,
              sortBy: "postDate",
              sortOrder: "desc",
              page,
              limit,
            })
          ),
          timed("strategicDeltasMs", () => computeStrategicDeltas(userId, timePeriod)),
        ]);

        const normalizeStartedAt = nowMs();
        const normalizedPosts = (postsResult.posts || []).map((post: any) => {
          const thumb = extractThumbnail(post);
          const proxiedThumb = normalizeThumb(thumb ?? post.thumbnailUrl ?? null);
          const proxiedCover = normalizeThumb(post.coverUrl ?? null);
          return {
            ...post,
            coverUrl: proxiedCover,
            thumbnailUrl: proxiedThumb,
          };
        });
        computeTimings.normalizeMs = nowMs() - normalizeStartedAt;
        const totalPages = Math.max(1, Math.ceil(postsResult.totalPosts / postsResult.limit));
        return {
          payload: {
            trendData,
            timeData,
            durationData,
            formatData,
            proposalData: {
              chartData: groupedCharts?.proposal || [],
              metricUsed: engagementMetricField,
              groupBy: "proposal",
            },
            toneData: {
              chartData: groupedCharts?.tone || [],
              metricUsed: engagementMetricField,
              groupBy: "tone",
            },
            referenceData: {
              chartData: groupedCharts?.references || [],
              metricUsed: engagementMetricField,
              groupBy: "references",
            },
            contextData: {
              chartData: groupedCharts?.context || [],
              metricUsed: engagementMetricField,
              groupBy: "context",
            },
            postsData: {
              posts: normalizedPosts,
              pagination: {
                currentPage: postsResult.page,
                totalPages,
                totalPosts: postsResult.totalPosts,
              },
            },
            strategicDeltas,
          },
          __perf: computeTimings,
        };
      },
      DEFAULT_DASHBOARD_TTL_MS
    );
    timings.push({ name: "cacheWrap", durationMs: nowMs() - cacheWrapStartedAt });

    const perfData = (value as any)?.__perf as ChartsBatchComputeTimings | undefined;
    if (perfData) {
      if (typeof perfData.trendMs === "number") timings.push({ name: "trend", durationMs: perfData.trendMs });
      if (typeof perfData.timeMs === "number") timings.push({ name: "time", durationMs: perfData.timeMs });
      if (typeof perfData.durationMs === "number") timings.push({ name: "duration", durationMs: perfData.durationMs });
      if (typeof perfData.formatMs === "number") timings.push({ name: "format", durationMs: perfData.formatMs });
      if (typeof perfData.groupingsMs === "number") timings.push({ name: "groupings", durationMs: perfData.groupingsMs });
      if (typeof perfData.postsMs === "number") timings.push({ name: "posts", durationMs: perfData.postsMs });
      if (typeof perfData.normalizeMs === "number") timings.push({ name: "normalize", durationMs: perfData.normalizeMs });
      if (typeof perfData.strategicDeltasMs === "number") timings.push({ name: "strategicDeltas", durationMs: perfData.strategicDeltasMs });
    }

    const responsePayload = (value as any)?.payload ?? value;
    const feedbackStartedAt = nowMs();
    const feedbackByActionId = await getRecommendationFeedbackByAction(userId, objectiveMode, timePeriod);
    timings.push({ name: "feedback", durationMs: nowMs() - feedbackStartedAt });
    const recommendationsStartedAt = nowMs();
    const recommendations = buildPlanningRecommendations({
      objectiveMode,
      trendData: responsePayload?.trendData,
      timeData: responsePayload?.timeData,
      durationData: responsePayload?.durationData,
      formatData: responsePayload?.formatData,
      proposalData: responsePayload?.proposalData,
      toneData: responsePayload?.toneData,
      contextData: responsePayload?.contextData,
      feedbackByActionId,
    });
    timings.push({ name: "recommendations", durationMs: nowMs() - recommendationsStartedAt });
    const responsePayloadWithRecommendations = {
      ...responsePayload,
      objectiveMode,
      recommendations,
      topActions: recommendations.actions.slice(0, 3),
    };

    const durationMs = nowMs() - startedAt;
    timings.push({ name: "total", durationMs });
    logger.info(`${SERVICE_TAG} Responded in ${durationMs}ms (cacheHit=${hit})`);
    const response = NextResponse.json(responsePayloadWithRecommendations, { status: 200 });
    return withServerTiming(response, timings, { "X-D2C-Cache": hit ? "hit" : "miss" });
  } catch (error: any) {
    logger.error(`${SERVICE_TAG} Error for user ${userId}:`, error);
    timings.push({ name: "total", durationMs: nowMs() - startedAt });
    const response = NextResponse.json(
      { error: "Erro ao processar planejamento em lote.", details: error?.message || "Erro desconhecido" },
      { status: 500 }
    );
    return withServerTiming(response, timings);
  }
}
