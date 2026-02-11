import { Types } from "mongoose";

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

const DEFAULT_LOOKBACK_DAYS = 180;
const DEFAULT_TOP_CATEGORIES_LIMIT = 5;
const DEFAULT_CAPTION_LIMIT = 30;
const MIN_CAPTION_SAMPLE = 6;

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
  captionEvidence: ScriptIntelligenceCaptionEvidence[];
  relaxationLevel: number;
  usedFallbackRules: boolean;
};

export type ScriptIntelligencePromptSnapshot = {
  intelligenceVersion: typeof SCRIPT_INTELLIGENCE_VERSION;
  promptMode: ScriptPromptMode;
  explicitCategories: ScriptCategorySelection;
  resolvedCategories: ScriptCategorySelection;
  metricUsed: typeof SCRIPT_INTELLIGENCE_METRIC;
  lookbackDays: number;
  dnaEvidence: {
    sampleSize: number;
    hasEnoughEvidence: boolean;
    metricIds: string[];
    avgInteractions: number;
    relaxationLevel: number;
    usedFallbackRules: boolean;
  };
};

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

function getDateRangeFromLookback(lookbackDays: number): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  return { startDate, endDate };
}

async function fetchRankedCategories(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
}): Promise<RankedCategoriesByDimension> {
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

function getTopRankedForDimension(
  rankedCategories: RankedCategoriesByDimension,
  dimension: ScriptCategoryDimension
): string {
  const fromRanking = rankedCategories[dimension]?.[0];
  if (fromRanking) return fromRanking;
  return DEFAULT_DIMENSION_CATEGORY[dimension];
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
  const query: Record<string, any> = {
    user: new Types.ObjectId(params.userId),
    postDate: { $gte: params.dateRange.startDate, $lte: params.dateRange.endDate },
    "stats.total_interactions": { $exists: true, $ne: null },
  };

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

  const mapped = (docs || [])
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

  return mapped;
}

async function fetchTopCaptionsForCategories(params: {
  userId: string;
  dateRange: { startDate: Date; endDate: Date };
  resolvedCategories: ScriptCategorySelection;
  explicitCategories: ScriptCategorySelection;
}): Promise<{ captions: ScriptIntelligenceCaptionEvidence[]; relaxationLevel: number; usedFallbackRules: boolean }> {
  const strategies = buildRelaxationStrategies({
    resolvedCategories: params.resolvedCategories,
    explicitCategories: params.explicitCategories,
  });

  let best: ScriptIntelligenceCaptionEvidence[] = [];
  let bestLevel = strategies.length - 1;

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
  const lookbackDays = Number.isFinite(params.lookbackDays)
    ? Math.max(1, Number(params.lookbackDays))
    : DEFAULT_LOOKBACK_DAYS;

  const parsed = parsePromptForScriptIntelligence(params.prompt);
  const dateRange = getDateRangeFromLookback(lookbackDays);

  await connectToDatabase();

  const rankedCategories = await fetchRankedCategories({
    userId: params.userId,
    dateRange,
  });

  const resolvedCategories = resolveFinalCategories({
    promptMode: parsed.promptMode,
    intent: parsed.intent,
    explicitCategories: parsed.explicitCategories,
    rankedCategories,
  });

  const captionFetchResult = await fetchTopCaptionsForCategories({
    userId: params.userId,
    dateRange,
    resolvedCategories,
    explicitCategories: parsed.explicitCategories,
  });

  const dnaProfile = buildCreatorDnaProfileFromCaptions(captionFetchResult.captions);

  return {
    intelligenceVersion: SCRIPT_INTELLIGENCE_VERSION,
    promptMode: parsed.promptMode,
    intent: parsed.intent,
    metricUsed: SCRIPT_INTELLIGENCE_METRIC,
    lookbackDays,
    explicitCategories: parsed.explicitCategories,
    resolvedCategories,
    rankedCategories,
    dnaProfile,
    captionEvidence: captionFetchResult.captions,
    relaxationLevel: captionFetchResult.relaxationLevel,
    usedFallbackRules: captionFetchResult.usedFallbackRules,
  };
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
    dnaEvidence: {
      sampleSize,
      hasEnoughEvidence: context.dnaProfile.hasEnoughEvidence,
      metricIds: context.captionEvidence.map((item) => item.metricId),
      avgInteractions,
      relaxationLevel: context.relaxationLevel,
      usedFallbackRules: context.usedFallbackRules,
    },
  };
}
