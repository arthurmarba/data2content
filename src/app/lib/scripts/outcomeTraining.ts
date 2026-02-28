import { Types } from "mongoose";

import { getCategoryByValue } from "@/app/lib/classification";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import ScriptEntry from "@/app/models/ScriptEntry";
import ScriptOutcomeProfile, {
  SCRIPT_OUTCOME_PROFILE_VERSION,
  type ScriptOutcomeConfidence,
  type ScriptOutcomeTopByDimension,
} from "@/app/models/ScriptOutcomeProfile";

import type { ScriptCategoryDimension } from "./promptParser";

const OUTCOME_LOOKBACK_DAYS = 365;
const BASELINE_PRIMARY_LOOKBACK_DAYS = 180;
const OUTCOME_PROFILE_MAX_LINKED_ROWS = 600;
const OUTCOME_TOP_LIMIT_PER_DIMENSION = 8;
const OUTCOME_TOP_EXAMPLES_LIMIT = 6;
const OUTCOME_REFRESH_COOLDOWN_MS = (() => {
  const parsed = Number(process.env.SCRIPTS_OUTCOME_PROFILE_REFRESH_COOLDOWN_MS ?? 120_000);
  return Number.isFinite(parsed) && parsed >= 15_000 ? Math.floor(parsed) : 120_000;
})();
const OUTCOME_READ_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.SCRIPTS_OUTCOME_PROFILE_CACHE_TTL_MS ?? 90_000);
  return Number.isFinite(parsed) && parsed >= 15_000 ? Math.floor(parsed) : 90_000;
})();
const OUTCOME_READ_CACHE_MAX_ENTRIES = (() => {
  const parsed = Number(process.env.SCRIPTS_OUTCOME_PROFILE_CACHE_MAX_ENTRIES ?? 500);
  return Number.isFinite(parsed) && parsed >= 50 ? Math.floor(parsed) : 500;
})();

const CTA_SAMPLE_REGEX =
  /(comente|comentario|salve|salvar|compartilhe|direct|dm|me chama|segue|link na bio)/i;

const CATEGORY_DIMENSIONS: ScriptCategoryDimension[] = [
  "proposal",
  "context",
  "format",
  "tone",
  "references",
];

const DIMENSION_CLASSIFICATION_TYPE: Record<
  ScriptCategoryDimension,
  "proposal" | "context" | "format" | "tone" | "reference"
> = {
  proposal: "proposal",
  context: "context",
  format: "format",
  tone: "tone",
  references: "reference",
};

export type ScriptOutcomeBaseline = {
  medianInteractions: number;
  medianEngagement: number;
};

export type ScriptOutcomeExample = {
  metricId: string;
  scriptId: string;
  caption: string;
  interactions: number;
  engagement: number | null;
  score: number;
  lift: number;
  postDate: string | null;
  categories: Partial<Record<ScriptCategoryDimension, string>>;
  hookSample: string | null;
  ctaSample: string | null;
};

export type ScriptOutcomeCategoryLift = {
  id: string;
  lift: number;
  score: number;
  sampleSize: number;
};

export type ScriptOutcomeProfileSnapshot = {
  profileVersion: string;
  sampleSizeLinked: number;
  lastComputedAt: string | null;
  baseline: ScriptOutcomeBaseline;
  topByDimension: Partial<Record<ScriptCategoryDimension, ScriptOutcomeCategoryLift[]>>;
  topExamples: ScriptOutcomeExample[];
  confidence: ScriptOutcomeConfidence;
};

type GetScriptOutcomeProfileOptions = {
  rebuildIfMissing?: boolean;
  rebuildIfCorrupted?: boolean;
};

type RefreshScriptOutcomeProfileOptions = {
  force?: boolean;
  awaitCompletion?: boolean;
};

type LinkedScriptRecord = {
  metricId: string;
  scriptId: string;
  caption: string;
  interactions: number;
  engagement: number | null;
  postDate: Date | null;
  categories: Partial<Record<ScriptCategoryDimension, string>>;
  hookSample: string | null;
  ctaSample: string | null;
  score: number;
  lift: number;
  recencyWeight: number;
};

type RefreshState = {
  lastCompletedAt: number;
  inFlight: Promise<ScriptOutcomeProfileSnapshot | null> | null;
};

const refreshStateByUser = new Map<string, RefreshState>();
const readCacheByUser = new Map<
  string,
  {
    expiresAt: number;
    value: ScriptOutcomeProfileSnapshot | null;
  }
