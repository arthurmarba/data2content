/**
 * statsFreeze.ts — os números congelados da semana e as regras de refechar. Sem banco.
 *
 * A regra inteira cabe numa frase: o que estava medido na segunda fica; o que faltava
 * completa depois. Números entram congelados no primeiro fechamento que os encontra;
 * leitura de cena (assunto, tom, asset, gancho) entra em qualquer refechamento.
 *
 * O banco fica em statsFreezeStore.ts. Ver também o modelo `WeeklyStatsFreeze`.
 */

import type { ReportPost } from "./postMetrics";
import type { WeekWindow } from "./weekWindow";

/**
 * Os campos de `Metric.stats` que o relatório lê — e só eles, para caber no plano
 * gratuito do Atlas. Mexeu num extrator de postMetrics.ts? Confira esta lista: o
 * teste de paridade em statsFreeze.test.ts acusa campo esquecido.
 */
export const FROZEN_STATS_KEYS = [
  "reach",
  "views",
  "video_views",
  "likes",
  "comments",
  "shares",
  "saved",
  "total_interactions",
  "engagement_rate_on_reach",
  "ig_reels_avg_watch_time",
  "video_duration_seconds",
] as const;

export type FrozenStatsKey = (typeof FROZEN_STATS_KEYS)[number];
export type FrozenStats = Partial<Record<FrozenStatsKey, number>>;

export function pickFrozenStats(stats: Record<string, unknown> | null | undefined): FrozenStats {
  const picked: FrozenStats = {};
  for (const key of FROZEN_STATS_KEYS) {
    const value = stats?.[key];
    if (typeof value === "number" && Number.isFinite(value)) picked[key] = value;
  }
  return picked;
}

/**
 * O post "tem número" quando a Meta já devolveu alcance ou visualização.
 *
 * De ~06/09 a 25/09/2026 a sincronização guardava Reels sem nenhum dos dois (a Meta
 * recusava `follows` e a consulta inteira caía). Congelar aquilo seria congelar o
 * vazio para sempre; sem número, o post espera o próximo fechamento.
 */
export function hasMeasuredStats(stats: Record<string, unknown> | null | undefined): boolean {
  const positive = (key: FrozenStatsKey) => {
    const value = stats?.[key];
    return typeof value === "number" && Number.isFinite(value) && value > 0;
  };
  return positive("reach") || positive("views") || positive("video_views");
}

export interface WeekMetricStats {
  id: string;
  stats?: Record<string, unknown> | null;
}

/** Posts da semana que entram agora: medidos e ainda não congelados. */
export function entriesToFreeze(
  metrics: readonly WeekMetricStats[],
  alreadyFrozen: ReadonlySet<string>,
): Array<{ id: string; stats: FrozenStats }> {
  const seen = new Set<string>();
  const entries: Array<{ id: string; stats: FrozenStats }> = [];
  for (const metric of metrics) {
    if (alreadyFrozen.has(metric.id) || seen.has(metric.id)) continue;
    if (!hasMeasuredStats(metric.stats)) continue;
    seen.add(metric.id);
    entries.push({ id: metric.id, stats: pickFrozenStats(metric.stats) });
  }
  return entries;
}

/**
 * Os números congelados por post. Se o mesmo post aparecer duas vezes (dois
 * fechamentos simultâneos), vale o primeiro: número congelado não se reescreve.
 */
export function frozenStatsById(
  entries: readonly { metric: unknown; stats?: Record<string, unknown> | null }[],
): Map<string, FrozenStats> {
  const byId = new Map<string, FrozenStats>();
  for (const entry of entries) {
    const id = String(entry.metric);
    if (byId.has(id)) continue;
    byId.set(id, pickFrozenStats(entry.stats));
  }
  return byId;
}

/**
 * Só se congela semana que já terminou. `--week=` aponta para qualquer semana, e
 * congelar a semana em curso gravaria números de meio de semana como definitivos.
 */
export function weekHasEnded(week: Pick<WeekWindow, "endsAt">, now: Date = new Date()): boolean {
  return now.getTime() > week.endsAt.getTime();
}

// ─── Refechar ────────────────────────────────────────────────────────────────

/**
 * Refechar semana que já tem retrato mas não tem números congelados grava os números
 * DE HOJE — é o que acontecia antes de existir o congelamento. Só com confirmação.
 */
export function reclosingNeedsConsent(params: {
  hasReport: boolean;
  hasFreeze: boolean;
  dryRun: boolean;
  acceptTodayStats: boolean;
}): boolean {
  return params.hasReport && !params.hasFreeze && !params.dryRun && !params.acceptTodayStats;
}

export class ReclosingWithoutFrozenStatsError extends Error {
  constructor(weekKey: string) {
    super(
      `A semana ${weekKey} já foi fechada e não tem números congelados: refechar agora grava ` +
        `os números de hoje. Confira com --dry-run e, se for isso mesmo, repita com ` +
        `--aceitar-numeros-de-hoje (na rota: aceitarNumerosDeHoje=1).`,
    );
    this.name = "ReclosingWithoutFrozenStatsError";
  }
}

/** Gravar retrato de semana em curso congelaria números de meio de semana. */
export class WeekNotEndedError extends Error {
  constructor(weekKey: string) {
    super(
      `A semana ${weekKey} ainda não terminou: gravar agora congelaria números de meio de ` +
        `semana e travaria o fechamento de segunda. Use --dry-run para olhar.`,
    );
    this.name = "WeekNotEndedError";
  }
}

export type PredictionWritePlan =
  /** A semana seguinte já mediu esta aposta: reescrever o enunciado quebraria a prestação de contas. */
  | { action: "keep-resolved" }
  /** Grava a aposta e apaga aposta não resolvida de OUTRO território na mesma semana. */
  | { action: "write" }
  /** Refechar não achou aposta: some a antiga não resolvida, para não medir o que o retrato não diz. */
  | { action: "clear-unresolved" }
  | { action: "none" };

export function planPredictionWrite(
  existing: readonly { resolvedAt?: Date | null }[],
  hasNewPrediction: boolean,
): PredictionWritePlan {
  if (existing.some((prediction) => prediction.resolvedAt)) return { action: "keep-resolved" };
  if (hasNewPrediction) return { action: "write" };
  return existing.length > 0 ? { action: "clear-unresolved" } : { action: "none" };
}

// ─── Cobertura ───────────────────────────────────────────────────────────────

/** Quanto da semana o retrato conseguiu ler. Vai gravado junto com o retrato. */
export interface WeekCoverage {
  posts: number;
  /** Com alcance ou visualização. */
  withStats: number;
  /** Com números congelados (os demais usam o número do dia). */
  frozen: number;
  /** Com a legenda classificada. */
  classified: number;
  /** Com leitura de cena — a fonte de assunto, tom, asset e gancho. */
  sceneRead: number;
}

export function coverageOf(
  posts: readonly ReportPost[],
  classifiedIds: ReadonlySet<string>,
  frozenIds: ReadonlySet<string>,
): WeekCoverage {
  const measured = (post: ReportPost) =>
    (post.absolute.alcance ?? 0) > 0 || (post.absolute.visualizacoes ?? 0) > 0;
  return {
    posts: posts.length,
    withStats: posts.filter(measured).length,
    frozen: posts.filter((post) => frozenIds.has(post.id)).length,
    classified: posts.filter((post) => classifiedIds.has(post.id)).length,
    sceneRead: posts.filter((post) => post.sceneRead).length,
  };
}
