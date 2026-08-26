import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import { getMetricCategoryValuesForAnalytics } from "@/app/lib/classificationV2Bridge";
import { createBasePipeline } from "@/app/lib/dataService/marketAnalysis/helpers";
import {
  classifyCreatorHookPattern,
  CREATOR_HOOK_PATTERN_LABELS,
  type CreatorHookPattern,
} from "@/app/lib/mcp/creatorHookPattern";
import DailyMetricSnapshotModel from "@/app/models/DailyMetricSnapshot";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";

export const MCP_INSPIRATION_RESEARCH_VERSION = "inspiration_research_v1" as const;
export const MCP_INSPIRATION_ANALYSIS_VERSION = "inspiration_analysis_v1" as const;
export const MCP_INSPIRATION_COMPARISON_VERSION = "inspiration_comparison_v1" as const;

export type McpInspirationResearchMode =
  | "similar_to_me"
  | "viral_reels"
  | "trending"
  | "by_topic"
  | "winning_patterns";

export type McpInspirationFormat = "reel" | "carousel" | "photo" | "long_video";

export type McpInspirationResearchFilters = {
  formats: McpInspirationFormat[];
  tones: string[];
  hookPatterns: CreatorHookPattern[];
  minDurationSeconds?: number | null;
  maxDurationSeconds?: number | null;
  sceneKeywords: string[];
  objects: string[];
  framing: string[];
  aesthetics: string[];
};

export type McpInspirationResearchParams = {
  userId: string;
  mode: McpInspirationResearchMode;
  query: string;
  filters: McpInspirationResearchFilters;
  periodDays: number;
  limit: number;
};

type ResearchMetric = Record<string, any> & {
  _id: Types.ObjectId | string;
  user: Types.ObjectId | string;
  postDate?: Date | string | null;
  description?: string | null;
  postLink?: string | null;
  type?: string | null;
  format?: string[] | string | null;
  tone?: string[] | string | null;
  context?: string[] | string | null;
  proposal?: string[] | string | null;
  contentIntent?: string[] | string | null;
  narrativeForm?: string[] | string | null;
  contentSignals?: string[] | string | null;
  stance?: string[] | string | null;
  proofStyle?: string[] | string | null;
  commercialMode?: string[] | string | null;
  sceneElements?: Record<string, any> | null;
  stats?: Record<string, any> | null;
  creatorInfo?: Record<string, any> | null;
};

type ViewerFingerprint = {
  contexts: Set<string>;
  intents: Set<string>;
  narratives: Set<string>;
  tones: Set<string>;
  hookPatterns: Set<CreatorHookPattern>;
  places: Set<string>;
  framings: Set<string>;
};

type VelocityEvidence = {
  acceleration72h: number | null;
  recentActivity: number;
};

type Baseline = {
  sampleSize: number;
  interactions: number | null;
  views: number | null;
  shareRate: number | null;
  saveRate: number | null;
};

