import { Types } from "mongoose";
import type { PipelineStage } from "mongoose";

import {
  getCategoryById,
  getCategoryByValue,
} from "@/app/lib/classification";
import { fetchTopCategories } from "@/app/lib/dataService";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";

import {
  SCRIPT_CATEGORY_DIMENSIONS,
  type ScriptCategoryDimension,
  type ScriptCategorySelection,
  type ScriptPromptMode,
  parsePromptForScriptIntelligence,
  type ScriptNarrativeIntent,
} from "./promptParser";
import {
  buildCreatorDnaProfileFromCaptions,
  type CreatorDnaProfile,
  type ScriptCaptionSample,
} from "./dnaProfile";
import { isScriptsOutcomeLearningV1Enabled, isScriptsStyleTrainingV1Enabled } from "./featureFlag";
import {
  getScriptOutcomeProfile,
  type ScriptOutcomeProfileSnapshot,
} from "./outcomeTraining";
import { buildScriptStyleContext, type ScriptStyleContext } from "./styleContext";
import { recordScriptsStageDuration } from "./performanceTelemetry";
import { getScriptStyleProfile, refreshScriptStyleProfile } from "./styleTraining";

const DEFAULT_LOOKBACK_DAYS = 180;
const DEFAULT_TOP_CATEGORIES_LIMIT = 5;
const DEFAULT_CAPTION_LIMIT = 30;
const DEFAULT_CAPTION_CANDIDATE_LIMIT = (() => {
  const fallback = DEFAULT_CAPTION_LIMIT * 8;
  const parsed = Number(process.env.SCRIPTS_INTELLIGENCE_CAPTION_CANDIDATE_LIMIT ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  const min = DEFAULT_CAPTION_LIMIT * 2;
  const max = 600;
  return Math.min(max, Math.max(min, normalized));
})();
const MIN_CAPTION_SAMPLE = 6;
const INTELLIGENCE_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.SCRIPTS_INTELLIGENCE_CACHE_TTL_MS ?? 90_000);
  return Number.isFinite(parsed) && parsed >= 15_000 ? Math.floor(parsed) : 90_000;
})();
const RANKED_CACHE_MAX_ENTRIES = 160;
const CAPTION_CACHE_MAX_ENTRIES = 240;

export const SCRIPT_INTELLIGENCE_VERSION = "scripts_intelligence_v2";
export const SCRIPT_INTELLIGENCE_METRIC: "avg_total_interactions" = "avg_total_interactions";

const DIMENSION_CATEGORY_TYPES: Record<
  ScriptCategoryDimension,
  "proposal" | "context" | "format" | "tone" | "reference"
> = {
  proposal: "proposal",
  context: "context",
  format: "format",
  tone: "tone",
  references: "reference",
};

const DEFAULT_DIMENSION_CATEGORY: Record<ScriptCategoryDimension, string> = {
  proposal: "tips",
  context: "general",
  format: "reel",
  tone: "educational",
  references: "pop_culture",
};

export type RankedCategoriesByDimension = Partial<Record<ScriptCategoryDimension, string[]>>;

export type ScriptIntelligenceCaptionEvidence = ScriptCaptionSample & {
  postDate: string | null;
  categories: ScriptCategorySelection;
};

export type ScriptIntelligenceLinkedOutcome = {
  enabled: boolean;
  sampleSizeLinked: number;
  confidence: "low" | "medium" | "high";
  blendedApplied: boolean;
  topByDimension: Partial<
    Record<
      ScriptCategoryDimension,
      Array<{
        id: string;
        lift: number;
        sampleSize: number;
      }>
    >
  >;
  topExamples: Array<{
    metricId: string;
    caption: string;
    score: number;
    lift: number;
    hookSample?: string | null;
    ctaSample?: string | null;
    postDate?: string | null;
    categories?: ScriptCategorySelection;
  }>;
};

export type ScriptIntelligenceContext = {
  intelligenceVersion: typeof SCRIPT_INTELLIGENCE_VERSION;
  promptMode: ScriptPromptMode;
  intent: ScriptNarrativeIntent;
  metricUsed: typeof SCRIPT_INTELLIGENCE_METRIC;
  lookbackDays: number;
  explicitCategories: ScriptCategorySelection;
  resolvedCategories: ScriptCategorySelection;
  rankedCategories: RankedCategoriesByDimension;
  dnaProfile: CreatorDnaProfile;
  styleProfile: ScriptStyleContext | null;
  styleProfileVersion: string | null;
  styleSampleSize: number;
  captionEvidence: ScriptIntelligenceCaptionEvidence[];
  relaxationLevel: number;
  usedFallbackRules: boolean;
  linkedOutcome?: ScriptIntelligenceLinkedOutcome | null;
};

