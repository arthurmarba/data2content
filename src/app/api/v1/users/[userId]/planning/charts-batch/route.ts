import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from "@/app/lib/cache/dashboardCache";
import { logger } from "@/app/lib/logger";
import { getUserReachInteractionTrendChartData } from "@/charts/getReachInteractionTrendChartData";
import getEngagementDistributionByFormatChartData from "@/charts/getEngagementDistributionByFormatChartData";
import { aggregateUserTimePerformance } from "@/utils/aggregateUserTimePerformance";
import getAverageEngagementByGrouping from "@/utils/getAverageEngagementByGrouping";
import { findUserPosts, toProxyUrl } from "@/app/lib/dataService/marketAnalysis/postsService";
import { timePeriodToDays } from "@/utils/timePeriodHelpers";
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
  formatMs?: number;
  proposalMs?: number;
  toneMs?: number;
  referenceMs?: number;
  postsMs?: number;
  normalizeMs?: number;
};

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
  const periodInDaysValue = timePeriodToDays(timePeriod);

  try {
    const cacheWrapStartedAt = nowMs();
    const cacheKey = `${SERVICE_TAG}:${JSON.stringify({
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
          formatData,
          proposalChartData,
          toneChartData,
          referenceChartData,
          postsResult,
        ] = await Promise.all([
          timed("trendMs", () => getUserReachInteractionTrendChartData(userId, timePeriod, granularity, {})),
          timed("timeMs", () => aggregateUserTimePerformance(userId, periodInDaysValue, metricField, {})),
          timed("formatMs", () =>
            getEngagementDistributionByFormatChartData(
              userId,
              timePeriod,
              engagementMetricField,
              DEFAULT_FORMAT_MAPPING,
              maxSlices
            )
          ),
          timed("proposalMs", () =>
            getAverageEngagementByGrouping(userId, timePeriod, engagementMetricField, "proposal")
          ),
          timed("toneMs", () => getAverageEngagementByGrouping(userId, timePeriod, engagementMetricField, "tone")),
          timed("referenceMs", () =>
            getAverageEngagementByGrouping(userId, timePeriod, engagementMetricField, "references")
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
            formatData,
            proposalData: {
              chartData: proposalChartData,
              metricUsed: engagementMetricField,
              groupBy: "proposal",
            },
            toneData: {
              chartData: toneChartData,
              metricUsed: engagementMetricField,
              groupBy: "tone",
            },
            referenceData: {
              chartData: referenceChartData,
              metricUsed: engagementMetricField,
              groupBy: "references",
            },
            postsData: {
              posts: normalizedPosts,
              pagination: {
                currentPage: postsResult.page,
                totalPages,
                totalPosts: postsResult.totalPosts,
              },
            },
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
      if (typeof perfData.formatMs === "number") timings.push({ name: "format", durationMs: perfData.formatMs });
      if (typeof perfData.proposalMs === "number") timings.push({ name: "proposal", durationMs: perfData.proposalMs });
      if (typeof perfData.toneMs === "number") timings.push({ name: "tone", durationMs: perfData.toneMs });
      if (typeof perfData.referenceMs === "number") timings.push({ name: "reference", durationMs: perfData.referenceMs });
      if (typeof perfData.postsMs === "number") timings.push({ name: "posts", durationMs: perfData.postsMs });
      if (typeof perfData.normalizeMs === "number") timings.push({ name: "normalize", durationMs: perfData.normalizeMs });
    }

    const responsePayload = (value as any)?.payload ?? value;

    const durationMs = nowMs() - startedAt;
    timings.push({ name: "total", durationMs });
    logger.info(`${SERVICE_TAG} Responded in ${durationMs}ms (cacheHit=${hit})`);
    const response = NextResponse.json(responsePayload, { status: 200 });
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