export type RankedInspirationCandidate = {
  metric: ResearchMetric;
  score: number;
  semanticScore: number;
  creativeScore: number;
  performanceIndex: number | null;
  performanceConfidence: "low" | "medium" | "high";
  performanceLabel: "outlier" | "above_creator_baseline" | "within_creator_baseline" | "insufficient_evidence";
  velocity: VelocityEvidence;
  hookPattern: CreatorHookPattern;
  matchedFilters: string[];
  reasons: string[];
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function round(value: number | null, places = 3): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function cleanText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function normalized(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stringValues(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()));
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function normalizedSet(values: unknown): Set<string> {
  return new Set(stringValues(values).map(normalized).filter(Boolean));
}

function queryTokens(value: string): string[] {
  const stopwords = new Set([
    "com", "sem", "para", "por", "que", "uma", "uns", "das", "dos", "nos", "nas",
    "conteudo", "conteudos", "video", "videos", "reel", "reels", "viral", "virais",
  ]);
  return [...new Set(normalized(value).split(" ").filter((token) => token.length >= 3 && !stopwords.has(token)))].slice(0, 16);
}

function formatOf(metric: ResearchMetric): McpInspirationFormat | "other" {
  const type = normalized(metric.type);
  const formats = stringValues(metric.format).map(normalized);
  if (formats.includes("long video") || formats.includes("video longo")) return "long_video";
  if (type === "reel" || type === "video" || formats.includes("reel")) return "reel";
  if (type.includes("carousel") || formats.includes("carousel") || formats.includes("carrossel")) return "carousel";
  if (type === "image" || formats.includes("photo") || formats.includes("foto")) return "photo";
  return "other";
}

function sceneOf(metric: ResearchMetric) {
  const scene = metric.sceneElements && typeof metric.sceneElements === "object" ? metric.sceneElements : {};
  return {
    tones: stringValues(scene.toneIds),
    subjects: stringValues(scene.subjects).length ? stringValues(scene.subjects) : stringValues(scene.subjectIds),
    objects: stringValues(scene.objects),
    placeId: cleanText(scene.placeId, 100),
    framing: stringValues(scene.framingIds),
    aesthetics: stringValues(scene.aestheticIds),
    openingLine: cleanText(scene.openingLine, 180),
    screenTitle: cleanText(scene.screenTitle, 180),
  };
}

function hookPatternOf(metric: ResearchMetric): CreatorHookPattern {
  const scene = sceneOf(metric);
  return classifyCreatorHookPattern(scene.openingLine ?? scene.screenTitle ?? cleanText(metric.description, 180) ?? "");
}

function categoriesOf(metric: ResearchMetric) {
  return {
    formats: getMetricCategoryValuesForAnalytics(metric, "format"),
    contexts: getMetricCategoryValuesForAnalytics(metric, "context"),
    proposals: getMetricCategoryValuesForAnalytics(metric, "proposal"),
    tones: getMetricCategoryValuesForAnalytics(metric, "tone"),
    intents: getMetricCategoryValuesForAnalytics(metric, "contentIntent"),
    narratives: getMetricCategoryValuesForAnalytics(metric, "narrativeForm"),
    signals: getMetricCategoryValuesForAnalytics(metric, "contentSignals"),
    stances: getMetricCategoryValuesForAnalytics(metric, "stance"),
    proofs: getMetricCategoryValuesForAnalytics(metric, "proofStyle"),
    commercialModes: getMetricCategoryValuesForAnalytics(metric, "commercialMode"),
  };
}

function median(values: Array<number | null>): number | null {
  const usable = values.filter((value): value is number => value !== null).sort((left, right) => left - right);
  if (!usable.length) return null;
  const middle = Math.floor(usable.length / 2);
  return usable.length % 2
    ? usable[middle] ?? null
    : ((usable[middle - 1] ?? 0) + (usable[middle] ?? 0)) / 2;
}

function rates(metric: ResearchMetric) {
  const stats = metric.stats ?? {};
  const interactions = finite(stats.total_interactions);
  const views = finite(stats.views ?? stats.video_views);
  const reach = finite(stats.reach);
  const denominator = reach && reach > 0 ? reach : views && views > 0 ? views : null;
  const shares = finite(stats.shares);
  const saves = finite(stats.saved ?? stats.saves);
  return {
    interactions,
    views,
    shareRate: denominator && shares !== null ? shares / denominator : null,
    saveRate: denominator && saves !== null ? saves / denominator : null,
  };
}

function buildBaselines(metrics: ResearchMetric[]): Map<string, Baseline> {
  const grouped = new Map<string, ResearchMetric[]>();
  for (const metric of metrics) {
    const key = String(metric.user ?? "");
    if (!key) continue;
    const rows = grouped.get(key) ?? [];
    rows.push(metric);
    grouped.set(key, rows);
  }
  return new Map([...grouped.entries()].map(([userId, rows]) => {
    const values = rows.map(rates);
    return [userId, {
      sampleSize: rows.length,
      interactions: median(values.map((item) => item.interactions)),
      views: median(values.map((item) => item.views)),
      shareRate: median(values.map((item) => item.shareRate)),
      saveRate: median(values.map((item) => item.saveRate)),
    }];
  }));
}

function relative(value: number | null, baseline: number | null): number | null {
  if (value === null || baseline === null || baseline <= 0) return null;
  return Math.min(4, Math.max(0, value / baseline));
}

function performanceFor(metric: ResearchMetric, baseline: Baseline | undefined) {
  if (!baseline || baseline.sampleSize < 3) {
    return {
      index: null,
      confidence: "low" as const,
      label: "insufficient_evidence" as const,
    };
  }
  const current = rates(metric);
  const components = [
    { value: relative(current.interactions, baseline.interactions), weight: 0.35 },
    { value: relative(current.views, baseline.views), weight: 0.25 },
    { value: relative(current.shareRate, baseline.shareRate), weight: 0.22 },
    { value: relative(current.saveRate, baseline.saveRate), weight: 0.18 },
  ].filter((item): item is { value: number; weight: number } => item.value !== null);
  if (!components.length) {
    return {
      index: null,
      confidence: "low" as const,
      label: "insufficient_evidence" as const,
    };
  }
  const totalWeight = components.reduce((sum, item) => sum + item.weight, 0);
  const index = components.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
  const confidence = baseline.sampleSize >= 8 && components.length >= 3
    ? "high" as const
    : baseline.sampleSize >= 4 && components.length >= 2
      ? "medium" as const
      : "low" as const;
  const label = index >= 1.8
    ? "outlier" as const
    : index >= 1.15
      ? "above_creator_baseline" as const
      : "within_creator_baseline" as const;
  return { index, confidence, label };
}

function overlapScore(target: Set<string>, candidate: string[]): number | null {
  if (!target.size) return null;
  const normalizedCandidate = new Set(candidate.map(normalized).filter(Boolean));
  if (!normalizedCandidate.size) return 0;
  const matches = [...target].filter((item) => normalizedCandidate.has(item)).length;
  return matches / target.size;
}

function substringMatch(targets: string[], candidates: string[]): boolean {
  if (!targets.length) return true;
  const normalizedCandidates = candidates.map(normalized).filter(Boolean);
  return targets.some((target) => {
    const wanted = normalized(target);
    return normalizedCandidates.some((candidate) => candidate.includes(wanted) || wanted.includes(candidate));
  });
}

function recencyScore(postDate: unknown): number {
  const timestamp = postDate ? new Date(postDate as string | number | Date).getTime() : NaN;
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (Date.now() - timestamp) / 86_400_000);
  return Math.exp(-ageDays / 35);
}