export type ScriptIntelligencePromptSnapshot = {
  intelligenceVersion: typeof SCRIPT_INTELLIGENCE_VERSION;
  promptMode: ScriptPromptMode;
  explicitCategories: ScriptCategorySelection;
  resolvedCategories: ScriptCategorySelection;
  metricUsed: typeof SCRIPT_INTELLIGENCE_METRIC;
  lookbackDays: number;
  styleProfileVersion: string | null;
  styleSampleSize: number;
  styleSignalsUsed?: ScriptStyleContext["styleSignalsUsed"];
  dnaEvidence: {
    sampleSize: number;
    hasEnoughEvidence: boolean;
    metricIds: string[];
    avgInteractions: number;
    relaxationLevel: number;
    usedFallbackRules: boolean;
  };
  linkedOutcomeSummary?: {
    enabled: boolean;
    sampleSizeLinked: number;
    confidence: "low" | "medium" | "high";
    blendedApplied: boolean;
    topDimensions: Partial<Record<ScriptCategoryDimension, string[]>>;
    topExampleMetricIds: string[];
  };
};

type TimedCacheEntry<T> = {
  expiresAt: number;
  value: T;
};

type CaptionFetchResult = {
  captions: ScriptIntelligenceCaptionEvidence[];
  relaxationLevel: number;
  usedFallbackRules: boolean;
};

const rankedCategoriesCache = new Map<string, TimedCacheEntry<RankedCategoriesByDimension>>();
const rankedCategoriesInFlight = new Map<string, Promise<RankedCategoriesByDimension>>();
const topCaptionsCache = new Map<string, TimedCacheEntry<CaptionFetchResult>>();
const topCaptionsInFlight = new Map<string, Promise<CaptionFetchResult>>();

function normalizeCategoryId(value: string, dimension: ScriptCategoryDimension): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const type = DIMENSION_CATEGORY_TYPES[dimension];
  const resolved = getCategoryByValue(trimmed, type);
  return resolved?.id || trimmed;
}

function normalizeCategoryList(values: string[], dimension: ScriptCategoryDimension): string[] {
  const normalized = values
    .map((value) => normalizeCategoryId(String(value || ""), dimension))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function pruneTimedCache<T>(cache: Map<string, TimedCacheEntry<T>>, maxEntries: number) {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }

  if (cache.size <= maxEntries) return;

  const sorted = Array.from(cache.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const extra = cache.size - maxEntries;
  for (let index = 0; index < extra; index += 1) {
    const item = sorted[index];
    if (!item) break;
    cache.delete(item[0]);
  }
}

function buildDateWindowCacheKey(dateRange: { startDate: Date; endDate: Date }): string {
  const start = Number.isFinite(dateRange.startDate.getTime())
    ? dateRange.startDate.toISOString().slice(0, 10)
    : "start";
  const end = Number.isFinite(dateRange.endDate.getTime()) ? dateRange.endDate.toISOString().slice(0, 10) : "end";
  return `${start}:${end}`;
}

function buildSelectionCacheKey(selection: ScriptCategorySelection): string {
  return SCRIPT_CATEGORY_DIMENSIONS.map((dimension) => `${dimension}=${selection[dimension] || ""}`).join("|");
}

function getDateRangeFromLookback(lookbackDays: number): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  return { startDate, endDate };
}

async function fetchRankedCategories(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
}): Promise<RankedCategoriesByDimension> {
  const cacheKey = `${params.userId}:${buildDateWindowCacheKey(params.dateRange)}`;
  const now = Date.now();
  const cached = rankedCategoriesCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inFlight = rankedCategoriesInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const task = computeRankedCategories(params)
    .then((value) => {
      rankedCategoriesCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + INTELLIGENCE_CACHE_TTL_MS,
      });
      pruneTimedCache(rankedCategoriesCache, RANKED_CACHE_MAX_ENTRIES);
      return value;
    })
    .finally(() => {
      rankedCategoriesInFlight.delete(cacheKey);
    });

  rankedCategoriesInFlight.set(cacheKey, task);
  return task;
}

async function computeRankedCategories(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
}): Promise<RankedCategoriesByDimension> {
  const viaFacet = await fetchRankedCategoriesViaFacet(params);
  if (viaFacet) return viaFacet;

  const tasks: Array<Promise<{ dimension: ScriptCategoryDimension; categories: string[] }>> =
    SCRIPT_CATEGORY_DIMENSIONS.map(async (dimension) => {
      try {
        const result = await fetchTopCategories({
          userId: params.userId,
          dateRange: params.dateRange,
          category: dimension,
          metric: SCRIPT_INTELLIGENCE_METRIC,
          limit: DEFAULT_TOP_CATEGORIES_LIMIT,
        });
        const categories = normalizeCategoryList(
          (result || []).map((item: any) => String(item?.category || "").trim()).filter(Boolean),
          dimension
        );
        return { dimension, categories };
      } catch {
        return { dimension, categories: [] };
      }
    });

  const settled = await Promise.all(tasks);
  return settled.reduce<RankedCategoriesByDimension>((acc, item) => {
    acc[item.dimension] = item.categories;
    return acc;
  }, {});
}

