import { evaluateTechnicalScriptQuality, type TechnicalScriptQualityScore } from "./ai";
import {
  SCRIPT_BENCHMARK_CASES,
  SCRIPT_BENCHMARK_THRESHOLDS,
} from "./benchmark.fixtures";

export type ScriptBenchmarkRevision = {
  label: string;
  content: string;
  semanticFinalScore?: number | null;
  retryAccepted?: boolean | null;
  semanticPasses?: boolean | null;
};

export type ScriptBenchmarkCase = {
  id: string;
  prompt: string;
  baseline: ScriptBenchmarkRevision;
  candidate: ScriptBenchmarkRevision;
};

export type ScriptBenchmarkCaseResult = {
  id: string;
  prompt: string;
  baseline: TechnicalScriptQualityScore;
  candidate: TechnicalScriptQualityScore;
  deltaQuality: number;
  deltaUtility: number;
  baselineSemanticFinalScore: number | null;
  candidateSemanticFinalScore: number | null;
  baselineRetryAccepted: boolean | null;
  candidateRetryAccepted: boolean | null;
  passes: boolean;
};

export type ScriptBenchmarkSummary = {
  totalCases: number;
  passedCases: number;
  avgBaselineQuality: number;
  avgCandidateQuality: number;
  avgDeltaQuality: number;
  avgBaselineUtility: number;
  avgCandidateUtility: number;
  avgDeltaUtility: number;
  avgBaselineSemanticFinalScore: number | null;
  avgCandidateSemanticFinalScore: number | null;
  baselineRetryAcceptedRate: number | null;
  candidateRetryAcceptedRate: number | null;
};

export type ScriptBenchmarkThresholds = {
  minCases: number;
  minPassRate: number;
  minAvgCandidateQuality: number;
  minAvgCandidateUtility: number;
  minAvgDeltaQuality: number;
  minAvgDeltaUtility: number;
  minAvgCandidateSemanticFinalScore: number;
  minCandidateRetryAcceptedRate: number;
};

export type ScriptBenchmarkGateResult = {
  ok: boolean;
  failures: string[];
};

