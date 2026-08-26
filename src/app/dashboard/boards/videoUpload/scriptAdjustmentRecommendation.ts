import {
  sanitizeDirectionalInstruction,
  sanitizePlainDirectionalCopy,
  type DirectionalCopyAction,
} from "./directionalCopyPolicy";

export type ScriptAdjustmentEffort = "no_rerecord" | "one_pickup" | "new_version";
export type ScriptAdjustmentConfidence = "low" | "medium" | "high";
export type ScriptAdjustmentAction = DirectionalCopyAction;

export type ScriptStructureRole =
  | "hook"
  | "context"
  | "problem"
  | "demonstration"
  | "proof"
  | "explanation"
  | "delivery"
  | "closing";

export type ScriptStructurePattern =
  | "problem_demo_explanation_action"
  | "result_process_explanation"
  | "question_proof_answer"
  | "before_after_reason_guidance"
  | "claim_test_verdict"
  | "scene_tension_turn"
  | "context_process_result"
  | "direct_explanation";

export type ScriptStructureBlock = {
  id: string;
  role: ScriptStructureRole;
  label: string;
  sourceStartMs: number | null;
  sourceEndMs: number | null;
};

export type ScriptAdjustmentStep = {
  id: string;
  action: ScriptAdjustmentAction;
  sourceStartMs: number | null;
  sourceEndMs: number | null;
  targetStartMs: number | null;
  targetEndMs: number | null;
  targetOrder: number;
  title: string;
  instruction: string;
  suggestedCopy: string | null;
  reason: string;
  confidence: ScriptAdjustmentConfidence;
};

export type ScriptAdjustmentRecommendation = {
  version: string;
  pattern: ScriptStructurePattern;
  summary: string;
  effort: ScriptAdjustmentEffort;
  canUseExistingFootage: boolean;
  currentStructure: ScriptStructureBlock[];
  recommendedStructure: ScriptStructureBlock[];
  steps: ScriptAdjustmentStep[];
  rationale: string;
  basis: {
    video: true;
    creatorPosts: number;
    territoryPosts: number;
    territoryCreators: number;
    confidence: ScriptAdjustmentConfidence;
  };
};

const VALID_EFFORT = new Set<ScriptAdjustmentEffort>(["no_rerecord", "one_pickup", "new_version"]);
const VALID_CONFIDENCE = new Set<ScriptAdjustmentConfidence>(["low", "medium", "high"]);
const VALID_ACTION = new Set<ScriptAdjustmentAction>(["keep", "cut", "shorten", "move", "overlay", "rerecord"]);
const VALID_ROLE = new Set<ScriptStructureRole>([
  "hook", "context", "problem", "demonstration", "proof", "explanation", "delivery", "closing",
]);
const VALID_PATTERN = new Set<ScriptStructurePattern>([
  "problem_demo_explanation_action", "result_process_explanation", "question_proof_answer",
  "before_after_reason_guidance", "claim_test_verdict", "scene_tension_turn",
  "context_process_result", "direct_explanation",
]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function count(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
}

function enumValue<T extends string>(value: unknown, valid: Set<T>, fallback: T): T {
  return typeof value === "string" && valid.has(value as T) ? value as T : fallback;
}

function safeTime(value: unknown, durationMs: number | null): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  const rounded = Math.round(parsed);
  if (durationMs !== null && rounded > durationMs) return null;
  return rounded;
}

function readBlock(value: unknown, index: number, durationMs: number | null): ScriptStructureBlock | null {
  const raw = record(value);
  if (!raw) return null;
  const role = enumValue(raw.role, VALID_ROLE, "explanation");
  const label = sanitizePlainDirectionalCopy(raw.label, 60);
  if (!label) return null;
  const sourceStartMs = safeTime(raw.sourceStartMs, durationMs);
  const sourceEndMs = safeTime(raw.sourceEndMs, durationMs);
  return {
    id: sanitizePlainDirectionalCopy(raw.id, 60) || `block-${index + 1}`,
    role,
    label,
    sourceStartMs,
    sourceEndMs: sourceStartMs !== null && sourceEndMs !== null && sourceEndMs >= sourceStartMs ? sourceEndMs : null,
  };
}

function readStep(value: unknown, index: number, durationMs: number | null): ScriptAdjustmentStep | null {
  const raw = record(value);
  if (!raw) return null;
  const action = enumValue(raw.action, VALID_ACTION, "keep");
  const title = sanitizeDirectionalInstruction({
    value: raw.title,
    action,
    fallbackObject: "este trecho",
    maxLength: 90,
  });
  const instruction = sanitizeDirectionalInstruction({
    value: raw.instruction,
    action,
    fallbackObject: "este trecho na ordem sugerida",
    maxLength: 280,
  });
  const reason = sanitizePlainDirectionalCopy(raw.reason, 220);
  if (!title || !instruction || !reason) return null;
  const sourceStartMs = safeTime(raw.sourceStartMs, durationMs);
  const sourceEndMs = safeTime(raw.sourceEndMs, durationMs);
  const targetStartMs = safeTime(raw.targetStartMs, durationMs);
  const targetEndMs = safeTime(raw.targetEndMs, durationMs);
  return {
    id: sanitizePlainDirectionalCopy(raw.id, 60) || `step-${index + 1}`,
    action,
    sourceStartMs,
    sourceEndMs: sourceStartMs !== null && sourceEndMs !== null && sourceEndMs >= sourceStartMs ? sourceEndMs : null,
    targetStartMs,
    targetEndMs: targetStartMs !== null && targetEndMs !== null && targetEndMs >= targetStartMs ? targetEndMs : null,
    targetOrder: Math.min(12, Math.max(1, count(raw.targetOrder) || index + 1)),
    title,
    instruction,
    suggestedCopy: sanitizePlainDirectionalCopy(raw.suggestedCopy, 220) || null,
    reason,
    confidence: enumValue(raw.confidence, VALID_CONFIDENCE, "low"),
  };
}