async function fetchRankedCategoriesViaFacet(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
}): Promise<RankedCategoriesByDimension | null> {
  if (!Types.ObjectId.isValid(params.userId)) return null;

  try {
    const userObjectId = new Types.ObjectId(params.userId);
    const matchStage: Record<string, any> = {
      user: userObjectId,
      postDate: { $gte: params.dateRange.startDate, $lte: params.dateRange.endDate },
      "stats.total_interactions": { $exists: true, $ne: null },
    };

    const facets = SCRIPT_CATEGORY_DIMENSIONS.reduce<Record<string, PipelineStage.FacetPipelineStage[]>>(
      (acc, dimension) => {
        const fieldRef = `$${dimension}`;
        acc[dimension] = [
          { $match: { [dimension]: { $exists: true, $ne: [] } } },
          { $unwind: fieldRef },
          { $group: { _id: fieldRef, metricValue: { $avg: "$stats.total_interactions" } } },
          { $sort: { metricValue: -1 } },
          { $limit: DEFAULT_TOP_CATEGORIES_LIMIT },
          { $project: { _id: 0, category: "$_id" } },
        ];
        return acc;
      },
      {}
    );

    const aggregateResult = await MetricModel.aggregate([{ $match: matchStage }, { $facet: facets }])
      .allowDiskUse(true)
      .exec();

    const first = Array.isArray(aggregateResult) ? aggregateResult[0] : null;
    if (!first || typeof first !== "object") {
      return {};
    }

    return SCRIPT_CATEGORY_DIMENSIONS.reduce<RankedCategoriesByDimension>((acc, dimension) => {
      const rows = Array.isArray((first as any)[dimension]) ? (first as any)[dimension] : [];
      acc[dimension] = normalizeCategoryList(
        rows.map((item: any) => String(item?.category || "").trim()).filter(Boolean),
        dimension
      );
      return acc;
    }, {});
  } catch {
    return null;
  }
}

function getTopRankedForDimension(
  rankedCategories: RankedCategoriesByDimension,
  dimension: ScriptCategoryDimension
): string {
  const fromRanking = rankedCategories[dimension]?.[0];
  if (fromRanking) return fromRanking;
  return DEFAULT_DIMENSION_CATEGORY[dimension];
}

function shouldApplyLinkedBlend(profile: ScriptOutcomeProfileSnapshot | null | undefined): boolean {
  if (!profile) return false;
  if (profile.sampleSizeLinked < 5) return false;
  return profile.confidence === "medium" || profile.confidence === "high";
}

function normalizeHistoricalRankingScores(
  rankedCategories: RankedCategoriesByDimension
): Partial<Record<ScriptCategoryDimension, Map<string, number>>> {
  return SCRIPT_CATEGORY_DIMENSIONS.reduce<Partial<Record<ScriptCategoryDimension, Map<string, number>>>>(
    (acc, dimension) => {
      const ids = normalizeCategoryList(rankedCategories[dimension] || [], dimension);
      if (!ids.length) return acc;
      const map = new Map<string, number>();
      const max = Math.max(1, ids.length - 1);
      ids.forEach((id, index) => {
        const normalized = max === 0 ? 1 : 1 - index / max;
        map.set(id, roundScore(normalized));
      });
      acc[dimension] = map;
      return acc;
    },
    {}
  );
}

function normalizeLinkedOutcomeScores(
  profile: ScriptOutcomeProfileSnapshot | null | undefined
): Partial<Record<ScriptCategoryDimension, Map<string, { score: number; lift: number; sampleSize: number }>>> {
  if (!profile) return {};
  return SCRIPT_CATEGORY_DIMENSIONS.reduce<
    Partial<Record<ScriptCategoryDimension, Map<string, { score: number; lift: number; sampleSize: number }>>>
  >((acc, dimension) => {
    const rows = Array.isArray(profile.topByDimension?.[dimension]) ? profile.topByDimension?.[dimension] || [] : [];
    if (!rows.length) return acc;
    const maxLift = rows.reduce((best, row) => Math.max(best, Number(row?.lift || 0)), 0);
    const divisor = maxLift > 0 ? maxLift : 1;
    const map = new Map<string, { score: number; lift: number; sampleSize: number }>();
    rows.forEach((row: any) => {
      const normalizedId = normalizeCategoryId(String(row?.id || ""), dimension);
      if (!normalizedId) return;
      const lift = Number(row?.lift || 0);
      const score = clampScore(lift / divisor);
      map.set(normalizedId, {
        score: roundScore(score),
        lift: roundScore(lift),
        sampleSize: Math.max(0, Number(row?.sampleSize || 0)),
      });
    });
    if (map.size) acc[dimension] = map;
    return acc;
  }, {});
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function roundScore(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 1000) / 1000;
}