function round(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageNullable(values: Array<number | null | undefined>): number | null {
  const normalized = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return normalized.length ? average(normalized) : null;
}

function rateNullable(values: Array<boolean | null | undefined>): number | null {
  const normalized = values.filter((value): value is boolean => typeof value === "boolean");
  if (!normalized.length) return null;
  const positives = normalized.filter(Boolean).length;
  return round(positives / normalized.length);
}

export function evaluateScriptBenchmarkCase(input: ScriptBenchmarkCase): ScriptBenchmarkCaseResult {
  const baseline = evaluateTechnicalScriptQuality(input.baseline.content, input.prompt);
  const candidate = evaluateTechnicalScriptQuality(input.candidate.content, input.prompt);
  const deltaQuality = round(candidate.perceivedQuality - baseline.perceivedQuality);
  const deltaUtility = round(candidate.utilityScore - baseline.utilityScore);

  return {
    id: input.id,
    prompt: input.prompt,
    baseline,
    candidate,
    deltaQuality,
    deltaUtility,
    baselineSemanticFinalScore:
      typeof input.baseline.semanticFinalScore === "number" ? input.baseline.semanticFinalScore : null,
    candidateSemanticFinalScore:
      typeof input.candidate.semanticFinalScore === "number" ? input.candidate.semanticFinalScore : null,
    baselineRetryAccepted:
      typeof input.baseline.retryAccepted === "boolean" ? input.baseline.retryAccepted : null,
    candidateRetryAccepted:
      typeof input.candidate.retryAccepted === "boolean" ? input.candidate.retryAccepted : null,
    passes: deltaQuality > 0 && deltaUtility > 0,
  };
}

export function summarizeScriptBenchmark(results: ScriptBenchmarkCaseResult[]): ScriptBenchmarkSummary {
  return {
    totalCases: results.length,
    passedCases: results.filter((item) => item.passes).length,
    avgBaselineQuality: average(results.map((item) => item.baseline.perceivedQuality)),
    avgCandidateQuality: average(results.map((item) => item.candidate.perceivedQuality)),
    avgDeltaQuality: average(results.map((item) => item.deltaQuality)),
    avgBaselineUtility: average(results.map((item) => item.baseline.utilityScore)),
    avgCandidateUtility: average(results.map((item) => item.candidate.utilityScore)),
    avgDeltaUtility: average(results.map((item) => item.deltaUtility)),
    avgBaselineSemanticFinalScore: averageNullable(results.map((item) => item.baselineSemanticFinalScore)),
    avgCandidateSemanticFinalScore: averageNullable(results.map((item) => item.candidateSemanticFinalScore)),
    baselineRetryAcceptedRate: rateNullable(results.map((item) => item.baselineRetryAccepted)),
    candidateRetryAcceptedRate: rateNullable(results.map((item) => item.candidateRetryAccepted)),
  };
}

export function formatScriptBenchmarkSummary(summary: ScriptBenchmarkSummary): string {
  const lines = [
    `cases=${summary.totalCases}`,
    `passed=${summary.passedCases}/${summary.totalCases}`,
    `quality=${summary.avgBaselineQuality.toFixed(3)} -> ${summary.avgCandidateQuality.toFixed(3)} (delta ${summary.avgDeltaQuality.toFixed(3)})`,
    `utility=${summary.avgBaselineUtility.toFixed(3)} -> ${summary.avgCandidateUtility.toFixed(3)} (delta ${summary.avgDeltaUtility.toFixed(3)})`,
  ];

  if (summary.avgBaselineSemanticFinalScore !== null || summary.avgCandidateSemanticFinalScore !== null) {
    lines.push(
      `semantic=${summary.avgBaselineSemanticFinalScore?.toFixed(2) ?? "—"} -> ${summary.avgCandidateSemanticFinalScore?.toFixed(2) ?? "—"}`
    );
  }
  if (summary.baselineRetryAcceptedRate !== null || summary.candidateRetryAcceptedRate !== null) {
    lines.push(
      `retryAccepted=${summary.baselineRetryAcceptedRate?.toFixed(3) ?? "—"} -> ${summary.candidateRetryAcceptedRate?.toFixed(3) ?? "—"}`
    );
  }

  return lines.join("\n");
}

export function evaluateScriptBenchmarkGate(
  summary: ScriptBenchmarkSummary,
  thresholds: ScriptBenchmarkThresholds
): ScriptBenchmarkGateResult {
  const failures: string[] = [];
  const passRate = summary.totalCases > 0 ? summary.passedCases / summary.totalCases : 0;

  if (summary.totalCases < thresholds.minCases) {
    failures.push(`dataset too small: ${summary.totalCases} < ${thresholds.minCases}`);
  }
  if (passRate < thresholds.minPassRate) {
    failures.push(`pass rate too low: ${passRate.toFixed(3)} < ${thresholds.minPassRate.toFixed(3)}`);
  }
  if (summary.avgCandidateQuality < thresholds.minAvgCandidateQuality) {
    failures.push(
      `candidate quality too low: ${summary.avgCandidateQuality.toFixed(3)} < ${thresholds.minAvgCandidateQuality.toFixed(3)}`
    );
  }
  if (summary.avgCandidateUtility < thresholds.minAvgCandidateUtility) {
    failures.push(
      `candidate utility too low: ${summary.avgCandidateUtility.toFixed(3)} < ${thresholds.minAvgCandidateUtility.toFixed(3)}`
    );
  }
  if (summary.avgDeltaQuality < thresholds.minAvgDeltaQuality) {
    failures.push(
      `quality delta too low: ${summary.avgDeltaQuality.toFixed(3)} < ${thresholds.minAvgDeltaQuality.toFixed(3)}`
    );
  }
  if (summary.avgDeltaUtility < thresholds.minAvgDeltaUtility) {
    failures.push(
      `utility delta too low: ${summary.avgDeltaUtility.toFixed(3)} < ${thresholds.minAvgDeltaUtility.toFixed(3)}`
    );
  }
  if (
    summary.avgCandidateSemanticFinalScore !== null &&
    summary.avgCandidateSemanticFinalScore < thresholds.minAvgCandidateSemanticFinalScore
  ) {
    failures.push(
      `candidate semantic score too low: ${summary.avgCandidateSemanticFinalScore.toFixed(2)} < ${thresholds.minAvgCandidateSemanticFinalScore.toFixed(2)}`
    );
  }
  if (
    summary.candidateRetryAcceptedRate !== null &&
    summary.candidateRetryAcceptedRate < thresholds.minCandidateRetryAcceptedRate
  ) {
    failures.push(
      `candidate retry acceptance too low: ${summary.candidateRetryAcceptedRate.toFixed(3)} < ${thresholds.minCandidateRetryAcceptedRate.toFixed(3)}`
    );
  }

  return {
    ok: failures.length === 0,
    failures,
  };
}

export { SCRIPT_BENCHMARK_CASES, SCRIPT_BENCHMARK_THRESHOLDS };
