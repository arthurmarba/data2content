import { buildRhythmInsights, type RhythmPost } from "./audienceRhythmInsights";

// Datas fixas em UTC (tz='UTC' nos testes p/ determinismo).
// 2025-01 quartas: 01,08,15,22,29 | segundas: 06,13,20,27 | sextas: 03,10,17,24,31
const post = (iso: string, saves: number, shares = 0): RhythmPost => ({
  postDate: new Date(iso),
  saves,
  shares,
});

const TZ = "UTC";

describe("buildRhythmInsights", () => {
  it("detects a standout weekday by saves", () => {
    const posts: RhythmPost[] = [
      // 5 quartas com saves altos
      post("2025-01-01T12:00:00Z", 10), post("2025-01-08T12:00:00Z", 10),
      post("2025-01-15T12:00:00Z", 10), post("2025-01-22T12:00:00Z", 10),
      post("2025-01-29T12:00:00Z", 10),
      // 5 segundas baixas
      post("2025-01-06T12:00:00Z", 1), post("2025-01-13T12:00:00Z", 1),
      post("2025-01-20T12:00:00Z", 1), post("2025-01-27T12:00:00Z", 1),
      post("2025-02-03T12:00:00Z", 1),
      // 5 sextas baixas
      post("2025-01-03T12:00:00Z", 1), post("2025-01-10T12:00:00Z", 1),
      post("2025-01-17T12:00:00Z", 1), post("2025-01-24T12:00:00Z", 1),
      post("2025-01-31T12:00:00Z", 1),
    ];
    const insights = buildRhythmInsights(posts, TZ);
    const day = insights.find((i) => i.kind === "dayOfWeek");
    expect(day?.label).toBe("às quartas");
    expect(day?.signal).toBe("saves");
    expect(day!.score).toBeGreaterThan(1.4);
  });

  it("does NOT flag a weekday on a near-tie", () => {
    const posts: RhythmPost[] = [
      post("2025-01-01T12:00:00Z", 10), post("2025-01-08T12:00:00Z", 10),
      post("2025-01-15T12:00:00Z", 10), post("2025-01-22T12:00:00Z", 10),
      // segundas quase iguais (10 vs 9 → dentro da margem de empate)
      post("2025-01-06T12:00:00Z", 9), post("2025-01-13T12:00:00Z", 9),
      post("2025-01-20T12:00:00Z", 9), post("2025-01-27T12:00:00Z", 9),
      post("2025-01-03T12:00:00Z", 9), post("2025-01-10T12:00:00Z", 9),
      post("2025-01-17T12:00:00Z", 9), post("2025-01-24T12:00:00Z", 9),
    ];
    expect(buildRhythmInsights(posts, TZ).find((i) => i.kind === "dayOfWeek")).toBeUndefined();
  });

  it("does NOT flag below the total-volume floor", () => {
    const posts: RhythmPost[] = [
      post("2025-01-01T12:00:00Z", 10), post("2025-01-08T12:00:00Z", 10),
      post("2025-01-06T12:00:00Z", 1), post("2025-01-13T12:00:00Z", 1),
    ]; // só 4 posts < 12
    expect(buildRhythmInsights(posts, TZ)).toEqual([]);
  });

  it("detects a standout time-of-day by saves", () => {
    // tudo na mesma data (quarta) p/ isolar o eixo de horário
    const at = (h: string, s: number) => post(`2025-01-01T${h}:00:00Z`, s);
    const posts: RhythmPost[] = [
      at("20", 10), at("21", 10), at("19", 10), at("22", 10), at("20", 10), // noite
      at("09", 1), at("10", 1), at("08", 1), at("11", 1), at("09", 1), // manhã
      at("14", 1), at("15", 1), at("13", 1), at("16", 1), at("14", 1), // tarde
    ];
    const t = buildRhythmInsights(posts, TZ).find((i) => i.kind === "timeOfDay");
    expect(t?.label).toBe("à noite");
  });

  it("uses shares as a signal when saves are flat", () => {
    const posts: RhythmPost[] = [
      // saves constantes (sem insight de saves), shares altos nas quartas
      post("2025-01-01T12:00:00Z", 2, 8), post("2025-01-08T12:00:00Z", 2, 8),
      post("2025-01-15T12:00:00Z", 2, 8), post("2025-01-22T12:00:00Z", 2, 8),
      post("2025-01-06T12:00:00Z", 2, 1), post("2025-01-13T12:00:00Z", 2, 1),
      post("2025-01-20T12:00:00Z", 2, 1), post("2025-01-27T12:00:00Z", 2, 1),
      post("2025-01-03T12:00:00Z", 2, 1), post("2025-01-10T12:00:00Z", 2, 1),
      post("2025-01-17T12:00:00Z", 2, 1), post("2025-01-24T12:00:00Z", 2, 1),
    ];
    const day = buildRhythmInsights(posts, TZ).find((i) => i.kind === "dayOfWeek");
    expect(day?.signal).toBe("shares");
    expect(day?.label).toBe("às quartas");
  });

  it("returns [] for empty input", () => {
    expect(buildRhythmInsights([], TZ)).toEqual([]);
  });
});
