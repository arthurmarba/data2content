/**
 * Quem pode reenviar um post à classificação de texto, e quando.
 *
 * Há duas portas para o worker `/api/worker/classify-content`:
 * - a sincronização do Instagram (`saveMetricData`), que manda o post novo na hora;
 * - o cron `recover-content-intelligence`, retaguarda de quem ficou "Classificação adiada".
 *
 * Em 26/09/2026, com as duas IAs sem saldo, a sincronização reenviava todo post
 * pendente duas vezes por dia: 1.021 posts viraram 15.657 mensagens na DLQ em uma
 * semana. A regra daqui separa as portas: post adiado é do cron, e ninguém reenvia
 * o mesmo post antes da janela de `INTELLIGENCE_RECOVERY_REQUEUE_HOURS`.
 */

const DEFAULT_REQUEUE_HOURS = 6;

/** Erro gravado pelo worker quando a IA recusou por saldo ou limite. O cron só
 * reenvia posts cujo erro casa com este padrão; a sincronização pula exatamente esses. */
export const DEFERRED_CLASSIFICATION_ERROR =
  /(classifica.{0,8}adiada|rate.?limit|quota|saldo|resource_exhausted|too many requests)/i;

export function classificationRequeueAfterMs(
  env: Record<string, string | undefined> = process.env,
): number {
  const hours = Number(env.INTELLIGENCE_RECOVERY_REQUEUE_HOURS);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_REQUEUE_HOURS;
  return safeHours * 60 * 60 * 1000;
}

export function isDeferredClassificationError(message: string | null | undefined): boolean {
  return Boolean(message && DEFERRED_CLASSIFICATION_ERROR.test(message));
}

type MetricClassificationState = {
  classificationStatus?: string | null;
  description?: string | null;
  classificationError?: string | null;
  classificationLastQueuedAt?: Date | string | null;
};

export type SyncClassificationDecision =
  | { enqueue: true }
  | { enqueue: false; reason: "not_pending" | "no_description" | "deferred" | "recently_queued" };

/** Decide se a sincronização do Instagram deve mandar o post ao worker agora. */
export function decideSyncClassificationEnqueue(
  metric: MetricClassificationState,
  now: Date = new Date(),
  requeueAfterMs: number = classificationRequeueAfterMs(),
): SyncClassificationDecision {
  if (metric.classificationStatus !== "pending") return { enqueue: false, reason: "not_pending" };
  if (!metric.description?.trim()) return { enqueue: false, reason: "no_description" };
  if (isDeferredClassificationError(metric.classificationError)) return { enqueue: false, reason: "deferred" };

  const lastQueuedAt = metric.classificationLastQueuedAt ? new Date(metric.classificationLastQueuedAt) : null;
  if (lastQueuedAt && !Number.isNaN(lastQueuedAt.getTime()) && now.getTime() - lastQueuedAt.getTime() < requeueAfterMs) {
    return { enqueue: false, reason: "recently_queued" };
  }
  return { enqueue: true };
}

/** Um envio por post por hora, como o cron. Sem ":" — a QStash recusa (HTTP 400). */
export function syncClassificationDeduplicationId(metricId: string, now: Date = new Date()): string {
  return `classification-sync-${metricId}-${now.toISOString().slice(0, 13)}`;
}
