import type { ScriptStructurePattern } from "./scriptAdjustmentRecommendation";

export const STRUCTURE_PATTERN_LABELS: Record<ScriptStructurePattern, string> = {
  problem_demo_explanation_action: "Problema, demonstração e correção",
  result_process_explanation: "Resultado antes do processo",
  question_proof_answer: "Pergunta, prova e resposta",
  before_after_reason_guidance: "Antes e depois com orientação",
  claim_test_verdict: "Opinião, teste e conclusão",
  scene_tension_turn: "Cena, tensão e virada",
  context_process_result: "Contexto, processo e resultado",
  direct_explanation: "Explicação direta",
};

export type CreatorStructureEvidence = {
  pattern: ScriptStructurePattern;
  label: string;
  sourceForm: string;
  posts: number;
  performanceIndex: number;
  outcomeSignals: Array<"retention" | "watch_time" | "deep_engagement">;
};

export type CreatorStructureEvidenceMetric = {
  narrativeForm?: string[] | string | null;
  stats?: Record<string, unknown> | null;
};

function values(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[_-]+/g, " ").trim();
}

export function structurePatternFromNarrativeForm(value: string): ScriptStructurePattern {
  const form = normalize(value);
  if (/tutorial|passo a passo|unboxing/.test(form)) return "problem_demo_explanation_action";
  if (/comparacao|comparison|antes e depois/.test(form)) return "before_after_reason_guidance";
  if (/perguntas e respostas|q and a|q&a/.test(form)) return "question_proof_answer";
  if (/review|avaliacao|reaction/.test(form)) return "claim_test_verdict";
  if (/cena|esquete|sketch/.test(form)) return "scene_tension_turn";
  if (/bastidores|rotina|vlog|day in the life/.test(form)) return "context_process_result";
  if (/clipe|corte|atualizacao|noticia/.test(form)) return "result_process_explanation";
  return "direct_explanation";
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function median(items: number[]): number | null {
  if (items.length === 0) return null;
  const sorted = [...items].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : sorted[middle] ?? null;
}

function signals(metric: CreatorStructureEvidenceMetric) {
  const stats = metric.stats ?? {};
  const reach = finite(stats.reach ?? stats.accounts_reached);
  const duration = finite(stats.video_duration_seconds);
  const watchMs = finite(stats.ig_reels_avg_watch_time);
  const retention = finite(stats.retention_rate);
  const comments = finite(stats.comments) ?? 0;
  const saves = finite(stats.saved ?? stats.saves) ?? 0;
  const shares = finite(stats.shares) ?? 0;
  return {
    retention,
    watchRatio: watchMs !== null && duration !== null && duration > 0 ? Math.min(2, watchMs / 1000 / duration) : null,
    deep: reach !== null && reach > 0 ? (comments + saves + shares) / reach : null,
  };
}

export function buildCreatorStructureEvidenceFromMetrics(
  metrics: CreatorStructureEvidenceMetric[],
  limit = 4,
): CreatorStructureEvidence[] {
  const eligible = metrics.flatMap((metric) => values(metric.narrativeForm).map((sourceForm) => ({ metric, sourceForm, pattern: structurePatternFromNarrativeForm(sourceForm), signals: signals(metric) })));
  const baseline = {
    retention: median(eligible.flatMap((item) => item.signals.retention === null ? [] : [item.signals.retention])),
    watchRatio: median(eligible.flatMap((item) => item.signals.watchRatio === null ? [] : [item.signals.watchRatio])),
    deep: median(eligible.flatMap((item) => item.signals.deep === null ? [] : [item.signals.deep])),
  };
  const grouped = new Map<ScriptStructurePattern, { sourceForms: string[]; scores: number[]; signals: Set<CreatorStructureEvidence["outcomeSignals"][number]> }>();
  for (const item of eligible) {
    const relative = [
      { key: "retention" as const, value: item.signals.retention, base: baseline.retention, weight: 0.4 },
      { key: "watch_time" as const, value: item.signals.watchRatio, base: baseline.watchRatio, weight: 0.4 },
      { key: "deep_engagement" as const, value: item.signals.deep, base: baseline.deep, weight: 0.2 },
    ].filter((entry) => entry.value !== null && entry.base !== null && entry.base > 0);
    const weight = relative.reduce((sum, entry) => sum + entry.weight, 0);
    const score = weight > 0 ? relative.reduce((sum, entry) => sum + Math.min(3, entry.value! / entry.base!) * entry.weight, 0) / weight : 1;
    const group = grouped.get(item.pattern) ?? { sourceForms: [], scores: [], signals: new Set() };
    group.sourceForms.push(item.sourceForm);
    group.scores.push(score);
    relative.forEach((entry) => group.signals.add(entry.key));
    grouped.set(item.pattern, group);
  }

  return [...grouped.entries()]
    .map(([pattern, group]) => ({
      pattern,
      label: STRUCTURE_PATTERN_LABELS[pattern],
      sourceForm: group.sourceForms[0] ?? STRUCTURE_PATTERN_LABELS[pattern],
      posts: group.scores.length,
      performanceIndex: Math.round((group.scores.reduce((sum, score) => sum + score, 0) / group.scores.length) * 100) / 100,
      outcomeSignals: [...group.signals],
    }))
    .sort((a, b) => b.performanceIndex - a.performanceIndex || b.posts - a.posts)
    .slice(0, Math.max(0, limit));
}

