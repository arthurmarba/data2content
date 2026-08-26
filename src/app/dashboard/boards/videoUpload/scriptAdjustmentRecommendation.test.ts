import {
  buildFallbackScriptAdjustmentRecommendation,
  sanitizeScriptAdjustmentRecommendation,
} from "./scriptAdjustmentRecommendation";

const valid = {
  version: "script-adjustment-v1",
  pattern: "problem_demo_explanation_action",
  summary: "Mostre o erro antes da explicação.",
  effort: "no_rerecord",
  canUseExistingFootage: true,
  currentStructure: [{ id: "context", role: "context", label: "Apresentação", sourceStartMs: 0, sourceEndMs: 4000 }],
  recommendedStructure: [{ id: "demo", role: "demonstration", label: "Erro", sourceStartMs: 11000, sourceEndMs: 13000 }],
  steps: [{
    id: "move-demo",
    action: "move",
    sourceStartMs: 11000,
    sourceEndMs: 13000,
    targetStartMs: 0,
    targetEndMs: 2000,
    targetOrder: 1,
    title: "Abra com a demonstração",
    instruction: "Use o trecho em que o erro aparece.",
    suggestedCopy: null,
    reason: "O erro é a imagem mais fácil de entender.",
    confidence: "high",
  }],
  rationale: "A demonstração aparece tarde, embora seja a parte mais clara.",
  basis: { video: true, creatorPosts: 4, territoryPosts: 20, territoryCreators: 7, confidence: "medium" },
};

describe("scriptAdjustmentRecommendation", () => {
  it("sanitiza e preserva um plano temporal válido", () => {
    const result = sanitizeScriptAdjustmentRecommendation(valid, { durationSeconds: 30 });
    expect(result?.steps[0]).toMatchObject({ sourceStartMs: 11000, targetStartMs: 0 });
    expect(result?.summary).toBe("Mostre o erro antes da explicação.");
  });

  it("remove tempos que não existem no vídeo", () => {
    const result = sanitizeScriptAdjustmentRecommendation({
      ...valid,
      steps: [{ ...valid.steps[0], sourceStartMs: 35000, sourceEndMs: 39000 }],
    }, { durationSeconds: 30 });
    expect(result?.steps[0].sourceStartMs).toBeNull();
    expect(result?.steps[0].sourceEndMs).toBeNull();
  });

  it("sobrescreve a base declarada pelo modelo", () => {
    const result = sanitizeScriptAdjustmentRecommendation(valid, {
      basisOverride: { creatorPosts: 12, territoryPosts: 40, territoryCreators: 9, confidence: "high" },
    });
    expect(result?.basis).toMatchObject({ creatorPosts: 12, territoryPosts: 40, territoryCreators: 9, confidence: "high" });
  });

  it("cria fallback apenas quando há direção concreta", () => {
    expect(buildFallbackScriptAdjustmentRecommendation({ practicalDirection: null })).toBeNull();
    expect(buildFallbackScriptAdjustmentRecommendation({
      practicalDirection: { title: "Encurte o começo", action: "Retire a apresentação repetida." },
    })?.steps).toHaveLength(1);
  });
});