>();
const readInFlightByUser = new Map<string, Promise<ScriptOutcomeProfileSnapshot | null>>();

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 4): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function extractHookSample(value: string): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized.slice(0, 110);
}

function extractCtaSample(value: string): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const match = normalized.match(CTA_SAMPLE_REGEX);
  if (!match) return null;
  const idx = match.index ?? -1;
  if (idx < 0) return match[0].toLowerCase();
  return normalized.slice(Math.max(0, idx - 24), Math.min(normalized.length, idx + 86)).trim();
}

function ensureObjectId(value: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
}

function toDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as any);
  return Number.isFinite(date.getTime()) ? date : null;
}

function computeMedian(values: number[]): number {
  const normalized = values
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .sort((a, b) => a - b);
  if (!normalized.length) return 0;
  const mid = Math.floor(normalized.length / 2);
  if (normalized.length % 2 === 1) return normalized[mid] || 0;
  const left = normalized[mid - 1] || 0;
  const right = normalized[mid] || 0;
  return (left + right) / 2;
}

export function deriveOutcomeConfidence(sampleSize: number): ScriptOutcomeConfidence {
  if (sampleSize >= 8) return "high";
  if (sampleSize >= 3) return "medium";
  return "low";
}

export function computeOutcomeScore(params: {
  interactions: number;
  engagement: number | null;
  baseline: ScriptOutcomeBaseline;
  daysSincePost: number;
}) {
  const interactions = Number.isFinite(params.interactions) ? Math.max(0, params.interactions) : 0;
  const baselineInteractions = Math.max(1, params.baseline.medianInteractions || 0);
  const baselineEngagement = Math.max(0.01, params.baseline.medianEngagement || 0);
  const engagementValue =
    typeof params.engagement === "number" && Number.isFinite(params.engagement)
      ? params.engagement
      : baselineEngagement;

  const iNorm = clampNumber(interactions / baselineInteractions, 0.2, 3.0);
  const eNorm = clampNumber(engagementValue / baselineEngagement, 0.2, 3.0);
  const score = 0.7 * iNorm + 0.3 * eNorm;
  const recencyWeight = clampNumber(Math.exp(-Math.max(0, params.daysSincePost) / 120), 0.35, 1);
  return {
    score: round(score, 4),
    lift: round(score, 4),
    iNorm: round(iNorm, 4),
    eNorm: round(eNorm, 4),
    recencyWeight: round(recencyWeight, 4),
  };
}

function normalizeCategoryId(value: unknown, dimension: ScriptCategoryDimension): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const resolved = getCategoryByValue(normalized, DIMENSION_CLASSIFICATION_TYPE[dimension]);
  return resolved?.id || normalized;
}

function buildEmptyTopByDimension(): ScriptOutcomeTopByDimension {
  return {
    proposal: [],
    context: [],
    format: [],
    tone: [],
    references: [],
  };
}

function buildEmptyProfile(baseline?: Partial<ScriptOutcomeBaseline>): ScriptOutcomeProfileSnapshot {
  return {
    profileVersion: SCRIPT_OUTCOME_PROFILE_VERSION,
    sampleSizeLinked: 0,
    lastComputedAt: null,
    baseline: {
      medianInteractions: Number(baseline?.medianInteractions || 0),
      medianEngagement: Number(baseline?.medianEngagement || 0),
    },
    topByDimension: buildEmptyTopByDimension(),
    topExamples: [],
    confidence: "low",
  };
}

