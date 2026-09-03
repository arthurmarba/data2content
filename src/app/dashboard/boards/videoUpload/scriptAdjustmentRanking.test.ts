import { rankScriptAdjustmentRecommendation } from "./scriptAdjustmentRanking";
import type { ScriptAdjustmentRecommendation } from "./scriptAdjustmentRecommendation";

const recommendation: ScriptAdjustmentRecommendation = {
  version: "v1",
  pattern: "problem_demo_explanation_action",
  summary: "Grave uma nova abertura e reorganize o restante.",
  effort: "one_pickup",
  canUseExistingFootage: false,
  currentStructure: [],
  recommendedStructure: [],
  steps: [
    { id: "new", action: "rerecord", sourceStartMs: null, sourceEndMs: null, targetStartMs: 0, targetEndMs: 2000, targetOrder: 1, title: "Grave uma abertura", instruction: "Grave uma abertura curta.", suggestedCopy: "Pare de fazer isso.", reason: "Falta uma promessa clara.", confidence: "medium" },
    { id: "move", action: "move", sourceStartMs: 8000, sourceEndMs: 10000, targetStartMs: 2000, targetEndMs: 4000, targetOrder: 2, title: "Mova a demonstração", instruction: "Mova a demonstração para o começo.", suggestedCopy: null, reason: "Ela mostra a entrega.", confidence: "high" },
  ],
  rationale: "O trecho visual entrega a ideia com mais rapidez.",
  basis: { video: true, creatorPosts: 0, territoryPosts: 0, territoryCreators: 0, confidence: "low" },
};

describe("scriptAdjustmentRanking", () => {
  it("prefere a variante executável sem regravação", () => {
    const result = rankScriptAdjustmentRecommendation({ recommendation, durationSeconds: 20 });
    expect(result.effort).toBe("no_rerecord");
    expect(result.steps.every((step) => step.action !== "rerecord")).toBe(true);
  });

  it("injeta base real do criador e território", () => {
    const result = rankScriptAdjustmentRecommendation({
      recommendation: { ...recommendation, effort: "no_rerecord", canUseExistingFootage: true, steps: [recommendation.steps[1]!] },
      creatorPosts: 8,
      creatorEvidence: [{ pattern: "problem_demo_explanation_action", label: "x", sourceForm: "tutorial", posts: 3, performanceIndex: 1.4, outcomeSignals: ["retention"] }],
      territoryContext: { territoryId: "cozinha", territoryLabel: "Gastronomia", weekKey: "2026-W33", posts: 20, creators: 8, windowDays: 90, patterns: [] },
    });
    expect(result.basis).toMatchObject({ creatorPosts: 8, territoryPosts: 20, territoryCreators: 8, confidence: "medium" });
  });
});

