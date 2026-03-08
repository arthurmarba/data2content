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
  RecommendationFeedbackMeta,
  RecommendationExperimentImpactSummary,
  RecommendationExperimentPlan,
  PlanningRecommendationAction,
  PlanningRecommendationType,
  PlanningObjectiveMode,
  RecommendationFeedbackStatus,
} from "@/utils/buildPlanningRecommendations";
import { findUserPosts, toProxyUrl } from "@/app/lib/dataService/marketAnalysis/postsService";
import { timePeriodToDays } from "@/utils/timePeriodHelpers";
import { getStartDateFromTimePeriod } from "@/utils/dateHelpers";
import MetricModel from "@/app/models/Metric";
import PlanningRecommendationFeedbackModel from "@/app/models/PlanningRecommendationFeedback";
import UserModel from "@/app/models/User";
import { connectToDatabase } from "@/app/lib/dataService/connection";
import {
  ALLOWED_TIME_PERIODS,
  ALLOWED_ENGAGEMENT_METRICS,
  EngagementMetricField,
  TimePeriod,
} from "@/app/lib/constants/timePeriods";
import { getMetricMeta, LEAD_INTENT_PROXY_FIELD } from "@/utils/performanceMetricResolver";
import { getCategoryById } from "@/app/lib/classification";

export const dynamic = "force-dynamic";

const SERVICE_TAG = "[api/v1/users/planning/charts-batch]";
const DEFAULT_TIME_PERIOD: TimePeriod = "last_90_days";
const DEFAULT_GRANULARITY: "daily" | "weekly" = "weekly";
const DEFAULT_METRIC_FIELD = "stats.total_interactions";
const DEFAULT_MAX_SLICES = 7;
const MAX_PAGE_LIMIT = 200;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_LIMIT = 200;
const CACHE_SCHEMA_VERSION = "v6";
const MIN_BENCHMARK_CREATORS = 5;
const MIN_BENCHMARK_POSTS = 18;
const MAX_BENCHMARK_CREATORS = 60;
const MAX_SIMILAR_CREATORS_VISIBLE = 6;
const WINDOW_BLOCK_HOURS = 4;

const DEFAULT_FORMAT_MAPPING: Record<string, string> = {
  IMAGE: "Imagem",
  VIDEO: "Vídeo",
  REEL: "Reel",
  CAROUSEL_ALBUM: "Carrossel",
};
const FOLLOWER_BANDS = [
  { id: "0_10k", label: "até 10 mil seguidores", min: 0, max: 10_000 },
  { id: "10k_50k", label: "10 mil a 50 mil seguidores", min: 10_000, max: 50_000 },
  { id: "50k_200k", label: "50 mil a 200 mil seguidores", min: 50_000, max: 200_000 },
  { id: "200k_plus", label: "mais de 200 mil seguidores", min: 200_000, max: null },
] as const;
const numberFormatter = new Intl.NumberFormat("pt-BR");
const TARGET_TIMEZONE = "America/Sao_Paulo";
const WEEKDAY_SHORT_EN_TO_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};
const zonedDatePartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TARGET_TIMEZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});
const formatAliases: Record<string, string> = {
  photo: "foto",
  imagem: "foto",
  image: "foto",
  carousel: "carrossel",
  carrossel: "carrossel",
  reel: "reels",
  reels: "reels",
  video: "video",
  "vídeo": "video",
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

function getDefaultMetricFieldForObjective(objectiveMode: PlanningObjectiveMode): EngagementMetricField {
  if (objectiveMode === "reach") return "stats.reach";
  if (objectiveMode === "leads") return LEAD_INTENT_PROXY_FIELD;
  return "stats.total_interactions";
}

function normalizeActionId(value: unknown): string {
  return String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9_:-]/g, "").slice(0, 80);
}

function stripAccents(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeLabel(value: string): string {
  return stripAccents(value).trim().toLowerCase();
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter(Boolean).map((item) => String(item));
  if (value) return [String(value)];
  return [];
}

function matchesValue(list: string[], target: string): boolean {
  const targetNorm = normalizeLabel(target);
  return list.some((item) => {
    const norm = normalizeLabel(item);
    if (norm === targetNorm) return true;
    const alias = formatAliases[norm];
    const aliasTarget = formatAliases[targetNorm];
    if (alias && alias === targetNorm) return true;
    if (aliasTarget && aliasTarget === norm) return true;
    return false;
  });
}

function formatPostsCount(count: number): string {
  const rounded = Math.max(0, Math.round(count));
  return `${numberFormatter.format(rounded)} post${rounded === 1 ? "" : "s"}`;
}

function parseFeedbackVariant(feedbackKey?: string | null): string {
  const normalized = String(feedbackKey || "").trim().toLowerCase();
  if (!normalized.includes(":")) return "";
  return normalized.split(":").slice(1).join(":");
}

function getTargetDateParts(value: string | Date): {
  weekdayIndexSun0: number;
  dayOfWeekMongo: number;
  year: number;
  month: number;
  day: number;
  hour: number;
} | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = zonedDatePartsFormatter.formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value;
  const weekdayShort = get("weekday");
  const month = Number(get("month"));
  const day = Number(get("day"));
  const year = Number(get("year"));
  const hour = Number(get("hour"));
  const weekdayIndexSun0 = typeof weekdayShort === "string" ? WEEKDAY_SHORT_EN_TO_INDEX[weekdayShort] : undefined;
  if (
    weekdayIndexSun0 === undefined ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hour)
  ) {
    return null;
  }
  return {
    weekdayIndexSun0,
    dayOfWeekMongo: weekdayIndexSun0 + 1,
    year,
    month,
    day,
    hour,
  };
}

function getDurationBucketKey(seconds: number | null | undefined): "0_15" | "15_30" | "30_60" | "60_plus" | null {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 15) return "0_15";
  if (seconds < 30) return "15_30";
  if (seconds < 60) return "30_60";
  return "60_plus";
}

function getFollowerBand(followersCount: number | null | undefined): FollowerBand | null {
  const safeFollowers = typeof followersCount === "number" && Number.isFinite(followersCount) ? followersCount : null;
  if (safeFollowers === null || safeFollowers < 0) return null;
  return (
    FOLLOWER_BANDS.find((band) => safeFollowers >= band.min && (band.max === null || safeFollowers < band.max)) || null
  );
}

function getContextLabel(contextId?: string | null): string | null {
  const normalized = String(contextId || "").trim();
  if (!normalized) return null;
  return getCategoryById(normalized, "context")?.label || normalized;
}

