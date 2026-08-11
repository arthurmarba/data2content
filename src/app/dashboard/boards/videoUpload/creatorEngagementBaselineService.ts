import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import {
  canonicalAestheticById,
  canonicalFramingById,
  canonicalPlaceById,
  canonicalToneById,
} from "@/app/lib/relatorio/mapRegistry";

export type CreatorEngagementPattern = {
  key: string;
  label: string;
  count: number;
};

export type CreatorEngagementBaseline = {
  postsAnalyzed: number;
  windowDays: number;
  confidence: "low" | "medium" | "high";
  medianEngagementRate: number | null;
  medianDeepEngagementRate: number | null;
  topPostsCount: number;
  openingSpeechRate: number | null;
  openingTextRate: number | null;
  patterns: {
    framing: CreatorEngagementPattern | null;
    aesthetic: CreatorEngagementPattern | null;
    subject: CreatorEngagementPattern | null;
    tone: CreatorEngagementPattern | null;
    place: CreatorEngagementPattern | null;
  };
};

type MetricLike = {
  stats?: Record<string, unknown>;
  sceneElements?: {
    framingIds?: string[];
    aestheticIds?: string[];
    subjects?: string[];
    subjectIds?: string[];
    toneIds?: string[];
    placeId?: string | null;
    openingLine?: string | null;
    screenTitle?: string | null;
  } | null;
};

const WINDOW_DAYS = 90;
const MAX_POSTS = 60;

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function metricRates(metric: MetricLike) {
  const stats = metric.stats ?? {};
  const reach = finite(stats.reach ?? stats.accounts_reached);
  if (!reach || reach <= 0) return { engagement: null, deep: null };
  const likes = finite(stats.likes) ?? 0;
  const comments = finite(stats.comments) ?? 0;
  const saves = finite(stats.saved ?? stats.saves) ?? 0;
  const shares = finite(stats.shares) ?? 0;
  return {
    engagement: (likes + comments + saves + shares) / reach,
    deep: (comments + saves + shares) / reach,
  };
}

function median(values: Array<number | null>): number | null {
  const usable = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (usable.length === 0) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 === 0
    ? ((usable[middle - 1] ?? 0) + (usable[middle] ?? 0)) / 2
    : usable[middle] ?? null;
}

function normalizeOpenLabel(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function strongestPattern(
  values: string[],
  labelFor: (key: string) => string | null,
): CreatorEngagementPattern | null {
  const counts = new Map<string, number>();
  for (const raw of values) {
    const key = raw.trim();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const winner = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (!winner) return null;
  return { key: winner[0], label: labelFor(winner[0]) ?? normalizeOpenLabel(winner[0]), count: winner[1] };
}

export function buildCreatorEngagementBaselineFromMetrics(
  metrics: MetricLike[],
): CreatorEngagementBaseline {
  const ranked = metrics
    .map((metric) => ({ metric, rates: metricRates(metric) }))
    .filter((item) => item.rates.engagement !== null)
    .sort((a, b) => (b.rates.deep ?? b.rates.engagement ?? 0) - (a.rates.deep ?? a.rates.engagement ?? 0));
  const topCount = ranked.length > 0 ? Math.max(1, Math.ceil(ranked.length * 0.35)) : 0;
  const top = ranked.slice(0, topCount).map((item) => item.metric);
  const topWithScenes = top.filter((metric) => Boolean(metric.sceneElements));
  const rate = (count: number) => topWithScenes.length > 0 ? count / topWithScenes.length : null;

  return {
    postsAnalyzed: ranked.length,
    windowDays: WINDOW_DAYS,
    confidence: ranked.length >= 12 ? "high" : ranked.length >= 5 ? "medium" : "low",
    medianEngagementRate: median(ranked.map((item) => item.rates.engagement)),
    medianDeepEngagementRate: median(ranked.map((item) => item.rates.deep)),
    topPostsCount: topCount,
    openingSpeechRate: rate(topWithScenes.filter((metric) => Boolean(metric.sceneElements?.openingLine?.trim())).length),
    openingTextRate: rate(topWithScenes.filter((metric) => Boolean(metric.sceneElements?.screenTitle?.trim())).length),
    patterns: {
      framing: strongestPattern(
        top.flatMap((metric) => metric.sceneElements?.framingIds ?? []),
        (key) => canonicalFramingById(key)?.label ?? null,
      ),
      aesthetic: strongestPattern(
        top.flatMap((metric) => metric.sceneElements?.aestheticIds ?? []),
        (key) => canonicalAestheticById(key)?.label ?? null,
      ),
      subject: strongestPattern(
        top.flatMap((metric) => metric.sceneElements?.subjects ?? metric.sceneElements?.subjectIds ?? []),
        (key) => normalizeOpenLabel(key),
      ),
      tone: strongestPattern(
        top.flatMap((metric) => metric.sceneElements?.toneIds ?? []),
        (key) => canonicalToneById(key)?.label ?? null,
      ),
      place: strongestPattern(
        top.map((metric) => metric.sceneElements?.placeId ?? "").filter(Boolean),
        (key) => canonicalPlaceById(key)?.label ?? null,
      ),
    },
  };
}

export async function buildCreatorEngagementBaseline(
  userId: string,
): Promise<CreatorEngagementBaseline> {
  if (!Types.ObjectId.isValid(userId)) return buildCreatorEngagementBaselineFromMetrics([]);
  await connectToDatabase();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const metrics = await MetricModel.find({
    user: new Types.ObjectId(userId),
    postDate: { $gte: since },
    classificationStatus: "completed",
    "stats.reach": { $gt: 0 },
    $or: [
      { format: "reel" },
      { type: { $regex: "reel|video", $options: "i" } },
      { "stats.video_duration_seconds": { $gt: 0 } },
    ],
  })
    .select("stats sceneElements postDate")
    .sort({ postDate: -1 })
    .limit(MAX_POSTS)
    .lean();
  return buildCreatorEngagementBaselineFromMetrics(metrics as unknown as MetricLike[]);
}