function blendRankedCategoriesWithLinkedOutcome(params: {
  rankedCategories: RankedCategoriesByDimension;
  linkedProfile: ScriptOutcomeProfileSnapshot | null;
  applyBlend: boolean;
}): {
  rankedCategories: RankedCategoriesByDimension;
  topByDimension: ScriptIntelligenceLinkedOutcome["topByDimension"];
} {
  const linkedScoresByDimension = normalizeLinkedOutcomeScores(params.linkedProfile);
  const linkedTopByDimension = SCRIPT_CATEGORY_DIMENSIONS.reduce<ScriptIntelligenceLinkedOutcome["topByDimension"]>(
    (acc, dimension) => {
      const map = linkedScoresByDimension[dimension];
      if (!map || !map.size) return acc;
      acc[dimension] = Array.from(map.entries())
        .map(([id, item]) => ({
          id,
          lift: item.lift,
          sampleSize: item.sampleSize,
        }))
        .sort((a, b) => b.lift - a.lift || b.sampleSize - a.sampleSize)
        .slice(0, DEFAULT_TOP_CATEGORIES_LIMIT);
      return acc;
    },
    {}
  );

  if (!params.applyBlend) {
    return {
      rankedCategories: params.rankedCategories,
      topByDimension: linkedTopByDimension,
    };
  }

  const historicalScoresByDimension = normalizeHistoricalRankingScores(params.rankedCategories);
  const blendedCategories = SCRIPT_CATEGORY_DIMENSIONS.reduce<RankedCategoriesByDimension>((acc, dimension) => {
    const historicalMap = historicalScoresByDimension[dimension] || new Map<string, number>();
    const linkedMap = linkedScoresByDimension[dimension] || new Map<string, { score: number }>();
    const keys = new Set<string>([...historicalMap.keys(), ...linkedMap.keys()]);
    const scored = Array.from(keys).map((id) => {
      const historicalScore = historicalMap.get(id) || 0;
      const linkedScore = linkedMap.get(id)?.score || 0;
      const blended = 0.65 * linkedScore + 0.35 * historicalScore;
      return { id, score: roundScore(blended) };
    });

    const ordered = scored
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, DEFAULT_TOP_CATEGORIES_LIMIT)
      .map((item) => item.id);
    acc[dimension] = ordered.length ? ordered : params.rankedCategories[dimension] || [];
    return acc;
  }, {});

  return {
    rankedCategories: blendedCategories,
    topByDimension: linkedTopByDimension,
  };
}

function mapLinkedExamplesToCaptionEvidence(
  profile: ScriptOutcomeProfileSnapshot | null | undefined
): ScriptIntelligenceCaptionEvidence[] {
  if (!profile || !Array.isArray(profile.topExamples)) return [];
  return profile.topExamples
    .slice(0, 4)
    .map((item) => {
      const metricId = String(item?.metricId || "");
      const caption = typeof item?.caption === "string" ? item.caption.trim() : "";
      if (!metricId || !caption) return null;

      const categories: ScriptCategorySelection = {};
      for (const dimension of SCRIPT_CATEGORY_DIMENSIONS) {
        const raw = item?.categories?.[dimension];
        if (!raw || typeof raw !== "string") continue;
        const normalized = normalizeCategoryId(raw, dimension);
        if (normalized) categories[dimension] = normalized;
      }

      return {
        metricId,
        caption,
        interactions:
          typeof item?.interactions === "number" && Number.isFinite(item.interactions)
            ? item.interactions
            : 0,
        postDate: item?.postDate || null,
        categories,
      } as ScriptIntelligenceCaptionEvidence;
    })
    .filter(Boolean) as ScriptIntelligenceCaptionEvidence[];
}

function mergeCaptionEvidenceWithLinkedExamples(params: {
  linkedExamples: ScriptIntelligenceCaptionEvidence[];
  rankedCaptions: ScriptIntelligenceCaptionEvidence[];
}): ScriptIntelligenceCaptionEvidence[] {
  if (!params.linkedExamples.length) return params.rankedCaptions;
  const merged: ScriptIntelligenceCaptionEvidence[] = [];
  const seen = new Set<string>();

  for (const item of params.linkedExamples) {
    const metricId = String(item.metricId || "");
    if (!metricId || seen.has(metricId)) continue;
    seen.add(metricId);
    merged.push(item);
  }
  for (const item of params.rankedCaptions) {
    const metricId = String(item.metricId || "");
    if (!metricId || seen.has(metricId)) continue;
    seen.add(metricId);
    merged.push(item);
    if (merged.length >= DEFAULT_CAPTION_LIMIT) break;
  }

  return merged.slice(0, DEFAULT_CAPTION_LIMIT);
}

