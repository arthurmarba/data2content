/**
 * @fileoverview Builds an Instagram metrics summary from stored Metric
 * documents to enrich the mobile Diagnóstico experience and Gemini context.
 *
 * All data originates from the creator's own authenticated Instagram connection
 * and is stored in MongoDB by the existing metrics pipeline. No PII is included.
 */

import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { getCategoryByValue } from "@/app/lib/classification";

export interface InstagramWeeklyPerformancePoint {
  weekStart: string;
  avgReach: number | null;
  avgInteractions: number | null;
  postsCount: number;
}

export interface InstagramFormatPerformance {
  format: string;
  postsCount: number;
  avgReach: number | null;
  avgEngagementRate: number | null;
  avgViews: number | null;
  shareOfPosts: number;
}

/**
 * Resonance of a narrative territory (content context) measured by connection
 * signals — saves + shares — not by reach. Ordered by resonance so the strongest
 * narrative connection surfaces first. This is the bridge between Instagram data
 * and the map's coherence (jornada Etapa 8): "o que do meu conteúdo conecta".
 */
export interface InstagramTerritoryResonance {
  /** Context category id (e.g. "career_work"). */
  territory: string;
  /** Human-readable PT label (e.g. "Carreira/Trabalho"). */
  label: string;
  postsCount: number;
  avgReach: number | null;
  avgSavesPerPost: number | null;
  avgSharesPerPost: number | null;
  /** Connection score = avgSaves + avgShares, used for ordering. */
  resonanceScore: number | null;
}

export interface InstagramMetricDeltas {
  avgReachPerPost: number | null;
  avgInteractionsPerPost: number | null;
  avgEngagementRate: number | null;
  avgIntentActionsPerPost: number | null;
}

export interface InstagramBestDayOfWeek {
  /** 0=Sunday … 6=Saturday (UTC-based approximation). */
  dayIndex: number;
  dayLabel: string;
  avgReach: number;
  postCount: number;
}

export interface InstagramMetricsSummary {
  /** Average reach per post across the current sample window. */
  avgReachPerPost: number | null;
  /** Average engagement rate on reach (0-1 scale). */
  avgEngagementRate: number | null;
  /** Average duration of Reels in seconds. */
  avgReelsDurationSeconds: number | null;
  /** Average watch time for Reels in seconds, when present in stored stats. */
  avgReelsWatchTimeSeconds: number | null;
  /** Average view count for Reels. */
  avgReelsViews: number | null;
  /** Average total interactions per post. */
  avgInteractionsPerPost: number | null;
  avgSavesPerPost: number | null;
  avgSharesPerPost: number | null;
  avgCommentsPerPost: number | null;
  avgProfileVisitsPerPost: number | null;
  avgFollowsPerPost: number | null;
  /** Average follows/profile-visits conversion (0-1 scale). */
  avgFollowerConversionRate: number | null;
  /** Average saved + shares + profile visits + follows per post. */
  avgIntentActionsPerPost: number | null;
  /** Top 3 formats by post count. */
  topFormats: string[];
  /** Format ranking with per-format averages. */
  formatPerformance: InstagramFormatPerformance[];
  /** Territory (content context) ranking by connection signals (saves + shares). */
  territoryResonance: InstagramTerritoryResonance[];
  /** Weekly average reach/interactions for the current sample window. */
  weeklyPerformance: InstagramWeeklyPerformancePoint[];
  /** Current window vs previous equivalent window deltas. */
  deltas: InstagramMetricDeltas;
  /** Number of posts sampled in the current window. */
  postsAnalyzed: number;
  /** Current sample window in days. */
  sampleWindowDays: number;
  /** Previous comparison window in days. */
  comparisonWindowDays: number;
  /** Newest post date in the current sample window. */
  newestPostDate: string | null;
  /**
   * Weekly average reach for the last 6 weeks (oldest first -> newest last).
   * Used by the Diagnóstico tile sparkline. 0 for weeks without posts.
   */
  reachOverTime: number[];
  /** Day of week with highest average reach (requires ≥2 posts on that day). */
  bestDayOfWeek: InstagramBestDayOfWeek | null;
}

