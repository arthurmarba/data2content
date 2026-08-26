import { buildCreatorStructureEvidenceFromMetrics, structurePatternFromNarrativeForm } from "./creatorStructureEvidence";

describe("creatorStructureEvidence", () => {
  it("traduz formatos conhecidos em estruturas reutilizáveis", () => {
    expect(structurePatternFromNarrativeForm("Tutorial/Passo a Passo")).toBe("problem_demo_explanation_action");
    expect(structurePatternFromNarrativeForm("Comparação")).toBe("before_after_reason_guidance");
    expect(structurePatternFromNarrativeForm("Perguntas e Respostas")).toBe("question_proof_answer");
  });

  it("ordena a estrutura pelo resultado relativo do próprio criador", () => {
    const result = buildCreatorStructureEvidenceFromMetrics([
      { narrativeForm: ["tutorial"], stats: { reach: 1000, comments: 20, saved: 30, shares: 50, video_duration_seconds: 20, ig_reels_avg_watch_time: 16000 } },
      { narrativeForm: ["review"], stats: { reach: 1000, comments: 2, saved: 3, shares: 2, video_duration_seconds: 20, ig_reels_avg_watch_time: 5000 } },
    ]);
    expect(result[0]).toMatchObject({ pattern: "problem_demo_explanation_action", posts: 1 });
    expect(result[0]!.performanceIndex).toBeGreaterThan(result[1]!.performanceIndex);
  });
});