export function resolveFinalCategories(params: {
  promptMode: ScriptPromptMode;
  intent: ScriptNarrativeIntent;
  explicitCategories: ScriptCategorySelection;
  rankedCategories: RankedCategoriesByDimension;
}): ScriptCategorySelection {
  const { promptMode, intent, explicitCategories, rankedCategories } = params;
  const resolved: ScriptCategorySelection = { ...explicitCategories };

  if (promptMode !== "full") {
    if (intent.wantsHumor) {
      if (!resolved.tone) {
        resolved.tone = "humorous";
      }
      if (!resolved.proposal) {
        resolved.proposal = "humor_scene";
      }
    }

    for (const dimension of SCRIPT_CATEGORY_DIMENSIONS) {
      if (!resolved[dimension]) {
        resolved[dimension] = getTopRankedForDimension(rankedCategories, dimension);
      }
    }
  }

  // Regra de produto: roteiros sempre seguem formato Reel.
  resolved.format = "reel";

  return resolved;
}

function getCategoryValuesForQuery(
  dimension: ScriptCategoryDimension,
  categoryId: string
): string[] {
  const values = new Set<string>();
  const normalized = categoryId.trim();
  if (!normalized) return [];
  values.add(normalized);

  const type = DIMENSION_CATEGORY_TYPES[dimension];
  const category = getCategoryById(normalized, type);
  if (category?.label) {
    values.add(category.label);
  }

  values.add(normalized.replace(/_/g, " "));

  return Array.from(values).filter(Boolean);
}

function buildRelaxationStrategies(params: {
  resolvedCategories: ScriptCategorySelection;
  explicitCategories: ScriptCategorySelection;
}): ScriptCategoryDimension[][] {
  const withResolved = SCRIPT_CATEGORY_DIMENSIONS.filter(
    (dimension) => Boolean(params.resolvedCategories[dimension])
  );
  const explicitOnly = SCRIPT_CATEGORY_DIMENSIONS.filter(
    (dimension) => Boolean(params.explicitCategories[dimension] && params.resolvedCategories[dimension])
  );

  const candidates: ScriptCategoryDimension[][] = [
    withResolved,
    withResolved.filter((dimension) => dimension !== "references"),
    withResolved.filter((dimension) => dimension !== "references" && dimension !== "tone"),
    withResolved.filter(
      (dimension) => dimension !== "references" && dimension !== "tone" && dimension !== "format"
    ),
    withResolved.filter((dimension) => dimension === "proposal" || dimension === "context"),
    explicitOnly,
    [],
  ];

  const seen = new Set<string>();
  const unique: ScriptCategoryDimension[][] = [];
  for (const candidate of candidates) {
    const key = candidate.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  return unique;
}

async function fetchCaptionsByRequiredDimensions(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
  resolvedCategories: ScriptCategorySelection;
  requiredDimensions: ScriptCategoryDimension[];
  limit: number;
}): Promise<ScriptIntelligenceCaptionEvidence[]> {
  const query = buildBaseCaptionQuery({
    userId: params.userId,
    dateRange: params.dateRange,
  });

  for (const dimension of params.requiredDimensions) {
    const id = params.resolvedCategories[dimension];
    if (!id) continue;
    const acceptedValues = getCategoryValuesForQuery(dimension, id);
    if (!acceptedValues.length) continue;
    query[dimension] = { $in: acceptedValues };
  }

  const docs = await MetricModel.find(query)
    .select(
      "_id description text_content postDate stats.total_interactions proposal context format tone references"
    )
    .sort({ "stats.total_interactions": -1, postDate: -1 })
    .limit(params.limit)
    .lean()
    .exec();

  return mapMetricDocsToCaptionEvidence(docs || []);
}

function buildBaseCaptionQuery(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
}): Record<string, any> {
  return {
    user: new Types.ObjectId(params.userId),
    postDate: { $gte: params.dateRange.startDate, $lte: params.dateRange.endDate },
    "stats.total_interactions": { $exists: true, $ne: null },
  };
}

async function fetchCaptionCandidates(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
}): Promise<ScriptIntelligenceCaptionEvidence[]> {
  const docs = await MetricModel.find(
    buildBaseCaptionQuery({
      userId: params.userId,
      dateRange: params.dateRange,
    })
  )
    .select(
      "_id description text_content postDate stats.total_interactions proposal context format tone references"
    )
    .sort({ "stats.total_interactions": -1, postDate: -1 })
    .limit(DEFAULT_CAPTION_CANDIDATE_LIMIT)
    .lean()
    .exec();

  return mapMetricDocsToCaptionEvidence(docs || []);
}