type InstagramMetricDocumentLike = {
  postDate?: Date | string | null;
  format?: string[] | string | null;
  type?: string | null;
  context?: string[] | string | null;
  stats?: Record<string, unknown> | null;
};

type MetricAverages = {
  avgReachPerPost: number | null;
  avgEngagementRate: number | null;
  avgInteractionsPerPost: number | null;
  avgIntentActionsPerPost: number | null;
};

const SAMPLE_WINDOW_DAYS = 60;
const COMPARISON_WINDOW_DAYS = 60;
const QUERY_WINDOW_DAYS = SAMPLE_WINDOW_DAYS + COMPARISON_WINDOW_DAYS;
const REACH_OVER_TIME_WEEKS = 6;
const WEEKLY_PERFORMANCE_WEEKS = Math.ceil(SAMPLE_WINDOW_DAYS / 7);
const ONE_DAY_MS = 86_400_000;
const ONE_WEEK_MS = 7 * ONE_DAY_MS;

function dateOnlyIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shiftDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * ONE_DAY_MS);
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function toPositiveNumber(value: unknown): number | null {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number(value)
      : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return roundMetric(sum / values.length);
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function deltaRatio(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null || previous <= 0) return null;
  return roundMetric((current - previous) / previous);
}

function formatLabels(value: InstagramMetricDocumentLike["format"]): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string" && value.trim()
    ? [value]
    : [];
  return raw.map(normalizeFormatLabel).filter(Boolean);
}

function metricFormatLabels(metric: InstagramMetricDocumentLike): string[] {
  const labels = formatLabels(metric.format);
  if (labels.length > 0) return labels;
  return typeof metric.type === "string" ? formatLabels(metric.type) : [];
}

function normalizeFormatLabel(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return "";
  if (normalized.includes("reel")) return "reel";
  if (normalized.includes("carousel") || normalized.includes("carrossel")) return "carrossel";
  if (normalized.includes("photo") || normalized.includes("image") || normalized.includes("foto")) return "foto";
  if (normalized.includes("video") || normalized.includes("vídeo")) return "vídeo";
  return normalized.replace(/[_-]+/g, " ");
}

function isReelFormat(formats: string[]): boolean {
  return formats.some((format) => format === "reel" || format === "vídeo");
}

function readReach(stats: Record<string, unknown>): number | null {
  return toPositiveNumber(stats.reach) ?? toPositiveNumber(stats.views) ?? toPositiveNumber(stats.impressions);
}

function hasStats(metric: InstagramMetricDocumentLike): metric is InstagramMetricDocumentLike & {
  stats: Record<string, unknown>;
} {
  return Boolean(metric.stats && typeof metric.stats === "object" && !Array.isArray(metric.stats));
}

function isAnalyzableMetric(metric: InstagramMetricDocumentLike): boolean {
  return hasStats(metric) && readReach(metric.stats) != null;
}

function readViews(stats: Record<string, unknown>): number | null {
  return toPositiveNumber(stats.views) ?? toPositiveNumber(stats.video_views) ?? toPositiveNumber(stats.plays);
}

function readInteractions(stats: Record<string, unknown>): number | null {
  const explicit = toPositiveNumber(stats.total_interactions) ?? toPositiveNumber(stats.engagement);
  if (explicit != null) return explicit;

  const parts = [
    toPositiveNumber(stats.likes) ?? 0,
    toPositiveNumber(stats.comments) ?? 0,
    toPositiveNumber(stats.shares) ?? 0,
    toPositiveNumber(stats.saved) ?? toPositiveNumber(stats.saves) ?? 0,
  ];
  const total = parts.reduce((sum, value) => sum + value, 0);
  return total > 0 ? total : null;
}

