import { buildCreatorHookEvidenceFromMetrics } from "./creatorHookEvidence";

describe("buildCreatorHookEvidenceFromMetrics", () => {
  it("ranks creator-owned hooks by retention and deep engagement relative to the creator", () => {
    const evidence = buildCreatorHookEvidenceFromMetrics([
      {
        stats: { reach: 1000, comments: 20, saved: 30, shares: 50, retention_rate: 0.8, video_duration_seconds: 20, ig_reels_avg_watch_time: 16_000 },
        sceneElements: { openingLine: "Você sente mais a lombar do que o glúteo?", subjects: ["agachamento"], toneIds: ["didatico"] },
      },
      {
        stats: { reach: 1000, comments: 2, saved: 3, shares: 5, retention_rate: 0.3, video_duration_seconds: 20, ig_reels_avg_watch_time: 6_000 },
        sceneElements: { openingLine: "Hoje eu vou mostrar um exercício", subjects: ["exercicio"] },
      },
    ]);

    expect(evidence[0]).toMatchObject({
      spokenLine: "Você sente mais a lombar do que o glúteo?",
      pattern: "question",
      subject: "agachamento",
      tone: "didatico",
    });
    expect(evidence[0]!.performanceIndex).toBeGreaterThan(evidence[1]!.performanceIndex);
    expect(evidence[0]!.outcomeSignals).toEqual(expect.arrayContaining(["retention", "watch_time", "deep_engagement"]));
  });

  it("uses on-screen text when spoken opening is absent and deduplicates exact pairs", () => {
    const repeated = {
      stats: { reach: 100, shares: 5 },
      sceneElements: { openingLine: null, screenTitle: "3 erros no agachamento" },
    };
    const evidence = buildCreatorHookEvidenceFromMetrics([repeated, repeated]);

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ screenTitle: "3 erros no agachamento", pattern: "diagnostic" });
  });

  it("never returns posts without an extracted opening", () => {
    expect(buildCreatorHookEvidenceFromMetrics([{ stats: { reach: 100 }, sceneElements: {} }])).toEqual([]);
  });
});