function emptyFingerprint(): ViewerFingerprint {
  return {
    contexts: new Set(),
    intents: new Set(),
    narratives: new Set(),
    tones: new Set(),
    hookPatterns: new Set(),
    places: new Set(),
    framings: new Set(),
  };
}

function topValues(values: string[], limit: number): Set<string> {
  const counts = new Map<string, number>();
  for (const value of values.map(normalized).filter(Boolean)) counts.set(value, (counts.get(value) ?? 0) + 1);
  return new Set([...counts.entries()].sort((left, right) => right[1] - left[1]).slice(0, limit).map(([value]) => value));
}

export function buildViewerFingerprint(metrics: ResearchMetric[]): ViewerFingerprint {
  if (!metrics.length) return emptyFingerprint();
  const categoryRows = metrics.map(categoriesOf);
  const scenes = metrics.map(sceneOf);
  return {
    contexts: topValues(categoryRows.flatMap((row) => row.contexts), 5),
    intents: topValues(categoryRows.flatMap((row) => row.intents), 4),
    narratives: topValues(categoryRows.flatMap((row) => row.narratives), 4),
    tones: topValues(categoryRows.flatMap((row) => row.tones).concat(scenes.flatMap((scene) => scene.tones)), 4),
    hookPatterns: new Set(metrics.map(hookPatternOf)),
    places: topValues(scenes.flatMap((scene) => scene.placeId ? [scene.placeId] : []), 4),
    framings: topValues(scenes.flatMap((scene) => scene.framing), 4),
  };
}