export function sanitizeScriptAdjustmentRecommendation(
  value: unknown,
  options: {
    durationSeconds?: number | null;
    basisOverride?: Partial<ScriptAdjustmentRecommendation["basis"]>;
  } = {},
): ScriptAdjustmentRecommendation | null {
  const raw = record(value);
  if (!raw) return null;
  const durationMs = typeof options.durationSeconds === "number" && Number.isFinite(options.durationSeconds) && options.durationSeconds > 0
    ? Math.round(options.durationSeconds * 1000)
    : null;
  const summary = sanitizeDirectionalInstruction({ value: raw.summary, action: "move", fallbackObject: "o trecho mais claro para o começo", maxLength: 240 });
  const rationale = sanitizePlainDirectionalCopy(raw.rationale, 320);
  const steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .slice(0, 6)
    .map((step, index) => readStep(step, index, durationMs))
    .filter((step): step is ScriptAdjustmentStep => Boolean(step))
    .filter((step, index, all) => all.findIndex((candidate) => candidate.id === step.id) === index)
    .sort((a, b) => a.targetOrder - b.targetOrder);
  if (!summary || !rationale || steps.length === 0) return null;

  const currentStructure = (Array.isArray(raw.currentStructure) ? raw.currentStructure : [])
    .slice(0, 8)
    .map((block, index) => readBlock(block, index, durationMs))
    .filter((block): block is ScriptStructureBlock => Boolean(block));
  const recommendedStructure = (Array.isArray(raw.recommendedStructure) ? raw.recommendedStructure : [])
    .slice(0, 8)
    .map((block, index) => readBlock(block, index, durationMs))
    .filter((block): block is ScriptStructureBlock => Boolean(block));
  const basisRaw = record(raw.basis) ?? {};
  const override = options.basisOverride ?? {};

  return {
    version: sanitizePlainDirectionalCopy(raw.version, 60) || "script-adjustment-v1",
    pattern: enumValue(raw.pattern, VALID_PATTERN, "direct_explanation"),
    summary,
    effort: enumValue(raw.effort, VALID_EFFORT, steps.some((step) => step.action === "rerecord") ? "one_pickup" : "no_rerecord"),
    canUseExistingFootage: typeof raw.canUseExistingFootage === "boolean" ? raw.canUseExistingFootage : !steps.some((step) => step.action === "rerecord"),
    currentStructure,
    recommendedStructure,
    steps,
    rationale,
    basis: {
      video: true,
      creatorPosts: count(override.creatorPosts ?? basisRaw.creatorPosts),
      territoryPosts: count(override.territoryPosts ?? basisRaw.territoryPosts),
      territoryCreators: count(override.territoryCreators ?? basisRaw.territoryCreators),
      confidence: enumValue(override.confidence ?? basisRaw.confidence, VALID_CONFIDENCE, "low"),
    },
  };
}

export function buildFallbackScriptAdjustmentRecommendation(params: {
  suggestedHook?: string | null;
  practicalDirection?: { title?: string | null; action?: string | null; example?: string | null } | null;
  confidence?: ScriptAdjustmentConfidence;
}): ScriptAdjustmentRecommendation | null {
  const action = sanitizePlainDirectionalCopy(params.practicalDirection?.action, 280);
  if (!action) return null;
  return sanitizeScriptAdjustmentRecommendation({
    version: "script-adjustment-fallback-v1",
    pattern: "direct_explanation",
    summary: params.practicalDirection?.title || "Aplique um ajuste simples antes de publicar.",
    effort: "no_rerecord",
    canUseExistingFootage: true,
    currentStructure: [],
    recommendedStructure: [],
    steps: [{
      id: "fallback-adjustment",
      action: "shorten",
      sourceStartMs: null,
      sourceEndMs: null,
      targetStartMs: null,
      targetEndMs: null,
      targetOrder: 1,
      title: params.practicalDirection?.title || "Aplique o ajuste principal",
      instruction: action,
      suggestedCopy: params.practicalDirection?.example || params.suggestedHook || null,
      reason: "É a mudança mais segura encontrada para deixar a ideia mais fácil de entender.",
      confidence: params.confidence ?? "low",
    }],
    rationale: "A recomendação usa somente o que foi observado neste vídeo.",
    basis: { video: true, creatorPosts: 0, territoryPosts: 0, territoryCreators: 0, confidence: params.confidence ?? "low" },
  });
}
