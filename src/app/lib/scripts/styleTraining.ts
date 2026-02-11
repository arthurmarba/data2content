import { Types } from "mongoose";

import AIGeneratedPost from "@/app/models/AIGeneratedPost";
import ScriptEntry from "@/app/models/ScriptEntry";
import ScriptStyleProfile, {
  SCRIPT_STYLE_PROFILE_VERSION,
  type ScriptStyleExclusionStats,
  type ScriptStyleNarrativeCadence,
  type ScriptStyleSignals,
  type ScriptStyleSourceMix,
} from "@/app/models/ScriptStyleProfile";

import { extractScriptStyleFeatures, normalizeForStyleComparison, tokenizeText } from "./styleFeatures";

export const STYLE_PROFILE_MIN_CONTENT_LENGTH = 160;
export const STYLE_PROFILE_MAX_SCRIPTS = 240;

type ScriptSource = "manual" | "ai" | "planner";

export type StyleTrainingEntry = {
  id: string;
  source: ScriptSource;
  content: string;
  aiVersionId?: string | null;
  isAdminRecommendation?: boolean;
  updatedAt?: Date | string | null;
};

export type ScriptStyleProfileSnapshot = {
  profileVersion: string;
  sampleSize: number;
  lastScriptAt: string | null;
  sourceMix: ScriptStyleSourceMix;
  styleSignals: ScriptStyleSignals;
  styleExamples: string[];
  exclusionStats: ScriptStyleExclusionStats;
};

type TrainingBuildResult = {
  profile: ScriptStyleProfileSnapshot;
};

type WeightedSample = {
  source: ScriptSource;
  weight: number;
  updatedAtMs: number;
  features: ReturnType<typeof extractScriptStyleFeatures>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function incrementCounter(counter: Map<string, number>, values: string[], weight: number) {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized) continue;
    counter.set(normalized, (counter.get(normalized) || 0) + weight);
  }
}