export function rankInspirationCandidates(params: {
  metrics: ResearchMetric[];
  mode: McpInspirationResearchMode;
  query: string;
  filters: McpInspirationResearchFilters;
  viewerFingerprint?: ViewerFingerprint | null;
  velocities?: Map<string, VelocityEvidence>;
}): RankedInspirationCandidate[] {
  const tokens = queryTokens(params.query);
  const baselines = buildBaselines(params.metrics);
  const fingerprint = params.viewerFingerprint ?? emptyFingerprint();
  const velocities = params.velocities ?? new Map<string, VelocityEvidence>();

  return params.metrics.flatMap((metric): RankedInspirationCandidate[] => {
    const categories = categoriesOf(metric);
    const scene = sceneOf(metric);
    const hookPattern = hookPatternOf(metric);
    const format = formatOf(metric);
    const duration = finite(metric.stats?.video_duration_seconds);
    if (params.filters.formats.length && !params.filters.formats.includes(format as McpInspirationFormat)) return [];
    if (params.filters.tones.length && !substringMatch(params.filters.tones, [...categories.tones, ...scene.tones])) return [];
    if (params.filters.hookPatterns.length && !params.filters.hookPatterns.includes(hookPattern)) return [];
    if (params.filters.minDurationSeconds != null && (duration === null || duration < params.filters.minDurationSeconds)) return [];
    if (params.filters.maxDurationSeconds != null && (duration === null || duration > params.filters.maxDurationSeconds)) return [];
    if (!substringMatch(params.filters.sceneKeywords, [scene.placeId ?? "", ...scene.subjects])) return [];
    if (!substringMatch(params.filters.objects, scene.objects)) return [];
    if (!substringMatch(params.filters.framing, scene.framing)) return [];
    if (!substringMatch(params.filters.aesthetics, scene.aesthetics)) return [];
    if (params.mode === "viral_reels" && format !== "reel" && format !== "long_video") return [];

    const searchable = normalized([
      metric.description,
      ...Object.values(categories).flat(),
      ...scene.subjects,
      ...scene.objects,
      scene.placeId,
      ...scene.framing,
      ...scene.aesthetics,
      scene.openingLine,
      scene.screenTitle,
    ].filter(Boolean).join(" "));
    const keywordMatches = tokens.filter((token) => searchable.includes(token));
    const keywordScore = tokens.length ? keywordMatches.length / tokens.length : 0;
    if (params.mode === "by_topic" && tokens.length && keywordScore === 0) return [];

    const similarityParts = [
      overlapScore(fingerprint.contexts, categories.contexts),
      overlapScore(fingerprint.intents, categories.intents),
      overlapScore(fingerprint.narratives, categories.narratives),
      overlapScore(fingerprint.tones, [...categories.tones, ...scene.tones]),
      overlapScore(fingerprint.places, scene.placeId ? [scene.placeId] : []),
      overlapScore(fingerprint.framings, scene.framing),
      fingerprint.hookPatterns.size ? (fingerprint.hookPatterns.has(hookPattern) ? 1 : 0) : null,
    ].filter((value): value is number => value !== null);
    const creatorSimilarity = similarityParts.length
      ? similarityParts.reduce((sum, value) => sum + value, 0) / similarityParts.length
      : 0;

    const explicitFilterCount = [
      params.filters.formats.length,
      params.filters.tones.length,
      params.filters.hookPatterns.length,
      params.filters.sceneKeywords.length,
      params.filters.objects.length,
      params.filters.framing.length,
      params.filters.aesthetics.length,
      params.filters.minDurationSeconds != null ? 1 : 0,
      params.filters.maxDurationSeconds != null ? 1 : 0,
    ].filter(Boolean).length;
    const creativeScore = explicitFilterCount ? 1 : clamp01(
      (scene.openingLine || scene.screenTitle ? 0.3 : 0) +
      (scene.placeId ? 0.15 : 0) +
      (scene.framing.length ? 0.15 : 0) +
      (scene.objects.length ? 0.1 : 0) +
      (categories.narratives.length ? 0.15 : 0) +
      (categories.tones.length || scene.tones.length ? 0.15 : 0),
    );

    const performance = performanceFor(metric, baselines.get(String(metric.user ?? "")));
    if (params.mode === "viral_reels" && performance.label !== "outlier") return [];
    if (params.mode === "winning_patterns" && (performance.index === null || performance.index < 1.15)) return [];
    const velocity = velocities.get(String(metric._id)) ?? { acceleration72h: null, recentActivity: 0 };
    if (params.mode === "trending" && velocity.acceleration72h === null) return [];

    const semanticScore = clamp01(tokens.length ? 0.7 * keywordScore + 0.3 * creatorSimilarity : creatorSimilarity);
    const performanceScore = performance.index === null ? 0.35 : clamp01(performance.index / 2.2);
    const velocityScore = velocity.acceleration72h === null ? 0 : clamp01(velocity.acceleration72h / 2.5);
    const freshness = recencyScore(metric.postDate);
    const score = params.mode === "similar_to_me"
      ? 0.48 * semanticScore + 0.2 * creativeScore + 0.22 * performanceScore + 0.1 * freshness
      : params.mode === "trending"
        ? 0.5 * velocityScore + 0.22 * performanceScore + 0.18 * freshness + 0.1 * Math.max(keywordScore, creativeScore)
        : params.mode === "viral_reels"
          ? 0.55 * performanceScore + 0.2 * semanticScore + 0.15 * creativeScore + 0.1 * freshness
          : params.mode === "winning_patterns"
            ? 0.45 * performanceScore + 0.25 * creativeScore + 0.2 * semanticScore + 0.1 * freshness
            : 0.52 * keywordScore + 0.2 * creativeScore + 0.18 * performanceScore + 0.1 * freshness;

    const matchedFilters = [
      params.filters.formats.length ? `formato:${format}` : null,
      params.filters.tones.length ? `tom:${[...categories.tones, ...scene.tones].slice(0, 2).join(",")}` : null,
      params.filters.hookPatterns.length ? `gancho:${hookPattern}` : null,
      params.filters.minDurationSeconds != null || params.filters.maxDurationSeconds != null ? `duracao:${duration ?? "n/d"}s` : null,
      params.filters.sceneKeywords.length ? `cenario:${scene.placeId ?? scene.subjects[0] ?? "identificado"}` : null,
      params.filters.objects.length ? `objetos:${scene.objects.slice(0, 3).join(",")}` : null,
      params.filters.framing.length ? `enquadramento:${scene.framing.slice(0, 2).join(",")}` : null,
      params.filters.aesthetics.length ? `estetica:${scene.aesthetics.slice(0, 2).join(",")}` : null,
      keywordMatches.length ? `assunto:${keywordMatches.slice(0, 4).join(",")}` : null,
    ].filter((value): value is string => Boolean(value));
    const reasons = [
      performance.label === "outlier" ? "desempenho fora da curva do próprio creator" : null,
      performance.label === "above_creator_baseline" ? "acima da base recente do próprio creator" : null,
      velocity.acceleration72h !== null && velocity.acceleration72h >= 1.2 ? "aceleração observada nas últimas 72 horas" : null,
      semanticScore >= 0.35 ? "afinidade temática ou narrativa" : null,
      scene.openingLine || scene.screenTitle ? `gancho identificado: ${CREATOR_HOOK_PATTERN_LABELS[hookPattern]}` : null,
      scene.placeId ? `cenário identificado: ${scene.placeId}` : null,
    ].filter((value): value is string => Boolean(value));

    return [{
      metric,
      score,
      semanticScore,
      creativeScore,
      performanceIndex: performance.index,
      performanceConfidence: performance.confidence,
      performanceLabel: performance.label,
      velocity,
      hookPattern,
      matchedFilters,
      reasons,
    }];
  }).sort((left, right) => right.score - left.score || recencyScore(right.metric.postDate) - recencyScore(left.metric.postDate));
}

function diversityPick(items: RankedInspirationCandidate[], limit: number): RankedInspirationCandidate[] {
  const picked: RankedInspirationCandidate[] = [];
  const creatorCounts = new Map<string, number>();
  const hookCounts = new Map<string, number>();
  for (const item of items) {
    const creatorId = String(item.metric.user ?? "");
    if ((creatorCounts.get(creatorId) ?? 0) >= 2) continue;
    if ((hookCounts.get(item.hookPattern) ?? 0) >= 3) continue;
    picked.push(item);
    creatorCounts.set(creatorId, (creatorCounts.get(creatorId) ?? 0) + 1);
    hookCounts.set(item.hookPattern, (hookCounts.get(item.hookPattern) ?? 0) + 1);
    if (picked.length >= limit) break;
  }
  return picked;
}

function safeCreator(metric: ResearchMetric) {
  const creator = metric.creatorInfo ?? {};
  const username = cleanText(creator.username, 100);
  return {
    name: cleanText(creator.name, 120),
    username,
    instagramProfileUrl: username ? `https://www.instagram.com/${encodeURIComponent(username.replace(/^@/, ""))}/` : null,
  };
}