function readEngagementRate(stats: Record<string, unknown>, reach: number | null, interactions: number | null): number | null {
  const explicit = toPositiveNumber(stats.engagement_rate_on_reach);
  if (explicit != null) return explicit;
  if (reach != null && interactions != null && reach > 0) return interactions / reach;
  return null;
}

function readFollowerConversionRate(stats: Record<string, unknown>): number | null {
  const explicit = toPositiveNumber(stats.follower_conversion_rate);
  if (explicit != null) return explicit;
  const follows = toPositiveNumber(stats.follows);
  const profileVisits = toPositiveNumber(stats.profile_visits);
  if (follows != null && profileVisits != null && profileVisits > 0) return follows / profileVisits;
  return null;
}

function readIntentActions(stats: Record<string, unknown>): number | null {
  const total =
    (toPositiveNumber(stats.saved) ?? toPositiveNumber(stats.saves) ?? 0) +
    (toPositiveNumber(stats.shares) ?? 0) +
    (toPositiveNumber(stats.profile_visits) ?? 0) +
    (toPositiveNumber(stats.follows) ?? 0);
  return total > 0 ? total : null;
}

function readWatchTimeSeconds(stats: Record<string, unknown>): number | null {
  const seconds =
    toPositiveNumber(stats.average_video_watch_time_seconds) ??
    toPositiveNumber(stats.avg_watch_time_seconds);
  if (seconds != null) return seconds;
  const ms = toPositiveNumber(stats.ig_reels_avg_watch_time);
  return ms != null ? ms / 1000 : null;
}

function summarizeAverages(metrics: InstagramMetricDocumentLike[]): MetricAverages {
  const reachVals: number[] = [];
  const engagementVals: number[] = [];
  const interactionVals: number[] = [];
  const intentVals: number[] = [];

  for (const metric of metrics) {
    const stats = metric.stats ?? {};
    const reach = readReach(stats);
    const interactions = readInteractions(stats);
    const engagement = readEngagementRate(stats, reach, interactions);
    const intent = readIntentActions(stats);

    if (reach != null) reachVals.push(reach);
    if (engagement != null) engagementVals.push(engagement);
    if (interactions != null) interactionVals.push(interactions);
    if (intent != null) intentVals.push(intent);
  }

  return {
    avgReachPerPost: avg(reachVals),
    avgEngagementRate: avg(engagementVals),
    avgInteractionsPerPost: avg(interactionVals),
    avgIntentActionsPerPost: avg(intentVals),
  };
}

function bucketReachByWeek(metrics: InstagramMetricDocumentLike[], weeks: number, now: Date): number[] {
  const buckets: { total: number; count: number }[] = Array.from(
    { length: weeks },
    () => ({ total: 0, count: 0 }),
  );
  for (const metric of metrics) {
    const date = toDate(metric.postDate);
    if (!date) continue;
    const reach = readReach(metric.stats ?? {});
    if (reach === null) continue;
    const diffWeeks = Math.floor((now.getTime() - date.getTime()) / ONE_WEEK_MS);
    const bucketIdx = weeks - 1 - diffWeeks;
    if (bucketIdx >= 0 && bucketIdx < weeks) {
      const bucket = buckets[bucketIdx];
      if (!bucket) continue;
      bucket.total += reach;
      bucket.count += 1;
    }
  }
  return buckets.map((b) => (b.count > 0 ? Math.round(b.total / b.count) : 0));
}