function mapMetricDocsToCaptionEvidence(docs: any[]): ScriptIntelligenceCaptionEvidence[] {
  return docs
    .map((doc: any) => {
      const caption =
        typeof doc?.description === "string" && doc.description.trim()
          ? doc.description.trim()
          : typeof doc?.text_content === "string" && doc.text_content.trim()
            ? doc.text_content.trim()
            : "";

      if (!caption) return null;

      return {
        metricId: String(doc?._id || ""),
        caption,
        interactions:
          typeof doc?.stats?.total_interactions === "number" ? doc.stats.total_interactions : 0,
        postDate: doc?.postDate ? new Date(doc.postDate).toISOString() : null,
        categories: {
          proposal: Array.isArray(doc?.proposal) && doc.proposal[0] ? String(doc.proposal[0]) : undefined,
          context: Array.isArray(doc?.context) && doc.context[0] ? String(doc.context[0]) : undefined,
          format: Array.isArray(doc?.format) && doc.format[0] ? String(doc.format[0]) : undefined,
          tone: Array.isArray(doc?.tone) && doc.tone[0] ? String(doc.tone[0]) : undefined,
          references:
            Array.isArray(doc?.references) && doc.references[0] ? String(doc.references[0]) : undefined,
        },
      } as ScriptIntelligenceCaptionEvidence;
    })
    .filter(Boolean) as ScriptIntelligenceCaptionEvidence[];
}

function buildAcceptedCategoryValueMap(
  resolvedCategories: ScriptCategorySelection
): Partial<Record<ScriptCategoryDimension, Set<string>>> {
  return SCRIPT_CATEGORY_DIMENSIONS.reduce<Partial<Record<ScriptCategoryDimension, Set<string>>>>(
    (acc, dimension) => {
      const categoryId = resolvedCategories[dimension];
      if (!categoryId) return acc;
      const values = getCategoryValuesForQuery(dimension, categoryId).map((value) => value.trim()).filter(Boolean);
      if (!values.length) return acc;
      acc[dimension] = new Set(values);
      return acc;
    },
    {}
  );
}

function captionMatchesRequiredDimensions(params: {
  caption: ScriptIntelligenceCaptionEvidence;
  requiredDimensions: ScriptCategoryDimension[];
  acceptedByDimension: Partial<Record<ScriptCategoryDimension, Set<string>>>;
}): boolean {
  for (const dimension of params.requiredDimensions) {
    const accepted = params.acceptedByDimension[dimension];
    if (!accepted || accepted.size === 0) continue;
    const value = params.caption.categories[dimension];
    if (!value) return false;
    if (accepted.has(value)) continue;
    if (accepted.has(value.replace(/_/g, " "))) continue;
    if (accepted.has(value.replace(/\s+/g, "_"))) continue;
    return false;
  }
  return true;
}

function selectBestCaptionsFromCandidates(params: {
  candidates: ScriptIntelligenceCaptionEvidence[];
  strategies: ScriptCategoryDimension[][];
  acceptedByDimension: Partial<Record<ScriptCategoryDimension, Set<string>>>;
  limit: number;
}): CaptionFetchResult {
  let best: ScriptIntelligenceCaptionEvidence[] = [];
  let bestLevel = params.strategies.length - 1;

  for (let index = 0; index < params.strategies.length; index += 1) {
    const requiredDimensions = params.strategies[index] || [];
    const selected: ScriptIntelligenceCaptionEvidence[] = [];
    for (const caption of params.candidates) {
      if (
        captionMatchesRequiredDimensions({
          caption,
          requiredDimensions,
          acceptedByDimension: params.acceptedByDimension,
        })
      ) {
        selected.push(caption);
        if (selected.length >= params.limit) break;
      }
    }

    if (selected.length > best.length) {
      best = selected;
      bestLevel = index;
    }

    if (selected.length >= MIN_CAPTION_SAMPLE) {
      return {
        captions: selected,
        relaxationLevel: index,
        usedFallbackRules: index > 0,
      };
    }
  }

  return {
    captions: best,
    relaxationLevel: bestLevel,
    usedFallbackRules: true,
  };
}

async function fetchTopCaptionsForCategories(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
  resolvedCategories: ScriptCategorySelection;
  explicitCategories: ScriptCategorySelection;
}): Promise<CaptionFetchResult> {
  const cacheKey = [
    params.userId,
    buildDateWindowCacheKey(params.dateRange),
    buildSelectionCacheKey(params.resolvedCategories),
    buildSelectionCacheKey(params.explicitCategories),
  ].join("::");
  const now = Date.now();
  const cached = topCaptionsCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const inFlight = topCaptionsInFlight.get(cacheKey);
  if (inFlight) {
    return inFlight;
  }

  const task = computeTopCaptionsForCategories(params)
    .then((value) => {
      topCaptionsCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + INTELLIGENCE_CACHE_TTL_MS,
      });
      pruneTimedCache(topCaptionsCache, CAPTION_CACHE_MAX_ENTRIES);
      return value;
    })
    .finally(() => {
      topCaptionsInFlight.delete(cacheKey);
    });

  topCaptionsInFlight.set(cacheKey, task);
  return task;
}

