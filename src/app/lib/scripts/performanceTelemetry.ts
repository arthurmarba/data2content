type ScriptsPerformanceStage =
  | "intelligence.total"
  | "intelligence.ranking"
  | "intelligence.captions"
  | "intelligence.style_profile"
  | "llm.call";

type StageWindow = {
  samples: number[];
  count: number;
  lastMs: number;
  updatedAt: number;
};

export type ScriptsPerformancePercentiles = {
  count: number;
  p50: number;
  p95: number;
  avg: number;
  lastMs: number;
  windowSize: number;
  updatedAt: string;
};

const WINDOW_SIZE = (() => {
  const parsed = Number(process.env.SCRIPTS_PERF_SAMPLE_WINDOW ?? 200);
  return Number.isFinite(parsed) && parsed >= 20 ? Math.floor(parsed) : 200;
})();

const stageStore = new Map<ScriptsPerformanceStage, StageWindow>();

function sanitizeDurationMs(durationMs: number): number {
  if (!Number.isFinite(durationMs)) return 0;
  if (durationMs < 0) return 0;
  return Math.round(durationMs);
}

function percentile(values: number[], pct: number): number {
  if (!values.length) return 0;
  const rank = Math.ceil((pct / 100) * values.length);
  const index = Math.min(values.length - 1, Math.max(0, rank - 1));
  return values[index] || 0;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round(total / values.length);
}

export function recordScriptsStageDuration(stage: ScriptsPerformanceStage, durationMs: number) {
  const value = sanitizeDurationMs(durationMs);
  const current = stageStore.get(stage) || {
    samples: [],
    count: 0,
    lastMs: 0,
    updatedAt: Date.now(),
  };

  current.samples.push(value);
  if (current.samples.length > WINDOW_SIZE) {
    current.samples.shift();
  }

  current.count += 1;
  current.lastMs = value;
  current.updatedAt = Date.now();
  stageStore.set(stage, current);
}

export function getScriptsPerformanceSnapshot(): Partial<Record<ScriptsPerformanceStage, ScriptsPerformancePercentiles>> {
  const snapshot: Partial<Record<ScriptsPerformanceStage, ScriptsPerformancePercentiles>> = {};

  for (const [stage, window] of stageStore.entries()) {
    if (!window.samples.length) continue;
    const sorted = [...window.samples].sort((a, b) => a - b);
    snapshot[stage] = {
      count: window.count,
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      avg: average(sorted),
      lastMs: window.lastMs,
      windowSize: window.samples.length,
      updatedAt: new Date(window.updatedAt).toISOString(),
    };
  }

  return snapshot;
}

export function clearScriptsPerformanceTelemetry() {
  stageStore.clear();
}