function buildWeeklyPerformance(
  metrics: InstagramMetricDocumentLike[],
  currentStart: Date,
  now: Date,
): InstagramWeeklyPerformancePoint[] {
  const buckets: { reach: number[]; interactions: number[]; postsCount: number }[] = Array.from(
    { length: WEEKLY_PERFORMANCE_WEEKS },
    () => ({ reach: [], interactions: [], postsCount: 0 }),
  );

  for (const metric of metrics) {
    const date = toDate(metric.postDate);
    if (!date) continue;
    const diffWeeks = Math.floor((date.getTime() - currentStart.getTime()) / ONE_WEEK_MS);
    if (diffWeeks < 0 || diffWeeks >= WEEKLY_PERFORMANCE_WEEKS || date > now) continue;

    const stats = metric.stats ?? {};
    const reach = readReach(stats);
    const interactions = readInteractions(stats);
    const bucket = buckets[diffWeeks];
    if (!bucket) continue;
    bucket.postsCount += 1;
    if (reach != null) bucket.reach.push(reach);
    if (interactions != null) bucket.interactions.push(interactions);
  }

  return buckets.map((bucket, index) => ({
    weekStart: dateOnlyIso(shiftDays(currentStart, index * 7)),
    avgReach: avg(bucket.reach),
    avgInteractions: avg(bucket.interactions),
    postsCount: bucket.postsCount,
  }));
}

function buildFormatPerformance(metrics: InstagramMetricDocumentLike[]): InstagramFormatPerformance[] {
  const grouped = new Map<
    string,
    { posts: Set<InstagramMetricDocumentLike>; reach: number[]; engagement: number[]; views: number[] }
  >();

  for (const metric of metrics) {
    const formats = metricFormatLabels(metric);
    if (formats.length === 0) continue;
    const stats = metric.stats ?? {};
    const reach = readReach(stats);
    const interactions = readInteractions(stats);
    const engagement = readEngagementRate(stats, reach, interactions);
    const views = readViews(stats);

    for (const format of formats) {
      const current = grouped.get(format) ?? {
        posts: new Set<InstagramMetricDocumentLike>(),
        reach: [],
        engagement: [],
        views: [],
      };
      current.posts.add(metric);
      if (reach != null) current.reach.push(reach);
      if (engagement != null) current.engagement.push(engagement);
      if (views != null) current.views.push(views);
      grouped.set(format, current);
    }
  }

  return Array.from(grouped.entries())
    .map(([format, data]) => ({
      format,
      postsCount: data.posts.size,
      avgReach: avg(data.reach),
      avgEngagementRate: avg(data.engagement),
      avgViews: avg(data.views),
      shareOfPosts: metrics.length > 0 ? roundMetric(data.posts.size / metrics.length) : 0,
    }))
    .sort((a, b) => b.postsCount - a.postsCount || (b.avgReach ?? 0) - (a.avgReach ?? 0))
    .slice(0, 4);
}

function metricContextLabels(metric: InstagramMetricDocumentLike): string[] {
  const raw = Array.isArray(metric.context)
    ? metric.context
    : typeof metric.context === "string" && metric.context.trim()
    ? [metric.context]
    : [];
  return raw
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
}

/**
 * Groups posts by content context (territory) and ranks by connection signals
 * (saves + shares) rather than reach. A territory needs ≥2 posts so a single
 * viral post can't dominate. Reach is reported for context, not for ordering.
 */
function buildTerritoryResonance(metrics: InstagramMetricDocumentLike[]): InstagramTerritoryResonance[] {
  const grouped = new Map<
    string,
    { posts: Set<InstagramMetricDocumentLike>; reach: number[]; saves: number[]; shares: number[] }
  >();

  for (const metric of metrics) {
    const contexts = metricContextLabels(metric);
    if (contexts.length === 0) continue;
    const stats = metric.stats ?? {};
    const reach = readReach(stats);
    const saves = toPositiveNumber(stats.saved) ?? toPositiveNumber(stats.saves);
    const shares = toPositiveNumber(stats.shares);

    for (const context of contexts) {
      const current = grouped.get(context) ?? {
        posts: new Set<InstagramMetricDocumentLike>(),
        reach: [],
        saves: [],
        shares: [],
      };
      current.posts.add(metric);
      if (reach != null) current.reach.push(reach);
      if (saves != null) current.saves.push(saves);
      if (shares != null) current.shares.push(shares);
      grouped.set(context, current);
    }
  }

  return Array.from(grouped.entries())
    .map(([territory, data]) => {
      const avgSaves = avg(data.saves);
      const avgShares = avg(data.shares);
      const resonanceScore =
        avgSaves != null || avgShares != null
          ? roundMetric((avgSaves ?? 0) + (avgShares ?? 0))
          : null;
      return {
        territory,
        label: getCategoryByValue(territory, "context")?.label ?? territory.replace(/[_-]+/g, " "),
        postsCount: data.posts.size,
        avgReach: avg(data.reach),
        avgSavesPerPost: avgSaves,
        avgSharesPerPost: avgShares,
        resonanceScore,
      };
    })
    .filter((item) => item.postsCount >= 2 && item.resonanceScore != null)
    .sort((a, b) => (b.resonanceScore ?? 0) - (a.resonanceScore ?? 0) || b.postsCount - a.postsCount)
    .slice(0, 4);
}

