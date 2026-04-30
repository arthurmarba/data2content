import { Types } from "mongoose";
import type { PipelineStage } from "mongoose";

import {
  getCategoryById,
  getCategoryByValue,
} from "@/app/lib/classification";
import { fetchTopCategories } from "@/app/lib/dataService";
import { connectToDatabase } from "@/app/lib/mongoose";
import MetricModel from "@/app/models/Metric";
import ScriptEntry from "@/app/models/ScriptEntry";

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
const SCRIPT_EXAMPLE_CACHE_MAX_ENTRIES = 320;
const DEFAULT_ENGAGEMENT_TIMEZONE = "America/Sao_Paulo";

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
    scriptId?: string | null;
    caption: string;
    score: number;
    lift: number;
    hookSample?: string | null;
    ctaSample?: string | null;
    postDate?: string | null;
    categories?: ScriptCategorySelection;
  }>;
};

export type ScriptIntelligenceWinningScriptExample = {
  scriptId: string;
  title: string;
  opening: string | null;
  development: string | null;
  cta: string | null;
  lift: number;
  interactions: number;
  postDate: string | null;
};

export type ScriptEngagementTimingInsight = {
  sampleSize: number;
  timezone: string;
  topHours: number[];
  topWeekdays: string[];
  summary: string;
};

export type ScriptEditorialDecision = {
  postDirective: string;
  narrativeAngle: string;
  recommendedStructure: string;
  whyThisShouldWork: string[];
  evidence: string[];
  postingWindow: string | null;
};

type WinningScriptExampleCandidate = {
  example: ScriptIntelligenceWinningScriptExample;
  categories?: ScriptCategorySelection;
  caption?: string | null;
  lift: number;
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
  winningScriptExamples: ScriptIntelligenceWinningScriptExample[];
  engagementTiming: ScriptEngagementTimingInsight | null;
  editorialDecision: ScriptEditorialDecision;
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
  engagementTimingSummary?: ScriptEngagementTimingInsight | null;
  editorialDecisionSummary?: ScriptEditorialDecision;
  styleSignalsUsed?: ScriptStyleContext["styleSignalsUsed"];
  dnaEvidence: {
    sampleSize: number;
    hasEnoughEvidence: boolean;
    metricIds: string[];
    avgInteractions: number;
    relaxationLevel: number;
    usedFallbackRules: boolean;
  };
  winningScriptExamplesSummary?: {
    count: number;
    scriptIds: string[];
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
const scriptExampleCache = new Map<
  string,
  TimedCacheEntry<ScriptIntelligenceWinningScriptExample | null>
>();
const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: DEFAULT_ENGAGEMENT_TIMEZONE,
  weekday: "short",
});
const HOUR_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  timeZone: DEFAULT_ENGAGEMENT_TIMEZONE,
  hour: "numeric",
  hour12: false,
});

const WINNING_SCRIPT_CTA_REGEX =
  /\b(comente|comenta|salve|salva|compartilhe|compartilha|direct|dm|me chama|segue|link|me conta|qual foi|e voc[eê])\b/i;
const WINNING_SCRIPT_PRACTICAL_REGEX =
  /\b(passo|ajuste|erro|troca|troque|pare de|comece|ritual|processo|crit[eé]rio|sinal|na pr[aá]tica|eu faço|eu troquei|eu parei|eu comecei)\b/i;
const WINNING_SCRIPT_DIMENSION_WEIGHTS: Record<ScriptCategoryDimension, number> = {
  proposal: 1.3,
  context: 1.15,
  format: 0.4,
  tone: 0.85,
  references: 0.55,
};
const SIMILARITY_STOPWORDS = new Set([
  "como",
  "com",
  "para",
  "pra",
  "roteiro",
  "sobre",
  "esse",
  "essa",
  "isso",
  "mais",
  "meu",
  "minha",
  "perfil",
  "criar",
  "gere",
  "crie",
  "quero",
  "fazer",
  "deixar",
  "melhor",
  "melhore",
  "ajuste",
  "novo",
  "real",
  "pratico",
  "prática",
]);

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

