import {
  Category,
  contextCategories,
  formatCategories,
  getCategoryByValue,
  proposalCategories,
  referenceCategories,
  toneCategories,
} from "@/app/lib/classification";

export const SCRIPT_CATEGORY_DIMENSIONS = ["proposal", "context", "format", "tone", "references"] as const;

export type ScriptCategoryDimension = (typeof SCRIPT_CATEGORY_DIMENSIONS)[number];

export type ScriptCategorySelection = Partial<Record<ScriptCategoryDimension, string>>;

export type ScriptPromptMode = "open" | "partial" | "full";

export type ScriptNarrativeIntent = {
  wantsHumor: boolean;
  wantsEngagement: boolean;
  subjectHint: string | null;
};

type FlatCategory = {
  id: string;
  label: string;
};

type DimClassificationType = "proposal" | "context" | "format" | "tone" | "reference";

const HUMOR_REGEX = /(humor|com[eé]dia|engra[cç]|piada|c[oô]mico|sketch|esquete|par[oó]dia)/i;
const ENGAGEMENT_REGEX =
  /(engaja|engajar|engajamento|engage|viral|viralizar|alcance|coment[áa]rio|compartilha|salvamento)/i;

function flattenCategories(list: Category[]): FlatCategory[] {
  const output: FlatCategory[] = [];
  const stack = [...list];
  while (stack.length) {
    const item = stack.shift();
    if (!item) continue;
    output.push({ id: item.id, label: item.label });
    if (Array.isArray(item.subcategories) && item.subcategories.length > 0) {
      stack.push(...item.subcategories);
    }
  }
  return output;
}

const CATEGORY_MAP: Record<ScriptCategoryDimension, { type: DimClassificationType; items: FlatCategory[] }> = {
  proposal: { type: "proposal", items: flattenCategories(proposalCategories) },
  context: { type: "context", items: flattenCategories(contextCategories) },
  format: { type: "format", items: flattenCategories(formatCategories) },
  tone: { type: "tone", items: flattenCategories(toneCategories) },
  references: { type: "reference", items: flattenCategories(referenceCategories) },
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}+/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_\s-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findTermIndex(textNormalized: string, termNormalized: string): number {
  if (!termNormalized || termNormalized.length < 3) return -1;
  const regex = new RegExp(`(^|\\s)${escapeRegex(termNormalized)}(?=$|\\s)`, "i");
  const match = textNormalized.match(regex);
  return typeof match?.index === "number" ? match.index : -1;
}

function normalizeCategoryInput(category: FlatCategory): string[] {
  const idNorm = normalizeText(category.id.replace(/_/g, " "));
  const labelNorm = normalizeText(category.label);
  const tokenCandidates = [...idNorm.split(" "), ...labelNorm.split(" ")].filter(
    (item) => item.length >= 6
  );
  const terms = [idNorm, labelNorm, ...tokenCandidates].filter((item) => item.length >= 3);
  return Array.from(new Set(terms));
}

function resolveCategory(value: string, type: DimClassificationType): string | null {
  const resolved = getCategoryByValue(value, type);
  return resolved?.id || null;
}

function pickCategoryForDimension(
  promptNormalized: string,
  dimension: ScriptCategoryDimension,
): string | null {
  const { items, type } = CATEGORY_MAP[dimension];
  let winner: { id: string; index: number; weight: number } | null = null;

  for (const item of items) {
    const terms = normalizeCategoryInput(item);
    for (const term of terms) {
      const index = findTermIndex(promptNormalized, term);
      if (index < 0) continue;
      const resolved = resolveCategory(item.id, type);
      if (!resolved) continue;
      const weight = term.length;
      if (!winner || index < winner.index || (index === winner.index && weight > winner.weight)) {
        winner = { id: resolved, index, weight };
      }
    }
  }

  return winner?.id || null;
}

function extractSubjectHint(prompt: string): string | null {
  const normalized = prompt.trim();
  if (!normalized) return null;

  const match = normalized.match(/(?:sobre|tema|assunto)\s+(.{4,120})/i);
  if (match?.[1]) {
    return match[1].replace(/[.,;:!?]+$/g, "").trim();
  }

  return null;
}

export function extractExplicitCategories(prompt: string): ScriptCategorySelection {
  const promptNormalized = normalizeText(prompt);
  if (!promptNormalized) return {};

  const selection: ScriptCategorySelection = {};
  for (const dimension of SCRIPT_CATEGORY_DIMENSIONS) {
    const resolved = pickCategoryForDimension(promptNormalized, dimension);
    if (resolved) {
      selection[dimension] = resolved;
    }
  }

  return selection;
}

export function detectNarrativeIntent(prompt: string): ScriptNarrativeIntent {
  const normalized = prompt || "";
  return {
    wantsHumor: HUMOR_REGEX.test(normalized),
    wantsEngagement: ENGAGEMENT_REGEX.test(normalized),
    subjectHint: extractSubjectHint(normalized),
  };
}

export function detectPromptMode(explicitCategories: ScriptCategorySelection): ScriptPromptMode {
  let count = 0;
  for (const dim of SCRIPT_CATEGORY_DIMENSIONS) {
    if (explicitCategories[dim]) count += 1;
  }

  if (count === 0) return "open";
  if (count === SCRIPT_CATEGORY_DIMENSIONS.length) return "full";
  return "partial";
}

export function parsePromptForScriptIntelligence(prompt: string): {
  explicitCategories: ScriptCategorySelection;
  promptMode: ScriptPromptMode;
  intent: ScriptNarrativeIntent;
} {
  const explicitCategories = extractExplicitCategories(prompt);
  return {
    explicitCategories,
    promptMode: detectPromptMode(explicitCategories),
    intent: detectNarrativeIntent(prompt),
  };
}
