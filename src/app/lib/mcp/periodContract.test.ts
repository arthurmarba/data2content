import { resolveMcpPeriod } from "./periodContract";

describe("MCP semantic period contract", () => {
  const now = new Date("2026-08-25T21:19:00.000Z");

  it("distinguishes rolling seven days from the last closed week", () => {
    const rolling = resolveMcpPeriod({ periodPreset: "rolling_7_days" }, now);
    const closed = resolveMcpPeriod({ periodPreset: "last_closed_week" }, now);

    expect(rolling.startsAt.toISOString()).toBe("2026-08-18T21:19:00.000Z");
    expect(rolling.endsAt.toISOString()).toBe(now.toISOString());
    expect(rolling.isClosed).toBe(false);
    expect(closed.startsAt.toISOString()).toBe("2026-08-17T03:00:00.000Z");
    expect(closed.endsAt.toISOString()).toBe("2026-08-24T02:59:59.999Z");
    expect(closed.label).toBe("17 a 23 de agosto");
    expect(closed.isClosed).toBe(true);
  });

  it("resolves the current week and previous calendar month in Sao Paulo", () => {
    const currentWeek = resolveMcpPeriod({ periodPreset: "current_week" }, now);
    const previousMonth = resolveMcpPeriod({ periodPreset: "previous_calendar_month" }, now);

    expect(currentWeek.startsAt.toISOString()).toBe("2026-08-24T03:00:00.000Z");
    expect(currentWeek.endsAt.toISOString()).toBe(now.toISOString());
    expect(previousMonth.startsAt.toISOString()).toBe("2026-07-01T03:00:00.000Z");
    expect(previousMonth.endsAt.toISOString()).toBe("2026-08-01T02:59:59.999Z");
    expect(previousMonth.label).toBe("julho de 2026");
  });

  it("treats date-only custom boundaries as local calendar days", () => {
    const custom = resolveMcpPeriod({
      periodPreset: "custom",
      startsAt: "2026-08-10",
      endsAt: "2026-08-12",
    }, now);

    expect(custom.startsAt.toISOString()).toBe("2026-08-10T03:00:00.000Z");
    expect(custom.endsAt.toISOString()).toBe("2026-08-13T02:59:59.999Z");
    expect(custom.days).toBe(3);
  });

  it("preserves legacy periodDays without pretending it is a calendar period", () => {
    const legacy = resolveMcpPeriod({ periodDays: 30 }, now);
    expect(legacy.preset).toBe("legacy_rolling_days");
    expect(legacy.legacyPeriodDays).toBe(30);
    expect(legacy.meaning).toContain("24 horas");
  });
});
