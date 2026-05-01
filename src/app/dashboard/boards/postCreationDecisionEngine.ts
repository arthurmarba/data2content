import type { PlannerUISlot } from "@/hooks/usePlannerData";
import { getCategoryByValue, type CategoryType } from "@/app/lib/classification";
import type { PlannerEvidencePost } from "@/types/planner";

import type {
  PostCreationDecisionOption,
  PostCreationDecisionState,
  PostCreationDecisionStep,
  PostCreationIdeaVariant,
} from "./postCreationFunnel";
import { buildPautaPhraseFromPlannerSlot } from "./postCreationPautaPresentation";

export type PostCreationDecisionCheckpoint = {
  step: PostCreationDecisionStep;
  label: string;
  selectedId: string | null;
  recommendedId: string | null;
  options: PostCreationDecisionOption[];
};

export type PostCreationIdeaCandidate = {
  variant: PostCreationIdeaVariant;
  slot: PlannerUISlot;
  decision: PostCreationDecisionState;
};

export type PostCreationOutcomeSignal = {
  slotId?: string | null;
  title?: string | null;
  isPosted?: boolean;
  isLinked?: boolean;
  engagement?: number | null;
  totalInteractions?: number | null;
};

export type PostCreationPreferenceSignals = {
  stepPreferences?: Partial<
    Record<
      PostCreationDecisionStep,
      Array<{
        optionId: string;
        count: number;
        recommendedRate?: number | null;
      }>
    >
  >;
  stepRules?: Partial<
    Record<
      PostCreationDecisionStep,
      Array<{
        optionId: string;
        mode: "promote" | "degrade";
        strength: number;
      }>
    >
  >;
  lanePreferences?: Array<{
    lane: PostCreationIdeaVariant["lane"];
    count: number;
    avgConfidence?: number | null;
    recommendedRate?: number | null;
  }>;
  laneRules?: Array<{
    lane: PostCreationIdeaVariant["lane"];
    mode: "promote" | "degrade";
    strength: number;
  }>;
  pathPreferences?: Array<{
    pathKey: string;
    count: number;
    avgConfidence?: number | null;
    recommendedRate?: number | null;
  }>;
  pathRules?: Array<{
    pathKey: string;
    mode: "promote" | "degrade";
    strength: number;
  }>;
};

type DecisionSourceType = "slot" | "recommendation";

type DecisionSourceSlot = {
  slot: PlannerUISlot;
  source: DecisionSourceType;
};

type OptionAggregate = {
  id: string;
  label: string;
  score: number;
  preferenceBonus: number;
  bestScore: number;
  count: number;
  totalExpectedInteractions: number;
  bestEntry: DecisionSourceSlot;
  sourceSignals: string[];
  evidenceSnippets: string[];
  evidencePosts: PlannerEvidencePost[];
  evidenceCount: number;
};

function hasEvidenceThumb(post: PlannerEvidencePost): boolean {
  return typeof post.coverUrl === "string" && post.coverUrl.trim().length > 0;
}

const TARGET_DECISION_OPTIONS = 5;
const TARGET_IDEA_CANDIDATES = 5;

type DecisionOptionListResult = {
  options: PostCreationDecisionOption[];
  recommendedId: string | null;
  selectedId: string | null;
};

function mergeEvidencePosts(
  current: PlannerEvidencePost[],
  incoming: PlannerEvidencePost[] | undefined,
  limit = 12
) {
  if (!incoming?.length) return current;
  const map = new Map<string, PlannerEvidencePost>();
  for (const item of current) {
    map.set(item.id, item);
  }
  for (const item of incoming) {
    if (!item?.id || map.has(item.id)) continue;
    map.set(item.id, item);
  }
  return Array.from(map.values())
    .sort((left, right) => (right.totalInteractions || 0) - (left.totalInteractions || 0))
    .slice(0, limit);
}

function prioritizeCandidatesWithEvidence(
  candidates: OptionAggregate[],
  step: PostCreationDecisionStep
): OptionAggregate[] {
  if (step === "pauta") return candidates;

  const withThumbs: OptionAggregate[] = [];
  const withoutThumbs: OptionAggregate[] = [];

  for (const option of candidates) {
    if (option.evidencePosts.some(hasEvidenceThumb)) {
      withThumbs.push(option);
    } else {
      withoutThumbs.push(option);
    }
  }

  return [...withThumbs, ...withoutThumbs];
}

export type PostCreationDecisionEngineResult = {
  decision: PostCreationDecisionState;
  checkpoints: PostCreationDecisionCheckpoint[];
  ideaCandidates: PostCreationIdeaCandidate[];
};

type StepConfig = {
  step: PostCreationDecisionStep;
  label: string;
  dependencies: PostCreationDecisionStep[];
  optional?: boolean;
  showWhen?: (decision: PostCreationDecisionState) => boolean;
};

function getWindowId(slot: PlannerUISlot): string {
  return `${slot.dayOfWeek}-${slot.blockStartHour}`;
}

export function buildDecisionPathKey(decision: Partial<PostCreationDecisionState>): string {
  return [
    decision.contextId || "context",
    decision.proposalId || "proposal",
    decision.toneId || "tone",
    decision.referenceId || "reference",
    decision.intentId || "intent",
    decision.formatId || "format",
    decision.durationId || "duration",
    decision.narrativeId || "narrative",
    decision.dayId || "day",
    decision.hourId || "hour",
    decision.themeId || "theme",
    decision.pautaId || "pauta",
  ].join("|");
}

function getFlowStepIndex(step: PostCreationDecisionStep): number {
  return DECISION_STEP_FLOW.findIndex((item) => item.step === step);
}

function getDayLabel(dayOfWeek?: number): string {
  const labels = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
  if (typeof dayOfWeek !== "number" || dayOfWeek < 0) return "Dia";
  const label = dayOfWeek === 7 ? labels[0] : labels[dayOfWeek];
  return (typeof label === "string" ? label : "Dia");
}

function getBlockLabel(hour?: number): string {
  if (typeof hour !== "number" || hour < 0) return "Horário";
  return `${String(hour).padStart(2, "0")}h`;
}

function formatPlannerFormatLabel(format?: string) {
  if (!format) return "Formato";
  const registeredLabel = format ? getCategoryByValue(format, "format")?.label : null;
  if (registeredLabel) return registeredLabel;
  const normalized = format.toLowerCase();
  if (normalized === "reel") return "Reel";
  if (normalized === "carousel") return "Carrossel";
  if (normalized === "story") return "Stories";
  return format;
}

