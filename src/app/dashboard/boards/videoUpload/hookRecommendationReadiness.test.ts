import {
  summarizeHookRecommendationReadiness,
  type HookRecommendationReadinessMetric,
} from "./hookRecommendationReadiness";

function metric(params: Partial<HookRecommendationReadinessMetric> = {}): HookRecommendationReadinessMetric {
  return {
    creatorId: "creator-1",
    territoryId: "treino",
    hasSceneRead: true,
    hasOpeningLine: true,
    hasScreenTitle: false,
    hasDuration: true,
    hasWatchTime: true,
    hasRetention: false,
    hasIntentSignals: true,
    ...params,
  };
}

describe("summarizeHookRecommendationReadiness", () => {
  it("marks a territory ready only with collective coverage and outcome signals", () => {
    const metrics = Array.from({ length: 20 }, (_, index) => metric({ creatorId: `creator-${index % 5}` }));
    const [result] = summarizeHookRecommendationReadiness({ metrics });

    expect(result).toMatchObject({
      territoryId: "treino",
      posts: 20,
      creators: 5,
      hooksAvailable: 20,
      sceneCoverage: 1,
      hookCoverage: 1,
      outcomeCoverage: 1,
      readiness: "ready",
      blockers: [],
    });
  });

  it("keeps an otherwise useful territory partial when collective or outcome coverage is weak", () => {
    const metrics = Array.from({ length: 12 }, (_, index) => metric({
      creatorId: `creator-${index % 3}`,
      hasSceneRead: index < 5,
      hasOpeningLine: index < 6,
      hasDuration: false,
      hasWatchTime: false,
      hasRetention: false,
    }));
    const [result] = summarizeHookRecommendationReadiness({ metrics });

    expect(result?.readiness).toBe("partial");
    expect(result?.blockers).toEqual(expect.arrayContaining([
      "few_posts",
      "few_creators",
      "few_extracted_hooks",
      "low_scene_coverage",
      "low_outcome_coverage",
    ]));
  });

  it("does not include posts whose creator has no canonical territory", () => {
    const result = summarizeHookRecommendationReadiness({
      metrics: [metric({ territoryId: null })],
    });

    expect(result).toEqual([]);
  });

  it("counts one post once when it has both spoken and on-screen hooks", () => {
    const [result] = summarizeHookRecommendationReadiness({
      metrics: [metric({ hasOpeningLine: true, hasScreenTitle: true })],
      thresholds: {
        readyPosts: 1,
        readyCreators: 1,
        readyHooks: 1,
        readySceneCoverage: 1,
        readyOutcomeCoverage: 1,
        partialPosts: 1,
        partialCreators: 1,
        partialHooks: 1,
      },
    });

    expect(result).toMatchObject({ openingLines: 1, screenTitles: 1, hooksAvailable: 1 });
  });
});