function safeItem(item: RankedInspirationCandidate, rank: number) {
  const metric = item.metric;
  const categories = categoriesOf(metric);
  const scene = sceneOf(metric);
  const duration = finite(metric.stats?.video_duration_seconds);
  const opening = scene.openingLine ?? scene.screenTitle;
  return {
    id: `inspiration:${String(metric._id)}`,
    rank,
    creator: safeCreator(metric),
    content: {
      url: typeof metric.postLink === "string" && /^https?:\/\//i.test(metric.postLink) ? metric.postLink : null,
      publishedAt: metric.postDate ? new Date(metric.postDate).toISOString() : null,
      format: formatOf(metric),
      durationSeconds: duration,
      captionExcerpt: cleanText(metric.description, 280),
      openingExcerpt: opening,
      openingSource: scene.openingLine ? "spoken" as const : scene.screenTitle ? "screen" as const : null,
    },
    creativeSignals: {
      hookPattern: item.hookPattern,
      hookPatternLabel: CREATOR_HOOK_PATTERN_LABELS[item.hookPattern],
      tones: [...new Set([...categories.tones, ...scene.tones])].slice(0, 8),
      subjects: scene.subjects.slice(0, 8),
      narratives: categories.narratives.slice(0, 6),
      scene: {
        placeId: scene.placeId,
        objects: scene.objects.slice(0, 10),
        framing: scene.framing.slice(0, 8),
        aesthetics: scene.aesthetics.slice(0, 8),
      },
    },
    relevance: {
      score: round(item.score),
      semanticScore: round(item.semanticScore),
      matchedFilters: item.matchedFilters,
      reasons: item.reasons,
    },
    performanceEvidence: {
      label: item.performanceLabel,
      relativeToCreatorBaseline: round(item.performanceIndex, 2),
      acceleration72h: round(item.velocity.acceleration72h, 2),
      confidence: item.performanceConfidence,
      exactPrivateMetricsExposed: false as const,
    },
    adaptationGuidance: {
      borrow: [
        `A lógica de abertura ${CREATOR_HOOK_PATTERN_LABELS[item.hookPattern].toLocaleLowerCase("pt-BR")}.`,
        scene.placeId ? `A função narrativa do cenário ${scene.placeId}.` : null,
        categories.narratives[0] ? `A estrutura ${categories.narratives[0]}.` : null,
      ].filter((value): value is string => Boolean(value)),
      avoid: "Não copie frases, roteiro, personagem ou identidade visual; adapte o padrão ao seu tema e à sua voz.",
    },
  };
}

async function loadVelocityEvidence(metricIds: Types.ObjectId[]): Promise<Map<string, VelocityEvidence>> {
  if (!metricIds.length) return new Map();
  const now = Date.now();
  const recentStart = new Date(now - 72 * 60 * 60 * 1000);
  const historyStart = new Date(now - 10 * 24 * 60 * 60 * 1000);
  const snapshots = await DailyMetricSnapshotModel.find({
    metric: { $in: metricIds },
    date: { $gte: historyStart },
  }).select("metric date dailyViews dailyReach dailyLikes dailyComments dailyShares dailySaved").lean();
  const grouped = new Map<string, { recent: number; previous: number; recentDays: Set<string>; previousDays: Set<string> }>();
  for (const snapshot of snapshots) {
    const key = String(snapshot.metric);
    const total = [
      snapshot.dailyViews,
      snapshot.dailyReach,
      snapshot.dailyLikes,
      snapshot.dailyComments,
      snapshot.dailyShares,
      snapshot.dailySaved,
    ].reduce<number>((sum, value) => sum + (finite(value) ?? 0), 0);
    const row = grouped.get(key) ?? { recent: 0, previous: 0, recentDays: new Set<string>(), previousDays: new Set<string>() };
    const date = new Date(snapshot.date);
    if (date >= recentStart) {
      row.recent += total;
      row.recentDays.add(date.toISOString().slice(0, 10));
    } else {
      row.previous += total;
      row.previousDays.add(date.toISOString().slice(0, 10));
    }
    grouped.set(key, row);
  }
  return new Map([...grouped.entries()].map(([metricId, row]) => {
    const previousEquivalent = row.previousDays.size >= 2 ? (row.previous / row.previousDays.size) * 3 : 0;
    return [metricId, {
      acceleration72h: previousEquivalent > 0 && row.recentDays.size > 0 ? row.recent / previousEquivalent : null,
      recentActivity: row.recent,
    }];
  }));
}

async function loadViewerFingerprint(userId: string, periodDays: number): Promise<ViewerFingerprint> {
  const metrics = await MetricModel.find({
    user: new Types.ObjectId(userId),
    postDate: { $gte: new Date(Date.now() - periodDays * 86_400_000) },
  })
    .sort({ postDate: -1 })
    .limit(120)
    .select("type format context tone contentIntent narrativeForm sceneElements")
    .lean() as unknown as ResearchMetric[];
  return buildViewerFingerprint(metrics);
}

function validateDuration(filters: McpInspirationResearchFilters) {
  if (
    filters.minDurationSeconds != null &&
    filters.maxDurationSeconds != null &&
    filters.minDurationSeconds > filters.maxDurationSeconds
  ) {
    throw new Error("inspiration_duration_range_invalid");
  }
}