const DECISION_LABEL_MAP: Partial<Record<PostCreationDecisionStep, Record<string, string>>> = {
  proposal: {
    diagnostico: "Diagnóstico",
    framework: "Framework",
    checklist: "Checklist",
    comparacao: "Comparação",
    opiniao: "Opinião",
    autoridade: "Autoridade",
  },
  context: {
    retencao: "Retenção",
    planejamento: "Planejamento",
    comunidade: "Comunidade",
    vendas: "Vendas",
    rotina: "Rotina",
    posicionamento: "Posicionamento",
  },
};

function formatCategoryLabel(
  value?: string | null,
  type?: Extract<CategoryType, "proposal" | "context" | "tone" | "format" | "reference">
) {
  if (!value) return "Item";
  if (type) {
    const registeredLabel = value ? getCategoryByValue(value, type)?.label : null;
    if (registeredLabel) return registeredLabel;
  }
  return value
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function compactDecisionLabel(
  value?: string | null,
  maxChars = 20,
  type?: Extract<CategoryType, "proposal" | "context" | "tone" | "format" | "reference">
): string {
  const normalized = formatCategoryLabel(value, type);
  if (normalized.length <= maxChars) return normalized;
  const sliced = normalized.slice(0, maxChars).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > Math.floor(maxChars * 0.55) ? sliced.slice(0, lastSpace) : sliced).trimEnd()}...`;
}

function formatDecisionLabel(step: Extract<PostCreationDecisionStep, "proposal" | "context">, value?: string | null) {
  const registeredLabel = value ? getCategoryByValue(value, step)?.label : null;
  if (registeredLabel) return registeredLabel;
  const normalizedKey = normalizeLabel(value);
  const mapped = normalizedKey ? (DECISION_LABEL_MAP as any)[step]?.[normalizedKey] : null;
  if (mapped) return mapped;
  return compactDecisionLabel(value, step === "context" ? 22 : 18, step);
}

function inferNarrativeLabel(slot?: PlannerUISlot | null) {
  const narrative = slot?.narrativeForm?.[0];
  if (narrative) return compactDecisionLabel(narrative, 24);
  if (slot?.scriptShort && /erro|ajuste|prova/i.test(slot.scriptShort)) {
    return "Erro -> ajuste -> prova";
  }
  if (slot?.scriptShort && /bastidor|rotina/i.test(slot.scriptShort)) {
    return "Bastidor -> ajuste -> conversa";
  }
  return "Erro -> ajuste -> prova";
}

function inferToneId(slot?: PlannerUISlot | null): string {
  const proposal = slot?.categories?.proposal?.[0] || "";
  const normalizedProposal = normalizeLabel(proposal);
  if (/tips|framework|comparison|review|news|positioning authority/.test(normalizedProposal)) {
    return "educational";
  }
  if (/announcement|call to action|publi divulgation|giveaway/.test(normalizedProposal)) {
    return "promotional";
  }
  if (/humor|trend|react/.test(normalizedProposal)) {
    return "humorous";
  }
  if (/message motivational/.test(normalizedProposal)) {
    return "inspirational";
  }
  return "neutral";
}

function inferIntentId(slot?: PlannerUISlot | null): string | null {
  const proposal = normalizeLabel(slot?.categories?.proposal?.[0] || null);
  if (!proposal) return null;
  if (/tips|framework|comparison|review|news|q a/.test(proposal)) return "educar";
  if (/announcement|call to action|publi divulgation|giveaway/.test(proposal)) return "converter";
  if (/behind the scenes|lifestyle|participation|unboxing/.test(proposal)) return "conectar";
  if (/humor|trend|react/.test(proposal)) return "entreter";
  return "engajar";
}

function getNarrativeId(slot: PlannerUISlot): string {
  return slot.narrativeForm?.[0] || inferNarrativeLabel(slot);
}

function getSlotDecisionPathKey(slot: PlannerUISlot): string {
  return buildDecisionPathKey({
    contextId: getContextId(slot),
    proposalId: getProposalId(slot),
    toneId: getToneId(slot),
    referenceId: getReferenceId(slot),
    intentId: getIntentId(slot),
    formatId: getFormatId(slot),
    durationId: getDurationId(slot),
    narrativeId: getNarrativeId(slot),
    dayId: String(slot.dayOfWeek ?? "day"),
    hourId: String(slot.blockStartHour ?? "hour"),
    themeId: getThemeId(slot),
  });
}

function getEntryIdentity(slot: PlannerUISlot, source: DecisionSourceType): string {
  if (slot.slotId) return slot.slotId;
  return `${getSlotDecisionPathKey(slot)}|${source}`;
}

function getSlotScore(slot: PlannerUISlot): number {
  const viewsP90 = slot.expectedMetrics?.viewsP90 || 0;
  const viewsP50 = slot.expectedMetrics?.viewsP50 || 0;
  const sharesP50 = slot.expectedMetrics?.sharesP50 || 0;
  const savedBonus = slot.isSaved ? 500 : 0;
  const plannedBonus = slot.status === "planned" || slot.status === "drafted" ? 250 : 0;
  return viewsP90 * 0.55 + viewsP50 * 0.35 + sharesP50 * 8 + savedBonus + plannedBonus;
}

function getEntryScore(entry: DecisionSourceSlot): number {
  const sourceBonus = entry.source === "recommendation" ? 450 : 0;
  const aiBonus = entry.slot.aiVersionId ? 220 : 0;
  return getSlotScore(entry.slot) + sourceBonus + aiBonus;
}

export function estimatePlannerSlotInteractions(
  slot: PlannerUISlot,
  outcomeSignals: PostCreationOutcomeSignal[]
): number | null {
  const matchedSignal = findMatchingOutcomeSignal(slot, outcomeSignals);

  if (
    matchedSignal &&
    typeof matchedSignal.totalInteractions === "number" &&
    Number.isFinite(matchedSignal.totalInteractions) &&
    matchedSignal.totalInteractions > 0
  ) {
    return Math.round(matchedSignal.totalInteractions);
  }

  const viewsP50 = slot.expectedMetrics?.viewsP50 || 0;
  const sharesP50 = slot.expectedMetrics?.sharesP50 || 0;
  
  if (viewsP50 || sharesP50) {
    const estimated = viewsP50 * 0.045 + sharesP50 * 10;
    if (estimated > 0) return Math.round(estimated);
  }

  // Baseline fallbacks if no metrics are present
  const format = (slot.format || "").toLowerCase();
  if (format === "reel") return 1250;
  if (format === "carousel") return 850;
  if (format === "story") return 450;
  
  return 600;
}

function normalizeLabel(value?: string | null): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeIntentId(value?: string | null): string | null {
  const normalized = normalizeLabel(value).replace(/\s+/g, "_");
  if (!normalized) return null;
  if (normalized === "teach" || normalized === "ensinar") return "educar";
  if (normalized === "convert") return "converter";
  if (normalized === "connect") return "conectar";
  if (normalized === "entertain") return "entreter";
  if (normalized === "engage") return "engajar";
  return normalized;
}

function compactThemeLabel(value?: string | null): string {
  const normalized = (value || "").replace(/\s+/g, " ").trim();
  if (!normalized) return "Tema";
  if (normalized.length <= 28) return normalized;
  const sliced = normalized.slice(0, 28).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 14 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}...`;
}

