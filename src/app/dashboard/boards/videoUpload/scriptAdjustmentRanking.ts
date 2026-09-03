import type { CreatorStructureEvidence } from "./creatorStructureEvidence";
import type {
  ScriptAdjustmentRecommendation,
  ScriptAdjustmentStep,
} from "./scriptAdjustmentRecommendation";
import { sanitizeScriptAdjustmentRecommendation } from "./scriptAdjustmentRecommendation";
import type { TerritoryStructureContext } from "./territoryStructureEvidenceService";

function effortPenalty(recommendation: ScriptAdjustmentRecommendation): number {
  if (recommendation.effort === "new_version") return 0.32;
  if (recommendation.effort === "one_pickup") return 0.12;
  return 0;
}

function candidateScore(params: {
  recommendation: ScriptAdjustmentRecommendation;
  creatorEvidence: CreatorStructureEvidence[];
  territoryContext?: TerritoryStructureContext | null;
}): number {
  const { recommendation, creatorEvidence, territoryContext } = params;
  let score = 1 - effortPenalty(recommendation);
  if (recommendation.canUseExistingFootage) score += 0.18;
  if (recommendation.steps.every((step) => step.action !== "rerecord")) score += 0.08;
  if (recommendation.steps.some((step) => step.sourceStartMs !== null)) score += 0.05;
  const creator = creatorEvidence.find((item) => item.pattern === recommendation.pattern);
  if (creator && creator.posts >= 2) score += Math.min(0.24, Math.max(0, creator.performanceIndex - 1) * 0.16 + 0.06);
  const territory = territoryContext?.patterns.find((item) => item.pattern === recommendation.pattern);
  if (territory) score += Math.min(0.18, Math.max(0, territory.performanceIndex - 1) * 0.12 + 0.05);
  return score;
}

function withoutRerecord(recommendation: ScriptAdjustmentRecommendation): ScriptAdjustmentRecommendation | null {
  const steps = recommendation.steps.filter((step) => step.action !== "rerecord");
  if (steps.length === 0 || steps.length === recommendation.steps.length) return null;
  return {
    ...recommendation,
    version: `${recommendation.version}-existing-footage`,
    effort: "no_rerecord",
    canUseExistingFootage: true,
    steps: steps.map((step, index) => ({ ...step, targetOrder: index + 1 })),
    summary: "Use primeiro os ajustes que cabem no vídeo já gravado.",
  };
}

function quickAdjustment(recommendation: ScriptAdjustmentRecommendation): ScriptAdjustmentRecommendation | null {
  const preferredActions = new Set<ScriptAdjustmentStep["action"]>(["move", "shorten", "cut", "overlay", "keep"]);
  const steps = recommendation.steps.filter((step) => preferredActions.has(step.action)).slice(0, 3);
  if (steps.length === 0 || steps.length === recommendation.steps.length) return null;
  return {
    ...recommendation,
    version: `${recommendation.version}-quick`,
    effort: "no_rerecord",
    canUseExistingFootage: true,
    steps: steps.map((step, index) => ({ ...step, targetOrder: index + 1 })),
    summary: "Aplique primeiro as mudanças mais simples deste plano.",
  };
}

export function rankScriptAdjustmentRecommendation(params: {
  recommendation: ScriptAdjustmentRecommendation;
  durationSeconds?: number | null;
  creatorEvidence?: CreatorStructureEvidence[] | null;
  creatorPosts?: number | null;
  territoryContext?: TerritoryStructureContext | null;
}): ScriptAdjustmentRecommendation {
  const creatorEvidence = params.creatorEvidence ?? [];
  const candidates = [
    params.recommendation,
    withoutRerecord(params.recommendation),
    quickAdjustment(params.recommendation),
  ].filter((item): item is ScriptAdjustmentRecommendation => Boolean(item));
  const chosen = [...candidates].sort((a, b) => candidateScore({ recommendation: b, creatorEvidence, territoryContext: params.territoryContext }) - candidateScore({ recommendation: a, creatorEvidence, territoryContext: params.territoryContext }))[0] ?? params.recommendation;
  const creatorPosts = Math.max(0, Math.trunc(params.creatorPosts ?? 0));
  const confidence = creatorPosts >= 12 && creatorEvidence.length >= 2 || (params.territoryContext?.patterns.length ?? 0) >= 2
    ? "high"
    : creatorPosts >= 5 && creatorEvidence.length > 0 || params.territoryContext
      ? "medium"
      : chosen.steps.every((step) => step.confidence === "high") ? "medium" : "low";
  return sanitizeScriptAdjustmentRecommendation(chosen, {
    durationSeconds: params.durationSeconds,
    basisOverride: {
      creatorPosts,
      territoryPosts: params.territoryContext?.posts ?? 0,
      territoryCreators: params.territoryContext?.creators ?? 0,
      confidence,
    },
  }) ?? params.recommendation;
}