async function computeTopCaptionsForCategories(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
  resolvedCategories: ScriptCategorySelection;
  explicitCategories: ScriptCategorySelection;
}): Promise<CaptionFetchResult> {
  const strategies = buildRelaxationStrategies({
    resolvedCategories: params.resolvedCategories,
    explicitCategories: params.explicitCategories,
  });
  const acceptedByDimension = buildAcceptedCategoryValueMap(params.resolvedCategories);

  const candidateCaptions = await fetchCaptionCandidates({
    userId: params.userId,
    dateRange: params.dateRange,
  });
  const fromCandidates = selectBestCaptionsFromCandidates({
    candidates: candidateCaptions,
    strategies,
    acceptedByDimension,
    limit: DEFAULT_CAPTION_LIMIT,
  });
  if (fromCandidates.captions.length >= MIN_CAPTION_SAMPLE) {
    return fromCandidates;
  }
  const candidatePoolIsComplete = candidateCaptions.length < DEFAULT_CAPTION_CANDIDATE_LIMIT;
  if (candidatePoolIsComplete) {
    return fromCandidates;
  }

  let best: ScriptIntelligenceCaptionEvidence[] = fromCandidates.captions;
  let bestLevel = fromCandidates.relaxationLevel;

  for (let index = 0; index < strategies.length; index += 1) {
    const requiredDimensions = strategies[index] || [];
    const captions = await fetchCaptionsByRequiredDimensions({
      userId: params.userId,
      dateRange: params.dateRange,
      resolvedCategories: params.resolvedCategories,
      requiredDimensions,
      limit: DEFAULT_CAPTION_LIMIT,
    });

    if (captions.length > best.length) {
      best = captions;
      bestLevel = index;
    }

    if (captions.length >= MIN_CAPTION_SAMPLE) {
      return {
        captions,
        relaxationLevel: index,
        usedFallbackRules: index > 0,
      };
    }
  }

  return {
    captions: best,
    relaxationLevel: bestLevel,
    usedFallbackRules: true,
  };
}

export async function buildScriptIntelligenceContext(params: {
  userId: string;
  prompt: string;
  lookbackDays?: number;
}): Promise<ScriptIntelligenceContext> {
  const totalStartMs = Date.now();
  try {
    const lookbackDays = Number.isFinite(params.lookbackDays)
      ? Math.max(1, Number(params.lookbackDays))
      : DEFAULT_LOOKBACK_DAYS;

    const parsed = parsePromptForScriptIntelligence(params.prompt);
    const dateRange = getDateRangeFromLookback(lookbackDays);

    await connectToDatabase();

    const styleProfilePromise = (async () => {
      let styleProfile: ScriptStyleContext | null = null;
      let styleProfileVersion: string | null = null;
      let styleSampleSize = 0;

      const styleTrainingEnabled = await isScriptsStyleTrainingV1Enabled();
      if (!styleTrainingEnabled) {
        return { styleProfile, styleProfileVersion, styleSampleSize };
      }

      const styleStartMs = Date.now();
      try {
        const storedStyleProfile = await getScriptStyleProfile(params.userId, {
          rebuildIfMissing: false,
          rebuildIfCorrupted: false,
        });
        if (!storedStyleProfile) {
          void refreshScriptStyleProfile(params.userId, { awaitCompletion: false }).catch(() => null);
        }
        styleProfile = buildScriptStyleContext(storedStyleProfile);
        styleProfileVersion = styleProfile?.profileVersion || null;
        styleSampleSize = styleProfile?.sampleSize || 0;
      } catch {
        styleProfile = null;
        styleProfileVersion = null;
        styleSampleSize = 0;
      } finally {
        recordScriptsStageDuration("intelligence.style_profile", Date.now() - styleStartMs);
      }

      return { styleProfile, styleProfileVersion, styleSampleSize };
    })();

    const linkedOutcomePromise = (async () => {
      const enabled = await isScriptsOutcomeLearningV1Enabled();
      if (!enabled) return { enabled: false, profile: null as ScriptOutcomeProfileSnapshot | null };
      try {
        const profile = await getScriptOutcomeProfile(params.userId, {
          rebuildIfMissing: false,
          rebuildIfCorrupted: false,
        });
        return { enabled: true, profile };
      } catch {
        return { enabled: true, profile: null as ScriptOutcomeProfileSnapshot | null };
      }
    })();

    let rankedCategories: RankedCategoriesByDimension = {};
    if (parsed.promptMode !== "full") {
      const rankingStartMs = Date.now();
      rankedCategories = await fetchRankedCategories({
        userId: params.userId,
        dateRange,
      });
      recordScriptsStageDuration("intelligence.ranking", Date.now() - rankingStartMs);
    }

    const linkedOutcomeData = await linkedOutcomePromise;
    const linkedBlendApplied = parsed.promptMode !== "full" && shouldApplyLinkedBlend(linkedOutcomeData.profile);
    const blendedRanking = blendRankedCategoriesWithLinkedOutcome({
      rankedCategories,
      linkedProfile: linkedOutcomeData.profile,
      applyBlend: linkedBlendApplied,
    });
    const rankedCategoriesForResolution = linkedBlendApplied ? blendedRanking.rankedCategories : rankedCategories;

    const resolvedCategories = resolveFinalCategories({
      promptMode: parsed.promptMode,
      intent: parsed.intent,
      explicitCategories: parsed.explicitCategories,
      rankedCategories: rankedCategoriesForResolution,
    });

    const captionsStartMs = Date.now();
    const captionFetchResult = await fetchTopCaptionsForCategories({
      userId: params.userId,
      dateRange,
      resolvedCategories,
      explicitCategories: parsed.explicitCategories,
    });
    recordScriptsStageDuration("intelligence.captions", Date.now() - captionsStartMs);

    const linkedCaptionEvidence = mapLinkedExamplesToCaptionEvidence(linkedOutcomeData.profile);
    const finalCaptionEvidence = mergeCaptionEvidenceWithLinkedExamples({
      linkedExamples: linkedCaptionEvidence,
      rankedCaptions: captionFetchResult.captions,
    });

    const dnaProfile = buildCreatorDnaProfileFromCaptions(finalCaptionEvidence);
    const { styleProfile, styleProfileVersion, styleSampleSize } = await styleProfilePromise;
    const linkedOutcome: ScriptIntelligenceLinkedOutcome | null = linkedOutcomeData.enabled
      ? {
          enabled: true,
          sampleSizeLinked: linkedOutcomeData.profile?.sampleSizeLinked || 0,
          confidence: linkedOutcomeData.profile?.confidence || "low",
          blendedApplied: linkedBlendApplied,
          topByDimension: blendedRanking.topByDimension,
          topExamples: (linkedOutcomeData.profile?.topExamples || []).slice(0, 4).map((item) => ({
            metricId: item.metricId,
            caption: item.caption,
            score: item.score,
            lift: item.lift,
            hookSample: item.hookSample || null,
            ctaSample: item.ctaSample || null,
            postDate: item.postDate || null,
            categories: item.categories,
          })),
        }
      : null;

    return {
      intelligenceVersion: SCRIPT_INTELLIGENCE_VERSION,
      promptMode: parsed.promptMode,
      intent: parsed.intent,
      metricUsed: SCRIPT_INTELLIGENCE_METRIC,
      lookbackDays,
      explicitCategories: parsed.explicitCategories,
      resolvedCategories,
      rankedCategories: rankedCategoriesForResolution,
      dnaProfile,
      styleProfile,
      styleProfileVersion,
      styleSampleSize,
      captionEvidence: finalCaptionEvidence,
      relaxationLevel: captionFetchResult.relaxationLevel,
      usedFallbackRules: captionFetchResult.usedFallbackRules,
      linkedOutcome,
    };
  } finally {
    recordScriptsStageDuration("intelligence.total", Date.now() - totalStartMs);
  }
}