function compactIdeaTitle(value?: string | null, fallback?: string | null): string {
  const primary = (value || "").replace(/\s+/g, " ").trim();
  const secondary = (fallback || "").replace(/\s+/g, " ").trim();
  const source = primary || secondary;
  if (!source) return "Pauta recomendada";

  const firstClause = source.split(/[:\-|]/)[0]?.trim() || source;
  if (firstClause.length <= 44) return firstClause;
  if (secondary && secondary.length <= 44) return secondary;
  if (source.length <= 44) return source;

  const sliced = source.slice(0, 44).trimEnd();
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 18 ? sliced.slice(0, lastSpace) : sliced).trimEnd()}...`;
}

function getProposalId(slot: PlannerUISlot): string {
  return slot.categories?.proposal?.[0] || "proposal";
}

function getContextId(slot: PlannerUISlot): string {
  return slot.categories?.context?.[0] || "context";
}

function getToneId(slot: PlannerUISlot): string {
  return slot.categories?.tone || inferToneId(slot);
}

function getReferenceId(slot: PlannerUISlot): string | null {
  return slot.categories?.reference?.[0] || null;
}

function getIntentId(slot: PlannerUISlot): string | null {
  return normalizeIntentId(slot.contentIntent?.[0]) || inferIntentId(slot);
}

function getThemeId(slot: PlannerUISlot): string {
  return normalizeLabel(slot.themeKeyword || slot.themes?.[0] || slot.title || null) || "theme";
}

function getFormatId(slot: PlannerUISlot): string {
  return slot.format || "format";
}

function getDurationId(slot: PlannerUISlot): string {
  const seconds = typeof slot.recordingTimeSec === "number" && slot.recordingTimeSec > 0 ? slot.recordingTimeSec : null;
  if (seconds !== null) {
    if (seconds <= 15) return "< 15s";
    if (seconds <= 30) return "15-30s";
    if (seconds <= 60) return "30-60s";
    return "60s+";
  }
  if (slot.format === "story") return "15-30s";
  if (slot.format === "reel") return "15-30s";
  if (slot.format === "long_video") return "60s+";
  return "30-60s";
}

function getThemeLabel(slot: PlannerUISlot): string {
  return compactThemeLabel(slot.themeKeyword || slot.themes?.[0] || slot.title || "Tema");
}

function getThemeEvidenceSnippet(slot: PlannerUISlot): string | null {
  const themeKey = normalizeLabel(slot.themeKeyword || slot.themes?.[0] || slot.title || null);
  const candidates = [...(slot.themes || []), slot.title, slot.scriptShort, slot.rationale];

  for (const candidate of candidates) {
    const normalized = (candidate || "").replace(/\s+/g, " ").trim();
    if (!normalized) continue;
    const firstClause = normalized.split(/[.!?]/)[0]?.trim() || normalized;
    if (!firstClause) continue;
    if (themeKey && normalizeLabel(firstClause) === themeKey) continue;
    return compactThemeLabel(firstClause);
  }

  return null;
}

function getThemeEvidenceSnippets(slot: PlannerUISlot): string[] {
  const themeKey = normalizeLabel(slot.themeKeyword || slot.themes?.[0] || slot.title || null);
  const candidates = [...(slot.themes || []), slot.title, slot.scriptShort, slot.rationale]
    .map((entry) => (entry || "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const snippets: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const firstClause = candidate.split(/[.!?]/)[0]?.trim() || candidate;
    if (!firstClause) continue;
    const normalizedClause = normalizeLabel(firstClause);
    if (!normalizedClause || normalizedClause === themeKey || seen.has(normalizedClause)) continue;
    seen.add(normalizedClause);
    snippets.push(compactThemeLabel(firstClause));
    if (snippets.length >= 2) break;
  }

  return snippets;
}

function getReferenceLabel(slot: PlannerUISlot): string | null {
  const referenceId = getReferenceId(slot);
  return referenceId ? compactDecisionLabel(referenceId, 24, "reference") : null;
}

function getIntentLabel(slot: PlannerUISlot): string | null {
  const intentId = getIntentId(slot);
  return intentId ? compactDecisionLabel(intentId, 24) : null;
}

function getPatternKey(slot: PlannerUISlot): string {
  return [
    slot.format || "format",
    getProposalId(slot),
    getToneId(slot) || "tone",
    getNarrativeId(slot),
    getContextId(slot),
  ].join("|");
}

function getThemeKey(slot: PlannerUISlot): string {
  return normalizeLabel(slot.title || slot.themeKeyword || slot.themes?.[0] || null);
}

function findMatchingOutcomeSignal(
  slot: PlannerUISlot,
  outcomeSignals: PostCreationOutcomeSignal[]
): PostCreationOutcomeSignal | null {
  const slotId = slot.slotId?.trim() || "";
  if (!slotId) return null;
  return outcomeSignals.find((item) => (item.slotId?.trim() || "") === slotId) || null;
}

function buildPatternStats(entries: DecisionSourceSlot[]) {
  const patternCounts = new Map<string, number>();
  const themeCounts = new Map<string, number>();
  const contextCounts = new Map<string, number>();

  for (const entry of entries) {
    const patternKey = getPatternKey(entry.slot);
    patternCounts.set(patternKey, (patternCounts.get(patternKey) || 0) + 1);

    const themeKey = getThemeKey(entry.slot);
    if (themeKey) {
      themeCounts.set(themeKey, (themeCounts.get(themeKey) || 0) + 1);
    }

    const contextId = getContextId(entry.slot);
    contextCounts.set(contextId, (contextCounts.get(contextId) || 0) + 1);
  }

  return {
    patternCounts,
    themeCounts,
    contextCounts,
  };
}

function resolveOutcomeBonus(slot: PlannerUISlot, outcomeSignals: PostCreationOutcomeSignal[]): number {
  if (!outcomeSignals.length) return 0;
  const signal = findMatchingOutcomeSignal(slot, outcomeSignals);
  if (!signal) return 0;

  const interactions = signal.totalInteractions || 0;
  const engagement = signal.engagement || 0;
  const postedBonus = signal.isPosted ? 2500 : 0;
  const linkedBonus = signal.isLinked ? 1800 : 0;
  return postedBonus + linkedBonus + interactions * 0.12 + engagement * 2;
}

function resolveFreshnessBonus(
  entry: DecisionSourceSlot,
  patternStats: ReturnType<typeof buildPatternStats>
): number {
  const patternCount = patternStats.patternCounts.get(getPatternKey(entry.slot)) || 0;
  const contextCount = patternStats.contextCounts.get(getContextId(entry.slot)) || 0;
  const recommendationBonus = entry.source === "recommendation" ? 220 : 0;
  const experimentBonus = entry.slot.isExperiment ? 180 : 0;
  const underusedPatternBonus = patternCount <= 1 ? 320 : patternCount === 2 ? 120 : 0;
  const underusedContextBonus = contextCount <= 1 ? 140 : 0;
  return recommendationBonus + experimentBonus + underusedPatternBonus + underusedContextBonus;
}

function resolveSaturationPenalty(
  entry: DecisionSourceSlot,
  patternStats: ReturnType<typeof buildPatternStats>
): number {
  const patternCount = patternStats.patternCounts.get(getPatternKey(entry.slot)) || 0;
  const themeCount = patternStats.themeCounts.get(getThemeKey(entry.slot)) || 0;
  const patternPenalty = patternCount > 2 ? (patternCount - 2) * 220 : 0;
  const themePenalty = themeCount > 1 ? (themeCount - 1) * 260 : 0;
  return patternPenalty + themePenalty;
}

function getDayId(slot: PlannerUISlot): string {
  return String(slot.dayOfWeek ?? "day");
}

function getHourId(slot: PlannerUISlot): string {
  return String(slot.blockStartHour ?? "hour");
}

function getSlotOptionId(step: PostCreationDecisionStep, slot: PlannerUISlot): string | null {
  if (step === "pauta") return slot.slotId || "pauta";
  if (step === "context") return getContextId(slot);
  if (step === "proposal") return getProposalId(slot);
  if (step === "tone") return getToneId(slot);
  if (step === "reference") return getReferenceId(slot);
  if (step === "intent") return getIntentId(slot);
  if (step === "format") return getFormatId(slot);
  if (step === "duration") return getDurationId(slot);
  if (step === "day") return getDayId(slot);
  if (step === "hour") return getHourId(slot);
  if (step === "narrative") return getNarrativeId(slot);
  return getThemeId(slot);
}

function getSlotOptionLabel(step: PostCreationDecisionStep, slot: PlannerUISlot): string {
  if (step === "pauta") return buildPautaPhraseFromPlannerSlot(slot);
  if (step === "context") return formatDecisionLabel("context", slot.categories?.context?.[0] || null);
  if (step === "proposal") return formatDecisionLabel("proposal", slot.categories?.proposal?.[0] || null);
  if (step === "tone") return formatCategoryLabel(getToneId(slot), "tone");
  if (step === "reference") return getReferenceLabel(slot) || "Sem referência";
  if (step === "intent") return getIntentLabel(slot) || "Sem intenção";
  if (step === "format") return formatPlannerFormatLabel(slot.format);
  if (step === "duration") return getDurationId(slot);
  if (step === "day") return getDayLabel(slot.dayOfWeek);
  if (step === "hour") return getBlockLabel(slot.blockStartHour);
  if (step === "narrative") return compactDecisionLabel(getNarrativeId(slot), 26);
  return getThemeLabel(slot);
}

function getOptionSupportSummary(slot: PlannerUISlot, count: number): string {
  return count > 1 ? `Base em ${count} sinais parecidos.` : "Base curta, mas coerente com o histórico.";
}

function getSlotOptionReason(
  step: PostCreationDecisionStep,
  slot: PlannerUISlot,
  count: number,
  source: DecisionSourceType,
  evidenceSnippets: string[] = []
): string {
  const proposalLabel = formatDecisionLabel("proposal", slot.categories?.proposal?.[0] || null);
  const contextLabel = formatDecisionLabel("context", slot.categories?.context?.[0] || null);
  const formatLabel = formatPlannerFormatLabel(slot.format);
  const supportSummary = getOptionSupportSummary(slot, count);

  if (step === "context") {
    return `Contexto pilar para ancorar ${proposalLabel.toLowerCase()}. ${supportSummary}`;
  }
  if (step === "proposal") {
    return `${contextLabel} responde bem quando focamos em ${proposalLabel.toLowerCase()}. ${supportSummary}`;
  }
  if (step === "tone") {
    return `Tom que sustenta ${proposalLabel.toLowerCase()} dentro de ${contextLabel.toLowerCase()}. ${supportSummary}`;
  }
  if (step === "reference") {
    return `Referência que ajuda a contextualizar ${proposalLabel.toLowerCase()} sem perder clareza. ${supportSummary}`;
  }
  if (step === "intent") {
    return `Intenção dominante para orientar a resposta do público ao conteúdo. ${supportSummary}`;
  }
  if (step === "format") {
    return `Formato ${formatLabel.toLowerCase()} casa bem com a proposta de ${proposalLabel.toLowerCase()}. ${supportSummary}`;
  }
  if (step === "duration") {
    return `Tempo ideal de tela estimado para reter público no ${formatLabel.toLowerCase()}. ${supportSummary}`;
  }
  if (step === "narrative") {
    return `Estrutura de condução que costuma funcionar para esse recorte editorial. ${supportSummary}`;
  }
  if (step === "day") {
    const sourceLead = source === "recommendation" ? "Dia mapeado por IA para postagem." : "Bom potencial de entrega neste dia.";
    return `${sourceLead} ${supportSummary}`;
  }
  if (step === "hour") {
    const sourceLead = source === "recommendation" ? "Pico de audiência previsto por IA." : "Horário nobre para o seu perfil geral.";
    return `${sourceLead} ${supportSummary}`;
  }
  if (step === "theme") {
    const snippets = evidenceSnippets.length ? evidenceSnippets : (getThemeEvidenceSnippet(slot) ? [getThemeEvidenceSnippet(slot)!] : []);
    if (snippets.length >= 2) {
      return `Frases que puxam esse tema: "${snippets[0]}" e "${snippets[1]}".`;
    }
    if (snippets.length === 1) {
      return `Frase que puxa esse tema: "${snippets[0]}".`;
    }
    return count > 1
      ? "Tema reforçado por legendas e títulos parecidos desse recorte."
      : "Tema sugerido por uma legenda ou título recente desse recorte.";
  }
  return supportSummary;
}

function resolveOutcomeStateLabel(slot: PlannerUISlot, outcomeSignals: PostCreationOutcomeSignal[]): string | null {
  const signal = findMatchingOutcomeSignal(slot, outcomeSignals);
  if (!signal) return null;
  if (signal.isPosted) return "Já virou conteúdo";
  if (signal.isLinked) return "Já virou roteiro";
  return null;
}

function resolveSourceLabel(entry: DecisionSourceSlot): string | null {
  if (entry.slot.isSaved) return "Já salvo";
  if (entry.source === "recommendation") return "Boa aposta IA";
  if (entry.slot.status === "planned" || entry.slot.status === "drafted") return "Linha do planner";
  return "Padrão do perfil";
}

function buildIdeaEvidence(
  entry: DecisionSourceSlot,
  lane: PostCreationIdeaVariant["lane"],
  patternStats: ReturnType<typeof buildPatternStats>,
  outcomeSignals: PostCreationOutcomeSignal[]
): string[] {
  const contextLabel = formatCategoryLabel(entry.slot.categories?.context?.[0] || null, "context");
  const proposalLabel = formatDecisionLabel("proposal", entry.slot.categories?.proposal?.[0] || null);
  const toneLabel = formatCategoryLabel(getToneId(entry.slot), "tone");
  const referenceLabel = getReferenceLabel(entry.slot);
  const intentLabel = getIntentLabel(entry.slot);
  const compactContextLabel = formatDecisionLabel("context", entry.slot.categories?.context?.[0] || null);
  const formatLabel = formatPlannerFormatLabel(entry.slot.format);
  const windowLabel = `${getDayLabel(entry.slot.dayOfWeek)}, ${getBlockLabel(entry.slot.blockStartHour)}`;
  const sourceLabel = resolveSourceLabel(entry);
  const outcomeLabel = resolveOutcomeStateLabel(entry.slot, outcomeSignals);
  const patternCount = patternStats.patternCounts.get(getPatternKey(entry.slot)) || 0;
  const freshnessLabel =
    lane === "bold" || entry.slot.isExperiment
      ? "Mais fresco"
      : patternCount > 2
        ? "Linha recorrente"
        : "Boa repetição";

  return [
    windowLabel,
    formatLabel,
    toneLabel !== "Item" ? toneLabel : null,
    referenceLabel,
    intentLabel,
    compactContextLabel && proposalLabel !== "Item"
      ? `${proposalLabel} em ${compactContextLabel}`
      : proposalLabel,
    outcomeLabel || sourceLabel,
    freshnessLabel,
  ].filter(Boolean) as string[];
}

function resolvePreferenceBonus(
  step: PostCreationDecisionStep,
  optionId: string,
  preferenceSignals?: PostCreationPreferenceSignals
): number {
  const entries = preferenceSignals?.stepPreferences?.[step] || [];
  const preference = entries.find((item) => item.optionId === optionId);
  if (!preference) return 0;
  const usageBonus = Math.min(20, Math.max(0, preference.count || 0)) * 720;
  const acceptance = preference.recommendedRate || 0;
  const acceptanceBonus = acceptance >= 0.5 ? (acceptance - 0.5) * 2400 : (acceptance - 0.5) * 900;
  const explicitRule = preferenceSignals?.stepRules?.[step]?.find((item) => item.optionId === optionId);
  const explicitRuleBonus =
    explicitRule?.mode === "promote"
      ? explicitRule.strength * 3200
      : explicitRule?.mode === "degrade"
        ? -explicitRule.strength * 3200
        : 0;
  return usageBonus + acceptanceBonus + explicitRuleBonus;
}

function matchDecision(slot: PlannerUISlot, decision: Partial<PostCreationDecisionState>): number {
  let score = 0;
  if (decision.contextId && getContextId(slot) === decision.contextId) score += 1;
  if (decision.proposalId && getProposalId(slot) === decision.proposalId) score += 1;
  if (decision.toneId && getToneId(slot) === decision.toneId) score += 0.8;
  if (decision.referenceId && getReferenceId(slot) === decision.referenceId) score += 0.6;
  if (decision.intentId && getIntentId(slot) === decision.intentId) score += 0.7;
  if (decision.formatId && getFormatId(slot) === decision.formatId) score += 1;
  if (decision.durationId && getDurationId(slot) === decision.durationId) score += 0.5;
  if (decision.narrativeId && getNarrativeId(slot) === decision.narrativeId) score += 0.5;
  if (decision.dayId && getDayId(slot) === decision.dayId) score += 1;
  if (decision.hourId && getHourId(slot) === decision.hourId) score += 1;
  if (decision.themeId && getThemeId(slot) === decision.themeId) score += 1;
  return score;
}

function buildOptionList(
  entries: DecisionSourceSlot[],
  step: PostCreationDecisionStep,
  currentId: string | null,
  preferenceSignals?: PostCreationPreferenceSignals,
  outcomeSignals: PostCreationOutcomeSignal[] = []
): DecisionOptionListResult {
  const grouped = new Map<string, OptionAggregate>();

  for (const entry of entries) {
    const slot = entry.slot;
    const id = getSlotOptionId(step, slot);
    if (!id) continue;
    const current = grouped.get(id);
    const nextScore = getEntryScore(entry);
    const expectedInteractions = estimatePlannerSlotInteractions(slot, outcomeSignals) || 0;
    const slotEvidencePosts = slot.evidencePosts || [];
    const slotEvidenceCount = Math.max(slot.evidenceCount || 0, slotEvidencePosts.length);
    if (!current) {
      const preferenceBonus = resolvePreferenceBonus(step, id, preferenceSignals);
      grouped.set(id, {
        id,
        label: getSlotOptionLabel(step, slot),
        score: nextScore,
        preferenceBonus,
        bestScore: nextScore,
        count: 1,
        totalExpectedInteractions: expectedInteractions,
        bestEntry: entry,
        sourceSignals: [slot.status, slot.format, getContextId(slot)].filter(Boolean),
        evidenceSnippets: step === "theme" ? getThemeEvidenceSnippets(slot) : [],
        evidencePosts: mergeEvidencePosts([], slotEvidencePosts),
        evidenceCount: slotEvidenceCount,
      });
      continue;
    }
    current.score += nextScore;
    current.count += 1;
    current.totalExpectedInteractions += expectedInteractions;
    current.sourceSignals = [...new Set([...current.sourceSignals, slot.status, slot.format, getContextId(slot)].filter(Boolean))];
    current.evidencePosts = mergeEvidencePosts(current.evidencePosts, slotEvidencePosts);
    current.evidenceCount = Math.max(current.evidenceCount, slotEvidenceCount, current.evidencePosts.length, current.count);
    if (step === "theme") {
      current.evidenceSnippets = [...new Set([...current.evidenceSnippets, ...getThemeEvidenceSnippets(slot)])].slice(0, 2);
    }
    if (nextScore > current.bestScore) {
      current.bestScore = nextScore;
      current.bestEntry = entry;
    }
  }

  const rankedCandidates = Array.from(grouped.values())
    .sort((a, b) => b.score + b.preferenceBonus - (a.score + a.preferenceBonus));
  const ranked = prioritizeCandidatesWithEvidence(rankedCandidates, step).slice(0, TARGET_DECISION_OPTIONS);
  const topScore = ranked[0] ? ranked[0].score + ranked[0].preferenceBonus : 1;
  const recommendedId = ranked[0]?.id || null;
  const selectedId = currentId && ranked.some((option) => option.id === currentId) ? currentId : recommendedId;

  return {
    recommendedId,
    selectedId,
    options: ranked.map((option) => ({
      id: option.id,
      label: option.label,
      shortReason: getSlotOptionReason(
        step,
        option.bestEntry.slot,
        option.count,
        option.bestEntry.source,
        option.evidenceSnippets
      ),
      recommended: option.id === recommendedId,
      expectedInteractionsAvg: option.count > 0 ? Math.round(option.totalExpectedInteractions / option.count) : 0,
      confidence: Number((((option.score + option.preferenceBonus) / topScore) || 0).toFixed(2)),
      sourceSignals: option.sourceSignals,
      evidencePosts: option.evidencePosts.slice(0, 12),
      evidenceCount: option.evidenceCount,
    })),
  };
}

function mergeOptionListResults(
  currentId: string | null,
  results: DecisionOptionListResult[]
): DecisionOptionListResult {
  const mergedOptions: PostCreationDecisionOption[] = [];
  const seenIds = new Set<string>();

  for (const result of results) {
    for (const option of result.options) {
      if (seenIds.has(option.id)) continue;
      seenIds.add(option.id);
      mergedOptions.push(option);
      if (mergedOptions.length >= TARGET_DECISION_OPTIONS) break;
    }
    if (mergedOptions.length >= TARGET_DECISION_OPTIONS) break;
  }

  const recommendedId = mergedOptions[0]?.id || null;
  const selectedId = currentId && mergedOptions.some((option) => option.id === currentId) ? currentId : recommendedId;

  return {
    recommendedId,
    selectedId,
    options: mergedOptions.map((option) => ({
      ...option,
      recommended: option.id === recommendedId,
    })),
  };
}

function buildSupplementedOptionList(params: {
  pools: DecisionSourceSlot[][];
  step: PostCreationDecisionStep;
  currentId: string | null;
  preferenceSignals?: PostCreationPreferenceSignals;
  outcomeSignals?: PostCreationOutcomeSignal[];
}): DecisionOptionListResult {
  const results = params.pools.map((entries) =>
    buildOptionList(entries, params.step, params.currentId, params.preferenceSignals, params.outcomeSignals || [])
  );
  return mergeOptionListResults(params.currentId, results);
}

const DECISION_STEP_FLOW: StepConfig[] = [
  { step: "context", label: "Contexto", dependencies: [] },
  { step: "proposal", label: "Proposta", dependencies: ["context"] },
  { step: "format", label: "Formato", dependencies: ["context", "proposal"] },
  {
    step: "duration",
    label: "Duração",
    dependencies: ["context", "proposal", "format"],
    optional: true,
    showWhen: (decision) => ["reel", "story", "long_video"].includes(decision.formatId || ""),
  },
  {
    step: "tone",
    label: "Tom",
    dependencies: ["context", "proposal", "format", "duration"],
    optional: true,
  },
  {
    step: "reference",
    label: "Referência",
    dependencies: ["context", "proposal", "format", "duration", "tone"],
    optional: true,
  },
  {
    step: "intent",
    label: "Intenção",
    dependencies: ["context", "proposal", "format", "duration", "tone", "reference"],
    optional: true,
  },
  {
    step: "narrative",
    label: "Narrativa",
    dependencies: ["context", "proposal", "format", "duration", "tone", "reference", "intent"],
    optional: true,
  },
  {
    step: "day",
    label: "Dia",
    dependencies: ["context", "proposal", "format", "duration", "tone", "reference", "intent", "narrative"],
  },
  {
    step: "hour",
    label: "Hora",
    dependencies: ["context", "proposal", "format", "duration", "tone", "reference", "intent", "narrative", "day"],
  },
  {
    step: "theme",
    label: "Tema",
    dependencies: [
      "context",
      "proposal",
      "format",
      "duration",
      "tone",
      "reference",
      "intent",
      "narrative",
      "day",
      "hour",
    ],
  },
  {
    step: "pauta",
    label: "Pauta",
    dependencies: [
      "context",
      "proposal",
      "format",
      "duration",
      "tone",
      "reference",
      "intent",
      "narrative",
      "day",
      "hour",
      "theme",
    ],
  },
];

function getDecisionValue(
  decision: Partial<PostCreationDecisionState>,
  step: PostCreationDecisionStep
): string | null {
  if (step === "context") return decision.contextId || null;
  if (step === "proposal") return decision.proposalId || null;
  if (step === "format") return decision.formatId || null;
  if (step === "duration") return decision.durationId || null;
  if (step === "tone") return decision.toneId || null;
  if (step === "reference") return decision.referenceId || null;
  if (step === "intent") return decision.intentId || null;
  if (step === "narrative") return decision.narrativeId || null;
  if (step === "day") return decision.dayId || null;
  if (step === "hour") return decision.hourId || null;
  if (step === "theme") return decision.themeId || null;
  if (step === "pauta") return decision.pautaId || null;
  return null;
}

function setDecisionValue(
  decision: PostCreationDecisionState,
  step: PostCreationDecisionStep,
  value: string | null
): PostCreationDecisionState {
  return {
    ...decision,
    ...(step === "context" ? { contextId: value } : {}),
    ...(step === "proposal" ? { proposalId: value } : {}),
    ...(step === "format" ? { formatId: value } : {}),
    ...(step === "duration" ? { durationId: value } : {}),
    ...(step === "tone" ? { toneId: value } : {}),
    ...(step === "reference" ? { referenceId: value } : {}),
    ...(step === "intent" ? { intentId: value } : {}),
    ...(step === "narrative" ? { narrativeId: value } : {}),
    ...(step === "day" ? { dayId: value } : {}),
    ...(step === "hour" ? { hourId: value } : {}),
    ...(step === "theme" ? { themeId: value } : {}),
    ...(step === "pauta" ? { pautaId: value } : {}),
  };
}

function filterEntriesByDependencies(
  entries: DecisionSourceSlot[],
  dependencies: PostCreationDecisionStep[],
  decision: Partial<PostCreationDecisionState>
): DecisionSourceSlot[] {
  if (!dependencies.length) return entries;
  return entries.filter((entry) =>
    dependencies.every((dependency) => {
      const expected = getDecisionValue(decision, dependency);
      if (!expected) return true;
      return getSlotOptionId(dependency, entry.slot) === expected;
    })
  );
}

function buildDependencyPools(
  entries: DecisionSourceSlot[],
  step: PostCreationDecisionStep,
  dependencies: PostCreationDecisionStep[],
  decision: Partial<PostCreationDecisionState>
): DecisionSourceSlot[][] {
  const pools: DecisionSourceSlot[][] = [];
  const seenSignatures = new Set<string>();
  const stepIndex = getFlowStepIndex(step);
  const activeDependencies = dependencies.filter((dependency) => Boolean(getDecisionValue(decision, dependency)));
  const downstreamAnchors = DECISION_STEP_FLOW.slice(stepIndex + 1)
    .map((item) => item.step)
    .filter((candidateStep) => Boolean(getDecisionValue(decision, candidateStep)));

  const pushPool = (steps: PostCreationDecisionStep[]) => {
    const filtered = steps.length ? filterEntriesByDependencies(entries, steps, decision) : entries;
    if (!filtered.length) return;
    const signature = filtered.map((entry) => getEntryIdentity(entry.slot, entry.source)).join("|");
    if (!signature || seenSignatures.has(signature)) return;
    seenSignatures.add(signature);
    pools.push(filtered);
  };

  for (let anchorCount = downstreamAnchors.length; anchorCount >= 0; anchorCount -= 1) {
    pushPool([...activeDependencies, ...downstreamAnchors.slice(0, anchorCount)]);
  }

  for (let dependencyCount = activeDependencies.length - 1; dependencyCount >= 0; dependencyCount -= 1) {
    pushPool(activeDependencies.slice(0, dependencyCount));
  }

  return pools.length ? pools : [entries];
}

function resolveIdeaLane(slot: PlannerUISlot, index: number): PostCreationIdeaVariant["lane"] {
  if (index === 0) return "recommended";
  if (slot.isExperiment) return "bold";
  const proposal = slot.categories?.proposal?.[0] || "";
  if (slot.format === "carousel" || /framework|checklist/i.test(proposal)) return "practical";
  return "safe";
}

function resolveLanePreferenceBonus(
  lane: PostCreationIdeaVariant["lane"],
  preferenceSignals?: PostCreationPreferenceSignals
): number {
  const preference = preferenceSignals?.lanePreferences?.find((item) => item.lane === lane);
  const usageBonus = preference ? Math.min(12, Math.max(0, preference.count || 0)) * 1200 : 0;
  const confidenceBonus = preference ? Math.max(0, preference.avgConfidence || 0) * 900 : 0;
  const recommendedRateBonus = preference ? Math.max(0, (preference.recommendedRate || 0) - 0.5) * 1200 : 0;
  const explicitRule = preferenceSignals?.laneRules?.find((item) => item.lane === lane);
  const explicitRuleBonus =
    explicitRule?.mode === "promote"
      ? explicitRule.strength * 2200
      : explicitRule?.mode === "degrade"
        ? -explicitRule.strength * 2200
        : 0;
  return usageBonus + confidenceBonus + recommendedRateBonus + explicitRuleBonus;
}

function resolvePathPreferenceBonus(
  pathKey: string,
  preferenceSignals?: PostCreationPreferenceSignals
): number {
  const preference = preferenceSignals?.pathPreferences?.find((item) => item.pathKey === pathKey);
  const usageBonus = preference ? Math.min(10, Math.max(0, preference.count || 0)) * 1400 : 0;
  const confidenceBonus = preference ? Math.max(0, preference.avgConfidence || 0) * 1100 : 0;
  const recommendedRateBonus = preference ? Math.max(0, (preference.recommendedRate || 0) - 0.5) * 1800 : 0;
  const explicitRule = preferenceSignals?.pathRules?.find((item) => item.pathKey === pathKey);
  const explicitRuleBonus =
    explicitRule?.mode === "promote"
      ? explicitRule.strength * 2600
      : explicitRule?.mode === "degrade"
        ? -explicitRule.strength * 2600
        : 0;
  return usageBonus + confidenceBonus + recommendedRateBonus + explicitRuleBonus;
}

export function buildPostCreationDecisionEngine(
  slots: PlannerUISlot[],
  currentDecision: PostCreationDecisionState,
  options?: {
    recommendationSlots?: PlannerUISlot[];
    outcomeSignals?: PostCreationOutcomeSignal[];
    preferenceSignals?: PostCreationPreferenceSignals;
  }
): PostCreationDecisionEngineResult {
  const recommendationSlots = options?.recommendationSlots || [];
  const outcomeSignals = options?.outcomeSignals || [];
  const preferenceSignals = options?.preferenceSignals;
  const seenKeys = new Set<string>();
  const entries: DecisionSourceSlot[] = [];

  for (const slot of slots) {
    const key = getEntryIdentity(slot, "slot");
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    entries.push({ slot, source: "slot" });
  }

  for (const slot of recommendationSlots) {
    const key = getEntryIdentity(slot, "recommendation");
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);
    entries.push({ slot, source: "recommendation" });
  }

  if (!entries.length) {
    return {
      decision: currentDecision,
      checkpoints: [],
      ideaCandidates: [],
    };
  }

  const patternStats = buildPatternStats(entries);
  let resolvedDecision: PostCreationDecisionState = {
    contextId: currentDecision.contextId || null,
    proposalId: currentDecision.proposalId || null,
    toneId: currentDecision.toneId || null,
    referenceId: currentDecision.referenceId || null,
    intentId: currentDecision.intentId || null,
    formatId: currentDecision.formatId || null,
    durationId: currentDecision.durationId || null,
    narrativeId: currentDecision.narrativeId || null,
    dayId: currentDecision.dayId || null,
    hourId: currentDecision.hourId || null,
    themeId: currentDecision.themeId || null,
    pautaId: currentDecision.pautaId || null,
  };
  const checkpoints: PostCreationDecisionCheckpoint[] = [];

  for (const config of DECISION_STEP_FLOW) {
    if (config.showWhen && !config.showWhen(resolvedDecision)) {
      resolvedDecision = setDecisionValue(resolvedDecision, config.step, null);
      continue;
    }

    const pools = buildDependencyPools(entries, config.step, config.dependencies, resolvedDecision);
    const currentId = getDecisionValue(resolvedDecision, config.step);
    const optionResult = buildSupplementedOptionList({
      pools,
      step: config.step,
      currentId,
      preferenceSignals,
      outcomeSignals,
    });

    const nextSelectedId = optionResult.selectedId;
    resolvedDecision = setDecisionValue(resolvedDecision, config.step, nextSelectedId);

    const shouldRenderCheckpoint =
      optionResult.options.length > 0 &&
      (!config.optional ||
        optionResult.options.length >= 2 ||
        (currentId ? optionResult.options.some((option) => option.id === currentId) : false));

    if (!shouldRenderCheckpoint) continue;

    checkpoints.push({
      step: config.step,
      label: config.label,
      ...optionResult,
    });
  }

  const rankedIdeas = [...entries]
    .map((entry) => ({
      ...entry,
      matchCount: matchDecision(entry.slot, resolvedDecision),
      pathKey: getSlotDecisionPathKey(entry.slot),
      score:
        getEntryScore(entry) +
        resolveOutcomeBonus(entry.slot, outcomeSignals) +
        resolveFreshnessBonus(entry, patternStats) -
        resolveSaturationPenalty(entry, patternStats) +
        resolvePathPreferenceBonus(getSlotDecisionPathKey(entry.slot), preferenceSignals),
    }))
    .sort((a, b) => {
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return b.score - a.score;
    });

  const seenTitles = new Set<string>();
  const seenIdeaIds = new Set<string>();
  const candidatePool: Array<PostCreationIdeaCandidate & { rankingScore: number }> = [];

  const pushIdeaCandidate = (entry: typeof rankedIdeas[number], allowRepeatedTitle: boolean) => {
    const candidateId = getEntryIdentity(entry.slot, entry.source);
    if (seenIdeaIds.has(candidateId)) return;
    const normalizedTitle = (entry.slot.title || entry.slot.themeKeyword || "").trim().toLowerCase();
    if (!allowRepeatedTitle && normalizedTitle && seenTitles.has(normalizedTitle)) return;
    if (normalizedTitle) seenTitles.add(normalizedTitle);
    const provisionalLane = resolveIdeaLane(entry.slot, candidatePool.length);
    const laneBonus = resolveLanePreferenceBonus(provisionalLane, preferenceSignals);
    seenIdeaIds.add(candidateId);
    candidatePool.push({
      slot: entry.slot,
      decision: {
        contextId: getContextId(entry.slot),
        proposalId: getProposalId(entry.slot),
        toneId: getToneId(entry.slot),
        referenceId: getReferenceId(entry.slot),
        intentId: getIntentId(entry.slot),
        formatId: getFormatId(entry.slot),
        durationId: getDurationId(entry.slot),
        narrativeId: getNarrativeId(entry.slot),
        dayId: getDayId(entry.slot),
        hourId: getHourId(entry.slot),
        themeId: getThemeId(entry.slot),
        pautaId: entry.slot.slotId || null,
      },
      rankingScore: entry.score + laneBonus + entry.matchCount * 6000,
      variant: {
        id: candidateId,
        title: compactIdeaTitle(
          buildPautaPhraseFromPlannerSlot(entry.slot),
          entry.slot.themeKeyword || entry.slot.themes?.[0] || entry.slot.title || null
        ),
        description:
          entry.slot.scriptShort ||
          entry.slot.rationale ||
          "Pauta sugerida para aprofundar no funil.",
        lane: provisionalLane,
        source: entry.slot.isSaved ? "saved_idea" : entry.source === "recommendation" ? "ai_idea" : "historical_pattern",
        expectedInteractionsAvg: estimatePlannerSlotInteractions(entry.slot, outcomeSignals),
        confidence: Number(Math.min(1, 0.45 + entry.matchCount * 0.12 + laneBonus / 4000).toFixed(2)),
        evidence: buildIdeaEvidence(entry, provisionalLane, patternStats, outcomeSignals),
      },
    });
  };

  for (const entry of rankedIdeas) {
    pushIdeaCandidate(entry, false);
    if (candidatePool.length >= TARGET_IDEA_CANDIDATES) break;
  }

  if (candidatePool.length < TARGET_IDEA_CANDIDATES) {
    for (const entry of rankedIdeas) {
      pushIdeaCandidate(entry, true);
      if (candidatePool.length >= TARGET_IDEA_CANDIDATES) break;
    }
  }

  const ideaCandidates = candidatePool
    .sort((a, b) => {
      if (b.rankingScore !== a.rankingScore) return b.rankingScore - a.rankingScore;
      return (b.variant.confidence || 0) - (a.variant.confidence || 0);
    })
    .slice(0, TARGET_IDEA_CANDIDATES)
    .map(({ rankingScore: _rankingScore, ...candidate }) => candidate);

  return {
    decision: resolvedDecision,
    checkpoints,
    ideaCandidates,
  };
}
