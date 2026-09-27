import {
  classificationRequeueAfterMs,
  decideSyncClassificationEnqueue,
  isDeferredClassificationError,
  syncClassificationDeduplicationId,
} from "@/app/lib/classificationRequeue";
import { buildDeferredClassificationErrorMessage } from "@/app/lib/classificationAiErrors";

const NOW = new Date("2026-09-26T00:01:30.000Z");
const HOUR = 60 * 60 * 1000;
const SIX_HOURS = 6 * HOUR;

describe("classificationRequeue", () => {
  it("post recém-inserido vai para a fila na hora", () => {
    expect(decideSyncClassificationEnqueue(
      { classificationStatus: "pending", description: "legenda", classificationError: null, classificationLastQueuedAt: null },
      NOW, SIX_HOURS,
    )).toEqual({ enqueue: true });
  });

  it.each([
    buildDeferredClassificationErrorMessage("insufficient_quota"),
    buildDeferredClassificationErrorMessage("rate_limit"),
  ])("post adiado fica com o cron de recuperação: %s", (classificationError) => {
    expect(decideSyncClassificationEnqueue(
      { classificationStatus: "pending", description: "legenda", classificationError, classificationLastQueuedAt: null },
      NOW, SIX_HOURS,
    )).toEqual({ enqueue: false, reason: "deferred" });
  });

  it("post adiado continua com o cron mesmo depois da janela", () => {
    expect(decideSyncClassificationEnqueue(
      {
        classificationStatus: "pending",
        description: "legenda",
        classificationError: buildDeferredClassificationErrorMessage("insufficient_quota"),
        classificationLastQueuedAt: new Date(NOW.getTime() - 3 * 24 * HOUR),
      },
      NOW, SIX_HOURS,
    )).toEqual({ enqueue: false, reason: "deferred" });
  });

  it("não reenvia antes da janela", () => {
    expect(decideSyncClassificationEnqueue(
      { classificationStatus: "pending", description: "legenda", classificationLastQueuedAt: new Date(NOW.getTime() - HOUR) },
      NOW, SIX_HOURS,
    )).toEqual({ enqueue: false, reason: "recently_queued" });
  });

  it("reenvia depois da janela quando a mensagem se perdeu sem erro gravado", () => {
    expect(decideSyncClassificationEnqueue(
      { classificationStatus: "pending", description: "legenda", classificationLastQueuedAt: new Date(NOW.getTime() - 7 * HOUR).toISOString() },
      NOW, SIX_HOURS,
    )).toEqual({ enqueue: true });
  });

  it("ignora post concluído, falho ou sem legenda", () => {
    expect(decideSyncClassificationEnqueue({ classificationStatus: "completed", description: "legenda" }, NOW, SIX_HOURS))
      .toEqual({ enqueue: false, reason: "not_pending" });
    expect(decideSyncClassificationEnqueue({ classificationStatus: "failed", description: "legenda" }, NOW, SIX_HOURS))
      .toEqual({ enqueue: false, reason: "not_pending" });
    expect(decideSyncClassificationEnqueue({ classificationStatus: "pending", description: "   " }, NOW, SIX_HOURS))
      .toEqual({ enqueue: false, reason: "no_description" });
  });

  it("reconhece os mesmos erros que o cron reenvia", () => {
    expect(isDeferredClassificationError("Classificação adiada: saldo/quota da IA indisponível.")).toBe(true);
    expect(isDeferredClassificationError("429 Too Many Requests")).toBe(true);
    expect(isDeferredClassificationError("RESOURCE_EXHAUSTED")).toBe(true);
    expect(isDeferredClassificationError("Erro na IA: resposta inválida")).toBe(false);
    expect(isDeferredClassificationError(null)).toBe(false);
  });

  it("janela vem de INTELLIGENCE_RECOVERY_REQUEUE_HOURS, com 6 horas como padrão", () => {
    expect(classificationRequeueAfterMs({ INTELLIGENCE_RECOVERY_REQUEUE_HOURS: "12" })).toBe(12 * HOUR);
    expect(classificationRequeueAfterMs({})).toBe(SIX_HOURS);
    expect(classificationRequeueAfterMs({ INTELLIGENCE_RECOVERY_REQUEUE_HOURS: "abc" })).toBe(SIX_HOURS);
    expect(classificationRequeueAfterMs({ INTELLIGENCE_RECOVERY_REQUEUE_HOURS: "0" })).toBe(SIX_HOURS);
  });

  it("deduplicação é por post e hora, sem dois-pontos", () => {
    const id = syncClassificationDeduplicationId("66f0c0ffee", NOW);
    expect(id).toBe("classification-sync-66f0c0ffee-2026-09-26T00");
    expect(id).not.toContain(":");
    expect(syncClassificationDeduplicationId("66f0c0ffee", new Date("2026-09-26T00:59:59.000Z"))).toBe(id);
  });
});
