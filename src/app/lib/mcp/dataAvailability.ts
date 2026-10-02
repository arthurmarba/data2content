/**
 * Por que um número falta. Resposta vazia sem motivo é indistinguível de "zero" —
 * foi assim que um criador concluiu que nenhum post dele trazia seguidor, quando
 * o Instagram simplesmente não informa esse número para Reels.
 *
 * Tudo aqui é puro (sem banco): nenhuma ferramenta inventa o número que falta,
 * só diz qual das causas é. A contagem no banco mora em `catalog.ts`.
 */
/** A sincronização periódica roda à meia-noite e ao meio-dia (UTC). */
export const INSTAGRAM_SYNC_CADENCE_HOURS = 12;

/** O Instagram só informa estas métricas para foto e carrossel; para Reel, nunca. */
export const METRICS_NOT_REPORTED_FOR_REELS = ["follows", "profile_visits"] as const;

export const DATA_FRESHNESS_NOTE =
  `Posts e números do Instagram são atualizados a cada ${INSTAGRAM_SYNC_CADENCE_HOURS} horas. ` +
  `Um post publicado agora pode levar até ${INSTAGRAM_SYNC_CADENCE_HOURS} horas para aparecer, ` +
  "e os números de um post continuam subindo por dias.";

export const REEL_FOLLOWER_METRICS_NOTE =
  "O Instagram não informa seguidores ganhos nem visitas ao perfil por Reel — só por foto e carrossel. " +
  "Em Reels, a ausência desses números não é zero: é dado que o Instagram não entrega. " +
  "Para crescimento de seguidores, use get_follower_growth.";

export type MetricGapReason =
  | "no_posts_in_period"
  | "instagram_does_not_report_for_reels"
  | "missing_for_posts_in_period";

export interface MetricGap {
  metric: string;
  reason: MetricGapReason;
  note: string;
}

export interface PostFormatCounts {
  reel: number;
  carousel: number;
  photo: number;
  other: number;
}

export function isReelOnlyGapMetric(metric: string): boolean {
  return (METRICS_NOT_REPORTED_FOR_REELS as readonly string[]).includes(metric);
}

/**
 * A causa de um número faltar num conjunto de posts. `null` quando nada falta.
 * Para as métricas que o Instagram não dá em Reel, a causa é essa sempre que só
 * Reels ficaram sem o número — mesmo se houver foto com ele.
 */
export function explainMetricGap(params: {
  metric: string;
  postsInPeriod: number;
  postsWithMetric: number;
  byFormat: PostFormatCounts;
}): MetricGap | null {
  const { metric, postsInPeriod, postsWithMetric, byFormat } = params;
  if (postsInPeriod === 0) {
    return { metric, reason: "no_posts_in_period", note: "Não há post no período pedido." };
  }
  if (postsWithMetric >= postsInPeriod) return null;
  const nonReels = postsInPeriod - byFormat.reel;
  if (isReelOnlyGapMetric(metric) && byFormat.reel > 0 && postsWithMetric >= nonReels) {
    return { metric, reason: "instagram_does_not_report_for_reels", note: REEL_FOLLOWER_METRICS_NOTE };
  }
  return {
    metric,
    reason: "missing_for_posts_in_period",
    note: `${postsInPeriod - postsWithMetric} de ${postsInPeriod} posts do período estão sem este número no Instagram.`,
  };
}

export function formatOfType(type: unknown): keyof PostFormatCounts {
  const value = String(type ?? "").toUpperCase();
  if (value === "REEL" || value === "VIDEO") return "reel";
  if (value === "CAROUSEL_ALBUM") return "carousel";
  if (value === "IMAGE") return "photo";
  return "other";
}
