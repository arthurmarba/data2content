import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import { getCategoryByValue } from "@/app/lib/classification";
import {
  canonicalAestheticById,
  canonicalAssetRoleById,
  canonicalFramingById,
  canonicalPlaceById,
  canonicalToneById,
} from "@/app/lib/relatorio/mapRegistry";
import { D2C_INTELLIGENCE_SCHEMA_VERSION } from "./intelligenceContract";
import {
  resolveMcpPeriod,
  type McpPeriodRequest,
} from "./periodContract";

export type McpAnalysisFormat = "all" | "reel" | "carousel" | "photo";

type MetricLike = Record<string, any> & {
  _id?: unknown;
  postDate?: Date | string | null;
  type?: string | null;
  format?: string[] | string | null;
  stats?: Record<string, unknown> | null;
  sceneElements?: Record<string, any> | null;
  source?: string | null;
};

type NumericKey =
  | "reach"
  | "views"
  | "interactions"
  | "saved"
  | "shares"
  | "comments"
  | "likes"
  | "watchTimeSeconds"
  | "durationSeconds"
  | "retentionRate"
  | "profileVisits"
  | "follows";

type NormalizedPost = {
  raw: MetricLike;
  id: string;
  postDate: Date;
  format: Exclude<McpAnalysisFormat, "all"> | "video" | "unknown";
  metrics: Record<NumericKey, number | null>;
  mature: boolean;
  performanceIndex: number | null;
};

const MATURITY_MS = 48 * 60 * 60 * 1000;

function finite(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toDate(value: unknown): Date | null {
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date : null;
}

function stringList(value: unknown): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  return [...new Set(values
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean))];
}

function normalizeFormat(metric: MetricLike): NormalizedPost["format"] {
  const values = [...stringList(metric.format), String(metric.type ?? "")].join(" ").toLowerCase();
  if (/reel/.test(values)) return "reel";
  if (/carousel|carrossel/.test(values)) return "carousel";
  if (/photo|image|foto/.test(values)) return "photo";
  if (/video|vídeo/.test(values)) return "video";
  return "unknown";
}