export function buildIntelligencePromptSnapshot(
  context: ScriptIntelligenceContext | null | undefined
): ScriptIntelligencePromptSnapshot | undefined {
  if (!context) return undefined;

  const sampleSize = context.captionEvidence.length;
  const totalInteractions = context.captionEvidence.reduce((sum, item) => sum + (item.interactions || 0), 0);
  const avgInteractions = sampleSize ? Number((totalInteractions / sampleSize).toFixed(1)) : 0;

  return {
    intelligenceVersion: context.intelligenceVersion,
    promptMode: context.promptMode,
    explicitCategories: context.explicitCategories,
    resolvedCategories: context.resolvedCategories,
    metricUsed: context.metricUsed,
    lookbackDays: context.lookbackDays,
    styleProfileVersion: context.styleProfileVersion,
    styleSampleSize: context.styleSampleSize,
    styleSignalsUsed: context.styleProfile?.styleSignalsUsed,
    dnaEvidence: {
      sampleSize,
      hasEnoughEvidence: context.dnaProfile.hasEnoughEvidence,
      metricIds: context.captionEvidence.map((item) => item.metricId),
      avgInteractions,
      relaxationLevel: context.relaxationLevel,
      usedFallbackRules: context.usedFallbackRules,
    },
    linkedOutcomeSummary: context.linkedOutcome
      ? {
          enabled: context.linkedOutcome.enabled,
          sampleSizeLinked: context.linkedOutcome.sampleSizeLinked,
          confidence: context.linkedOutcome.confidence,
          blendedApplied: context.linkedOutcome.blendedApplied,
          topDimensions: SCRIPT_CATEGORY_DIMENSIONS.reduce<
            Partial<Record<ScriptCategoryDimension, string[]>>
          >((acc, dimension) => {
            const rows = context.linkedOutcome?.topByDimension?.[dimension] || [];
            if (!rows.length) return acc;
            acc[dimension] = rows.map((row) => row.id);
            return acc;
          }, {}),
          topExampleMetricIds: (context.linkedOutcome.topExamples || []).map((item) => item.metricId),
        }
      : undefined,
  };
}