function normalizeStoredProfile(doc: any): ScriptOutcomeProfileSnapshot {
  if (!doc) return buildEmptyProfile();
  return {
    profileVersion: String(doc.profileVersion || SCRIPT_OUTCOME_PROFILE_VERSION),
    sampleSizeLinked: Number(doc.sampleSizeLinked || 0),
    lastComputedAt: doc.lastComputedAt ? new Date(doc.lastComputedAt).toISOString() : null,
    baseline: {
      medianInteractions: Number(doc?.baseline?.medianInteractions || 0),
      medianEngagement: Number(doc?.baseline?.medianEngagement || 0),
    },
    topByDimension: {
      proposal: Array.isArray(doc?.topByDimension?.proposal) ? doc.topByDimension.proposal : [],
      context: Array.isArray(doc?.topByDimension?.context) ? doc.topByDimension.context : [],
      format: Array.isArray(doc?.topByDimension?.format) ? doc.topByDimension.format : [],
      tone: Array.isArray(doc?.topByDimension?.tone) ? doc.topByDimension.tone : [],
      references: Array.isArray(doc?.topByDimension?.references) ? doc.topByDimension.references : [],
    },
    topExamples: Array.isArray(doc?.topExamples)
      ? doc.topExamples.map((item: any) => ({
          metricId: String(item?.metricId || ""),
          scriptId: String(item?.scriptId || ""),
          caption: String(item?.caption || ""),
          interactions: Number(item?.interactions || 0),
          engagement:
            typeof item?.engagement === "number" && Number.isFinite(item.engagement)
              ? item.engagement
              : null,
          score: Number(item?.score || 0),
          lift: Number(item?.lift || 0),
          postDate: item?.postDate ? new Date(item.postDate).toISOString() : null,
          categories: {
            proposal: typeof item?.categories?.proposal === "string" ? item.categories.proposal : undefined,
            context: typeof item?.categories?.context === "string" ? item.categories.context : undefined,
            format: typeof item?.categories?.format === "string" ? item.categories.format : undefined,
            tone: typeof item?.categories?.tone === "string" ? item.categories.tone : undefined,
            references: typeof item?.categories?.references === "string" ? item.categories.references : undefined,
          },
          hookSample: typeof item?.hookSample === "string" ? item.hookSample : null,
          ctaSample: typeof item?.ctaSample === "string" ? item.ctaSample : null,
        }))
      : [],
    confidence:
      doc?.confidence === "high" || doc?.confidence === "medium" || doc?.confidence === "low"
        ? doc.confidence
        : "low",
  };
}

