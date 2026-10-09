/** @jest-environment node */
import { explainMetricGap } from "./dataAvailability";

const formats = (reel: number, photo = 0) => ({ reel, carousel: 0, photo, other: 0 });

describe("motivo de um número faltar", () => {
  it("conta só de Reels: o Instagram não informa seguidores", () => {
    expect(explainMetricGap({ metric: "follows", postsInPeriod: 33, postsWithMetric: 0, byFormat: formats(33) }))
      .toMatchObject({ reason: "instagram_does_not_report_for_reels" });
  });

  it("fotos com o número e Reels sem: ainda é o limite do Instagram", () => {
    expect(explainMetricGap({ metric: "follows", postsInPeriod: 10, postsWithMetric: 4, byFormat: formats(6, 4) }))
      .toMatchObject({ reason: "instagram_does_not_report_for_reels" });
  });

  it("foto sem o número é lacuna de verdade", () => {
    expect(explainMetricGap({ metric: "follows", postsInPeriod: 10, postsWithMetric: 2, byFormat: formats(6, 4) }))
      .toMatchObject({ reason: "missing_for_posts_in_period" });
  });

  it("alcance faltando em Reel não é culpa do Instagram", () => {
    expect(explainMetricGap({ metric: "reach", postsInPeriod: 17, postsWithMetric: 16, byFormat: formats(17) }))
      .toMatchObject({ reason: "missing_for_posts_in_period", note: "1 de 17 posts do período estão sem este número no Instagram." });
  });

  it("nada falta: sem motivo", () => {
    expect(explainMetricGap({ metric: "reach", postsInPeriod: 3, postsWithMetric: 3, byFormat: formats(3) })).toBeNull();
  });

  it("período vazio diz que não há post", () => {
    expect(explainMetricGap({ metric: "follows", postsInPeriod: 0, postsWithMetric: 0, byFormat: formats(0) }))
      .toMatchObject({ reason: "no_posts_in_period" });
  });
});