export async function researchMcpInspirationContent(params: McpInspirationResearchParams) {
  validateDuration(params.filters);
  await connectToDatabase();
  const viewerId = new Types.ObjectId(params.userId);
  const since = new Date(Date.now() - params.periodDays * 86_400_000);
  const candidateLimit = Math.max(180, Math.min(600, params.limit * 60));
  const baseMatch: Record<string, any> = {
    user: { $ne: viewerId },
    postDate: { $gte: since },
    $or: [
      { "stats.views": { $gt: 0 } },
      { "stats.reach": { $gt: 0 } },
      { "stats.total_interactions": { $gt: 0 } },
    ],
  };
  const durationQuery: Record<string, number> = {};
  if (params.filters.minDurationSeconds != null) durationQuery.$gte = params.filters.minDurationSeconds;
  if (params.filters.maxDurationSeconds != null) durationQuery.$lte = params.filters.maxDurationSeconds;
  if (Object.keys(durationQuery).length) baseMatch["stats.video_duration_seconds"] = durationQuery;

  const metrics = await MetricModel.aggregate<ResearchMetric>([
    { $match: baseMatch },
    ...createBasePipeline(),
    {
      $match: {
        "creatorInfo.communityInspirationOptIn": true,
        "creatorInfo.isInstagramConnected": true,
      },
    },
    { $sort: { postDate: -1, "stats.total_interactions": -1 } },
    { $limit: candidateLimit },
    {
      $project: {
        _id: 1,
        user: 1,
        description: 1,
        postDate: 1,
        postLink: 1,
        type: 1,
        format: 1,
        context: 1,
        proposal: 1,
        tone: 1,
        references: 1,
        contentIntent: 1,
        narrativeForm: 1,
        contentSignals: 1,
        stance: 1,
        proofStyle: 1,
        commercialMode: 1,
        sceneElements: 1,
        stats: 1,
        "creatorInfo.name": 1,
        "creatorInfo.username": 1,
      },
    },
  ]).exec();

  const needsVelocity = params.mode === "trending";
  const [viewerFingerprint, velocities] = await Promise.all([
    params.mode === "similar_to_me" ? loadViewerFingerprint(params.userId, params.periodDays) : Promise.resolve(null),
    needsVelocity
      ? loadVelocityEvidence(metrics.map((metric) => new Types.ObjectId(String(metric._id))))
      : Promise.resolve(new Map<string, VelocityEvidence>()),
  ]);
  const ranked = rankInspirationCandidates({
    metrics,
    mode: params.mode,
    query: params.query,
    filters: params.filters,
    viewerFingerprint,
    velocities,
  });
  const picked = diversityPick(ranked, params.limit);
  const velocityCovered = needsVelocity
    ? metrics.filter((metric) => velocities.get(String(metric._id))?.acceleration72h !== null && velocities.has(String(metric._id))).length
    : 0;
  const eligibleCreators = new Set(metrics.map((metric) => String(metric.user))).size;
  const warnings = [
    !metrics.length ? "no_opted_in_content_in_period" : null,
    params.mode === "similar_to_me" && viewerFingerprint && !viewerFingerprint.contexts.size && !viewerFingerprint.intents.size
      ? "viewer_similarity_evidence_low"
      : null,
    needsVelocity && velocityCovered === 0 ? "trend_velocity_unavailable_no_trending_claim" : null,
    picked.length < params.limit ? "fewer_results_met_all_filters" : null,
  ].filter((value): value is string => Boolean(value));

  return {
    schemaVersion: MCP_INSPIRATION_RESEARCH_VERSION,
    query: {
      mode: params.mode,
      text: cleanText(params.query, 500) ?? "",
      periodDays: params.periodDays,
      limit: params.limit,
      filters: params.filters,
      trendDefinition: params.mode === "trending"
        ? "aceleracao_72h_com_snapshots_diarios"
        : null,
      viralDefinition: params.mode === "viral_reels"
        ? "desempenho_relativo_ao_historico_do_proprio_creator"
        : null,
    },
    items: picked.map((item, index) => safeItem(item, index + 1)),
    coverage: {
      candidatePosts: metrics.length,
      eligibleOptInCreators: eligibleCreators,
      returnedPosts: picked.length,
      sceneAnalysisAvailable: metrics.filter((metric) => Boolean(metric.sceneElements)).length,
      velocityAvailable: velocityCovered,
      warnings,
    },
    followUp: {
      detailTool: "analyze_inspiration_content" as const,
      compareTool: "compare_inspiration_contents" as const,
      scriptTool: "generate_script_draft" as const,
      instruction: "Use os IDs inspiration:<id> para aprofundar, comparar ou criar um roteiro inspirado nos padrões.",
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_opt_in_community_content" as const,
      onlyOptInCreators: true as const,
      exactPrivateMetricsExposed: false as const,
      fullThirdPartyTranscriptsExposed: false as const,
      mustNotPresentAsGuaranteedViral: true as const,
      trendScope: "data2content_community" as const,
    },
  };
}

function parseInspirationId(value: string): Types.ObjectId | null {
  const raw = value.replace(/^inspiration:/i, "").trim();
  return Types.ObjectId.isValid(raw) ? new Types.ObjectId(raw) : null;
}