function buildDateWindowStart(days: number): Date {
  const now = new Date();
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function fetchUserBaseline(userId: Types.ObjectId): Promise<ScriptOutcomeBaseline> {
  const fetchValues = async (days: number) => {
    const docs = await Metric.find({
      user: userId,
      postDate: { $gte: buildDateWindowStart(days) },
    })
      .select("stats.total_interactions stats.engagement")
      .sort({ postDate: -1 })
      .limit(2500)
      .lean()
      .exec();

    const interactions: number[] = [];
    const engagement: number[] = [];
    for (const doc of docs || []) {
      if (typeof doc?.stats?.total_interactions === "number" && Number.isFinite(doc.stats.total_interactions)) {
        interactions.push(doc.stats.total_interactions);
      }
      if (typeof doc?.stats?.engagement === "number" && Number.isFinite(doc.stats.engagement)) {
        engagement.push(doc.stats.engagement);
      }
    }
    return { interactions, engagement };
  };

  let values = await fetchValues(BASELINE_PRIMARY_LOOKBACK_DAYS);
  if (!values.interactions.length || !values.engagement.length) {
    values = await fetchValues(OUTCOME_LOOKBACK_DAYS);
  }

  const medianInteractions = computeMedian(values.interactions);
  const medianEngagement = computeMedian(values.engagement);
  return {
    medianInteractions: round(Math.max(0, medianInteractions), 4),
    medianEngagement: round(Math.max(0.0001, medianEngagement), 4),
  };
}

async function fetchLinkedScriptRecords(
  userId: Types.ObjectId,
  baseline: ScriptOutcomeBaseline
): Promise<LinkedScriptRecord[]> {
  const startDate = buildDateWindowStart(OUTCOME_LOOKBACK_DAYS);
  const scripts = await ScriptEntry.find({
    userId,
    "postedContent.metricId": { $exists: true },
    postedAt: { $gte: startDate },
  })
    .select("_id content postedAt postedContent")
    .sort({ postedAt: -1, _id: -1 })
    .limit(OUTCOME_PROFILE_MAX_LINKED_ROWS)
    .lean()
    .exec();

  if (!scripts.length) return [];

  const metricIds = Array.from(
    new Set(
      scripts
        .map((script: any) => String(script?.postedContent?.metricId || ""))
        .filter((metricId) => Types.ObjectId.isValid(metricId))
    )
  ).map((metricId) => new Types.ObjectId(metricId));

  const metricDocs = metricIds.length
    ? await Metric.find({ _id: { $in: metricIds }, user: userId })
        .select(
          "_id description postDate stats.total_interactions stats.engagement proposal context format tone references"
        )
        .lean()
        .exec()
    : [];

  const metricById = new Map<string, any>();
  for (const metric of metricDocs || []) {
    metricById.set(String(metric._id), metric);
  }

  const now = new Date();
  const records: LinkedScriptRecord[] = [];

  for (const script of scripts || []) {
    const metricId = String(script?.postedContent?.metricId || "");
    if (!metricId) continue;

    const metricDoc = metricById.get(metricId);
    const interactionsRaw =
      typeof metricDoc?.stats?.total_interactions === "number" && Number.isFinite(metricDoc.stats.total_interactions)
        ? metricDoc.stats.total_interactions
        : typeof script?.postedContent?.totalInteractions === "number" &&
            Number.isFinite(script.postedContent.totalInteractions)
          ? script.postedContent.totalInteractions
          : 0;
    if (!Number.isFinite(interactionsRaw) || interactionsRaw <= 0) continue;

    const engagementRaw =
      typeof metricDoc?.stats?.engagement === "number" && Number.isFinite(metricDoc.stats.engagement)
        ? metricDoc.stats.engagement
        : typeof script?.postedContent?.engagement === "number" && Number.isFinite(script.postedContent.engagement)
          ? script.postedContent.engagement
          : null;

    const postDate =
      toDateOrNull(metricDoc?.postDate) ||
      toDateOrNull(script?.postedContent?.postDate) ||
      toDateOrNull(script?.postedAt);
    const daysSincePost = postDate
      ? Math.max(0, Math.floor((now.getTime() - postDate.getTime()) / (24 * 60 * 60 * 1000)))
      : OUTCOME_LOOKBACK_DAYS;
    const scored = computeOutcomeScore({
      interactions: interactionsRaw,
      engagement: engagementRaw,
      baseline,
      daysSincePost,
    });

    const categories: Partial<Record<ScriptCategoryDimension, string>> = {};
    const getFirstCategory = (key: string) =>
      Array.isArray(metricDoc?.[key]) && metricDoc[key][0] ? metricDoc[key][0] : null;
    categories.proposal = normalizeCategoryId(getFirstCategory("proposal"), "proposal") || undefined;
    categories.context = normalizeCategoryId(getFirstCategory("context"), "context") || undefined;
    categories.format = normalizeCategoryId(getFirstCategory("format"), "format") || undefined;
    categories.tone = normalizeCategoryId(getFirstCategory("tone"), "tone") || undefined;
    categories.references = normalizeCategoryId(getFirstCategory("references"), "references") || undefined;

    const caption = normalizeText(metricDoc?.description || script?.postedContent?.caption || "");
    const scriptContent = normalizeText(script?.content || "");
    records.push({
      metricId,
      scriptId: String(script?._id || ""),
      caption,
      interactions: Math.max(0, Number(interactionsRaw || 0)),
      engagement: typeof engagementRaw === "number" && Number.isFinite(engagementRaw) ? engagementRaw : null,
      postDate,
      categories,
      hookSample: extractHookSample(scriptContent),
      ctaSample: extractCtaSample(scriptContent),
      score: scored.score,
      lift: scored.lift,
      recencyWeight: scored.recencyWeight,
    });
  }

  return records;
}

export function buildOutcomeAggregates(params: {
  records: LinkedScriptRecord[];
  baseline: ScriptOutcomeBaseline;
}): ScriptOutcomeProfileSnapshot {
  const records = params.records || [];
  const sampleSizeLinked = records.length;
  if (!sampleSizeLinked) {
    return buildEmptyProfile(params.baseline);
  }

  const dimensionMaps: Record<
    ScriptCategoryDimension,
    Map<string, { weightedScore: number; weightedLift: number; weightSum: number; count: number }>
  > = {
    proposal: new Map(),
    context: new Map(),
    format: new Map(),
    tone: new Map(),
    references: new Map(),
  };

  for (const record of records) {
    for (const dimension of CATEGORY_DIMENSIONS) {
      const categoryId = record.categories[dimension];
      if (!categoryId) continue;
      const map = dimensionMaps[dimension];
      const prev = map.get(categoryId) || { weightedScore: 0, weightedLift: 0, weightSum: 0, count: 0 };
      prev.weightedScore += record.score * record.recencyWeight;
      prev.weightedLift += record.lift * record.recencyWeight;
      prev.weightSum += record.recencyWeight;
      prev.count += 1;
      map.set(categoryId, prev);
    }
  }

  const topByDimension: ScriptOutcomeTopByDimension = buildEmptyTopByDimension();
  for (const dimension of CATEGORY_DIMENSIONS) {
    const rows = Array.from(dimensionMaps[dimension].entries())
      .map(([id, agg]) => ({
        id,
        score: round(agg.weightSum > 0 ? agg.weightedScore / agg.weightSum : 0, 4),
        lift: round(agg.weightSum > 0 ? agg.weightedLift / agg.weightSum : 0, 4),
        sampleSize: agg.count,
      }))
      .sort((a, b) => b.lift - a.lift || b.score - a.score || b.sampleSize - a.sampleSize)
      .slice(0, OUTCOME_TOP_LIMIT_PER_DIMENSION);
    topByDimension[dimension] = rows;
  }

  const topExamples = [...records]
    .sort((a, b) => b.score - a.score || b.interactions - a.interactions)
    .slice(0, OUTCOME_TOP_EXAMPLES_LIMIT)
    .map((row) => ({
      metricId: row.metricId,
      scriptId: row.scriptId,
      caption: row.caption,
      interactions: row.interactions,
      engagement: row.engagement,
      score: round(row.score, 4),
      lift: round(row.lift, 4),
      postDate: row.postDate ? row.postDate.toISOString() : null,
      categories: row.categories,
      hookSample: row.hookSample,
      ctaSample: row.ctaSample,
    }));

  return {
    profileVersion: SCRIPT_OUTCOME_PROFILE_VERSION,
    sampleSizeLinked,
    lastComputedAt: new Date().toISOString(),
    baseline: {
      medianInteractions: round(params.baseline.medianInteractions, 4),
      medianEngagement: round(params.baseline.medianEngagement, 4),
    },
    topByDimension,
    topExamples,
    confidence: deriveOutcomeConfidence(sampleSizeLinked),
  };
}

function shouldUseReadCache(options: GetScriptOutcomeProfileOptions): boolean {
  return options.rebuildIfMissing === false && options.rebuildIfCorrupted === false;
}

function pruneReadCache() {
  const now = Date.now();
  for (const [key, value] of readCacheByUser.entries()) {
    if (value.expiresAt <= now) readCacheByUser.delete(key);
  }
  if (readCacheByUser.size <= OUTCOME_READ_CACHE_MAX_ENTRIES) return;
  const sorted = Array.from(readCacheByUser.entries()).sort((a, b) => a[1].expiresAt - b[1].expiresAt);
  const extra = readCacheByUser.size - OUTCOME_READ_CACHE_MAX_ENTRIES;
  for (let index = 0; index < extra; index += 1) {
    const item = sorted[index];
    if (!item) break;
    readCacheByUser.delete(item[0]);
  }
}

function setReadCache(userObjectIdKey: string, value: ScriptOutcomeProfileSnapshot | null) {
  readCacheByUser.set(userObjectIdKey, {
    value,
    expiresAt: Date.now() + OUTCOME_READ_CACHE_TTL_MS,
  });
  pruneReadCache();
}

function getReadCache(userObjectIdKey: string): ScriptOutcomeProfileSnapshot | null | undefined {
  const cached = readCacheByUser.get(userObjectIdKey);
  if (!cached) return undefined;
  if (cached.expiresAt <= Date.now()) {
    readCacheByUser.delete(userObjectIdKey);
    return undefined;
  }
  return cached.value;
}

export async function rebuildScriptOutcomeProfile(userId: string): Promise<ScriptOutcomeProfileSnapshot | null> {
  const userObjectId = ensureObjectId(userId);
  if (!userObjectId) return null;
  await connectToDatabase();

  const baseline = await fetchUserBaseline(userObjectId);
  const records = await fetchLinkedScriptRecords(userObjectId, baseline);
  const profile = buildOutcomeAggregates({ records, baseline });

  const payload = {
    userId: userObjectId,
    profileVersion: profile.profileVersion,
    sampleSizeLinked: profile.sampleSizeLinked,
    lastComputedAt: profile.lastComputedAt ? new Date(profile.lastComputedAt) : null,
    baseline: profile.baseline,
    topByDimension: profile.topByDimension,
    topExamples: profile.topExamples.map((item) => ({
      ...item,
      postDate: item.postDate ? new Date(item.postDate) : null,
    })),
    confidence: profile.confidence,
  };

  const saved = await ScriptOutcomeProfile.findOneAndUpdate(
    { userId: userObjectId },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .lean()
    .exec();

  const normalized = normalizeStoredProfile(saved);
  setReadCache(String(userObjectId), normalized);
  return normalized;
}

async function getScriptOutcomeProfileFromStore(
  userObjectIdKey: string,
  options: GetScriptOutcomeProfileOptions
): Promise<ScriptOutcomeProfileSnapshot | null> {
  const { rebuildIfMissing = true, rebuildIfCorrupted = true } = options;
  const userObjectId = ensureObjectId(userObjectIdKey);
  if (!userObjectId) return null;
  await connectToDatabase();

  const existing = await ScriptOutcomeProfile.findOne({ userId: userObjectId }).lean().exec();
  if (!existing) {
    if (!rebuildIfMissing) return null;
    return rebuildScriptOutcomeProfile(userObjectIdKey);
  }

  const normalized = normalizeStoredProfile(existing);
  const isCorrupted =
    normalized.profileVersion !== SCRIPT_OUTCOME_PROFILE_VERSION ||
    !normalized.baseline ||
    !normalized.topByDimension ||
    normalized.sampleSizeLinked < 0;
  if (isCorrupted) {
    if (!rebuildIfCorrupted) return null;
    return rebuildScriptOutcomeProfile(userObjectIdKey);
  }

  return normalized;
}

export async function getScriptOutcomeProfile(
  userId: string,
  options: GetScriptOutcomeProfileOptions = {}
): Promise<ScriptOutcomeProfileSnapshot | null> {
  const userObjectId = ensureObjectId(userId);
  if (!userObjectId) return null;
  const key = String(userObjectId);
  const normalizedOptions: GetScriptOutcomeProfileOptions = {
    rebuildIfMissing: options.rebuildIfMissing ?? true,
    rebuildIfCorrupted: options.rebuildIfCorrupted ?? true,
  };

  if (shouldUseReadCache(normalizedOptions)) {
    const cached = getReadCache(key);
    if (cached !== undefined) return cached;

    const inFlight = readInFlightByUser.get(key);
    if (inFlight) return inFlight;

    const task = getScriptOutcomeProfileFromStore(key, normalizedOptions)
      .then((profile) => {
        setReadCache(key, profile);
        return profile;
      })
      .finally(() => {
        readInFlightByUser.delete(key);
      });

    readInFlightByUser.set(key, task);
    return task;
  }

  const profile = await getScriptOutcomeProfileFromStore(key, normalizedOptions);
  setReadCache(key, profile);
  return profile;
}

export async function refreshScriptOutcomeProfile(
  userId: string,
  options: RefreshScriptOutcomeProfileOptions = {}
): Promise<ScriptOutcomeProfileSnapshot | null> {
  const { force = false, awaitCompletion = true } = options;
  const userObjectId = ensureObjectId(userId);
  if (!userObjectId) return null;
  const key = String(userObjectId);
  const nowTs = Date.now();
  const currentState = refreshStateByUser.get(key) || { lastCompletedAt: 0, inFlight: null };

  if (currentState.inFlight) {
    return awaitCompletion ? currentState.inFlight : null;
  }

  if (!force && currentState.lastCompletedAt > 0 && nowTs - currentState.lastCompletedAt < OUTCOME_REFRESH_COOLDOWN_MS) {
    return null;
  }

  const task = rebuildScriptOutcomeProfile(key)
    .then((profile) => {
      setReadCache(key, profile);
      return profile;
    })
    .catch(() => {
      setReadCache(key, null);
      return null;
    })
    .finally(() => {
      const previous = refreshStateByUser.get(key) || { lastCompletedAt: 0, inFlight: null };
      refreshStateByUser.set(key, {
        lastCompletedAt: Date.now(),
        inFlight: null,
      });
      if (previous.inFlight) {
        readInFlightByUser.delete(key);
      }
    });

  refreshStateByUser.set(key, {
    lastCompletedAt: currentState.lastCompletedAt,
    inFlight: task,
  });

  return awaitCompletion ? task : null;
}

export function getOutcomeDimensionLift(
  profile: ScriptOutcomeProfileSnapshot | null | undefined,
  dimension: ScriptCategoryDimension,
  id: string | null | undefined
) {
  if (!profile || !id) return null;
  const values = profile.topByDimension?.[dimension];
  if (!Array.isArray(values) || !values.length) return null;
  const found = values.find((item) => item.id === id);
  if (!found) return null;
  return found;
}

export function clearScriptOutcomeProfileMemoryCache() {
  refreshStateByUser.clear();
  readCacheByUser.clear();
  readInFlightByUser.clear();
}
