import {
  evaluateScriptBenchmarkGate,
  evaluateScriptBenchmarkCase,
  formatScriptBenchmarkSummary,
  SCRIPT_BENCHMARK_CASES,
  SCRIPT_BENCHMARK_THRESHOLDS,
  summarizeScriptBenchmark,
} from "./benchmark";

describe("scripts/benchmark", () => {
  it("enforces the benchmark gate for current fixtures", () => {
    const results = SCRIPT_BENCHMARK_CASES.map((item) => evaluateScriptBenchmarkCase(item));
    const summary = summarizeScriptBenchmark(results);
    const gate = evaluateScriptBenchmarkGate(summary, SCRIPT_BENCHMARK_THRESHOLDS);

    expect(results.every((item) => item.passes)).toBe(true);
    expect(summary.passedCases).toBe(summary.totalCases);
    expect(summary.totalCases).toBeGreaterThanOrEqual(SCRIPT_BENCHMARK_THRESHOLDS.minCases);
    expect(summary.avgDeltaQuality).toBeGreaterThanOrEqual(SCRIPT_BENCHMARK_THRESHOLDS.minAvgDeltaQuality);
    expect(summary.avgDeltaUtility).toBeGreaterThanOrEqual(SCRIPT_BENCHMARK_THRESHOLDS.minAvgDeltaUtility);
    expect(summary.avgCandidateQuality).toBeGreaterThanOrEqual(
      SCRIPT_BENCHMARK_THRESHOLDS.minAvgCandidateQuality
    );
    expect(summary.avgCandidateUtility).toBeGreaterThanOrEqual(
      SCRIPT_BENCHMARK_THRESHOLDS.minAvgCandidateUtility
    );
    expect(summary.avgCandidateSemanticFinalScore).toBeGreaterThanOrEqual(
      SCRIPT_BENCHMARK_THRESHOLDS.minAvgCandidateSemanticFinalScore
    );
    expect(summary.candidateRetryAcceptedRate).toBeGreaterThanOrEqual(
      SCRIPT_BENCHMARK_THRESHOLDS.minCandidateRetryAcceptedRate
    );
    expect(gate).toEqual({ ok: true, failures: [] });
  });

  it("formats benchmark summary for CLI output", () => {
    const summary = summarizeScriptBenchmark(SCRIPT_BENCHMARK_CASES.map(evaluateScriptBenchmarkCase));
    const formatted = formatScriptBenchmarkSummary(summary);

    expect(formatted).toContain("cases=");
    expect(formatted).toContain("quality=");
    expect(formatted).toContain("utility=");
    expect(formatted).toContain("semantic=");
    expect(formatted).toContain("retryAccepted=");
  });

  it("reports threshold failures when benchmark regresses", () => {
    const gate = evaluateScriptBenchmarkGate(
      {
        totalCases: 4,
        passedCases: 2,
        avgBaselineQuality: 0.4,
        avgCandidateQuality: 0.68,
        avgDeltaQuality: 0.12,
        avgBaselineUtility: 0.2,
        avgCandidateUtility: 0.61,
        avgDeltaUtility: 0.21,
        avgBaselineSemanticFinalScore: 6.2,
        avgCandidateSemanticFinalScore: 7.7,
        baselineRetryAcceptedRate: 0,
        candidateRetryAcceptedRate: 0.5,
      },
      SCRIPT_BENCHMARK_THRESHOLDS
    );

    expect(gate.ok).toBe(false);
    expect(gate.failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("dataset too small"),
        expect.stringContaining("pass rate too low"),
        expect.stringContaining("candidate quality too low"),
        expect.stringContaining("candidate utility too low"),
        expect.stringContaining("quality delta too low"),
        expect.stringContaining("utility delta too low"),
        expect.stringContaining("candidate semantic score too low"),
        expect.stringContaining("candidate retry acceptance too low"),
      ])
    );
  });
});
