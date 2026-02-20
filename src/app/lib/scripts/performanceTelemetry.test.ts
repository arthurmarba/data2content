import {
  clearScriptsPerformanceTelemetry,
  getScriptsPerformanceSnapshot,
  recordScriptsStageDuration,
} from "./performanceTelemetry";

describe("scripts/performanceTelemetry", () => {
  beforeEach(() => {
    clearScriptsPerformanceTelemetry();
  });

  it("computes p50 and p95 for recorded stage durations", () => {
    recordScriptsStageDuration("llm.call", 100);
    recordScriptsStageDuration("llm.call", 200);
    recordScriptsStageDuration("llm.call", 300);
    recordScriptsStageDuration("llm.call", 400);

    const snapshot = getScriptsPerformanceSnapshot();
    const llm = snapshot["llm.call"];

    expect(llm).toBeDefined();
    expect(llm?.count).toBe(4);
    expect(llm?.windowSize).toBe(4);
    expect(llm?.p50).toBe(200);
    expect(llm?.p95).toBe(400);
    expect(llm?.lastMs).toBe(400);
  });

  it("keeps a capped moving window while preserving total count", () => {
    for (let index = 1; index <= 240; index += 1) {
      recordScriptsStageDuration("intelligence.ranking", index);
    }

    const snapshot = getScriptsPerformanceSnapshot();
    const ranking = snapshot["intelligence.ranking"];

    expect(ranking).toBeDefined();
    expect(ranking?.count).toBe(240);
    expect(ranking?.windowSize).toBeLessThanOrEqual(200);
    expect(ranking?.lastMs).toBe(240);
  });
});
