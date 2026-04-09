import {
  evaluateScriptBenchmarkGate,
  evaluateScriptBenchmarkCase,
  formatScriptBenchmarkSummary,
  SCRIPT_BENCHMARK_CASES,
  SCRIPT_BENCHMARK_THRESHOLDS,
  summarizeScriptBenchmark,
} from "../src/app/lib/scripts/benchmark";

function run() {
  const results = SCRIPT_BENCHMARK_CASES.map((item) => evaluateScriptBenchmarkCase(item));
  const summary = summarizeScriptBenchmark(results);
  const gate = evaluateScriptBenchmarkGate(summary, SCRIPT_BENCHMARK_THRESHOLDS);

  console.log("[scripts-benchmark] summary");
  console.log(formatScriptBenchmarkSummary(summary));
  console.log(
    `thresholds cases>=${SCRIPT_BENCHMARK_THRESHOLDS.minCases} passRate>=${SCRIPT_BENCHMARK_THRESHOLDS.minPassRate.toFixed(3)} quality>=${SCRIPT_BENCHMARK_THRESHOLDS.minAvgCandidateQuality.toFixed(3)} utility>=${SCRIPT_BENCHMARK_THRESHOLDS.minAvgCandidateUtility.toFixed(3)} deltaQuality>=${SCRIPT_BENCHMARK_THRESHOLDS.minAvgDeltaQuality.toFixed(3)} deltaUtility>=${SCRIPT_BENCHMARK_THRESHOLDS.minAvgDeltaUtility.toFixed(3)} semantic>=${SCRIPT_BENCHMARK_THRESHOLDS.minAvgCandidateSemanticFinalScore.toFixed(2)} retryAccepted>=${SCRIPT_BENCHMARK_THRESHOLDS.minCandidateRetryAcceptedRate.toFixed(3)}`
  );
  console.log("");
  console.log("[scripts-benchmark] cases");
  for (const item of results) {
    console.log(
      [
        item.id,
        `quality ${item.baseline.perceivedQuality.toFixed(3)} -> ${item.candidate.perceivedQuality.toFixed(3)}`,
        `utility ${item.baseline.utilityScore.toFixed(3)} -> ${item.candidate.utilityScore.toFixed(3)}`,
        `semantic ${item.baselineSemanticFinalScore?.toFixed(2) ?? "—"} -> ${item.candidateSemanticFinalScore?.toFixed(2) ?? "—"}`,
        `retry ${item.baselineRetryAccepted === null ? "—" : item.baselineRetryAccepted ? "1" : "0"} -> ${item.candidateRetryAccepted === null ? "—" : item.candidateRetryAccepted ? "1" : "0"}`,
      ].join(" | ")
    );
  }

  if (!gate.ok) {
    console.log("");
    console.log("[scripts-benchmark] gate FAILED");
    for (const failure of gate.failures) {
      console.log(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("");
  console.log("[scripts-benchmark] gate PASSED");
}

run();