function normalizeFormatBenchmarkLabel(rawValue: unknown): string | null {
  const raw = String(rawValue || "").trim();
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (DEFAULT_FORMAT_MAPPING[upper]) return DEFAULT_FORMAT_MAPPING[upper];
  const normalized = normalizeLabel(raw);
  if (normalized === "reel" || normalized === "reels") return "Reel";
  if (normalized === "video" || normalized === "vídeo") return "Vídeo";
  if (normalized === "imagem" || normalized === "image" || normalized === "photo" || normalized === "foto") return "Imagem";
  if (normalized === "carousel" || normalized === "carrossel") return "Carrossel";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function buildBenchmarkPlaceholder(reason: string, params?: Partial<TimingBenchmarkPayload["cohort"]>): TimingBenchmarkPayload {
  return {
    cohort: {
      canShow: false,
      strategy: "insufficient",
      label: null,
      contextId: params?.contextId || null,
      contextLabel: params?.contextLabel || null,
      followerBandId: params?.followerBandId || null,
      followerBandLabel: params?.followerBandLabel || null,
      creatorCount: params?.creatorCount || 0,
      postsCount: params?.postsCount || 0,
      confidence: "low",
      reason,
    },
    hourly: {
      buckets: [],
      topHoursByPosts: [],
      topHoursByAverage: [],
    },
    weekly: {
      buckets: [],
      topWindowsByPosts: [],
      topWindowsByAverage: [],
    },
    duration: {
      buckets: [
        { key: "0_15", label: "0-15s", minSeconds: 0, maxSeconds: 15, average: 0, postsCount: 0 },
        { key: "15_30", label: "15-30s", minSeconds: 15, maxSeconds: 30, average: 0, postsCount: 0 },
        { key: "30_60", label: "30-60s", minSeconds: 30, maxSeconds: 60, average: 0, postsCount: 0 },
        { key: "60_plus", label: "60s+", minSeconds: 60, maxSeconds: null, average: 0, postsCount: 0 },
      ],
      topBucketByPostsKey: null,
      topBucketByAverageKey: null,
      totalVideoPosts: 0,
    },
    format: {
      buckets: [],
      topFormatByPosts: null,
      topFormatByAverage: null,
    },
  };
}

function buildSimilarCreatorsPlaceholder(
  reason: string,
  params?: Partial<Omit<SimilarCreatorsPayload, "canShow" | "strategy" | "items">>
): SimilarCreatorsPayload {
  return {
    canShow: false,
    strategy: "insufficient",
    label: params?.label || null,
    contextId: params?.contextId || null,
    contextLabel: params?.contextLabel || null,
    followerBandId: params?.followerBandId || null,
    followerBandLabel: params?.followerBandLabel || null,
    creatorCount: params?.creatorCount || 0,
    reason,
    items: [],
  };
}

function buildSimilarCreatorsPayload(params: {
  strategy: {
    strategy: TimingBenchmarkPayload["cohort"]["strategy"];
    label: string | null;
  };
  candidates: BenchmarkCandidateUser[];
  contextId: string | null;
  contextLabel: string | null;
  followerBand: FollowerBand | null;
  reason?: string | null;
}): SimilarCreatorsPayload {
  const { strategy, candidates, contextId, contextLabel, followerBand, reason } = params;
  const items = candidates
    .slice()
    .sort((a, b) => {
      const followerDiff = (b.followers_count ?? -1) - (a.followers_count ?? -1);
      if (followerDiff !== 0) return followerDiff;
      const mediaKitDiff = Number(Boolean(b.mediaKitSlug)) - Number(Boolean(a.mediaKitSlug));
      if (mediaKitDiff !== 0) return mediaKitDiff;
      return String(a.name || a.username || a._id).localeCompare(String(b.name || b.username || b._id));
    })
    .slice(0, MAX_SIMILAR_CREATORS_VISIBLE)
    .map((candidate, index) => ({
      id: String(candidate._id),
      rankByFollowers: index + 1,
      name: String(candidate.name || "").trim() || null,
      username: String(candidate.username || "").trim() || null,
      avatarUrl: candidate.profile_picture_url ? toProxyUrl(candidate.profile_picture_url) : null,
      followers:
        typeof candidate.followers_count === "number" && Number.isFinite(candidate.followers_count)
          ? candidate.followers_count
          : null,
      mediaKitSlug: String(candidate.mediaKitSlug || "").trim() || null,
      contextLabel: getContextLabel(candidate.creatorContext?.id) || contextLabel,
    }));

  return {
    canShow: items.length > 0,
    strategy: strategy.strategy,
    label: strategy.label,
    contextId,
    contextLabel,
    followerBandId: followerBand?.id || null,
    followerBandLabel: followerBand?.label || null,
    creatorCount: candidates.length,
    reason: reason || null,
    items,
  };
}

function getBenchmarkConfidence(strategy: TimingBenchmarkPayload["cohort"]["strategy"], creatorCount: number, postsCount: number) {
  if (strategy === "context_band" && creatorCount >= 10 && postsCount >= 40) return "high" as const;
  if (creatorCount >= 6 && postsCount >= 24) return "medium" as const;
  return "low" as const;
}

function rankTopHours(
  buckets: TimingBenchmarkBucket[],
  key: "postsCount" | "average",
  limit = 3
): number[] {
  return buckets
    .slice()
    .sort((a, b) => {
      const primary = key === "postsCount" ? b.postsCount - a.postsCount : b.average - a.average;
      if (primary !== 0) return primary;
      const secondary = key === "postsCount" ? b.average - a.average : b.postsCount - a.postsCount;
      if (secondary !== 0) return secondary;
      return a.hour - b.hour;
    })
    .slice(0, limit)
    .map((bucket) => bucket.hour);
}

function rankTopWindows(
  windows: TimingBenchmarkWindow[],
  key: "postsCount" | "average",
  limit = 3
): TimingBenchmarkWindow[] {
  return windows
    .slice()
    .sort((a, b) => {
      const primary = key === "postsCount" ? b.postsCount - a.postsCount : b.average - a.average;
      if (primary !== 0) return primary;
      const secondary = key === "postsCount" ? b.average - a.average : b.postsCount - a.postsCount;
      if (secondary !== 0) return secondary;
      if (a.dayOfWeek !== b.dayOfWeek) return a.dayOfWeek - b.dayOfWeek;
      return a.startHour - b.startHour;
    })
    .slice(0, limit);
}

function resolveLeadIntentProxy(stats: any): number {
  const profileVisits = toSafeNumber(stats?.profile_visits);
  const follows = toSafeNumber(stats?.follows);
  const shares = toSafeNumber(stats?.shares);
  const saves = toSafeNumber(stats?.saved ?? stats?.saves);
  const comments = toSafeNumber(stats?.comments);
  const reach = toSafeNumber(stats?.reach);
  const rawScore = profileVisits * 3 + follows * 8 + shares * 2 + saves * 1.5 + comments * 0.5;
  if (rawScore <= 0) return 0;
  if (reach > 0) return (rawScore / reach) * 1000;
  return rawScore;
}

function getObjectiveMetricValue(post: any, objectiveMode: PlanningObjectiveMode): number | null {
  if (objectiveMode === "reach") {
    const reach = toSafeNumber(post?.stats?.reach ?? post?.stats?.views);
    return Number.isFinite(reach) ? reach : null;
  }
  if (objectiveMode === "leads") {
    const leadIntent = resolveLeadIntentProxy(post?.stats);
    return Number.isFinite(leadIntent) ? leadIntent : null;
  }
  const totalInteractions = post?.stats?.total_interactions;
  if (typeof totalInteractions === "number" && Number.isFinite(totalInteractions)) return totalInteractions;
  const likes = toSafeNumber(post?.stats?.likes);
  const comments = toSafeNumber(post?.stats?.comments);
  const shares = toSafeNumber(post?.stats?.shares);
  const saves = toSafeNumber(post?.stats?.saved ?? post?.stats?.saves);
  return likes + comments + shares + saves;
}

function matchesRecommendationVariant(post: any, action: PlanningRecommendationAction): boolean {
  const variant = parseFeedbackVariant(action.feedbackKey);
  if (!variant) return true;

  if (action.id === "time_slot") {
    const match = variant.match(/^d(\d+)_h(\d+)$/);
    if (!match) return true;
    const dayOfWeekMongo = Number(match[1]);
    const hour = Number(match[2]);
    const parts = getTargetDateParts(post?.postDate || post?.createdAt || post?.timestamp);
    if (!parts) return false;
    return parts.dayOfWeekMongo === dayOfWeekMongo && parts.hour === hour;
  }

  if (action.id === "duration") {
    const duration = toSafeNumber(post?.stats?.video_duration_seconds);
    return getDurationBucketKey(duration) === variant;
  }

  if (action.id === "format_reach") {
    return matchesValue(toStringArray(post?.format), variant.replace(/_/g, " "));
  }

  if (action.id === "proposal_engagement" || action.id === "proposal_leads") {
    return matchesValue(toStringArray(post?.proposal), variant.replace(/_/g, " "));
  }

  if (action.id === "context_reach" || action.id === "context_leads") {
    return matchesValue(toStringArray(post?.context), variant.replace(/_/g, " "));
  }

  if (action.id === "tone_engagement") {
    return matchesValue(toStringArray(post?.tone), variant.replace(/_/g, " "));
  }

  return true;
}

async function getRecommendationFeedbackByAction(
  userId: string,
  objectiveMode: PlanningObjectiveMode,
  timePeriod: TimePeriod
): Promise<{
  feedbackByActionId: Record<string, RecommendationFeedbackStatus>;
  feedbackMetaByActionId: Record<string, RecommendationFeedbackMeta>;
}> {
  await connectToDatabase();
  const rows = await PlanningRecommendationFeedbackModel.find({
    userId: new Types.ObjectId(userId),
    objectiveMode,
    timePeriod,
  })
    .select("actionId status updatedAt")
    .lean();

  return rows.reduce<{
    feedbackByActionId: Record<string, RecommendationFeedbackStatus>;
    feedbackMetaByActionId: Record<string, RecommendationFeedbackMeta>;
  }>(
    (acc, row: any) => {
      const actionId = normalizeActionId(row?.actionId);
      const status = row?.status;
      if (!actionId) return acc;
      if (status !== "applied" && status !== "not_applied") return acc;
      acc.feedbackByActionId[actionId] = status;
      acc.feedbackMetaByActionId[actionId] = {
        status,
        updatedAt: row?.updatedAt instanceof Date ? row.updatedAt.toISOString() : row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      };
      return acc;
    },
    { feedbackByActionId: {}, feedbackMetaByActionId: {} }
  );
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
  benchmarkMs?: number;
  formatMs?: number;
  groupingsMs?: number;
  postsMs?: number;
  normalizeMs?: number;
  strategicDeltasMs?: number;
  experimentImpactMs?: number;
};

type PeriodAggregateMetrics = {
  postsCount: number;
  avgInteractionsPerPost: number;
  avgSavesPerPost: number;
  avgCommentsPerPost: number;
  avgReachPerPost: number;
  avgLeadIntentPer1kReach: number;
};

type StrategicMetricDelta = {
  currentAvg: number | null;
  previousAvg: number | null;
  deltaRatio: number | null;
  currentPosts: number;
  previousPosts: number;
  hasMinimumSample: boolean;
};

type ComparableExperimentPost = {
  postDate: Date;
  createdAt?: Date;
  timestamp?: Date;
  type?: string;
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[];
  stats?: Record<string, unknown>;
};

type FollowerBand = (typeof FOLLOWER_BANDS)[number];

type BenchmarkCandidateUser = {
  _id: Types.ObjectId;
  name?: string | null;
  username?: string | null;
  profile_picture_url?: string | null;
  mediaKitSlug?: string | null;
  followers_count?: number | null;
  creatorContext?: {
    id?: string | null;
  } | null;
};

type TimingBenchmarkBucket = {
  hour: number;
  average: number;
  postsCount: number;
};

type TimingBenchmarkDayHourBucket = {
  dayOfWeek: number;
  hour: number;
  average: number;
  postsCount: number;
};

type TimingBenchmarkWindow = {
  dayOfWeek: number;
  startHour: number;
  endHour: number;
  average: number;
  postsCount: number;
};

type TimingBenchmarkDurationBucket = {
  key: "0_15" | "15_30" | "30_60" | "60_plus";
  label: "0-15s" | "15-30s" | "30-60s" | "60s+";
  minSeconds: number;
  maxSeconds: number | null;
  average: number;
  postsCount: number;
};

type TimingBenchmarkFormatBucket = {
  name: string;
  average: number;
  postsCount: number;
};

type TimingBenchmarkPayload = {
  cohort: {
    canShow: boolean;
    strategy: "context_band" | "context_only" | "band_only" | "insufficient";
    label: string | null;
    contextId: string | null;
    contextLabel: string | null;
    followerBandId: string | null;
    followerBandLabel: string | null;
    creatorCount: number;
    postsCount: number;
    confidence: "high" | "medium" | "low";
    reason?: string | null;
  };
  hourly: {
    buckets: TimingBenchmarkBucket[];
    topHoursByPosts: number[];
    topHoursByAverage: number[];
  };
  weekly: {
    buckets: TimingBenchmarkDayHourBucket[];
    topWindowsByPosts: TimingBenchmarkWindow[];
    topWindowsByAverage: TimingBenchmarkWindow[];
  };
  duration: {
    buckets: TimingBenchmarkDurationBucket[];
    topBucketByPostsKey: TimingBenchmarkDurationBucket["key"] | null;
    topBucketByAverageKey: TimingBenchmarkDurationBucket["key"] | null;
    totalVideoPosts: number;
  };
  format: {
    buckets: TimingBenchmarkFormatBucket[];
    topFormatByPosts: string | null;
    topFormatByAverage: string | null;
  };
};

type SimilarCreatorRankingItem = {
  id: string;
  rankByFollowers: number;
  name: string | null;
  username: string | null;
  avatarUrl: string | null;
  followers: number | null;
  mediaKitSlug: string | null;
  contextLabel: string | null;
};

type SimilarCreatorsPayload = {
  canShow: boolean;
  strategy: TimingBenchmarkPayload["cohort"]["strategy"];
  label: string | null;
  contextId: string | null;
  contextLabel: string | null;
  followerBandId: string | null;
  followerBandLabel: string | null;
  creatorCount: number;
  reason?: string | null;
  items: SimilarCreatorRankingItem[];
};

type SimilarCreatorsBundle = {
  timingBenchmark: TimingBenchmarkPayload;
  similarCreators: SimilarCreatorsPayload;
};

type DirectioningSummaryTone = "positive" | "neutral" | "negative" | "warning";

type DirectioningSummary = {
  headline: string;
  priorityLabel: string;
  priorityState: PlanningRecommendationType;
  primarySignal: {
    text: string;
    tone: DirectioningSummaryTone;
    metricLabel: string;
  };
  confidence: {
    label: string;
    description: string;
  };
  comparison?: {
    narrative: string;
    tone: DirectioningSummaryTone;
    currentLabel: string;
    previousLabel: string;
  };
  compositeConfidence?: {
    level: "high" | "medium" | "low";
    label: string;
    score: number;
    summary: string;
    factors: Array<{
      label: string;
      status: "strong" | "moderate" | "weak";
      text: string;
    }>;
  };
  experimentFocus?: RecommendationExperimentPlan | null;
  baseDescription: string;
  proxyDisclosure: string | null;
  noGoLine: string;
  cards: Array<{ title: string; body: string }>;
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

function formatSampleBaseText(sampleSize: number | null | undefined): string {
  if (typeof sampleSize === "number" && Number.isFinite(sampleSize) && sampleSize > 0) {
    const rounded = Math.max(0, Math.round(sampleSize));
    return rounded === 1
      ? `${numberFormatter.format(rounded)} publicação analisada`
      : `${numberFormatter.format(rounded)} publicações analisadas`;
  }
  return "Poucos dados para fechar uma leitura forte";
}

function getConfidenceLabel(confidence?: string | null): string {
  if (confidence === "high") return "Sinal forte";
  if (confidence === "medium") return "Sinal moderado";
  return "Sinal inicial";
}

function getCompositeConfidenceLabel(level: "high" | "medium" | "low"): string {
  if (level === "high") return "Confiança alta";
  if (level === "medium") return "Confiança moderada";
  return "Confiança inicial";
}

function getPrimaryStrategicMetricDelta(
  strategicDeltas: any,
  objectiveMode: PlanningObjectiveMode
): StrategicMetricDelta | null {
  if (objectiveMode === "reach") return (strategicDeltas?.metrics?.reachPerPost as StrategicMetricDelta) || null;
  if (objectiveMode === "leads") return (strategicDeltas?.metrics?.leadIntentPer1kReach as StrategicMetricDelta) || null;
  return (strategicDeltas?.metrics?.interactionsPerPost as StrategicMetricDelta) || null;
}

function formatStrategicSignal(metric: StrategicMetricDelta | null, metricLabel: string) {
  if (!metric) {
    return { text: "Ainda faltam dados para comparar o período atual com o anterior.", tone: "warning" as DirectioningSummaryTone };
  }
  if (!metric.hasMinimumSample) {
    return {
      text: `Base pequena: ${numberFormatter.format(metric.currentPosts)} posts agora vs ${numberFormatter.format(metric.previousPosts)} antes.`,
      tone: "warning" as DirectioningSummaryTone,
    };
  }
  if (typeof metric.deltaRatio !== "number" || !Number.isFinite(metric.deltaRatio)) {
    return { text: "Ainda não existe base comparável suficiente no período anterior equivalente.", tone: "warning" as DirectioningSummaryTone };
  }

  const pct = Math.round(metric.deltaRatio * 100);
  if (Math.abs(pct) < 3) {
    return { text: `${metricLabel}: sem mudança forte contra o período anterior.`, tone: "neutral" as DirectioningSummaryTone };
  }
  if (pct > 0) {
    return { text: `${metricLabel}: +${pct}% contra o período anterior.`, tone: "positive" as DirectioningSummaryTone };
  }
  return { text: `${metricLabel}: ${pct}% contra o período anterior.`, tone: "negative" as DirectioningSummaryTone };
}

function formatDateLabel(dateIso?: string | null): string {
  if (!dateIso) return "";
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(parsed);
}

function buildComparisonSummary(
  strategicDeltas: any,
  objectiveMode: PlanningObjectiveMode,
  metricLabel: string
): DirectioningSummary["comparison"] {
  const metric = getPrimaryStrategicMetricDelta(strategicDeltas, objectiveMode);
  const currentStart = strategicDeltas?.range?.currentStart;
  const currentEnd = strategicDeltas?.range?.currentEnd;
  const previousStart = strategicDeltas?.range?.previousStart;
  const previousEnd = strategicDeltas?.range?.previousEnd;
  const currentLabel = currentStart && currentEnd ? `${formatDateLabel(currentStart)} a ${formatDateLabel(currentEnd)}` : "Período atual";
  const previousLabel = previousStart && previousEnd ? `${formatDateLabel(previousStart)} a ${formatDateLabel(previousEnd)}` : "Período anterior";

  if (!metric) {
    return {
      currentLabel,
      previousLabel,
      tone: "warning",
      narrative: "Ainda faltam dados para comparar o período atual com o anterior equivalente.",
    };
  }
  if (!metric.hasMinimumSample) {
    return {
      currentLabel,
      previousLabel,
      tone: "warning",
      narrative: `Comparação ainda frágil: ${numberFormatter.format(metric.currentPosts)} posts agora vs ${numberFormatter.format(metric.previousPosts)} antes.`,
    };
  }
  if (typeof metric.deltaRatio !== "number" || !Number.isFinite(metric.deltaRatio)) {
    return {
      currentLabel,
      previousLabel,
      tone: "warning",
      narrative: "Ainda não existe base comparável suficiente no período anterior equivalente.",
    };
  }

  const pct = Math.round(metric.deltaRatio * 100);
  if (Math.abs(pct) < 3) {
    return {
      currentLabel,
      previousLabel,
      tone: "neutral",
      narrative: `${metricLabel} ficou estável ao comparar ${currentLabel} com ${previousLabel}.`,
    };
  }
  if (pct > 0) {
    return {
      currentLabel,
      previousLabel,
      tone: "positive",
      narrative: `${metricLabel} subiu ${pct}% em ${currentLabel} contra ${previousLabel}.`,
    };
  }
  return {
    currentLabel,
    previousLabel,
    tone: "negative",
    narrative: `${metricLabel} caiu ${Math.abs(pct)}% em ${currentLabel} contra ${previousLabel}.`,
  };
}

function buildCompositeConfidenceSummary(params: {
  topAction: PlanningRecommendationAction | null;
  primaryMetric: StrategicMetricDelta | null;
  metricMeta: ReturnType<typeof getMetricMeta>;
}): DirectioningSummary["compositeConfidence"] {
  const { topAction, primaryMetric, metricMeta } = params;
  const sampleSize = typeof topAction?.sampleSize === "number" && Number.isFinite(topAction.sampleSize) ? topAction.sampleSize : 0;

  const sampleFactor =
    sampleSize >= 10
      ? { label: "Amostra", status: "strong" as const, text: `${numberFormatter.format(sampleSize)} publicações sustentam essa leitura.`, score: 35 }
      : sampleSize >= 5
        ? { label: "Amostra", status: "moderate" as const, text: `${numberFormatter.format(sampleSize)} publicações já dão direção, mas ainda pedem confirmação.`, score: 24 }
        : { label: "Amostra", status: "weak" as const, text: "A base ainda é pequena para uma conclusão forte.", score: 10 };

  const periodFactor =
    primaryMetric?.hasMinimumSample
      ? { label: "Comparação", status: "strong" as const, text: "O período atual e o anterior já podem ser comparados com base mínima.", score: 30 }
      : (primaryMetric?.currentPosts || primaryMetric?.previousPosts)
        ? { label: "Comparação", status: "moderate" as const, text: "A comparação existe, mas um dos períodos ainda tem pouca base.", score: 18 }
        : { label: "Comparação", status: "weak" as const, text: "Ainda faltam posts para uma comparação equivalente confiável.", score: 8 };

  const metricFactor = metricMeta?.isProxy
    ? { label: "Métrica", status: "weak" as const, text: `Esta leitura usa proxy: ${metricMeta.description}`, score: 8 }
    : { label: "Métrica", status: "strong" as const, text: "A leitura usa métrica direta, sem proxy principal.", score: 20 };

  const stabilityFactor = topAction?.guardrailReason
    ? { label: "Estabilidade", status: "moderate" as const, text: topAction.guardrailReason, score: 8 }
    : topAction?.confidence === "high"
      ? { label: "Estabilidade", status: "strong" as const, text: "O sinal atual aparece com boa consistência para priorização.", score: 15 }
      : topAction?.confidence === "medium"
        ? { label: "Estabilidade", status: "moderate" as const, text: "O sinal é útil para decidir, mas ainda merece acompanhamento.", score: 11 }
        : { label: "Estabilidade", status: "weak" as const, text: "O sinal ainda é inicial e pode mudar com poucos posts novos.", score: 6 };

  const factors = [sampleFactor, periodFactor, metricFactor, stabilityFactor];
  const score = factors.reduce((sum, factor) => sum + factor.score, 0);
  const level: "high" | "medium" | "low" = score >= 72 ? "high" : score >= 45 ? "medium" : "low";
  const summary =
    level === "high"
      ? "Os dados já sustentam uma decisão com boa segurança."
      : level === "medium"
        ? "A direção está útil, mas ainda vale validar antes de transformar em regra."
        : "Use como hipótese guiada, não como verdade fixa.";

  return {
    level,
    label: getCompositeConfidenceLabel(level),
    score,
    summary,
    factors: factors.map(({ label, status, text }) => ({ label, status, text })),
  };
}

function buildDirectioningSummary(params: {
  objectiveMode: PlanningObjectiveMode;
  metricMeta: ReturnType<typeof getMetricMeta>;
  strategicDeltas: any;
  recommendations: { actions: PlanningRecommendationAction[] };
}): DirectioningSummary {
  const { objectiveMode, metricMeta, strategicDeltas, recommendations } = params;
  const actions = Array.isArray(recommendations?.actions) ? recommendations.actions : [];
  const activePendingAction = actions.find((action) => action.executionState === "planned" && action.queueStage === "now") || null;
  const waitingImpactAction = actions.find((action) => action.executionState === "waiting_impact") || null;
  const executedAction = actions.find((action) => action.executionState === "executed") || null;
  const topAction =
    activePendingAction ||
    actions.find((action) => action.executionState === "planned") ||
    actions[0] ||
    null;
  const allApplied = actions.length > 0 && actions.every((action) => action.feedbackStatus === "applied");
  const metricLabel = metricMeta?.label || getMetricMeta(getDefaultMetricFieldForObjective(objectiveMode)).label;
  const primarySignal = formatStrategicSignal(getPrimaryStrategicMetricDelta(strategicDeltas, objectiveMode), metricLabel);
  const comparison = buildComparisonSummary(strategicDeltas, objectiveMode, metricLabel);
  const comparisonNarrative = comparison?.narrative || primarySignal?.text || "Ainda não existe base comparável suficiente para este período.";
  const compositeConfidence = buildCompositeConfidenceSummary({
    topAction,
    primaryMetric: getPrimaryStrategicMetricDelta(strategicDeltas, objectiveMode),
    metricMeta,
  });
  const compositeConfidenceLabel = compositeConfidence?.label || getCompositeConfidenceLabel("low");
  const compositeConfidenceSummary = compositeConfidence?.summary || "Use como hipótese guiada, não como verdade fixa.";
  const confidenceLabel = getConfidenceLabel(topAction?.confidence);
  const confidenceDescription = topAction
    ? `${formatSampleBaseText(topAction.sampleSize)} • ${confidenceLabel.toLowerCase()} • ${compositeConfidenceLabel.toLowerCase()}`
    : "Ainda sem base suficiente para montar uma prioridade.";
  const headline = allApplied
    ? waitingImpactAction?.experimentImpact?.text || "Plano executado. Agora o foco é observar se o impacto aparece no próximo ciclo."
    : waitingImpactAction && activePendingAction
      ? `Você já executou parte do plano. Enquanto mede impacto, a prioridade ativa é ${activePendingAction.title.toLowerCase()}.`
      : waitingImpactAction
        ? waitingImpactAction.experimentImpact?.text || `Você já executou ${waitingImpactAction.title.toLowerCase()}. Agora vale medir impacto antes de abrir novas frentes.`
        : executedAction && activePendingAction
          ? `A última ação foi marcada como executada. O próximo passo é ${activePendingAction.title.toLowerCase()}.`
          : topAction?.strategicSynopsis || "Sem prioridade definida nesta semana.";
  const proxyDisclosure = metricMeta?.isProxy && metricMeta?.description
    ? `Objetivo baseado em proxy: ${metricMeta.description}`
    : null;
  const noGoLine = topAction?.whatNotToDo || "Evite testar muitos elementos ao mesmo tempo enquanto valida a prioridade da semana.";
  const cards: Array<{ title: string; body: string }> = [
    { title: "Diagnóstico da semana", body: headline },
    { title: "Comparação real", body: comparisonNarrative },
    { title: "Confiabilidade", body: compositeConfidenceSummary },
    {
      title: "Estado do plano",
      body: waitingImpactAction
        ? waitingImpactAction.experimentImpact?.text || "Você já executou uma alavanca recente. Agora acompanhe impacto antes de abrir muita novidade."
        : activePendingAction
          ? `Prioridade ativa: ${activePendingAction.title}.`
          : "Sem prioridade pendente no momento.",
    },
  ];

  if (proxyDisclosure) {
    cards.push({ title: "Leitura usada", body: proxyDisclosure });
  }

  return {
    headline,
    priorityLabel: topAction?.title || "Sem prioridade",
    priorityState: topAction?.recommendationType || "test",
    primarySignal: {
      text: primarySignal.text,
      tone: primarySignal.tone,
      metricLabel,
    },
    confidence: {
      label: confidenceLabel,
      description: confidenceDescription,
    },
    comparison,
    compositeConfidence,
    experimentFocus: topAction?.experimentPlan || null,
    baseDescription: confidenceDescription,
    proxyDisclosure,
    noGoLine,
    cards,
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
        follows: { $ifNull: ["$stats.follows", 0] },
        profileVisits: { $ifNull: ["$stats.profile_visits", 0] },
        reach: { $ifNull: ["$stats.reach", 0] },
        totalInteractionsRaw: "$stats.total_interactions",
      },
    },
    {
      $addFields: {
        totalInteractions: {
          $ifNull: ["$totalInteractionsRaw", { $add: ["$likes", "$comments", "$shares", "$saves"] }],
        },
        leadIntentRaw: {
          $add: [
            { $multiply: ["$profileVisits", 3] },
            { $multiply: ["$follows", 8] },
            { $multiply: ["$shares", 2] },
            { $multiply: ["$saves", 1.5] },
            { $multiply: ["$comments", 0.5] },
          ],
        },
      },
    },
    {
      $addFields: {
        leadIntentPer1kReach: {
          $cond: [
            { $gt: ["$leadIntentRaw", 0] },
            {
              $cond: [
                { $gt: ["$reach", 0] },
                { $multiply: [{ $divide: ["$leadIntentRaw", "$reach"] }, 1000] },
                "$leadIntentRaw",
              ],
            },
            0,
          ],
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
        reachSum: { $sum: "$reach" },
        leadIntentSum: { $sum: "$leadIntentPer1kReach" },
      },
    },
  ]);

  const row = aggregated[0];
  const postsCount = toSafeNumber(row?.postsCount);
  const interactionsSum = toSafeNumber(row?.interactionsSum);
  const savesSum = toSafeNumber(row?.savesSum);
  const commentsSum = toSafeNumber(row?.commentsSum);
  const reachSum = toSafeNumber(row?.reachSum);
  const leadIntentSum = toSafeNumber(row?.leadIntentSum);
  return {
    postsCount,
    avgInteractionsPerPost: postsCount > 0 ? interactionsSum / postsCount : 0,
    avgSavesPerPost: postsCount > 0 ? savesSum / postsCount : 0,
    avgCommentsPerPost: postsCount > 0 ? commentsSum / postsCount : 0,
    avgReachPerPost: postsCount > 0 ? reachSum / postsCount : 0,
    avgLeadIntentPer1kReach: postsCount > 0 ? leadIntentSum / postsCount : 0,
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
      reachPerPost: buildMetricDelta(
        currentMetrics.avgReachPerPost,
        previousMetrics.avgReachPerPost,
        currentMetrics.postsCount,
        previousMetrics.postsCount
      ),
      leadIntentPer1kReach: buildMetricDelta(
        currentMetrics.avgLeadIntentPer1kReach,
        previousMetrics.avgLeadIntentPer1kReach,
        currentMetrics.postsCount,
        previousMetrics.postsCount
      ),
    },
  };
}

