import { hookOpeningMatchScore, scriptStructureMatchScore } from "./contentPotentialHistoryService";

describe("hookOpeningMatchScore", () => {
  it("reconhece pequenas variações da abertura escolhida", () => {
    expect(hookOpeningMatchScore(
      "Você sente mais a lombar do que o glúteo?",
      "Você sente mais a lombar que o glúteo",
    )).toBeGreaterThanOrEqual(0.7);
  });

  it("não confirma uma abertura estruturalmente diferente", () => {
    expect(hookOpeningMatchScore(
      "Você sente mais a lombar do que o glúteo?",
      "Hoje eu vou mostrar três exercícios",
    )).toBeLessThan(0.7);
  });

  it("retorna null sem fala publicada", () => {
    expect(hookOpeningMatchScore("Uma abertura", null)).toBeNull();
  });
});

describe("scriptStructureMatchScore", () => {
  it("reconhece a forma narrativa publicada que corresponde ao plano", () => {
    expect(scriptStructureMatchScore("problem_demo_explanation_action", ["Tutorial/Passo a Passo"])).toBe(1);
  });

  it("diferencia uma estrutura publicada incompatível", () => {
    expect(scriptStructureMatchScore("question_proof_answer", ["Review"])).toBe(0);
  });

  it("não inventa correspondência quando a classificação está ausente", () => {
    expect(scriptStructureMatchScore("question_proof_answer", [])).toBeNull();
  });
});
