import { combineHybridScore, normalizeScore } from "./recommender";

describe("planner/recommender hybrid scoring", () => {
  it("normalizes values inside a range", () => {
    expect(normalizeScore(50, 0, 100)).toBe(0.5);
    expect(normalizeScore(0, 0, 100)).toBe(0);
    expect(normalizeScore(100, 0, 100)).toBe(1);
  });

  it("returns zero when range is invalid", () => {
    expect(normalizeScore(50, 10, 10)).toBe(0);
    expect(normalizeScore(50, 20, 10)).toBe(0);
  });

  it("combines planned slot score with 75/25 weights", () => {
    const hybrid = combineHybridScore({
      perfNorm: 0.8,
      scriptLiftNorm: 0.6,
      isExperiment: false,
    });
    expect(hybrid).toBeCloseTo(0.75, 5);
  });

  it("combines test slot score with 90/10 weights", () => {
    const hybrid = combineHybridScore({
      perfNorm: 0.8,
      scriptLiftNorm: 0.6,
      isExperiment: true,
    });
    expect(hybrid).toBeCloseTo(0.78, 5);
  });
});