function readMetrics(metric: MetricLike): NormalizedPost["metrics"] {
  const stats = metric.stats ?? {};
  const watchTimeSeconds = finite(stats.average_video_watch_time_seconds)
    ?? finite(stats.avg_watch_time_seconds)
    ?? (() => {
      const milliseconds = finite(stats.ig_reels_avg_watch_time);
      return milliseconds == null ? null : milliseconds / 1000;
    })();
  const durationSeconds = finite(stats.video_duration_seconds);
  const reach = finite(stats.reach) ?? finite(stats.accounts_reached) ?? finite(stats.impressions);
  const interactions = finite(stats.total_interactions) ?? finite(stats.engagement) ?? (() => {
    const values = [stats.likes, stats.comments, stats.shares, stats.saved ?? stats.saves]
      .map(finite)
      .filter((value): value is number => value != null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
  })();
  return {
    reach,
    views: finite(stats.views) ?? finite(stats.video_views) ?? finite(stats.plays),
    interactions,
    saved: finite(stats.saved) ?? finite(stats.saves),
    shares: finite(stats.shares),
    comments: finite(stats.comments),
    likes: finite(stats.likes),
    watchTimeSeconds,
    durationSeconds,
    retentionRate: finite(stats.retention_rate)
      ?? (watchTimeSeconds != null && durationSeconds ? watchTimeSeconds / durationSeconds : null),
    profileVisits: finite(stats.profile_visits),
    follows: finite(stats.follows),
  };
}

const DERIVED_METRIC_KEYS = [
  "engagement_rate_on_reach",
  "engagement_rate_on_impressions",
  "follower_conversion_rate",
  "propagation_index",
  "like_comment_ratio",
  "comment_share_ratio",
  "save_like_ratio",
  "virality_weighted",
  "follow_reach_ratio",
  "engagement_deep_vs_reach",
  "engagement_fast_vs_reach",
  "deep_fast_engagement_ratio",
] as const;

function readDerivedMetrics(metric: MetricLike) {
  const stats = metric.stats ?? {};
  return Object.fromEntries(DERIVED_METRIC_KEYS.map((key) => [key, finite(stats[key])])) as Record<
    typeof DERIVED_METRIC_KEYS[number],
    number | null
  >;
}

function velocitySummary(metric: MetricLike) {
  const snapshots = Array.isArray(metric.dailySnapshots) ? metric.dailySnapshots : [];
  const normalized = snapshots.flatMap((snapshot: Record<string, unknown>) => {
    const date = toDate(snapshot?.date);
    if (!date) return [];
    return [{
      date: date.toISOString(),
      dailyViews: finite(snapshot.dailyViews),
      dailyLikes: finite(snapshot.dailyLikes),
      dailyComments: finite(snapshot.dailyComments),
      dailyShares: finite(snapshot.dailyShares),
      cumulativeViews: finite(snapshot.cumulativeViews),
      cumulativeLikes: finite(snapshot.cumulativeLikes),
    }];
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  const first = normalized[0];
  const latest = normalized.at(-1);
  return {
    available: normalized.length > 0,
    snapshotsCount: normalized.length,
    startsAt: first?.date ?? null,
    endsAt: latest?.date ?? null,
    cumulativeViewGrowth: first?.cumulativeViews != null && latest?.cumulativeViews != null
      ? latest.cumulativeViews - first.cumulativeViews
      : null,
    snapshots: normalized,
  };
}

function entityTargets(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const type = String((item as Record<string, unknown>).type ?? "").trim();
    const label = String((item as Record<string, unknown>).label ?? "").trim();
    if (!type || !label) return [];
    return [{ type, label, canonicalId: (item as Record<string, unknown>).canonicalId ?? null }];
  });
}

function classificationSummary(metric: MetricLike) {
  const meta = metric.classificationMeta && typeof metric.classificationMeta === "object"
    ? metric.classificationMeta as Record<string, unknown>
    : {};
  return {
    status: metric.classificationStatus ?? null,
    proposals: stringList(metric.proposal).map(humanize),
    contexts: stringList(metric.context).map(contextLabel),
    tones: stringList(metric.tone).map(humanize),
    references: stringList(metric.references).map(humanize),
    contentIntents: stringList(metric.contentIntent).map(humanize),
    narrativeForms: stringList(metric.narrativeForm).map(humanize),
    contentSignals: stringList(metric.contentSignals).map(humanize),
    stances: stringList(metric.stance).map(humanize),
    proofStyles: stringList(metric.proofStyle).map(humanize),
    commercialModes: stringList(metric.commercialMode).map(humanize),
    primary: typeof meta.primary === "string" ? humanize(meta.primary) : null,
    secondary: typeof meta.secondary === "string" ? humanize(meta.secondary) : null,
    confidence: meta.confidence && typeof meta.confidence === "object" ? meta.confidence : {},
    evidence: meta.evidence && typeof meta.evidence === "object" ? meta.evidence : {},
  };
}

function avg(values: Array<number | null>): number | null {
  const usable = values.filter((value): value is number => value != null);
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function median(values: Array<number | null>): number | null {
  const usable = values.filter((value): value is number => value != null).sort((a, b) => a - b);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2 ? usable[middle]! : (usable[middle - 1]! + usable[middle]!) / 2;
}

function round(value: number | null, digits = 2): number | null {
  if (value == null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function delta(current: number | null, previous: number | null): number | null {
  return current != null && previous != null && previous > 0 ? round((current - previous) / previous) : null;
}

function evidenceLevel(count: number): "example" | "indication" | "signal" | "pattern" {
  if (count >= 5) return "pattern";
  if (count >= 3) return "signal";
  if (count === 2) return "indication";
  return "example";
}

function humanize(value: string): string {
  return value.replace(/[._-]+/g, " ").replace(/\s+/g, " ").trim();
}

function contextLabel(value: string): string {
  return getCategoryByValue(value, "context")?.label ?? humanize(value);
}

function metricRatios(post: NormalizedPost, baseline: Record<string, number | null>) {
  const intent = post.metrics.reach && post.metrics.reach > 0
    ? ((post.metrics.saved ?? 0) + (post.metrics.shares ?? 0)) / post.metrics.reach
    : null;
  const engagement = post.metrics.reach && post.metrics.reach > 0 && post.metrics.interactions != null
    ? post.metrics.interactions / post.metrics.reach
    : null;
  const components = [
    { value: post.metrics.reach, baseline: baseline.reach, weight: 0.35 },
    { value: post.metrics.retentionRate, baseline: baseline.retentionRate, weight: 0.25 },
    { value: intent, baseline: baseline.intentRate, weight: 0.25 },
    { value: engagement, baseline: baseline.engagementRate, weight: 0.15 },
  ].filter((item) => item.value != null && item.baseline != null && item.baseline > 0);
  if (!components.length) return null;
  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
  return round(components.reduce((sum, item) => {
    const ratio = Math.min(3, Math.max(0, item.value! / item.baseline!));
    return sum + ratio * item.weight;
  }, 0) / totalWeight);
}

function baselineFor(posts: NormalizedPost[]) {
  const intentRates = posts.map((post) => post.metrics.reach && post.metrics.reach > 0
    ? ((post.metrics.saved ?? 0) + (post.metrics.shares ?? 0)) / post.metrics.reach
    : null);
  const engagementRates = posts.map((post) => post.metrics.reach && post.metrics.reach > 0 && post.metrics.interactions != null
    ? post.metrics.interactions / post.metrics.reach
    : null);
  return {
    reach: median(posts.map((post) => post.metrics.reach)),
    retentionRate: median(posts.map((post) => post.metrics.retentionRate)),
    intentRate: median(intentRates),
    engagementRate: median(engagementRates),
  };
}

function normalizePosts(metrics: MetricLike[], now: Date): NormalizedPost[] {
  const normalized: NormalizedPost[] = metrics.flatMap((raw): NormalizedPost[] => {
    const postDate = toDate(raw.postDate);
    if (!postDate) return [];
    return [{
      raw,
      id: String(raw._id ?? raw.instagramMediaId ?? ""),
      postDate,
      format: normalizeFormat(raw),
      metrics: readMetrics(raw),
      mature: now.getTime() - postDate.getTime() >= MATURITY_MS,
      performanceIndex: null,
    }];
  });
  const unique = new Map<string, NormalizedPost>();
  for (const post of normalized) {
    const key = String(post.raw.instagramMediaId ?? post.raw._id ?? `${post.postDate.toISOString()}:${post.raw.postLink ?? ""}`);
    if (!unique.has(key)) unique.set(key, post);
  }
  const posts = [...unique.values()];
  const mature = posts.filter((post) => post.mature);
  const baseline = baselineFor(mature.length ? mature : posts);
  for (const post of posts) post.performanceIndex = metricRatios(post, baseline);
  return posts;
}

function publicationInventory(posts: NormalizedPost[], returnedSampleCount: number) {
  const items = [...posts]
    .sort((a, b) => b.postDate.getTime() - a.postDate.getTime())
    .map((post) => ({
      id: post.id,
      instagramMediaId: post.raw.instagramMediaId ?? null,
      publishedAt: post.postDate.toISOString(),
      format: post.format,
      url: typeof post.raw.postLink === "string" ? post.raw.postLink : null,
      source: typeof post.raw.source === "string" ? post.raw.source : null,
    }));
  const metricsEligibleCount = posts.filter((post) =>
    Object.values(post.metrics).some((value) => value != null),
  ).length;
  const fullyAnalyzedCount = posts.filter((post) => {
    const classified = post.raw.classificationStatus === "completed";
    const visualEligible = ["reel", "video", "carousel", "photo"].includes(post.format);
    return classified && (!visualEligible || Boolean(post.raw.sceneElements?.version));
  }).length;
  const byFormat = posts.reduce<Record<string, number>>((acc, post) => {
    acc[post.format] = (acc[post.format] ?? 0) + 1;
    return acc;
  }, {});
  return {
    countBasis: "distinct_content_records_by_instagram_media_id_or_record_id",
    publishedCount: posts.length,
    collectedCount: posts.length,
    metricsEligibleCount,
    fullyAnalyzedCount,
    returnedSampleCount,
    byFormat,
    items,
  };
}

function publicationSummary(label: string, inventory: ReturnType<typeof publicationInventory>): string {
  const formatNames: Record<string, { singular: string; plural: string }> = {
    reel: { singular: "Reel", plural: "Reels" },
    video: { singular: "vídeo", plural: "vídeos" },
    carousel: { singular: "carrossel", plural: "carrosséis" },
    photo: { singular: "foto", plural: "fotos" },
    unknown: { singular: "conteúdo sem formato identificado", plural: "conteúdos sem formato identificado" },
  };
  const breakdown = Object.entries(inventory.byFormat)
    .filter(([, count]) => count > 0)
    .map(([format, count]) => {
      const names = formatNames[format];
      return `${count} ${names ? (count === 1 ? names.singular : names.plural) : format}`;
    })
    .join(" e ");
  const noun = inventory.publishedCount === 1 ? "publicação" : "publicações";
  return `No período ${label}, a Data2Content encontrou ${inventory.publishedCount} ${noun}${breakdown ? `: ${breakdown}` : ""}.`;
}

function filterFormat(posts: NormalizedPost[], format: McpAnalysisFormat): NormalizedPost[] {
  return format === "all" ? posts : posts.filter((post) => post.format === format);
}

function summarizePillars(posts: NormalizedPost[]) {
  const intentRates = posts.map((post) => post.metrics.reach && post.metrics.reach > 0
    ? ((post.metrics.saved ?? 0) + (post.metrics.shares ?? 0)) / post.metrics.reach
    : null);
  return {
    distribution: {
      avgReach: round(avg(posts.map((post) => post.metrics.reach))),
      avgViews: round(avg(posts.map((post) => post.metrics.views))),
    },
    attention: {
      avgWatchTimeSeconds: round(avg(posts.map((post) => post.metrics.watchTimeSeconds))),
      avgRetentionRate: round(avg(posts.map((post) => post.metrics.retentionRate)), 4),
    },
    intent: {
      avgSaves: round(avg(posts.map((post) => post.metrics.saved))),
      avgShares: round(avg(posts.map((post) => post.metrics.shares))),
      avgIntentRate: round(avg(intentRates), 4),
    },
    conversion: {
      avgProfileVisits: round(avg(posts.map((post) => post.metrics.profileVisits))),
      avgFollows: round(avg(posts.map((post) => post.metrics.follows))),
    },
    derived: Object.fromEntries(DERIVED_METRIC_KEYS.map((key) => [
      key,
      round(avg(posts.map((post) => readDerivedMetrics(post.raw)[key])), 4),
    ])),
  };
}

function pillarDeltas(current: ReturnType<typeof summarizePillars>, previous: ReturnType<typeof summarizePillars>) {
  return {
    avgReach: delta(current.distribution.avgReach, previous.distribution.avgReach),
    avgViews: delta(current.distribution.avgViews, previous.distribution.avgViews),
    avgRetentionRate: delta(current.attention.avgRetentionRate, previous.attention.avgRetentionRate),
    avgIntentRate: delta(current.intent.avgIntentRate, previous.intent.avgIntentRate),
    avgProfileVisits: delta(current.conversion.avgProfileVisits, previous.conversion.avgProfileVisits),
    avgFollows: delta(current.conversion.avgFollows, previous.conversion.avgFollows),
  };
}

function rankedSignals(
  posts: NormalizedPost[],
  values: (post: NormalizedPost) => Array<{ id: string; label: string }>,
  limit = 5,
) {
  const groups = new Map<string, { label: string; posts: Set<string>; scores: number[] }>();
  for (const post of posts) {
    for (const value of values(post)) {
      if (!value.id || !value.label) continue;
      const group = groups.get(value.id) ?? { label: value.label, posts: new Set<string>(), scores: [] };
      group.posts.add(post.id);
      if (post.performanceIndex != null) group.scores.push(post.performanceIndex);
      groups.set(value.id, group);
    }
  }
  return [...groups.entries()].map(([id, group]) => ({
    id,
    label: group.label,
    postsCount: group.posts.size,
    avgPerformanceIndex: round(avg(group.scores)),
    evidenceLevel: evidenceLevel(group.posts.size),
  })).sort((a, b) => (b.avgPerformanceIndex ?? -1) - (a.avgPerformanceIndex ?? -1)
    || b.postsCount - a.postsCount).slice(0, limit);
}

function formatPerformance(posts: NormalizedPost[]) {
  const formats = ["reel", "carousel", "photo", "video", "unknown"] as const;
  return formats.flatMap((format) => {
    const matching = posts.filter((post) => post.format === format);
    if (!matching.length) return [];
    const pillars = summarizePillars(matching);
    return [{
      format,
      postsCount: matching.length,
      avgPerformanceIndex: round(avg(matching.map((post) => post.performanceIndex))),
      avgReach: pillars.distribution.avgReach,
      avgViews: pillars.distribution.avgViews,
      avgRetentionRate: pillars.attention.avgRetentionRate,
      avgIntentRate: pillars.intent.avgIntentRate,
      evidenceLevel: evidenceLevel(matching.length),
    }];
  }).sort((a, b) => (b.avgPerformanceIndex ?? -1) - (a.avgPerformanceIndex ?? -1));
}

function topContent(posts: NormalizedPost[], limit = 5) {
  return [...posts].sort((a, b) => (b.performanceIndex ?? -1) - (a.performanceIndex ?? -1))
    .slice(0, limit).map((post) => ({
      id: post.id,
      instagramMediaId: post.raw.instagramMediaId ?? null,
      publishedAt: post.postDate.toISOString(),
      format: post.format,
      description: typeof post.raw.description === "string" ? post.raw.description.slice(0, 320) : "",
      url: typeof post.raw.postLink === "string" ? post.raw.postLink : null,
      performanceIndex: post.performanceIndex,
      mature: post.mature,
      metrics: post.metrics,
      derivedMetrics: readDerivedMetrics(post.raw),
      intelligence: {
        subjects: stringList(post.raw.sceneElements?.subjects),
        openingLine: post.raw.sceneElements?.openingLine ?? null,
        screenTitle: post.raw.sceneElements?.screenTitle ?? null,
        narrativeForms: stringList(post.raw.narrativeForm).map(humanize),
        contentIntents: stringList(post.raw.contentIntent).map(humanize),
        proposals: stringList(post.raw.proposal).map(humanize),
        tones: stringList(post.raw.tone).map(humanize),
        contentSignals: stringList(post.raw.contentSignals).map(humanize),
        proofStyles: stringList(post.raw.proofStyle).map(humanize),
        commercialModes: stringList(post.raw.commercialMode).map(humanize),
        lifeAssets: stringList(post.raw.lifeAssets),
      },
    }));
}

function coverage(posts: NormalizedPost[]) {
  const count = (read: (post: NormalizedPost) => unknown) => posts.filter((post) => {
    const value = read(post);
    return Array.isArray(value) ? value.length > 0 : value !== null && value !== undefined && value !== "";
  }).length;
  const visualEligiblePosts = posts.filter((post) =>
    ["reel", "video", "carousel", "photo"].includes(post.format),
  );
  const classification = count((post) => post.raw.classificationStatus === "completed" ? true : null);
  const sceneEligible = visualEligiblePosts.length;
  const withScene = visualEligiblePosts.filter((post) => Boolean(post.raw.sceneElements?.version)).length;
  return {
    posts: posts.length,
    maturePosts: posts.filter((post) => post.mature).length,
    byFormat: posts.reduce<Record<string, number>>((acc, post) => {
      acc[post.format] = (acc[post.format] ?? 0) + 1;
      return acc;
    }, {}),
    basicMetrics: count((post) => post.metrics.reach),
    classification,
    classificationPercent: posts.length ? Math.round(classification / posts.length * 100) : 0,
    sceneEligible,
    sceneRead: withScene,
    scenePercent: sceneEligible ? Math.round(withScene / sceneEligible * 100) : 0,
    visualEligible: sceneEligible,
    visualRead: withScene,
    visualPercent: sceneEligible ? Math.round(withScene / sceneEligible * 100) : 0,
    openings: count((post) => post.raw.sceneElements?.openingLine ?? post.raw.sceneElements?.screenTitle),
    subjects: count((post) => post.raw.sceneElements?.subjects),
    watchTime: count((post) => post.metrics.watchTimeSeconds),
    profileVisits: count((post) => post.metrics.profileVisits),
    follows: count((post) => post.metrics.follows),
    derivedMetrics: count((post) => Object.values(readDerivedMetrics(post.raw)).some((value) => value != null)),
    velocity: count((post) => Array.isArray(post.raw.dailySnapshots) && post.raw.dailySnapshots.length > 0),
    entities: count((post) => entityTargets(post.raw.entityTargets)),
    lifeAssets: count((post) => post.raw.lifeAssets),
    classificationConfidence: count((post) => post.raw.classificationMeta?.confidence),
  };
}

function recommendations(params: {
  coverage: ReturnType<typeof coverage>;
  formats: ReturnType<typeof formatPerformance>;
  topics: ReturnType<typeof rankedSignals>;
  openings: ReturnType<typeof rankedSignals>;
}) {
  const result: Array<{ action: string; evidence: string; evidenceLevel: string }> = [];
  if (params.coverage.classificationPercent < 90 || (params.coverage.sceneEligible && params.coverage.scenePercent < 90)) {
    result.push({
      action: "Trate esta leitura como parcial até os posts pendentes serem reprocessados.",
      evidence: `${params.coverage.classification}/${params.coverage.posts} classificados; ${params.coverage.visualRead}/${params.coverage.visualEligible} posts lidos visualmente.`,
      evidenceLevel: "coverage_warning",
    });
  }
  const topFormat = params.formats[0];
  if (topFormat) result.push({
    action: `Teste novamente o formato ${topFormat.format}, preservando o elemento criativo que gerou o resultado.`,
    evidence: `${topFormat.postsCount} posts; índice médio ${topFormat.avgPerformanceIndex ?? "n/d"}.`,
    evidenceLevel: topFormat.evidenceLevel,
  });
  const topTopic = params.topics[0];
  if (topTopic) result.push({
    action: `Aprofunde o assunto “${topTopic.label}” com um ângulo novo.`,
    evidence: `${topTopic.postsCount} posts; índice médio ${topTopic.avgPerformanceIndex ?? "n/d"}.`,
    evidenceLevel: topTopic.evidenceLevel,
  });
  const topOpening = params.openings[0];
  if (topOpening) result.push({
    action: `Repita a lógica de abertura de “${topOpening.label}”, sem copiar a frase literalmente.`,
    evidence: `${topOpening.postsCount} ocorrência(s); índice ${topOpening.avgPerformanceIndex ?? "n/d"}.`,
    evidenceLevel: topOpening.evidenceLevel,
  });
  return result.slice(0, 4);
}

export function summarizeContentPeriod(params: {
  metrics: MetricLike[];
  periodDays?: number;
  period?: McpPeriodRequest;
  format?: McpAnalysisFormat;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const resolvedPeriod = resolveMcpPeriod(
    params.period ?? (params.periodDays != null ? { periodDays: params.periodDays } : {}),
    now,
  );
  const all = normalizePosts(params.metrics, now);
  const selectedFormat = params.format ?? "all";
  const current = filterFormat(all.filter((post) =>
    post.postDate >= resolvedPeriod.startsAt && post.postDate <= resolvedPeriod.endsAt
  ), selectedFormat);
  const previous = filterFormat(all.filter((post) =>
    post.postDate >= resolvedPeriod.comparisonStartsAt && post.postDate <= resolvedPeriod.comparisonEndsAt
  ), selectedFormat);
  const currentPillars = summarizePillars(current);
  const previousPillars = summarizePillars(previous);
  const currentCoverage = coverage(current);
  const formats = formatPerformance(current);
  const topics = rankedSignals(current, (post) => {
    const exact = stringList(post.raw.sceneElements?.subjects);
    if (exact.length) return exact.map((label) => ({ id: label.toLowerCase(), label }));
    return stringList(post.raw.context).map((id) => ({ id, label: contextLabel(id) }));
  });
  const openings = rankedSignals(current, (post) => {
    const opening = String(post.raw.sceneElements?.openingLine ?? post.raw.sceneElements?.screenTitle ?? "").trim();
    return opening ? [{ id: opening.toLowerCase(), label: opening }] : [];
  });
  const narrativeForms = rankedSignals(current, (post) => stringList(post.raw.narrativeForm)
    .map((id) => ({ id, label: humanize(id) })));
  const contentIntents = rankedSignals(current, (post) => stringList(post.raw.contentIntent)
    .map((id) => ({ id, label: humanize(id) })));
  const stances = rankedSignals(current, (post) => stringList(post.raw.stance)
    .map((id) => ({ id, label: humanize(id) })));
  const proposals = rankedSignals(current, (post) => stringList(post.raw.proposal)
    .map((id) => ({ id, label: humanize(id) })));
  const communicationTones = rankedSignals(current, (post) => stringList(post.raw.tone)
    .map((id) => ({ id, label: humanize(id) })));
  const references = rankedSignals(current, (post) => stringList(post.raw.references)
    .map((id) => ({ id, label: humanize(id) })));
  const contentSignals = rankedSignals(current, (post) => stringList(post.raw.contentSignals)
    .map((id) => ({ id, label: humanize(id) })));
  const proofStyles = rankedSignals(current, (post) => stringList(post.raw.proofStyle)
    .map((id) => ({ id, label: humanize(id) })));
  const commercialModes = rankedSignals(current, (post) => stringList(post.raw.commercialMode)
    .map((id) => ({ id, label: humanize(id) })));
  const lifeAssets = rankedSignals(current, (post) => stringList(post.raw.lifeAssets)
    .map((label) => ({ id: label.toLowerCase(), label })));
  const entities = rankedSignals(current, (post) => entityTargets(post.raw.entityTargets)
    .map((entity) => ({ id: `${entity.type}:${entity.label.toLowerCase()}`, label: `${entity.label} (${entity.type})` })));
  const places = rankedSignals(current, (post) => {
    const id = String(post.raw.sceneElements?.placeId ?? "").trim();
    return id ? [{ id, label: canonicalPlaceById(id)?.label ?? humanize(id) }] : [];
  });
  const framings = rankedSignals(current, (post) => stringList(post.raw.sceneElements?.framingIds)
    .map((id) => ({ id, label: canonicalFramingById(id)?.label ?? humanize(id) })));
  const aesthetics = rankedSignals(current, (post) => stringList(post.raw.sceneElements?.aestheticIds)
    .map((id) => ({ id, label: canonicalAestheticById(id)?.label ?? humanize(id) })));
  const tones = rankedSignals(current, (post) => stringList(post.raw.sceneElements?.toneIds)
    .map((id) => ({ id, label: canonicalToneById(id)?.label ?? humanize(id) })));
  const cast = rankedSignals(current, (post) => stringList(post.raw.sceneElements?.assetRoleIds)
    .map((id) => ({ id, label: canonicalAssetRoleById(id)?.label ?? humanize(id) })));
  const objects = rankedSignals(current, (post) => stringList(post.raw.sceneElements?.objects)
    .map((label) => ({ id: label.toLowerCase(), label })));

  const rankedContent = topContent(current);
  const inventory = publicationInventory(current, rankedContent.length);
  const safeSummary = publicationSummary(resolvedPeriod.label, inventory);
  const consistencyIssues = [
    inventory.publishedCount !== currentCoverage.posts ? "inventory_coverage_count_mismatch" : null,
    Object.values(inventory.byFormat).reduce((sum, count) => sum + count, 0) !== inventory.publishedCount
      ? "format_count_mismatch"
      : null,
    inventory.returnedSampleCount > inventory.publishedCount ? "sample_exceeds_population" : null,
  ].filter((issue): issue is string => Boolean(issue));
  const analysisStatus = consistencyIssues.length > 0
    ? "inconsistent"
    : inventory.fullyAnalyzedCount < inventory.publishedCount
      ? "partial"
      : "complete";
  const { posts: contentRecordsInPeriod, ...enrichmentCoverage } = currentCoverage;
  const publicCoverage = {
    meaning: "Cobertura de coleta e enriquecimento de IA; não use estes campos como cadência de publicação.",
    contentRecordsInPeriod,
    ...enrichmentCoverage,
  };

  const result = {
    schemaVersion: "mcp_content_period_v3",
    intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    period: {
      preset: resolvedPeriod.preset,
      kind: resolvedPeriod.kind,
      label: resolvedPeriod.label,
      meaning: resolvedPeriod.meaning,
      days: resolvedPeriod.days,
      startsAt: resolvedPeriod.startsAt.toISOString(),
      endsAt: resolvedPeriod.endsAt.toISOString(),
      timezone: resolvedPeriod.timezone,
      isClosed: resolvedPeriod.isClosed,
      legacyPeriodDays: resolvedPeriod.legacyPeriodDays,
      format: selectedFormat,
      comparison: "previous_equivalent_period",
      comparisonStartsAt: resolvedPeriod.comparisonStartsAt.toISOString(),
      comparisonEndsAt: resolvedPeriod.comparisonEndsAt.toISOString(),
    },
    freshness: {
      generatedAt: now.toISOString(),
      newestPostDate: current.length
        ? [...current].sort((a, b) => b.postDate.getTime() - a.postDate.getTime())[0]!.postDate.toISOString()
        : null,
      metricMaturityHours: 48,
    },
    inventory,
    facts: {
      publicationCount: {
        value: inventory.publishedCount,
        unit: "publications",
        sourceField: "inventory.publishedCount",
        periodLabel: resolvedPeriod.label,
        startsAt: resolvedPeriod.startsAt.toISOString(),
        endsAt: resolvedPeriod.endsAt.toISOString(),
      },
    },
    coverage: publicCoverage,
    pillars: currentPillars,
    deltas: pillarDeltas(currentPillars, previousPillars),
    formatPerformance: formats,
    topContent: rankedContent,
    signals: {
      topics,
      openings,
      narrativeForms,
      contentIntents,
      stances,
      proposals,
      communicationTones,
      references,
      contentSignals,
      proofStyles,
      commercialModes,
      lifeAssets,
      entities,
      scene: { places, framings, aesthetics, tones, cast, objects },
    },
    recommendations: recommendations({ coverage: currentCoverage, formats, topics, openings }),
    interpretationRules: {
      example: "1 post: exemplo, não padrão",
      indication: "2 posts: indício",
      signal: "3–4 posts: sinal",
      pattern: "5+ posts: padrão mais confiável",
    },
    responseContract: {
      safeSummary,
      authoritativePublicationCountPath: "inventory.publishedCount",
      rules: [
        "Use somente inventory.publishedCount para afirmar quantas publicações ocorreram neste período.",
        "Não trate coverage, returnedSampleCount ou contagens de sinais como frequência de publicação.",
        "Sempre informe period.label ou as datas period.startsAt e period.endsAt ao citar uma contagem.",
        "Não combine esta contagem com janelas do creator playbook ou de outra chamada.",
        "Se analysisReceipt.status for inconsistent, não faça afirmações quantitativas sem explicar a divergência.",
      ],
    },
    analysisReceipt: {
      id: `mcp-period-${now.getTime()}-${inventory.publishedCount}`,
      status: analysisStatus,
      generatedAt: now.toISOString(),
      periodPreset: resolvedPeriod.preset,
      startsAt: resolvedPeriod.startsAt.toISOString(),
      endsAt: resolvedPeriod.endsAt.toISOString(),
      publishedCount: inventory.publishedCount,
      collectedCount: inventory.collectedCount,
      metricsEligibleCount: inventory.metricsEligibleCount,
      fullyAnalyzedCount: inventory.fullyAnalyzedCount,
      returnedSampleCount: inventory.returnedSampleCount,
      consistencyIssues,
    },
  };
  return result;
}

const METRIC_SELECT = [
  "_id instagramMediaId postLink postDate description type format source stats",
  "classificationStatus proposal context tone references contentIntent narrativeForm contentSignals stance proofStyle commercialMode",
  "classificationMeta entityTargets theme collab collabCreator isPubli lifeAssets",
  "sceneElements dailySnapshots createdAt updatedAt",
].join(" ");

export async function analyzeMcpContentPeriod(params: {
  userId: string;
  periodDays?: number;
  periodPreset?: McpPeriodRequest["periodPreset"];
  startsAt?: string;
  endsAt?: string;
  format?: McpAnalysisFormat;
}) {
  const now = new Date();
  const period = resolveMcpPeriod({
    periodPreset: params.periodPreset,
    periodDays: params.periodDays,
    startsAt: params.startsAt,
    endsAt: params.endsAt,
  }, now);
  await connectToDatabase();
  const metrics = await MetricModel.find({
    user: new Types.ObjectId(params.userId),
    postDate: { $gte: period.comparisonStartsAt, $lte: period.endsAt },
  }).sort({ postDate: -1 }).select(METRIC_SELECT).lean();
  return summarizeContentPeriod({
    metrics: metrics as MetricLike[],
    period: {
      periodPreset: params.periodPreset,
      periodDays: params.periodDays,
      startsAt: params.startsAt,
      endsAt: params.endsAt,
    },
    format: params.format,
    now,
  });
}

export async function getMcpContentDetail(userId: string, contentId: string) {
  if (!Types.ObjectId.isValid(contentId)) return null;
  await connectToDatabase();
  const metric = await MetricModel.findOne({ _id: new Types.ObjectId(contentId), user: new Types.ObjectId(userId) })
    .select(METRIC_SELECT).lean() as MetricLike | null;
  if (!metric) return null;
  const post = normalizePosts([metric], new Date())[0];
  if (!post) return null;
  return {
    schemaVersion: "mcp_content_detail_v2",
    intelligenceSchemaVersion: D2C_INTELLIGENCE_SCHEMA_VERSION,
    id: post.id,
    instagramMediaId: metric.instagramMediaId ?? null,
    publishedAt: post.postDate.toISOString(),
    format: post.format,
    description: metric.description ?? "",
    url: metric.postLink ?? null,
    metrics: post.metrics,
    derivedMetrics: readDerivedMetrics(metric),
    velocity: velocitySummary(metric),
    publication: {
      theme: typeof metric.theme === "string" ? metric.theme : null,
      isSponsored: Boolean(metric.isPubli),
      isCollaboration: Boolean(metric.collab),
      collaborator: typeof metric.collabCreator === "string" ? metric.collabCreator : null,
    },
    classification: classificationSummary(metric),
    entities: entityTargets(metric.entityTargets),
    lifeAssets: stringList(metric.lifeAssets),
    visualIntelligence: metric.sceneElements ? {
      analyzed: Boolean(metric.sceneElements.version),
      subjects: stringList(metric.sceneElements.subjects),
      openingLine: metric.sceneElements.openingLine ?? null,
      screenTitle: metric.sceneElements.screenTitle ?? null,
      quotes: stringList(metric.sceneElements.quotes),
      place: metric.sceneElements.placeId
        ? canonicalPlaceById(metric.sceneElements.placeId)?.label ?? humanize(metric.sceneElements.placeId)
        : null,
      framings: stringList(metric.sceneElements.framingIds)
        .map((id) => canonicalFramingById(id)?.label ?? humanize(id)),
      aesthetics: stringList(metric.sceneElements.aestheticIds)
        .map((id) => canonicalAestheticById(id)?.label ?? humanize(id)),
      tones: stringList(metric.sceneElements.toneIds)
        .map((id) => canonicalToneById(id)?.label ?? humanize(id)),
      cast: stringList(metric.sceneElements.assetRoleIds)
        .map((id) => canonicalAssetRoleById(id)?.label ?? humanize(id)),
      objects: stringList(metric.sceneElements.objects),
      offMap: Boolean(metric.sceneElements.offMap),
      audit: {
        provider: metric.sceneElements.provider ?? null,
        version: metric.sceneElements.version ?? null,
        analyzedAt: toDate(metric.sceneElements.analyzedAt)?.toISOString() ?? null,
      },
    } : { analyzed: false },
  };
}