const DAY_LABELS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;

function buildBestDayOfWeek(metrics: InstagramMetricDocumentLike[]): InstagramBestDayOfWeek | null {
  const buckets = Array.from({ length: 7 }, () => ({ total: 0, count: 0 }));
  for (const metric of metrics) {
    const date = toDate(metric.postDate);
    if (!date) continue;
    const reach = readReach(metric.stats ?? {});
    if (reach == null) continue;
    const dayIdx = date.getDay();
    const bucket = buckets[dayIdx];
    if (!bucket) continue;
    bucket.total += reach;
    bucket.count += 1;
  }
  let bestIdx = -1;
  let bestAvg = 0;
  for (let i = 0; i < 7; i++) {
    const bucket = buckets[i];
    if (!bucket || bucket.count < 1) continue;
    const dayAvg = bucket.total / bucket.count;
    if (dayAvg > bestAvg) { bestAvg = dayAvg; bestIdx = i; }
  }
  if (bestIdx === -1) return null;
  const winnerBucket = buckets[bestIdx];
  const dayLabel = DAY_LABELS_PT[bestIdx];
  if (!winnerBucket || !dayLabel) return null;
  return {
    dayIndex: bestIdx,
    dayLabel,
    avgReach: Math.round(bestAvg),
    postCount: winnerBucket.count,
  };
}

/**
 * Pure summarizer used by the server query and unit tests.
 */