async function loadEligibleMetricsByIds(userId: string, ids: string[]): Promise<ResearchMetric[]> {
  const objectIds = ids.map(parseInspirationId).filter((value): value is Types.ObjectId => Boolean(value));
  if (!objectIds.length) return [];
  await connectToDatabase();
  const metrics = await MetricModel.find({
    _id: { $in: objectIds },
    user: { $ne: new Types.ObjectId(userId) },
  })
    .select(
      "_id user description postDate postLink type format context proposal tone references contentIntent " +
      "narrativeForm contentSignals stance proofStyle commercialMode sceneElements stats",
    )
    .lean() as unknown as ResearchMetric[];
  const creatorIds = [...new Set(metrics.map((metric) => String(metric.user)))].map((id) => new Types.ObjectId(id));
  const creators = await UserModel.find({
    _id: { $in: creatorIds },
    communityInspirationOptIn: true,
    isInstagramConnected: true,
  }).select("_id name username").lean();
  const creatorById = new Map(creators.map((creator) => [String(creator._id), creator]));
  return metrics
    .filter((metric) => creatorById.has(String(metric.user)))
    .map((metric) => ({ ...metric, creatorInfo: creatorById.get(String(metric.user)) ?? null }));
}

async function loadCreatorBaselineMetrics(metrics: ResearchMetric[], periodDays = 180): Promise<ResearchMetric[]> {
  const creatorIds = [...new Set(metrics.map((metric) => String(metric.user)))].map((id) => new Types.ObjectId(id));
  if (!creatorIds.length) return [];
  return MetricModel.find({
    user: { $in: creatorIds },
    postDate: { $gte: new Date(Date.now() - periodDays * 86_400_000) },
  }).sort({ postDate: -1 }).limit(Math.min(600, creatorIds.length * 80)).select("_id user stats").lean() as unknown as Promise<ResearchMetric[]>;
}

export async function analyzeMcpInspirationContent(params: { userId: string; inspirationId: string }) {
  const [metric] = await loadEligibleMetricsByIds(params.userId, [params.inspirationId]);
  if (!metric) return null;
  const [baselineMetrics, velocities] = await Promise.all([
    loadCreatorBaselineMetrics([metric]),
    loadVelocityEvidence([new Types.ObjectId(String(metric._id))]),
  ]);
  const candidate = rankInspirationCandidates({
    metrics: [...baselineMetrics.filter((row) => String(row._id) !== String(metric._id)), metric],
    mode: "winning_patterns",
    query: "",
    filters: {
      formats: [], tones: [], hookPatterns: [], sceneKeywords: [], objects: [], framing: [], aesthetics: [],
    },
    velocities,
  }).find((item) => String(item.metric._id) === String(metric._id));
  const fallback = rankInspirationCandidates({
    metrics: [...baselineMetrics.filter((row) => String(row._id) !== String(metric._id)), metric],
    mode: "by_topic",
    query: "",
    filters: {
      formats: [], tones: [], hookPatterns: [], sceneKeywords: [], objects: [], framing: [], aesthetics: [],
    },
    velocities,
  }).find((item) => String(item.metric._id) === String(metric._id));
  const selected = candidate ?? fallback;
  if (!selected) return null;
  const item = safeItem(selected, 1);
  return {
    schemaVersion: MCP_INSPIRATION_ANALYSIS_VERSION,
    inspiration: item,
    researchReading: {
      whatOpensAttention: `${item.creativeSignals.hookPatternLabel}${item.content.openingExcerpt ? `: ${item.content.openingExcerpt}` : ""}`,
      howItDevelops: item.creativeSignals.narratives.length
        ? item.creativeSignals.narratives.join(" → ")
        : "Estrutura detalhada não disponível.",
      visualExecution: {
        placeId: item.creativeSignals.scene.placeId,
        objects: item.creativeSignals.scene.objects,
        framing: item.creativeSignals.scene.framing,
        aesthetics: item.creativeSignals.scene.aesthetics,
      },
      whyItMayHaveWorked: selected.reasons.length
        ? selected.reasons
        : ["Há sinais de conteúdo e execução, mas não evidência suficiente para atribuir causalidade."],
      safeAdaptation: item.adaptationGuidance,
    },
    coverage: {
      sceneAnalysisAvailable: Boolean(metric.sceneElements),
      performanceBaselineSampleSize: baselineMetrics.length,
      velocityAvailable: velocities.get(String(metric._id))?.acceleration72h !== null,
      warnings: [
        !metric.sceneElements ? "scene_analysis_unavailable" : null,
        selected.performanceConfidence === "low" ? "performance_confidence_low" : null,
      ].filter((value): value is string => Boolean(value)),
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_opt_in_community_content" as const,
      onlyOptInCreators: true as const,
      fullTranscriptExcluded: true as const,
      rawPrivateMetricsExcluded: true as const,
      causalPerformanceClaimProhibited: true as const,
    },
  };
}

