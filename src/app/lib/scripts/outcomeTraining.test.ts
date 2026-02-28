import {
  buildOutcomeAggregates,
  computeOutcomeScore,
  deriveOutcomeConfidence,
} from "./outcomeTraining";

describe("scripts/outcomeTraining", () => {
  it("computes linked score using interactions, engagement and recency", () => {
    const result = computeOutcomeScore({
      interactions: 1200,
      engagement: 8,
      baseline: { medianInteractions: 600, medianEngagement: 4 },
      daysSincePost: 15,
    });

    expect(result.score).toBeGreaterThan(1);
    expect(result.iNorm).toBe(2);
    expect(result.eNorm).toBe(2);
    expect(result.recencyWeight).toBeGreaterThan(0.8);
  });

  it("falls back to baseline engagement when engagement is missing", () => {
    const result = computeOutcomeScore({
      interactions: 300,
      engagement: null,
      baseline: { medianInteractions: 300, medianEngagement: 3 },
      daysSincePost: 50,
    });

    expect(result.iNorm).toBe(1);
    expect(result.eNorm).toBe(1);
    expect(result.score).toBe(1);
  });

  it("derives confidence by sample size", () => {
    expect(deriveOutcomeConfidence(2)).toBe("low");
    expect(deriveOutcomeConfidence(4)).toBe("medium");
    expect(deriveOutcomeConfidence(9)).toBe("high");
  });

  it("aggregates winners per dimension with weighted lift", () => {
    const profile = buildOutcomeAggregates({
      baseline: { medianInteractions: 500, medianEngagement: 3 },
      records: [
        {
          metricId: "m1",
          scriptId: "s1",
          caption: "Teste 1",
          interactions: 1000,
          engagement: 5,
          postDate: new Date("2026-01-20T10:00:00.000Z"),
          categories: { proposal: "tips", context: "career_work", format: "reel" },
          hookSample: "Gancho A",
          ctaSample: "Comenta aqui",
          score: 1.8,
          lift: 1.8,
          recencyWeight: 1,
        },
        {
          metricId: "m2",
          scriptId: "s2",
          caption: "Teste 2",
          interactions: 700,
          engagement: 4,
          postDate: new Date("2026-01-19T10:00:00.000Z"),
          categories: { proposal: "tips", context: "career_work", format: "reel" },
          hookSample: "Gancho B",
          ctaSample: "Salva esse post",
          score: 1.3,
          lift: 1.3,
          recencyWeight: 0.9,
        },
        {
          metricId: "m3",
          scriptId: "s3",
          caption: "Teste 3",
          interactions: 550,
          engagement: 2.8,
          postDate: new Date("2026-01-10T10:00:00.000Z"),
          categories: { proposal: "announcement", context: "general", format: "reel" },
          hookSample: "Gancho C",
          ctaSample: null,
          score: 0.95,
          lift: 0.95,
          recencyWeight: 0.7,
        },
      ] as any,
    });

    expect(profile.sampleSizeLinked).toBe(3);
    expect(profile.confidence).toBe("medium");
    expect(profile.topByDimension.proposal?.[0]?.id).toBe("tips");
    expect(profile.topExamples.length).toBeGreaterThan(0);
  });
});