export function summarizeInstagramMetrics(
  metrics: InstagramMetricDocumentLike[],
  now: Date = new Date(),
): InstagramMetricsSummary | null {
  const currentStart = shiftDays(now, -SAMPLE_WINDOW_DAYS);
  const previousStart = shiftDays(currentStart, -COMPARISON_WINDOW_DAYS);

  const currentMetrics = metrics
    .filter((metric) => {
      const date = toDate(metric.postDate);
      return Boolean(date && date >= currentStart && date <= now && isAnalyzableMetric(metric));
    })
    .sort((a, b) => (toDate(b.postDate)?.getTime() ?? 0) - (toDate(a.postDate)?.getTime() ?? 0));

  if (currentMetrics.length === 0) return null;

  const previousMetrics = metrics.filter((metric) => {
    const date = toDate(metric.postDate);
    return Boolean(date && date >= previousStart && date < currentStart && isAnalyzableMetric(metric));
  });

  const currentAverages = summarizeAverages(currentMetrics);
  const previousAverages = summarizeAverages(previousMetrics);
  const durationVals: number[] = [];
  const watchTimeVals: number[] = [];
  const viewsVals: number[] = [];
  const savesVals: number[] = [];
  const sharesVals: number[] = [];
  const commentsVals: number[] = [];
  const profileVisitsVals: number[] = [];
  const followsVals: number[] = [];
  const followerConversionVals: number[] = [];

  for (const metric of currentMetrics) {
    const stats = metric.stats ?? {};
    const formats = metricFormatLabels(metric);
    const isReel = isReelFormat(formats);

    if (isReel) {
      const duration = toPositiveNumber(stats.video_duration_seconds);
      const views = readViews(stats);
      const watchTime = readWatchTimeSeconds(stats);
      if (duration != null) durationVals.push(duration);
      if (views != null) viewsVals.push(views);
      if (watchTime != null) watchTimeVals.push(watchTime);
    }

    const saves = toPositiveNumber(stats.saved) ?? toPositiveNumber(stats.saves);
    const shares = toPositiveNumber(stats.shares);
    const comments = toPositiveNumber(stats.comments);
    const profileVisits = toPositiveNumber(stats.profile_visits);
    const follows = toPositiveNumber(stats.follows);
    const followerConversion = readFollowerConversionRate(stats);

    if (saves != null) savesVals.push(saves);
    if (shares != null) sharesVals.push(shares);
    if (comments != null) commentsVals.push(comments);
    if (profileVisits != null) profileVisitsVals.push(profileVisits);
    if (follows != null) followsVals.push(follows);
    if (followerConversion != null) followerConversionVals.push(followerConversion);
  }

  const formatPerformance = buildFormatPerformance(currentMetrics);
  const topFormats = formatPerformance.slice(0, 3).map((item) => item.format);
  const newestPostDate = toDate(currentMetrics[0]?.postDate);

  return {
    ...currentAverages,
    avgReelsDurationSeconds: avg(durationVals),
    avgReelsWatchTimeSeconds: avg(watchTimeVals),
    avgReelsViews: avg(viewsVals),
    avgSavesPerPost: avg(savesVals),
    avgSharesPerPost: avg(sharesVals),
    avgCommentsPerPost: avg(commentsVals),
    avgProfileVisitsPerPost: avg(profileVisitsVals),
    avgFollowsPerPost: avg(followsVals),
    avgFollowerConversionRate: avg(followerConversionVals),
    topFormats,
    formatPerformance,
    territoryResonance: buildTerritoryResonance(currentMetrics),
    weeklyPerformance: buildWeeklyPerformance(currentMetrics, currentStart, now),
    deltas: {
      avgReachPerPost: deltaRatio(currentAverages.avgReachPerPost, previousAverages.avgReachPerPost),
      avgInteractionsPerPost: deltaRatio(currentAverages.avgInteractionsPerPost, previousAverages.avgInteractionsPerPost),
      avgEngagementRate: deltaRatio(currentAverages.avgEngagementRate, previousAverages.avgEngagementRate),
      avgIntentActionsPerPost: deltaRatio(currentAverages.avgIntentActionsPerPost, previousAverages.avgIntentActionsPerPost),
    },
    postsAnalyzed: currentMetrics.length,
    sampleWindowDays: SAMPLE_WINDOW_DAYS,
    comparisonWindowDays: COMPARISON_WINDOW_DAYS,
    newestPostDate: newestPostDate ? newestPostDate.toISOString() : null,
    reachOverTime: bucketReachByWeek(currentMetrics, REACH_OVER_TIME_WEEKS, now),
    bestDayOfWeek: buildBestDayOfWeek(currentMetrics),
  };
}

/**
 * Queries the last 120 days and computes a compact Instagram summary.
 * Returns null if no metrics are found or on any error.
 */
export async function buildInstagramMetricsSummary(
  userId: string,
): Promise<InstagramMetricsSummary | null> {
  try {
    await connectToDatabase();
    const { default: MetricModel } = await import("@/app/models/Metric");

    const now = new Date();
    const queryStart = shiftDays(now, -QUERY_WINDOW_DAYS);

    const metrics = await MetricModel.find({
      user: new Types.ObjectId(userId),
      postDate: { $gte: queryStart },
      $or: [
        { "stats.reach": { $gt: 0 } },
        { "stats.views": { $gt: 0 } },
        { "stats.impressions": { $gt: 0 } },
      ],
    })
      .sort({ postDate: -1 })
      .select("postDate format type context stats")
      .lean();

    if (!metrics || metrics.length === 0) return null;
    return summarizeInstagramMetrics(metrics as InstagramMetricDocumentLike[], now);
  } catch {
    return null;
  }
}