function topFromCounter(counter: Map<string, number>, limit: number): string[] {
  return Array.from(counter.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function buildEmptyProfile(exclusionStats?: Partial<ScriptStyleExclusionStats>): ScriptStyleProfileSnapshot {
  return {
    profileVersion: SCRIPT_STYLE_PROFILE_VERSION,
    sampleSize: 0,
    lastScriptAt: null,
    sourceMix: {
      manual: 0,
      ai: 0,
      planner: 0,
    },
    styleSignals: {
      avgParagraphs: 0,
      avgSentenceLength: 0,
      emojiDensity: 0,
      questionRate: 0,
      exclamationRate: 0,
      hookPatterns: [],
      ctaPatterns: [],
      humorMarkers: [],
      recurringExpressions: [],
      narrativeCadence: {
        openingAvgChars: 0,
        developmentAvgChars: 0,
        closingAvgChars: 0,
      },
    },
    styleExamples: [],
    exclusionStats: {
      adminRecommendationSkipped: exclusionStats?.adminRecommendationSkipped || 0,
      tooShortSkipped: exclusionStats?.tooShortSkipped || 0,
      emptySkipped: exclusionStats?.emptySkipped || 0,
      duplicateSkipped: exclusionStats?.duplicateSkipped || 0,
    },
  };
}

function getBaseWeight(source: ScriptSource): number {
  if (source === "ai") return 0.7;
  if (source === "planner") return 0.6;
  return 1;
}

export function estimateRewriteRatio(original: string, edited: string): number {
  const originalTokens = tokenizeText(normalizeForStyleComparison(original));
  const editedTokens = tokenizeText(normalizeForStyleComparison(edited));
  if (!originalTokens.length || !editedTokens.length) return 0;

  const originalMap = new Map<string, number>();
  for (const token of originalTokens) {
    originalMap.set(token, (originalMap.get(token) || 0) + 1);
  }

  let overlap = 0;
  for (const token of editedTokens) {
    const remaining = originalMap.get(token) || 0;
    if (remaining <= 0) continue;
    overlap += 1;
    originalMap.set(token, remaining - 1);
  }

  const baseline = Math.max(originalTokens.length, editedTokens.length);
  if (!baseline) return 0;
  return clamp(1 - overlap / baseline, 0, 1);
}

function toWeightedSamples(params: {
  entries: StyleTrainingEntry[];
  aiGeneratedScripts: Record<string, string>;
}): {
  samples: WeightedSample[];
  exclusionStats: ScriptStyleExclusionStats;
} {
  const sorted = [...params.entries].sort((a, b) => {
    const aMs = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const bMs = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return bMs - aMs;
  });

  const exclusionStats: ScriptStyleExclusionStats = {
    adminRecommendationSkipped: 0,
    tooShortSkipped: 0,
    emptySkipped: 0,
    duplicateSkipped: 0,
  };

  const seenContent = new Set<string>();
  const samples: WeightedSample[] = [];

  for (const entry of sorted) {
    if (samples.length >= STYLE_PROFILE_MAX_SCRIPTS) break;
    if (entry.isAdminRecommendation) {
      exclusionStats.adminRecommendationSkipped += 1;
      continue;
    }

    const features = extractScriptStyleFeatures(entry.content || "");
    if (!features.normalizedContent) {
      exclusionStats.emptySkipped += 1;
      continue;
    }

    if (features.normalizedContent.length < STYLE_PROFILE_MIN_CONTENT_LENGTH) {
      exclusionStats.tooShortSkipped += 1;
      continue;
    }

    const dedupeKey = normalizeForStyleComparison(features.normalizedContent);
    if (seenContent.has(dedupeKey)) {
      exclusionStats.duplicateSkipped += 1;
      continue;
    }
    seenContent.add(dedupeKey);

    const source = entry.source || "manual";
    let weight = getBaseWeight(source);

    const generatedScript = entry.aiVersionId ? params.aiGeneratedScripts[entry.aiVersionId] : undefined;
    if (typeof generatedScript === "string" && generatedScript) {
      const rewriteRatio = estimateRewriteRatio(generatedScript, features.normalizedContent);
      weight += 0.25 * rewriteRatio;
    }

    const updatedAtMs = entry.updatedAt ? new Date(entry.updatedAt).getTime() : 0;
    samples.push({
      source,
      weight,
      updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0,
      features,
    });
  }

  return { samples, exclusionStats };
}

export function buildScriptStyleProfileFromEntries(params: {
  entries: StyleTrainingEntry[];
  aiGeneratedScripts?: Record<string, string>;
}): TrainingBuildResult {
  const aiGeneratedScripts = params.aiGeneratedScripts || {};
  const { samples, exclusionStats } = toWeightedSamples({
    entries: params.entries || [],
    aiGeneratedScripts,
  });

  if (!samples.length) {
    return {
      profile: buildEmptyProfile(exclusionStats),
    };
  }

  const sourceMix: ScriptStyleSourceMix = {
    manual: 0,
    ai: 0,
    planner: 0,
  };

  const weighted = {
    paragraphs: 0,
    sentenceLength: 0,
    emojiDensity: 0,
    questionRate: 0,
    exclamationRate: 0,
    openingChars: 0,
    developmentChars: 0,
    closingChars: 0,
  };

  let totalWeight = 0;
  let latestUpdatedAtMs = 0;
  const hookCounter = new Map<string, number>();
  const ctaCounter = new Map<string, number>();
  const humorCounter = new Map<string, number>();
  const recurringCounter = new Map<string, number>();
  const styleExamples: string[] = [];
  const styleExampleSet = new Set<string>();

  for (const sample of samples) {
    totalWeight += sample.weight;
    latestUpdatedAtMs = Math.max(latestUpdatedAtMs, sample.updatedAtMs);
    sourceMix[sample.source] += 1;

    weighted.paragraphs += sample.features.paragraphCount * sample.weight;
    weighted.sentenceLength += sample.features.avgSentenceLength * sample.weight;
    weighted.emojiDensity += sample.features.emojiDensity * sample.weight;
    weighted.questionRate += sample.features.questionRate * sample.weight;
    weighted.exclamationRate += sample.features.exclamationRate * sample.weight;
    weighted.openingChars += sample.features.narrativeCadence.openingChars * sample.weight;
    weighted.developmentChars += sample.features.narrativeCadence.developmentChars * sample.weight;
    weighted.closingChars += sample.features.narrativeCadence.closingChars * sample.weight;

    if (sample.features.hookPattern) {
      incrementCounter(hookCounter, [sample.features.hookPattern], sample.weight);
    }
    incrementCounter(ctaCounter, sample.features.ctaPatterns, sample.weight);
    incrementCounter(humorCounter, sample.features.humorMarkers, sample.weight);
    incrementCounter(recurringCounter, sample.features.recurringExpressions, sample.weight);

    if (sample.features.styleExample && styleExamples.length < 12) {
      const example = sample.features.styleExample;
      if (!styleExampleSet.has(example)) {
        styleExampleSet.add(example);
        styleExamples.push(example);
      }
    }
  }

  const safeWeight = totalWeight || 1;
  const cadence: ScriptStyleNarrativeCadence = {
    openingAvgChars: round(weighted.openingChars / safeWeight, 1),
    developmentAvgChars: round(weighted.developmentChars / safeWeight, 1),
    closingAvgChars: round(weighted.closingChars / safeWeight, 1),
  };

  return {
    profile: {
      profileVersion: SCRIPT_STYLE_PROFILE_VERSION,
      sampleSize: samples.length,
      lastScriptAt: latestUpdatedAtMs ? new Date(latestUpdatedAtMs).toISOString() : null,
      sourceMix,
      styleSignals: {
        avgParagraphs: round(weighted.paragraphs / safeWeight, 2),
        avgSentenceLength: round(weighted.sentenceLength / safeWeight, 2),
        emojiDensity: round(weighted.emojiDensity / safeWeight, 4),
        questionRate: round(weighted.questionRate / safeWeight, 4),
        exclamationRate: round(weighted.exclamationRate / safeWeight, 4),
        hookPatterns: topFromCounter(hookCounter, 6),
        ctaPatterns: topFromCounter(ctaCounter, 6),
        humorMarkers: topFromCounter(humorCounter, 10),
        recurringExpressions: topFromCounter(recurringCounter, 20),
        narrativeCadence: cadence,
      },
      styleExamples,
      exclusionStats,
    },
  };
}

function ensureObjectId(value: string): Types.ObjectId | null {
  if (!Types.ObjectId.isValid(value)) return null;
  return new Types.ObjectId(value);
}

async function fetchRecentTrainingEntries(userId: string): Promise<StyleTrainingEntry[]> {
  const userObjectId = ensureObjectId(userId);
  if (!userObjectId) return [];

  const docs = await ScriptEntry.find({ userId: userObjectId })
    .select("_id source content aiVersionId isAdminRecommendation updatedAt")
    .sort({ updatedAt: -1, _id: -1 })
    .limit(STYLE_PROFILE_MAX_SCRIPTS * 3)
    .lean()
    .exec();

  return (docs || []).map((doc: any) => ({
    id: String(doc?._id || ""),
    source: (doc?.source || "manual") as ScriptSource,
    content: typeof doc?.content === "string" ? doc.content : "",
    aiVersionId: typeof doc?.aiVersionId === "string" ? doc.aiVersionId : null,
    isAdminRecommendation: Boolean(doc?.isAdminRecommendation),
    updatedAt: doc?.updatedAt || null,
  }));
}

async function fetchAiGeneratedBaseScripts(entries: StyleTrainingEntry[]): Promise<Record<string, string>> {
  const ids = entries
    .map((entry) => entry.aiVersionId || "")
    .filter((id): id is string => Boolean(id) && Types.ObjectId.isValid(id));

  if (!ids.length) return {};

  const uniqueIds = Array.from(new Set(ids)).map((id) => new Types.ObjectId(id));
  const docs = await AIGeneratedPost.find({ _id: { $in: uniqueIds } })
    .select("_id script")
    .lean()
    .exec();

  return (docs || []).reduce<Record<string, string>>((acc, doc: any) => {
    const id = String(doc?._id || "");
    const script = typeof doc?.script === "string" ? doc.script : "";
    if (id && script) {
      acc[id] = script;
    }
    return acc;
  }, {});
}

function normalizeStoredProfile(doc: any): ScriptStyleProfileSnapshot {
  if (!doc) return buildEmptyProfile();
  return {
    profileVersion: String(doc.profileVersion || SCRIPT_STYLE_PROFILE_VERSION),
    sampleSize: Number(doc.sampleSize || 0),
    lastScriptAt: doc.lastScriptAt ? new Date(doc.lastScriptAt).toISOString() : null,
    sourceMix: {
      manual: Number(doc?.sourceMix?.manual || 0),
      ai: Number(doc?.sourceMix?.ai || 0),
      planner: Number(doc?.sourceMix?.planner || 0),
    },
    styleSignals: {
      avgParagraphs: Number(doc?.styleSignals?.avgParagraphs || 0),
      avgSentenceLength: Number(doc?.styleSignals?.avgSentenceLength || 0),
      emojiDensity: Number(doc?.styleSignals?.emojiDensity || 0),
      questionRate: Number(doc?.styleSignals?.questionRate || 0),
      exclamationRate: Number(doc?.styleSignals?.exclamationRate || 0),
      hookPatterns: Array.isArray(doc?.styleSignals?.hookPatterns) ? doc.styleSignals.hookPatterns : [],
      ctaPatterns: Array.isArray(doc?.styleSignals?.ctaPatterns) ? doc.styleSignals.ctaPatterns : [],
      humorMarkers: Array.isArray(doc?.styleSignals?.humorMarkers) ? doc.styleSignals.humorMarkers : [],
      recurringExpressions: Array.isArray(doc?.styleSignals?.recurringExpressions)
        ? doc.styleSignals.recurringExpressions
        : [],
      narrativeCadence: {
        openingAvgChars: Number(doc?.styleSignals?.narrativeCadence?.openingAvgChars || 0),
        developmentAvgChars: Number(doc?.styleSignals?.narrativeCadence?.developmentAvgChars || 0),
        closingAvgChars: Number(doc?.styleSignals?.narrativeCadence?.closingAvgChars || 0),
      },
    },
    styleExamples: Array.isArray(doc?.styleExamples) ? doc.styleExamples : [],
    exclusionStats: {
      adminRecommendationSkipped: Number(doc?.exclusionStats?.adminRecommendationSkipped || 0),
      tooShortSkipped: Number(doc?.exclusionStats?.tooShortSkipped || 0),
      emptySkipped: Number(doc?.exclusionStats?.emptySkipped || 0),
      duplicateSkipped: Number(doc?.exclusionStats?.duplicateSkipped || 0),
    },
  };
}

export async function rebuildScriptStyleProfile(userId: string): Promise<ScriptStyleProfileSnapshot | null> {
  const userObjectId = ensureObjectId(userId);
  if (!userObjectId) return null;

  const entries = await fetchRecentTrainingEntries(userId);
  const aiGeneratedScripts = await fetchAiGeneratedBaseScripts(entries);
  const built = buildScriptStyleProfileFromEntries({ entries, aiGeneratedScripts });

  const payload = {
    userId: userObjectId,
    profileVersion: built.profile.profileVersion,
    sampleSize: built.profile.sampleSize,
    lastScriptAt: built.profile.lastScriptAt ? new Date(built.profile.lastScriptAt) : null,
    sourceMix: built.profile.sourceMix,
    styleSignals: built.profile.styleSignals,
    styleExamples: built.profile.styleExamples,
    exclusionStats: built.profile.exclusionStats,
  };

  const saved = await ScriptStyleProfile.findOneAndUpdate(
    { userId: userObjectId },
    { $set: payload },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .lean()
    .exec();

  return normalizeStoredProfile(saved);
}

export async function getScriptStyleProfile(userId: string): Promise<ScriptStyleProfileSnapshot | null> {
  const userObjectId = ensureObjectId(userId);
  if (!userObjectId) return null;

  const existing = await ScriptStyleProfile.findOne({ userId: userObjectId }).lean().exec();
  if (!existing) {
    return rebuildScriptStyleProfile(userId);
  }

  const normalized = normalizeStoredProfile(existing);
  const isCorrupted =
    normalized.profileVersion !== SCRIPT_STYLE_PROFILE_VERSION ||
    !normalized.styleSignals ||
    !normalized.sourceMix ||
    normalized.sampleSize < 0;

  if (isCorrupted) {
    return rebuildScriptStyleProfile(userId);
  }

  return normalized;
}

export async function refreshScriptStyleProfile(userId: string): Promise<ScriptStyleProfileSnapshot | null> {
  return rebuildScriptStyleProfile(userId);
}