function compactExampleText(value: string, max = 140): string {
  const normalized = String(value || "").replace(/\s+/g, " ").replace(/^"+|"+$/g, "").trim();
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1).trim()}…` : normalized;
}

function resolveCategoryLabelForEditorial(
  dimension: ScriptCategoryDimension,
  id: string | undefined
): string {
  const normalized = String(id || "").trim();
  if (!normalized) return "";
  const category = getCategoryById(normalized, DIMENSION_CATEGORY_TYPES[dimension]);
  if (category?.label) return category.label;
  return normalized.replace(/_/g, " ");
}

function buildEditorialSubjectLabel(params: {
  prompt: string;
  intent: ScriptNarrativeIntent;
  resolvedCategories: ScriptCategorySelection;
}): string {
  const subjectHint = compactExampleText(params.intent.subjectHint || "", 90);
  if (subjectHint) return subjectHint;

  const proposal = resolveCategoryLabelForEditorial("proposal", params.resolvedCategories.proposal);
  const context = resolveCategoryLabelForEditorial("context", params.resolvedCategories.context);
  if (proposal && context && context !== "general") return `${proposal} em ${context}`;
  if (proposal) return proposal;

  return compactExampleText(params.prompt, 90) || "o tema principal do pedido";
}

function inferNarrativeAngle(params: {
  intent: ScriptNarrativeIntent;
  resolvedCategories: ScriptCategorySelection;
  winningScriptExamples: ScriptIntelligenceWinningScriptExample[];
}): string {
  const topWinner = params.winningScriptExamples[0];
  const opening = String(topWinner?.opening || "").toLowerCase();
  const development = String(topWinner?.development || "").toLowerCase();

  if (params.intent.wantsHumor || params.resolvedCategories.tone === "humorous") {
    return "cena reconhecível com humor observacional e fechamento em pergunta";
  }
  if (/(eu parei|eu comecei|confesso|foi quando)/i.test(opening)) {
    return "confissão prática com virada observável";
  }
  if (/(erro|por que|nao|não|trava|derruba|problema)/i.test(opening)) {
    return "diagnóstico direto do erro antes da dica";
  }
  if (WINNING_SCRIPT_PRACTICAL_REGEX.test(development)) {
    return "ajuste prático mostrado na cena, não explicado de forma abstrata";
  }
  return "gancho direto com contexto real e ajuste aplicável";
}

function inferRecommendedStructure(params: {
  intent: ScriptNarrativeIntent;
  resolvedCategories: ScriptCategorySelection;
}): string {
  if (params.intent.wantsHumor || params.resolvedCategories.tone === "humorous") {
    return "cena reconhecível -> exagero/controlado -> virada útil -> pergunta final";
  }
  if (params.resolvedCategories.proposal === "tips" || params.resolvedCategories.tone === "educational") {
    return "erro visível -> contexto observável -> ajuste aplicável -> pergunta específica no fechamento";
  }
  return "gancho claro -> tensão real -> movimento útil -> fechamento conversacional";
}

function buildEditorialDecision(params: {
  prompt: string;
  intent: ScriptNarrativeIntent;
  resolvedCategories: ScriptCategorySelection;
  dnaProfile: CreatorDnaProfile;
  captionEvidence: ScriptIntelligenceCaptionEvidence[];
  winningScriptExamples: ScriptIntelligenceWinningScriptExample[];
  engagementTiming: ScriptEngagementTimingInsight | null;
  linkedOutcome: ScriptIntelligenceLinkedOutcome | null | undefined;
}): ScriptEditorialDecision {
  const subject = buildEditorialSubjectLabel({
    prompt: params.prompt,
    intent: params.intent,
    resolvedCategories: params.resolvedCategories,
  });
  const proposal = resolveCategoryLabelForEditorial("proposal", params.resolvedCategories.proposal);
  const context = resolveCategoryLabelForEditorial("context", params.resolvedCategories.context);
  const tone = resolveCategoryLabelForEditorial("tone", params.resolvedCategories.tone);
  const topWinner = params.winningScriptExamples[0];
  const topLinkedProposal = params.linkedOutcome?.topByDimension?.proposal?.[0];
  const languageSignal = [
    ...(params.dnaProfile.openingPatterns || []).slice(0, 1),
    ...(params.dnaProfile.recurringExpressions || []).slice(0, 2),
  ]
    .map((item) => compactExampleText(item, 60))
    .filter(Boolean)
    .join(" | ");
  const narrativeAngle = inferNarrativeAngle({
    intent: params.intent,
    resolvedCategories: params.resolvedCategories,
    winningScriptExamples: params.winningScriptExamples,
  });
  const recommendedStructure = inferRecommendedStructure({
    intent: params.intent,
    resolvedCategories: params.resolvedCategories,
  });

  const postDirective =
    params.intent.wantsHumor || params.resolvedCategories.tone === "humorous"
      ? `Poste um reels sobre ${subject} em formato de cena observável, usando humor de situação e uma virada útil no final.`
      : `Poste um reels sobre ${subject} pelo ângulo de ${narrativeAngle}, deixando o erro claro antes do ajuste.`;

  const whyThisShouldWork = [
    [proposal, context, tone].filter(Boolean).length
      ? `No histórico recente, ${[proposal, context, tone].filter(Boolean).join(" + ")} aparece como combinação forte para esse tema.`
      : null,
    topWinner || topLinkedProposal
      ? `${params.winningScriptExamples.length || 0} roteiro(s) vencedor(es) próximo(s) repetem ${narrativeAngle}${topLinkedProposal ? ` e a proposal líder chega a lift ${topLinkedProposal.lift.toFixed(2)}` : ""}.`
      : null,
    languageSignal
      ? `As legendas fortes repetem sinais de linguagem como ${languageSignal}, o que ajuda esse vídeo a soar mais nativo no perfil.`
      : null,
    params.engagementTiming?.summary
      ? `Também existe recorrência temporal nos posts fortes: ${params.engagementTiming.summary}.`
      : null,
  ].filter(Boolean) as string[];

  const evidence = [
    [
      proposal ? `proposal ${proposal}` : null,
      context ? `context ${context}` : null,
      tone ? `tone ${tone}` : null,
    ]
      .filter(Boolean)
      .join(" | "),
    params.winningScriptExamples.length
      ? `${params.winningScriptExamples.length} roteiro(s) vencedor(es) próximo(s); principal exemplo: ${compactExampleText(topWinner?.title || "", 70)}.`
      : null,
    params.captionEvidence.length
      ? `${params.captionEvidence.length} legenda(s) forte(s) consideradas na leitura de DNA e linguagem.`
      : null,
    topLinkedProposal
      ? `Lift vinculado líder em proposal: ${topLinkedProposal.id} (${topLinkedProposal.lift.toFixed(2)}).`
      : null,
    params.engagementTiming?.summary ? `Timing observado: ${params.engagementTiming.summary}.` : null,
  ]
    .filter(Boolean)
    .map((line) => compactExampleText(line as string, 120));

  return {
    postDirective: compactExampleText(postDirective, 150),
    narrativeAngle: compactExampleText(narrativeAngle, 110),
    recommendedStructure: compactExampleText(recommendedStructure, 130),
    whyThisShouldWork: whyThisShouldWork.slice(0, 4).map((line) => compactExampleText(line, 150)),
    evidence: evidence.slice(0, 4),
    postingWindow: params.engagementTiming?.summary || null,
  };
}

function normalizeWeekdayLabel(value: string): string {
  return value.replace(/\.$/, "").toLowerCase();
}

function buildEngagementTimingInsight(
  samples: Array<Pick<ScriptIntelligenceCaptionEvidence, "postDate">>
): ScriptEngagementTimingInsight | null {
  const validDates = samples
    .map((item) => (item?.postDate ? new Date(item.postDate) : null))
    .filter((date): date is Date => date !== null && Number.isFinite(date.getTime()));
  if (validDates.length < 3) return null;

  const hourCounts = new Map<number, number>();
  const weekdayCounts = new Map<string, number>();

  for (const date of validDates) {
    const weekday = normalizeWeekdayLabel(WEEKDAY_FORMATTER.format(date));
    const hour = Number(HOUR_FORMATTER.format(date));
    if (weekday) weekdayCounts.set(weekday, (weekdayCounts.get(weekday) || 0) + 1);
    if (Number.isFinite(hour)) hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  const topHours = Array.from(hourCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 2)
    .map(([hour]) => hour);
  const topWeekdays = Array.from(weekdayCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([weekday]) => weekday);

  if (!topHours.length && !topWeekdays.length) return null;

  const hourLabel = topHours.map((hour) => `${String(hour).padStart(2, "0")}h`).join(" e ");
  const weekdayLabel = topWeekdays.join(" e ");
  const summary = [
    weekdayLabel ? `dias com mais recorrência: ${weekdayLabel}` : "",
    hourLabel ? `horários com mais recorrência: ${hourLabel}` : "",
  ]
    .filter(Boolean)
    .join(" | ");

  return {
    sampleSize: validDates.length,
    timezone: DEFAULT_ENGAGEMENT_TIMEZONE,
    topHours,
    topWeekdays,
    summary,
  };
}

function normalizeSimilarityText(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSimilarityTokens(value: string): string[] {
  return normalizeSimilarityText(value)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !SIMILARITY_STOPWORDS.has(token));
}

function computePromptTokenOverlap(queryTokens: string[], targetText: string): number {
  if (!queryTokens.length) return 0;
  const querySet = new Set(queryTokens);
  const targetSet = new Set(extractSimilarityTokens(targetText));
  if (!targetSet.size) return 0;
  let matches = 0;
  for (const token of querySet) {
    if (targetSet.has(token)) matches += 1;
  }
  return matches / Math.max(1, Math.min(querySet.size, 6));
}

function scoreWinningScriptExampleCandidate(params: {
  candidate: WinningScriptExampleCandidate;
  intent: ScriptNarrativeIntent;
  resolvedCategories: ScriptCategorySelection;
  explicitCategories: ScriptCategorySelection;
  promptTokens: string[];
}): number {
  let score = Math.max(0, Math.min(2.5, Number(params.candidate.lift || 0))) * 0.55;
  let categoryScore = 0;

  for (const dimension of SCRIPT_CATEGORY_DIMENSIONS) {
    const resolved = params.resolvedCategories[dimension];
    const candidateValue = params.candidate.categories?.[dimension];
    if (!resolved || !candidateValue || resolved !== candidateValue) continue;
    categoryScore += WINNING_SCRIPT_DIMENSION_WEIGHTS[dimension];
    if (params.explicitCategories[dimension] && params.explicitCategories[dimension] === candidateValue) {
      categoryScore += 0.35;
    }
  }
  score += categoryScore;

  const searchableText = [
    params.candidate.example.title,
    params.candidate.example.opening,
    params.candidate.example.development,
    params.candidate.example.cta,
    params.candidate.caption || "",
  ]
    .filter(Boolean)
    .join(" ");
  score += computePromptTokenOverlap(params.promptTokens, searchableText) * 2.2;

  if (params.intent.wantsHumor) {
    if (
      params.candidate.categories?.tone === "humorous" ||
      params.candidate.categories?.proposal === "humor_scene"
    ) {
      score += 0.6;
    }
  }

  if (params.intent.wantsEngagement && params.candidate.example.cta && WINNING_SCRIPT_CTA_REGEX.test(params.candidate.example.cta)) {
    score += 0.18;
  }

  if (params.candidate.example.development && WINNING_SCRIPT_PRACTICAL_REGEX.test(params.candidate.example.development)) {
    score += 0.4;
  }

  return roundScore(score);
}

export function selectWinningScriptExamplesForPrompt(params: {
  candidates: WinningScriptExampleCandidate[];
  prompt: string;
  intent: ScriptNarrativeIntent;
  resolvedCategories: ScriptCategorySelection;
  explicitCategories?: ScriptCategorySelection;
  limit?: number;
}): ScriptIntelligenceWinningScriptExample[] {
  if (!params.candidates.length) return [];

  const promptBasis = [
    params.intent.subjectHint || "",
    params.prompt || "",
  ]
    .filter(Boolean)
    .join(" ");
  const promptTokens = extractSimilarityTokens(promptBasis).slice(0, 8);
  const explicitCategories = params.explicitCategories || {};
  const limit = Math.max(1, Math.min(params.limit || 2, params.candidates.length));

  return [...params.candidates]
    .map((candidate) => ({
      candidate,
      score: scoreWinningScriptExampleCandidate({
        candidate,
        intent: params.intent,
        resolvedCategories: params.resolvedCategories,
        explicitCategories,
        promptTokens,
      }),
    }))
    .sort((a, b) => b.score - a.score || b.candidate.lift - a.candidate.lift)
    .slice(0, limit)
    .map((item) => item.candidate.example);
}

function extractScriptSpeechLines(content: string): string[] {
  const normalized = String(content || "").replace(/\r/g, "");
  if (!normalized.trim()) return [];

  const speeches: string[] = [];
  for (const rawLine of normalized.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const directMatch = line.match(/^fala(?:\s*\(literal\))?\s*:\s*(.+)$/i);
    if (directMatch?.[1]) {
      const speech = compactExampleText(directMatch[1], 180);
      if (speech) speeches.push(speech);
      continue;
    }

    if (!line.startsWith("|") || /^\|\s*tempo\s*\|/i.test(line)) continue;
    const cols = line
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!cols.length || cols.every((part) => /^:?-{2,}:?$/.test(part))) continue;

    const speech = cols.length >= 6 ? cols[4] : cols.length >= 4 ? cols[2] : "";
    const compacted = compactExampleText(speech ?? "", 180);
    if (compacted) speeches.push(compacted);
  }

  if (speeches.length) return speeches.slice(0, 8);

  return normalized
    .split(/\n\s*\n/g)
    .map((part) => compactExampleText(part, 180))
    .filter(Boolean)
    .slice(0, 4);
}

function buildWinningScriptExampleFromContent(params: {
  scriptId: string;
  title: string;
  content: string;
  lift: number;
  interactions: number;
  postDate: string | null;
  fallbackOpening?: string | null;
  fallbackCta?: string | null;
}): ScriptIntelligenceWinningScriptExample | null {
  const speechLines = extractScriptSpeechLines(params.content);
  const opening = compactExampleText(speechLines[0] || params.fallbackOpening || "", 120) || null;

  const ctaCandidate =
    speechLines.find((line) => WINNING_SCRIPT_CTA_REGEX.test(line)) ||
    speechLines[speechLines.length - 1] ||
    params.fallbackCta ||
    "";
  const cta = compactExampleText(ctaCandidate, 120) || null;

  const developmentCandidate =
    speechLines.find((line) => {
      const normalized = line.trim();
      if (!normalized) return false;
      if (opening && normalized === opening) return false;
      if (cta && normalized === cta) return false;
      return WINNING_SCRIPT_PRACTICAL_REGEX.test(normalized);
    }) ||
    speechLines[1] ||
    "";
  const development = compactExampleText(developmentCandidate, 120) || null;

  if (!opening && !development && !cta) return null;

  return {
    scriptId: params.scriptId,
    title: compactExampleText(params.title || "Roteiro de alta performance", 90) || "Roteiro de alta performance",
    opening,
    development,
    cta,
    lift: params.lift,
    interactions: params.interactions,
    postDate: params.postDate,
  };
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

async function fetchWinningScriptExamples(params: {
  userId: string;
  profile: ScriptOutcomeProfileSnapshot | null;
  prompt: string;
  intent: ScriptNarrativeIntent;
  resolvedCategories: ScriptCategorySelection;
  explicitCategories: ScriptCategorySelection;
}): Promise<ScriptIntelligenceWinningScriptExample[]> {
  if (!Types.ObjectId.isValid(params.userId)) return [];

  const profileExamples = Array.isArray(params.profile?.topExamples) ? params.profile.topExamples.slice(0, 5) : [];
  if (!profileExamples.length) return [];

  const now = Date.now();
  const resolved = new Map<string, ScriptIntelligenceWinningScriptExample | null>();
  const missingIds: string[] = [];

  for (const item of profileExamples) {
    const scriptId = String(item?.scriptId || "");
    if (!scriptId || !Types.ObjectId.isValid(scriptId)) continue;
    const cached = scriptExampleCache.get(scriptId);
    if (cached && cached.expiresAt > now) {
      resolved.set(scriptId, cached.value);
      continue;
    }
    missingIds.push(scriptId);
  }

  if (missingIds.length) {
    const docs = await ScriptEntry.find({
      userId: new Types.ObjectId(params.userId),
      _id: { $in: missingIds.map((id) => new Types.ObjectId(id)) },
    })
      .select("_id title content postedAt postedContent.totalInteractions")
      .lean()
      .exec();

    const docById = new Map<string, any>();
    for (const doc of docs || []) {
      docById.set(String(doc?._id || ""), doc);
    }

    for (const scriptId of missingIds) {
      const profileItem = profileExamples.find((item) => String(item?.scriptId || "") === scriptId);
      const doc = docById.get(scriptId);
      const built =
        doc && profileItem
          ? buildWinningScriptExampleFromContent({
              scriptId,
              title: typeof doc?.title === "string" ? doc.title : "",
              content: typeof doc?.content === "string" ? doc.content : "",
              lift: typeof profileItem?.lift === "number" ? profileItem.lift : 0,
              interactions:
                typeof doc?.postedContent?.totalInteractions === "number" &&
                Number.isFinite(doc.postedContent.totalInteractions)
                  ? doc.postedContent.totalInteractions
                  : typeof profileItem?.interactions === "number" && Number.isFinite(profileItem.interactions)
                    ? profileItem.interactions
                    : 0,
              postDate: profileItem?.postDate || null,
              fallbackOpening: profileItem?.hookSample || null,
              fallbackCta: profileItem?.ctaSample || null,
            })
          : null;

      scriptExampleCache.set(scriptId, {
        value: built,
        expiresAt: Date.now() + INTELLIGENCE_CACHE_TTL_MS,
      });
      resolved.set(scriptId, built);
    }

    pruneTimedCache(scriptExampleCache, SCRIPT_EXAMPLE_CACHE_MAX_ENTRIES);
  }

  const candidates = profileExamples
    .map((item) => {
      const built = resolved.get(String(item?.scriptId || "")) || null;
      if (!built) return null;
      return {
        example: built,
        categories: item.categories,
        caption: item.caption || "",
        lift: typeof item.lift === "number" ? item.lift : 0,
      } satisfies WinningScriptExampleCandidate;
    })
    .filter(Boolean) as WinningScriptExampleCandidate[];

  return selectWinningScriptExamplesForPrompt({
    candidates,
    prompt: params.prompt,
    intent: params.intent,
    resolvedCategories: params.resolvedCategories,
    explicitCategories: params.explicitCategories,
    limit: 2,
  });
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
    const scriptExamplesStartMs = Date.now();
    const winningScriptExamples = linkedOutcomeData.enabled
      ? await fetchWinningScriptExamples({
          userId: params.userId,
          profile: linkedOutcomeData.profile,
          prompt: params.prompt,
          intent: parsed.intent,
          resolvedCategories,
          explicitCategories: parsed.explicitCategories,
        })
      : [];
    recordScriptsStageDuration("intelligence.script_examples", Date.now() - scriptExamplesStartMs);
    const engagementTiming = buildEngagementTimingInsight(finalCaptionEvidence);
    const linkedOutcome: ScriptIntelligenceLinkedOutcome | null = linkedOutcomeData.enabled
      ? {
          enabled: true,
          sampleSizeLinked: linkedOutcomeData.profile?.sampleSizeLinked || 0,
          confidence: linkedOutcomeData.profile?.confidence || "low",
          blendedApplied: linkedBlendApplied,
          topByDimension: blendedRanking.topByDimension,
          topExamples: (linkedOutcomeData.profile?.topExamples || []).slice(0, 4).map((item) => ({
            metricId: item.metricId,
            scriptId: item.scriptId || null,
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
    const editorialDecision = buildEditorialDecision({
      prompt: params.prompt,
      intent: parsed.intent,
      resolvedCategories,
      dnaProfile,
      captionEvidence: finalCaptionEvidence,
      winningScriptExamples,
      engagementTiming,
      linkedOutcome,
    });

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
      winningScriptExamples,
      engagementTiming,
      editorialDecision,
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
    engagementTimingSummary: context.engagementTiming,
    editorialDecisionSummary: context.editorialDecision,
    styleSignalsUsed: context.styleProfile?.styleSignalsUsed,
    dnaEvidence: {
      sampleSize,
      hasEnoughEvidence: context.dnaProfile.hasEnoughEvidence,
      metricIds: context.captionEvidence.map((item) => item.metricId),
      avgInteractions,
      relaxationLevel: context.relaxationLevel,
      usedFallbackRules: context.usedFallbackRules,
    },
    winningScriptExamplesSummary: (context.winningScriptExamples || []).length
      ? {
          count: (context.winningScriptExamples || []).length,
          scriptIds: (context.winningScriptExamples || []).map((item) => item.scriptId),
        }
      : undefined,
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
