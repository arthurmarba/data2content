import { buildScriptStyleContext, computeStyleSimilarityScore } from "./styleContext";
import type { ScriptStyleProfileSnapshot } from "./styleTraining";

describe("scripts/styleContext", () => {
  const profile: ScriptStyleProfileSnapshot = {
    profileVersion: "scripts_style_profile_v1",
    sampleSize: 12,
    lastScriptAt: "2026-02-10T10:00:00.000Z",
    sourceMix: { manual: 8, ai: 3, planner: 1 },
    styleSignals: {
      avgParagraphs: 3,
      avgSentenceLength: 12,
      emojiDensity: 0.02,
      questionRate: 0.1,
      exclamationRate: 0.2,
      hookPatterns: ["deixa eu te mostrar"],
      ctaPatterns: ["comentario", "compartilhar"],
      humorMarkers: ["humor"],
      recurringExpressions: ["resultado", "simples"],
      narrativeCadence: {
        openingAvgChars: 90,
        developmentAvgChars: 280,
        closingAvgChars: 110,
      },
    },
    styleExamples: ["Deixa eu te mostrar um jeito simples de fazer isso hoje."],
    exclusionStats: {
      adminRecommendationSkipped: 0,
      tooShortSkipped: 0,
      emptySkipped: 0,
      duplicateSkipped: 0,
    },
  };

  it("builds style context with evidence flag and guidelines", () => {
    const context = buildScriptStyleContext(profile);
    expect(context?.hasEnoughEvidence).toBe(true);
    expect(context?.writingGuidelines.length).toBeGreaterThan(0);
    expect(context?.styleSignalsUsed.hookPatterns[0]).toBe("deixa eu te mostrar");
  });

  it("returns similarity score when style context is available", () => {
    const context = buildScriptStyleContext(profile);
    const score = computeStyleSimilarityScore(
      "Deixa eu te mostrar algo rapido.\n\nFunciona no dia a dia.\n\nComenta aqui e compartilha com alguem.",
      context
    );
    expect(typeof score).toBe("number");
    expect((score || 0) >= 0).toBe(true);
    expect((score || 0) <= 1).toBe(true);
  });
});
