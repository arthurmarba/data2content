import { buildCreatorEngagementBaselineFromMetrics } from "./creatorEngagementBaselineService";

describe("creatorEngagementBaselineService", () => {
  it("usa apenas métricas com alcance e extrai padrões dos melhores conteúdos", () => {
    const baseline = buildCreatorEngagementBaselineFromMetrics([
      {
        stats: { reach: 1_000, likes: 100, comments: 20, saved: 30, shares: 50 },
        sceneElements: {
          framingIds: ["close_up"],
          aestheticIds: ["minimalista"],
          subjects: ["bastidores"],
          toneIds: ["didatico"],
          placeId: "casa",
          openingLine: "Você também trava aqui?",
        },
      },
      {
        stats: { reach: 1_000, likes: 40, comments: 4, saved: 6, shares: 10 },
        sceneElements: { framingIds: ["plano_medio"], subjects: ["rotina"] },
      },
      { stats: { reach: 0, likes: 999 }, sceneElements: { subjects: ["ignorar"] } },
    ]);

    expect(baseline.postsAnalyzed).toBe(2);
    expect(baseline.topPostsCount).toBe(1);
    expect(baseline.patterns.subject).toEqual(expect.objectContaining({ key: "bastidores", count: 1 }));
    expect(baseline.openingSpeechRate).toBe(1);
    expect(baseline.confidence).toBe("low");
  });
});