function getTimePeriodStartDate(timePeriod: TimePeriod): Date | null {
  if (timePeriod === "all_time") return null;
  const startDate = getStartDateFromTimePeriod(new Date(), timePeriod);
  if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return null;
  return startDate;
}

async function resolveTopPerformingContextIds(
  userIds: Types.ObjectId[],
  startDate: Date | null
): Promise<Map<string, string>> {
  if (!userIds.length) return new Map();

  const match: Record<string, unknown> = {
    user: { $in: userIds },
    context: { $exists: true, $ne: [], $nin: [null] },
    "stats.total_interactions": { $ne: null },
  };

  if (startDate) {
    match.postDate = { $gte: startDate, $lte: new Date() };
  } else {
    match.postDate = { $lte: new Date() };
  }

  const rows = await MetricModel.aggregate<{
    _id: Types.ObjectId;
    topContext?: { name?: string | null };
  }>([
    { $match: match },
    {
      $project: {
        user: 1,
        context: { $ifNull: ["$context", []] },
        metricValue: { $ifNull: ["$stats.total_interactions", 0] },
      },
    },
    { $unwind: "$context" },
    {
      $group: {
        _id: { user: "$user", context: "$context" },
        avg: { $avg: "$metricValue" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.user": 1, avg: -1, count: -1 } },
    {
      $group: {
        _id: "$_id.user",
        topContext: {
          $first: {
            name: "$_id.context",
          },
        },
      },
    },
  ]).exec();

  return new Map(
    rows
      .map((row) => {
        const userId = row._id?.toString();
        const contextId = String(row.topContext?.name || "").trim();
        if (!userId || !contextId) return null;
        return [userId, contextId] as const;
      })
      .filter((entry): entry is readonly [string, string] => Boolean(entry))
  );
}

async function buildSimilarCreatorsBenchmarkBundle(
  userId: string,
  timePeriod: TimePeriod,
  objectiveMode: PlanningObjectiveMode
): Promise<SimilarCreatorsBundle> {
  await connectToDatabase();

  const currentUser = await UserModel.findById(userId)
    .select("followers_count creatorContext")
    .lean<{
      followers_count?: number | null;
      creatorContext?: { id?: string | null } | null;
    } | null>();

  const startDate = getTimePeriodStartDate(timePeriod);
  const currentUserTopContextMap = await resolveTopPerformingContextIds([new Types.ObjectId(userId)], startDate);
  const topContextId = currentUserTopContextMap.get(String(userId)) || null;
  const persistedContextId = String(currentUser?.creatorContext?.id || "").trim() || null;
  const contextId = topContextId || persistedContextId;
  const contextLabel = getContextLabel(contextId);
  const followerBand = getFollowerBand(currentUser?.followers_count);

  if (!contextId && !followerBand) {
    const reason = "Ainda não temos informação suficiente para te comparar com contas parecidas.";
    return {
      timingBenchmark: buildBenchmarkPlaceholder(reason),
      similarCreators: buildSimilarCreatorsPlaceholder(reason),
    };
  }

  const allCandidates = await UserModel.find({
    _id: { $ne: new Types.ObjectId(userId) },
    isInstagramConnected: true,
  })
    .select("_id name username profile_picture_url mediaKitSlug followers_count creatorContext")
    .lean<BenchmarkCandidateUser[]>();

  const candidateTopContextMap = await resolveTopPerformingContextIds(
    allCandidates.map((candidate) => candidate._id).filter((id): id is Types.ObjectId => Boolean(id)),
    startDate
  );

  const currentFollowers =
    typeof currentUser?.followers_count === "number" && Number.isFinite(currentUser.followers_count)
      ? currentUser.followers_count
      : null;

  const resolveCandidateContextIds = (candidate: BenchmarkCandidateUser) =>
    Array.from(
      new Set(
        [
          candidateTopContextMap.get(String(candidate._id)) || null,
          String(candidate?.creatorContext?.id || "").trim() || null,
        ].filter((value): value is string => Boolean(value))
      )
    );
  const matchesContext = (candidate: BenchmarkCandidateUser, targetContextId: string | null) =>
    Boolean(targetContextId && resolveCandidateContextIds(candidate).includes(targetContextId));
  const matchesBand = (candidate: BenchmarkCandidateUser) => {
    if (!followerBand) return false;
    const followers = typeof candidate?.followers_count === "number" && Number.isFinite(candidate.followers_count)
      ? candidate.followers_count
      : null;
    if (followers === null) return false;
    return followers >= followerBand.min && (followerBand.max === null || followers < followerBand.max);
  };

  const strategies: Array<{
    strategy: TimingBenchmarkPayload["cohort"]["strategy"];
    matches: (candidate: BenchmarkCandidateUser) => boolean;
    label: string | null;
  }> = [];

  const contextTargets = Array.from(
    new Map(
      [
        topContextId
          ? {
              id: topContextId,
              label: getContextLabel(topContextId),
            }
          : null,
        persistedContextId && persistedContextId !== topContextId
          ? {
              id: persistedContextId,
              label: getContextLabel(persistedContextId),
            }
          : null,
      ]
        .filter(
          (
            item
          ): item is {
            id: string;
            label: string | null;
          } => Boolean(item?.id)
        )
        .map((item) => [item.id, item] as const)
    ).values()
  );

  contextTargets.forEach((target) => {
    if (followerBand) {
      strategies.push({
        strategy: "context_band",
        matches: (candidate) => matchesContext(candidate, target.id) && matchesBand(candidate),
        label: `${target.label || "Mesmo contexto"} • ${followerBand.label}`,
      });
    }
    strategies.push({
      strategy: "context_only",
      matches: (candidate) => matchesContext(candidate, target.id),
      label: target.label || "Mesmo contexto",
    });
  });
  if (followerBand) {
    strategies.push({
      strategy: "band_only",
      matches: (candidate) => matchesBand(candidate),
      label: followerBand.label,
    });
  }

  let selectedStrategy: (typeof strategies)[number] | null = null;
  let selectedCandidates: BenchmarkCandidateUser[] = [];
  let fallbackStrategy: (typeof strategies)[number] | null = null;
  let fallbackCandidates: BenchmarkCandidateUser[] = [];

  for (const strategy of strategies) {
    const matched = allCandidates.filter(strategy.matches);
    if (matched.length > fallbackCandidates.length) {
      fallbackStrategy = strategy;
      fallbackCandidates = matched;
    }
    if (matched.length < MIN_BENCHMARK_CREATORS) continue;
    selectedStrategy = strategy;
    selectedCandidates = matched;
    break;
  }

  if (!selectedStrategy || selectedCandidates.length < MIN_BENCHMARK_CREATORS) {
    const reason = "Ainda faltam contas parecidas com a sua para essa comparação ficar útil.";
    return {
      timingBenchmark: buildBenchmarkPlaceholder(reason, {
        contextId,
        contextLabel,
        followerBandId: followerBand?.id || null,
        followerBandLabel: followerBand?.label || null,
        creatorCount: fallbackCandidates.length,
      }),
      similarCreators:
        fallbackStrategy && fallbackCandidates.length > 0
          ? buildSimilarCreatorsPayload({
              strategy: fallbackStrategy,
              candidates: fallbackCandidates.map((candidate) => ({
                ...candidate,
                creatorContext: {
                  id: resolveCandidateContextIds(candidate)[0] || candidate?.creatorContext?.id || null,
                },
              })),
              contextId,
              contextLabel,
              followerBand,
              reason,
            })
          : buildSimilarCreatorsPlaceholder(reason, {
              label: null,
              contextId,
              contextLabel,
              followerBandId: followerBand?.id || null,
              followerBandLabel: followerBand?.label || null,
              creatorCount: 0,
            }),
    };
  }

  const similarCreators = buildSimilarCreatorsPayload({
    strategy: selectedStrategy,
    candidates: selectedCandidates.map((candidate) => ({
      ...candidate,
      creatorContext: {
        id: candidateTopContextMap.get(String(candidate._id)) || candidate?.creatorContext?.id || null,
      },
    })),
    contextId,
    contextLabel,
    followerBand,
  });

  const rankedCandidates = selectedCandidates
    .slice()
    .sort((a, b) => {
      const aFollowers =
        typeof a.followers_count === "number" && Number.isFinite(a.followers_count) ? a.followers_count : null;
      const bFollowers =
        typeof b.followers_count === "number" && Number.isFinite(b.followers_count) ? b.followers_count : null;
      if (currentFollowers !== null) {
        const aDistance = aFollowers === null ? Number.POSITIVE_INFINITY : Math.abs(aFollowers - currentFollowers);
        const bDistance = bFollowers === null ? Number.POSITIVE_INFINITY : Math.abs(bFollowers - currentFollowers);
        if (aDistance !== bDistance) return aDistance - bDistance;
      }
      return String(a._id).localeCompare(String(b._id));
    })
    .slice(0, MAX_BENCHMARK_CREATORS);

  const selectedUserIds = rankedCandidates.map((candidate) => candidate._id);
  const match: Record<string, unknown> = {
    user: { $in: selectedUserIds },
    postDate: startDate ? { $gte: startDate, $lte: new Date() } : { $lte: new Date() },
  };

  const comparablePosts = await MetricModel.find(match)
    .select(
      "postDate type format stats.total_interactions stats.likes stats.comments stats.shares stats.saved stats.saves stats.reach stats.views stats.profile_visits stats.follows stats.video_duration_seconds"
    )
    .lean();

  const postCount = Array.isArray(comparablePosts) ? comparablePosts.length : 0;
  if (postCount < MIN_BENCHMARK_POSTS) {
    return {
      timingBenchmark: buildBenchmarkPlaceholder("Ainda faltam posts suficientes dessas contas para te dar uma comparação confiável.", {
        contextId,
        contextLabel,
        followerBandId: followerBand?.id || null,
        followerBandLabel: followerBand?.label || null,
        creatorCount: rankedCandidates.length,
        postsCount: postCount,
      }),
      similarCreators,
    };
  }

  const hourlyMap = new Map<number, { sum: number; postsCount: number }>();
  const dayHourMap = new Map<string, { dayOfWeek: number; hour: number; sum: number; postsCount: number }>();
  const windowMap = new Map<string, { dayOfWeek: number; startHour: number; endHour: number; sum: number; postsCount: number }>();
  const durationMap = new Map<TimingBenchmarkDurationBucket["key"], { sum: number; postsCount: number }>([
    ["0_15", { sum: 0, postsCount: 0 }],
    ["15_30", { sum: 0, postsCount: 0 }],
    ["30_60", { sum: 0, postsCount: 0 }],
    ["60_plus", { sum: 0, postsCount: 0 }],
  ]);
  const formatMap = new Map<string, { sum: number; postsCount: number }>();
  let totalVideoPosts = 0;

  for (const post of comparablePosts) {
    const metricValue = getObjectiveMetricValue(post, objectiveMode);
    const safeMetricValue = typeof metricValue === "number" && Number.isFinite(metricValue) ? metricValue : 0;
    const dateParts = getTargetDateParts((post as any)?.postDate);
    if (dateParts && typeof metricValue === "number" && Number.isFinite(metricValue)) {
      const hourBucket = hourlyMap.get(dateParts.hour) || { sum: 0, postsCount: 0 };
      hourBucket.sum += metricValue;
      hourBucket.postsCount += 1;
      hourlyMap.set(dateParts.hour, hourBucket);

      const dayHourKey = `${dateParts.dayOfWeekMongo}:${dateParts.hour}`;
      const dayHourBucket = dayHourMap.get(dayHourKey) || {
        dayOfWeek: dateParts.dayOfWeekMongo,
        hour: dateParts.hour,
        sum: 0,
        postsCount: 0,
      };
      dayHourBucket.sum += metricValue;
      dayHourBucket.postsCount += 1;
      dayHourMap.set(dayHourKey, dayHourBucket);

      const startHour = Math.floor(dateParts.hour / WINDOW_BLOCK_HOURS) * WINDOW_BLOCK_HOURS;
      const endHour = Math.min(startHour + WINDOW_BLOCK_HOURS - 1, 23);
      const windowKey = `${dateParts.dayOfWeekMongo}:${startHour}`;
      const windowBucket = windowMap.get(windowKey) || {
        dayOfWeek: dateParts.dayOfWeekMongo,
        startHour,
        endHour,
        sum: 0,
        postsCount: 0,
      };
      windowBucket.sum += metricValue;
      windowBucket.postsCount += 1;
      windowMap.set(windowKey, windowBucket);
    }

    const formatValues = toStringArray((post as any)?.format)
      .map((value) => normalizeFormatBenchmarkLabel(value))
      .filter((value): value is string => Boolean(value));
    if (formatValues.length > 0) {
      const uniqueFormats = Array.from(new Set(formatValues));
      const formatWeight = 1 / uniqueFormats.length;
      uniqueFormats.forEach((formatLabel) => {
        const formatBucket = formatMap.get(formatLabel) || { sum: 0, postsCount: 0 };
        formatBucket.sum += safeMetricValue * formatWeight;
        formatBucket.postsCount += formatWeight;
        formatMap.set(formatLabel, formatBucket);
      });
    }

    const durationSeconds = toSafeNumber((post as any)?.stats?.video_duration_seconds);
    const durationKey = getDurationBucketKey(durationSeconds);
    if (!durationKey) continue;
    totalVideoPosts += 1;
    const durationBucket = durationMap.get(durationKey) || { sum: 0, postsCount: 0 };
    durationBucket.sum += safeMetricValue;
    durationBucket.postsCount += 1;
    durationMap.set(durationKey, durationBucket);
  }

  const hourlyBuckets: TimingBenchmarkBucket[] = Array.from(hourlyMap.entries())
    .map(([hour, data]) => ({
      hour,
      average: data.postsCount > 0 ? data.sum / data.postsCount : 0,
      postsCount: data.postsCount,
    }))
    .sort((a, b) => a.hour - b.hour);

  const dayHourBuckets: TimingBenchmarkDayHourBucket[] = Array.from(dayHourMap.values())
    .map((bucket) => ({
      dayOfWeek: bucket.dayOfWeek,
      hour: bucket.hour,
      average: bucket.postsCount > 0 ? bucket.sum / bucket.postsCount : 0,
      postsCount: bucket.postsCount,
    }))
    .sort((a, b) => (a.dayOfWeek === b.dayOfWeek ? a.hour - b.hour : a.dayOfWeek - b.dayOfWeek));

  const windows = Array.from(windowMap.values()).map((bucket) => ({
    dayOfWeek: bucket.dayOfWeek,
    startHour: bucket.startHour,
    endHour: bucket.endHour,
    average: bucket.postsCount > 0 ? bucket.sum / bucket.postsCount : 0,
    postsCount: bucket.postsCount,
  }));

  const durationBucketDefinitions: Array<
    Pick<TimingBenchmarkDurationBucket, "key" | "label" | "minSeconds" | "maxSeconds">
  > = [
    { key: "0_15", label: "0-15s", minSeconds: 0, maxSeconds: 15 },
    { key: "15_30", label: "15-30s", minSeconds: 15, maxSeconds: 30 },
    { key: "30_60", label: "30-60s", minSeconds: 30, maxSeconds: 60 },
    { key: "60_plus", label: "60s+", minSeconds: 60, maxSeconds: null },
  ];

  const durationBuckets: TimingBenchmarkDurationBucket[] = durationBucketDefinitions.map((definition) => {
    const data = durationMap.get(definition.key) || { sum: 0, postsCount: 0 };
    return {
      ...definition,
      average: data.postsCount > 0 ? data.sum / data.postsCount : 0,
      postsCount: data.postsCount,
    };
  });

  const formatBuckets: TimingBenchmarkFormatBucket[] = Array.from(formatMap.entries())
    .map(([name, data]) => ({
      name,
      average: data.postsCount > 0 ? data.sum / data.postsCount : 0,
      postsCount: Math.max(0, Math.round(data.postsCount)),
    }))
    .filter((bucket) => bucket.postsCount > 0)
    .sort((a, b) => (b.average === a.average ? b.postsCount - a.postsCount : b.average - a.average));

  return {
    timingBenchmark: {
      cohort: {
        canShow: true,
        strategy: selectedStrategy.strategy,
        label: selectedStrategy.label,
        contextId,
        contextLabel,
        followerBandId: followerBand?.id || null,
        followerBandLabel: followerBand?.label || null,
        creatorCount: rankedCandidates.length,
        postsCount: postCount,
        confidence: getBenchmarkConfidence(selectedStrategy.strategy, rankedCandidates.length, postCount),
      },
      hourly: {
        buckets: hourlyBuckets,
        topHoursByPosts: rankTopHours(hourlyBuckets, "postsCount"),
        topHoursByAverage: rankTopHours(hourlyBuckets, "average"),
      },
      weekly: {
        buckets: dayHourBuckets,
        topWindowsByPosts: rankTopWindows(windows, "postsCount"),
        topWindowsByAverage: rankTopWindows(windows, "average"),
      },
      duration: {
        buckets: durationBuckets,
        topBucketByPostsKey:
          durationBuckets
            .slice()
            .sort((a, b) => (b.postsCount === a.postsCount ? b.average - a.average : b.postsCount - a.postsCount))[0]?.key || null,
        topBucketByAverageKey:
          durationBuckets
            .filter((bucket) => bucket.postsCount > 0)
            .slice()
            .sort((a, b) => (b.average === a.average ? b.postsCount - a.postsCount : b.average - a.average))[0]?.key || null,
        totalVideoPosts,
      },
      format: {
        buckets: formatBuckets,
        topFormatByPosts:
          formatBuckets
            .slice()
            .sort((a, b) => (b.postsCount === a.postsCount ? b.average - a.average : b.postsCount - a.postsCount))[0]?.name || null,
        topFormatByAverage: formatBuckets[0]?.name || null,
      },
    },
    similarCreators,
  };
}

async function fetchComparableExperimentPosts(userId: string, timePeriod: TimePeriod): Promise<ComparableExperimentPost[]> {
  await connectToDatabase();
  const userObjectId = new Types.ObjectId(userId);
  const startDate = getTimePeriodStartDate(timePeriod);
  const match: Record<string, unknown> = {
    user: userObjectId,
    type: { $in: SUPPORTED_POST_TYPES },
  };
  if (startDate) {
    match.postDate = { $gte: startDate, $lte: new Date() };
  }

  const rows = await MetricModel.find(match)
    .select("postDate createdAt type format proposal context tone stats")
    .sort({ postDate: -1 })
    .lean();

  return Array.isArray(rows) ? (rows as ComparableExperimentPost[]) : [];
}

function buildExperimentImpactSummary(params: {
  action: PlanningRecommendationAction;
  posts: ComparableExperimentPost[];
  objectiveMode: PlanningObjectiveMode;
}): RecommendationExperimentImpactSummary | null {
  const { action, posts, objectiveMode } = params;
  if (action.feedbackStatus !== "applied" || !action.feedbackUpdatedAt) return null;
  const feedbackDate = new Date(action.feedbackUpdatedAt);
  if (Number.isNaN(feedbackDate.getTime())) return null;

  const metricLabel = String(action.metricLabel || getMetricMeta(getDefaultMetricFieldForObjective(objectiveMode)).label);
  const datedPosts = posts
    .map((post) => {
      const rawDate = post?.postDate || post?.createdAt || post?.timestamp;
      const parsedDate = rawDate ? new Date(rawDate) : null;
      const metricValue = getObjectiveMetricValue(post, objectiveMode);
      if (!parsedDate || Number.isNaN(parsedDate.getTime()) || metricValue === null || !Number.isFinite(metricValue)) {
        return null;
      }
      return { post, parsedDate, metricValue };
    })
    .filter((entry): entry is { post: ComparableExperimentPost; parsedDate: Date; metricValue: number } => Boolean(entry))
    .filter((entry) => matchesRecommendationVariant(entry.post, action))
    .sort((a, b) => b.parsedDate.getTime() - a.parsedDate.getTime());

  const postsAfter = datedPosts.filter((entry) => entry.parsedDate.getTime() > feedbackDate.getTime());
  const postsBefore = datedPosts.filter((entry) => entry.parsedDate.getTime() <= feedbackDate.getTime());

  if (!postsAfter.length) {
    return {
      status: "awaiting_posts",
      text: "Ainda não há posts novos aderentes a esse teste para medir impacto.",
      beforeAvg: null,
      afterAvg: null,
      deltaRatio: null,
      beforeCount: 0,
      afterCount: 0,
    };
  }

  const comparisonCount = Math.min(postsAfter.length, postsBefore.length, 5);
  if (comparisonCount <= 0) {
    return {
      status: "insufficient_history",
      text: "Há posts depois do teste, mas falta base anterior comparável dentro dessa mesma hipótese.",
      beforeAvg: null,
      afterAvg: null,
      deltaRatio: null,
      beforeCount: postsBefore.length,
      afterCount: postsAfter.length,
    };
  }

  const afterWindow = postsAfter.slice(0, comparisonCount);
  const beforeWindow = postsBefore.slice(0, comparisonCount);
  const afterAvg = afterWindow.reduce((sum, entry) => sum + entry.metricValue, 0) / comparisonCount;
  const beforeAvg = beforeWindow.reduce((sum, entry) => sum + entry.metricValue, 0) / comparisonCount;
  const deltaRatio = beforeAvg > 0 ? (afterAvg - beforeAvg) / beforeAvg : null;

  if (comparisonCount < 2) {
    return {
      status: "early",
      text: `Ainda cedo: existe só ${formatPostsCount(comparisonCount)} depois do teste para comparar ${metricLabel.toLowerCase()}.`,
      beforeAvg,
      afterAvg,
      deltaRatio,
      beforeCount: comparisonCount,
      afterCount: comparisonCount,
    };
  }

  if (typeof deltaRatio !== "number" || !Number.isFinite(deltaRatio)) {
    return {
      status: "early",
      text: `Já há ${formatPostsCount(comparisonCount)} depois do teste, mas a comparação ainda não é conclusiva.`,
      beforeAvg,
      afterAvg,
      deltaRatio: null,
      beforeCount: comparisonCount,
      afterCount: comparisonCount,
    };
  }

  const pct = Math.round(deltaRatio * 100);
  if (Math.abs(pct) < 5) {
    return {
      status: "stable",
      text: `Depois de ${formatPostsCount(comparisonCount)}, ${metricLabel.toLowerCase()} ficou estável contra os posts imediatamente anteriores.`,
      beforeAvg,
      afterAvg,
      deltaRatio,
      beforeCount: comparisonCount,
      afterCount: comparisonCount,
    };
  }

  if (pct > 0) {
    return {
      status: "improved",
      text: `Depois de ${formatPostsCount(comparisonCount)}, ${metricLabel.toLowerCase()} subiu ${pct}% contra os posts imediatamente anteriores.`,
      beforeAvg,
      afterAvg,
      deltaRatio,
      beforeCount: comparisonCount,
      afterCount: comparisonCount,
    };
  }

  return {
    status: "declined",
    text: `Depois de ${formatPostsCount(comparisonCount)}, ${metricLabel.toLowerCase()} caiu ${Math.abs(pct)}% contra os posts imediatamente anteriores.`,
    beforeAvg,
    afterAvg,
    deltaRatio,
    beforeCount: comparisonCount,
    afterCount: comparisonCount,
  };
}

async function enrichRecommendationsWithExperimentImpact(params: {
  userId: string;
  timePeriod: TimePeriod;
  objectiveMode: PlanningObjectiveMode;
  recommendations: ReturnType<typeof buildPlanningRecommendations>;
}): Promise<ReturnType<typeof buildPlanningRecommendations>> {
  const { userId, timePeriod, objectiveMode, recommendations } = params;
  const actions = Array.isArray(recommendations?.actions) ? recommendations.actions : [];
  const needsImpact = actions.some((action) => action.feedbackStatus === "applied" && action.feedbackUpdatedAt);
  if (!needsImpact) return recommendations;

  const comparablePosts = await fetchComparableExperimentPosts(userId, timePeriod);
  const nextActions = actions.map((action) => ({
    ...action,
    experimentImpact: buildExperimentImpactSummary({
      action,
      posts: comparablePosts,
      objectiveMode,
    }),
  }));

  return {
    ...recommendations,
    actions: nextActions,
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

  const fallbackMetricField = getDefaultMetricFieldForObjective(
    isAllowedPlanningObjective(objectiveModeParam) ? objectiveModeParam : "engagement"
  );
  const engagementMetricField: EngagementMetricField = isAllowedEngagementMetric(engagementMetricParam)
    ? engagementMetricParam
    : fallbackMetricField;
  if (engagementMetricParam && !isAllowedEngagementMetric(engagementMetricParam)) {
    return NextResponse.json(
      { error: `engagementMetricField inválido. Permitidos: ${ALLOWED_ENGAGEMENT_METRICS.join(", ")}` },
      { status: 400 }
    );
  }

  const metricField = metricParam || engagementMetricField || DEFAULT_METRIC_FIELD;
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
      objectiveMode,
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
          benchmarkBundle,
          formatData,
          groupedCharts,
          postsResult,
          strategicDeltas,
        ] = await Promise.all([
          timed("trendMs", () => getUserReachInteractionTrendChartData(userId, timePeriod, granularity, {})),
          timed("timeMs", () => aggregateUserTimePerformance(userId, periodInDaysValue, metricField, {})),
          timed("durationMs", () => aggregateUserDurationPerformance(userId, periodInDaysValue)),
          timed("benchmarkMs", () => buildSimilarCreatorsBenchmarkBundle(userId, timePeriod, objectiveMode)),
          timed("formatMs", () =>
            getEngagementDistributionByFormatChartData(
              userId,
              timePeriod,
              engagementMetricField,
              DEFAULT_FORMAT_MAPPING,
              maxSlices,
              { aggregationMode: "average" }
            )
          ),
          timed("groupingsMs", () =>
            getAverageEngagementByGroupings(
              userId,
              timePeriod,
              engagementMetricField,
              ["proposal", "tone", "references", "context"],
              undefined,
              { creditMode: "fractional" }
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
            timingBenchmark: benchmarkBundle.timingBenchmark,
            similarCreators: benchmarkBundle.similarCreators,
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
            metricMeta: {
              field: engagementMetricField,
              ...getMetricMeta(engagementMetricField),
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
      if (typeof perfData.durationMs === "number") timings.push({ name: "duration", durationMs: perfData.durationMs });
      if (typeof perfData.benchmarkMs === "number") timings.push({ name: "benchmark", durationMs: perfData.benchmarkMs });
      if (typeof perfData.formatMs === "number") timings.push({ name: "format", durationMs: perfData.formatMs });
      if (typeof perfData.groupingsMs === "number") timings.push({ name: "groupings", durationMs: perfData.groupingsMs });
      if (typeof perfData.postsMs === "number") timings.push({ name: "posts", durationMs: perfData.postsMs });
      if (typeof perfData.normalizeMs === "number") timings.push({ name: "normalize", durationMs: perfData.normalizeMs });
      if (typeof perfData.strategicDeltasMs === "number") timings.push({ name: "strategicDeltas", durationMs: perfData.strategicDeltasMs });
    }

    const responsePayload = (value as any)?.payload ?? value;
    const feedbackStartedAt = nowMs();
    const { feedbackByActionId, feedbackMetaByActionId } = await getRecommendationFeedbackByAction(userId, objectiveMode, timePeriod);
    timings.push({ name: "feedback", durationMs: nowMs() - feedbackStartedAt });
    const recommendationsStartedAt = nowMs();
    const recommendations = buildPlanningRecommendations({
      objectiveMode,
      trendData: responsePayload?.trendData,
      timeData: responsePayload?.timeData,
      durationData: responsePayload?.durationData,
      timingBenchmark: responsePayload?.timingBenchmark,
      formatData: responsePayload?.formatData,
      proposalData: responsePayload?.proposalData,
      toneData: responsePayload?.toneData,
      contextData: responsePayload?.contextData,
      feedbackByActionId,
      feedbackMetaByActionId,
    });
    timings.push({ name: "recommendations", durationMs: nowMs() - recommendationsStartedAt });
    const experimentImpactStartedAt = nowMs();
    const recommendationsWithImpact = await enrichRecommendationsWithExperimentImpact({
      userId,
      timePeriod,
      objectiveMode,
      recommendations,
    });
    timings.push({ name: "experimentImpact", durationMs: nowMs() - experimentImpactStartedAt });
    const directioningSummary = buildDirectioningSummary({
      objectiveMode,
      metricMeta: responsePayload?.metricMeta || getMetricMeta(engagementMetricField),
      strategicDeltas: responsePayload?.strategicDeltas,
      recommendations: recommendationsWithImpact,
    });
    const responsePayloadWithRecommendations = {
      ...responsePayload,
      objectiveMode,
      recommendations: recommendationsWithImpact,
      directioningSummary,
      topActions: recommendationsWithImpact.actions.slice(0, 3),
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
