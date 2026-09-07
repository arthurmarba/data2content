/** @jest-environment node */
import { buildDailyFollowerGrowth, type DailyFollowerClose } from "./dailyFollowerGrowth";

const close = (date: string, followers: number, readings = 2): DailyFollowerClose => ({
  date,
  followers,
  measuredAt: new Date(`${date}T23:00:00.000Z`),
  readings,
});

const period = { startDate: "2026-09-01", endDate: "2026-09-05", timeZone: "America/Sao_Paulo" };

describe("ganho de seguidores por dia", () => {
  it("calcula o ganho como diferença entre fechamentos consecutivos", () => {
    const result = buildDailyFollowerGrowth({
      ...period,
      baseline: { followers: 1000, measuredAt: new Date("2026-08-31T23:00:00Z"), date: "2026-08-31" },
      closes: [close("2026-09-01", 1010), close("2026-09-02", 1035), close("2026-09-03", 1030)],
    });

    expect(result.days.map((day) => [day.date, day.netGain, day.daysCovered])).toEqual([
      ["2026-09-01", 10, 1],
      ["2026-09-02", 25, 1],
      ["2026-09-03", -5, 1],
    ]);
    expect(result.summary).toMatchObject({
      netGain: 30,
      followersAtStart: 1000,
      followersAtEnd: 1030,
      bestDay: { date: "2026-09-02", netGain: 25 },
      worstDay: { date: "2026-09-03", netGain: -5 },
      daysWithLoss: 1,
    });
  });

  it("não transforma dia sem leitura em zero nem espalha o ganho pelo buraco", () => {
    const result = buildDailyFollowerGrowth({
      ...period,
      baseline: { followers: 1000, measuredAt: new Date("2026-08-31T23:00:00Z"), date: "2026-08-31" },
      closes: [close("2026-09-01", 1010), close("2026-09-04", 1040)],
    });

    // 02 e 03 não existem na série: a variação de 30 pertence a três dias, e diz isso.
    expect(result.days.map((day) => day.date)).toEqual(["2026-09-01", "2026-09-04"]);
    expect(result.days[1]).toMatchObject({ netGain: 30, daysCovered: 3 });
    expect(result.coverage).toMatchObject({
      calendarDays: 5,
      daysWithReading: 2,
      transitionsSpanningGaps: 1,
    });
    expect(result.coverage.warnings).toEqual(
      expect.arrayContaining(["collection_gaps_span_multiple_days", "partial_daily_coverage"]),
    );
  });

  it("deixa o primeiro dia sem ganho quando não há leitura anterior ao período", () => {
    const result = buildDailyFollowerGrowth({
      ...period,
      baseline: null,
      closes: [close("2026-09-01", 1010), close("2026-09-02", 1020)],
    });

    expect(result.days[0]).toMatchObject({ netGain: null, daysCovered: null });
    expect(result.summary.followersAtStart).toBeNull();
    expect(result.summary.netGain).toBe(10);
    expect(result.coverage.hasBaselineBeforePeriod).toBe(false);
    expect(result.coverage.warnings).toContain("first_day_has_no_prior_reading");
  });

  it("conta a distância real até a referência, mesmo que ela seja antiga", () => {
    const result = buildDailyFollowerGrowth({
      ...period,
      baseline: { followers: 900, measuredAt: new Date("2026-08-25T23:00:00Z"), date: "2026-08-25" },
      closes: [close("2026-09-01", 1000)],
    });

    expect(result.days[0]).toMatchObject({ netGain: 100, daysCovered: 7 });
    expect(result.coverage.transitionsSpanningGaps).toBe(1);
  });

  it("não inventa número quando o período não tem leitura nenhuma", () => {
    const result = buildDailyFollowerGrowth({ ...period, baseline: null, closes: [] });

    expect(result.days).toEqual([]);
    expect(result.summary).toMatchObject({
      netGain: null,
      followersAtStart: null,
      followersAtEnd: null,
      averageGainPerMeasuredDay: null,
      bestDay: null,
      worstDay: null,
    });
    expect(result.coverage.warnings).toContain("no_follower_readings_in_period");
  });

  it("não deixa o dia em curso disputar melhor ou pior dia", () => {
    const result = buildDailyFollowerGrowth({
      ...period,
      today: "2026-09-03",
      baseline: { followers: 1000, measuredAt: new Date("2026-08-31T23:00:00Z"), date: "2026-08-31" },
      // O dia de hoje tem só a manhã: +2 contra +10 e +40 dos dias fechados.
      closes: [close("2026-09-01", 1010), close("2026-09-02", 1050), close("2026-09-03", 1052, 1)],
    });

    expect(result.days.map((day) => day.dayIsComplete)).toEqual([true, true, false]);
    expect(result.summary.bestDay).toEqual({ date: "2026-09-02", netGain: 40 });
    expect(result.summary.worstDay).toEqual({ date: "2026-09-01", netGain: 10 });
    expect(result.summary.inProgressDay).toEqual({ date: "2026-09-03", netGain: 2 });
    // O saldo do período continua somando tudo, inclusive o parcial de hoje.
    expect(result.summary.netGain).toBe(52);
    expect(result.coverage.warnings).toContain("last_day_still_in_progress");
  });

  it("não conta o dia em curso como dia negativo", () => {
    const result = buildDailyFollowerGrowth({
      ...period,
      today: "2026-09-02",
      baseline: { followers: 1000, measuredAt: new Date("2026-08-31T23:00:00Z"), date: "2026-08-31" },
      closes: [close("2026-09-01", 1010), close("2026-09-02", 1008, 1)],
    });

    expect(result.summary.daysWithLoss).toBe(0);
    expect(result.summary.inProgressDay).toEqual({ date: "2026-09-02", netGain: -2 });
  });

  it("declara que o ganho é derivado e líquido, não um número do Instagram", () => {
    const result = buildDailyFollowerGrowth({ ...period, baseline: null, closes: [close("2026-09-01", 10)] });

    expect(result.receipt).toMatchObject({
      source: "account_followers_snapshot_difference",
      gainIsDerivedNotReportedByInstagram: true,
      gainIsNetOfUnfollows: true,
      gapsAreNotSpreadAcrossDays: true,
    });
  });
});