function countValues(values: string[]): Array<{ value: string; count: number }> {
  const counts = new Map<string, { value: string; count: number }>();
  for (const raw of values) {
    const key = normalized(raw);
    if (!key) continue;
    const current = counts.get(key);
    counts.set(key, { value: current?.value ?? raw, count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((left, right) => right.count - left.count || left.value.localeCompare(right.value));
}

export async function compareMcpInspirationContents(params: { userId: string; inspirationIds: string[] }) {
  const uniqueIds = [...new Set(params.inspirationIds)].slice(0, 5);
  const metrics = await loadEligibleMetricsByIds(params.userId, uniqueIds);
  if (metrics.length < 2) return null;
  const byId = new Map(metrics.map((metric) => [`inspiration:${String(metric._id)}`, metric]));
  const ordered = uniqueIds.map((id) => byId.get(id.startsWith("inspiration:") ? id : `inspiration:${id}`)).filter((value): value is ResearchMetric => Boolean(value));
  const hooks = ordered.map(hookPatternOf);
  const scenes = ordered.map(sceneOf);
  const categories = ordered.map(categoriesOf);
  const durations = ordered.map((metric) => finite(metric.stats?.video_duration_seconds)).filter((value): value is number => value !== null);
  const common = {
    hookPatterns: countValues(hooks.map((hook) => CREATOR_HOOK_PATTERN_LABELS[hook])).filter((item) => item.count >= 2),
    tones: countValues(categories.flatMap((row) => row.tones).concat(scenes.flatMap((scene) => scene.tones))).filter((item) => item.count >= 2),
    narratives: countValues(categories.flatMap((row) => row.narratives)).filter((item) => item.count >= 2),
    subjects: countValues(scenes.flatMap((scene) => scene.subjects)).filter((item) => item.count >= 2),
    places: countValues(scenes.flatMap((scene) => scene.placeId ? [scene.placeId] : [])).filter((item) => item.count >= 2),
    objects: countValues(scenes.flatMap((scene) => scene.objects)).filter((item) => item.count >= 2),
    framing: countValues(scenes.flatMap((scene) => scene.framing)).filter((item) => item.count >= 2),
  };
  return {
    schemaVersion: MCP_INSPIRATION_COMPARISON_VERSION,
    comparedIds: ordered.map((metric) => `inspiration:${String(metric._id)}`),
    items: ordered.map((metric) => ({
      id: `inspiration:${String(metric._id)}`,
      creator: safeCreator(metric),
      url: typeof metric.postLink === "string" && /^https?:\/\//i.test(metric.postLink) ? metric.postLink : null,
      format: formatOf(metric),
      durationSeconds: finite(metric.stats?.video_duration_seconds),
      hookPattern: hookPatternOf(metric),
      hookPatternLabel: CREATOR_HOOK_PATTERN_LABELS[hookPatternOf(metric)],
      tones: [...new Set([...categoriesOf(metric).tones, ...sceneOf(metric).tones])].slice(0, 8),
      scene: {
        placeId: sceneOf(metric).placeId,
        objects: sceneOf(metric).objects.slice(0, 8),
        framing: sceneOf(metric).framing.slice(0, 8),
      },
    })),
    sharedPatterns: common,
    durationRange: durations.length
      ? { minimumSeconds: Math.min(...durations), maximumSeconds: Math.max(...durations), averageSeconds: round(durations.reduce((sum, value) => sum + value, 0) / durations.length, 1) }
      : null,
    synthesis: {
      strongestCommonPattern: common.hookPatterns[0]?.value ?? common.narratives[0]?.value ?? common.tones[0]?.value ?? null,
      adaptationInstruction: "Combine padrões recorrentes com a voz e os territórios do assinante; não monte um roteiro por colagem de frases de terceiros.",
    },
    coverage: {
      requested: uniqueIds.length,
      compared: ordered.length,
      sceneAnalysisAvailable: ordered.filter((metric) => Boolean(metric.sceneElements)).length,
      warnings: ordered.length < uniqueIds.length ? ["some_items_unavailable_or_not_opted_in"] : [],
    },
    receipt: {
      generatedAt: new Date().toISOString(),
      source: "data2content_opt_in_community_content" as const,
      onlyOptInCreators: true as const,
      fullTranscriptsExcluded: true as const,
      rawPrivateMetricsExcluded: true as const,
    },
  };
}

export async function buildMcpInspirationReferenceContext(params: { userId: string; inspirationIds: string[] }) {
  const metrics = await loadEligibleMetricsByIds(params.userId, [...new Set(params.inspirationIds)].slice(0, 5));
  if (!metrics.length) return { ids: [] as string[], promptContext: null as string | null };
  const rows = metrics.map((metric) => {
    const scene = sceneOf(metric);
    const categories = categoriesOf(metric);
    const pattern = hookPatternOf(metric);
    return [
      `- Referência ${`inspiration:${String(metric._id)}`}`,
      `gancho=${CREATOR_HOOK_PATTERN_LABELS[pattern]}`,
      `tom=${[...new Set([...categories.tones, ...scene.tones])].slice(0, 3).join(",") || "n/d"}`,
      `narrativa=${categories.narratives.slice(0, 2).join(",") || "n/d"}`,
      `cenário=${scene.placeId || "n/d"}`,
      `enquadramento=${scene.framing.slice(0, 2).join(",") || "n/d"}`,
      `objetos=${scene.objects.slice(0, 3).join(",") || "n/d"}`,
      `duração=${finite(metric.stats?.video_duration_seconds) ?? "n/d"}s`,
    ].join("; ");
  });
  return {
    ids: metrics.map((metric) => `inspiration:${String(metric._id)}`),
    promptContext: [
      "PADRÕES DE REFERÊNCIAS OPT-IN DA COMUNIDADE DATA2CONTENT:",
      ...rows,
      "Use apenas os padrões abstratos. Não copie frases, roteiro, personagem ou identidade visual de terceiros.",
    ].join("\n"),
  };
}
