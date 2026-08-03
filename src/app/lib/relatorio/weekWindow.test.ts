import {
  gridPosition,
  lastClosedWeek,
  shiftWeeks,
  weekKeyBack,
  weekWindowFor,
} from "./weekWindow";

describe("weekWindowFor", () => {
  it("a semana de 22/07/2026 (quarta) começa na segunda 20/07", () => {
    const week = weekWindowFor(new Date("2026-07-22T15:00:00Z"));
    expect(week.weekKey).toBe("2026-W30");
    expect(week.rangeLabel).toBe("20 a 26 de julho");
    // Segunda 00:00 em São Paulo (UTC-3) = domingo 03:00 UTC.
    expect(week.startsAt.toISOString()).toBe("2026-07-20T03:00:00.000Z");
    expect(week.endsAt.toISOString()).toBe("2026-07-27T02:59:59.999Z");
  });

  it("domingo 23h de São Paulo ainda é a semana que fecha, não a seguinte", () => {
    // Domingo 26/07 às 23:00 BRT = segunda 27/07 02:00 UTC.
    const week = weekWindowFor(new Date("2026-07-27T02:00:00Z"));
    expect(week.weekKey).toBe("2026-W30");
  });

  it("segunda 00:30 de São Paulo já é a semana nova", () => {
    const week = weekWindowFor(new Date("2026-07-27T03:30:00Z"));
    expect(week.weekKey).toBe("2026-W31");
  });

  it("rotula intervalo que cruza o mês", () => {
    const week = weekWindowFor(new Date("2026-07-01T12:00:00Z"));
    expect(week.rangeLabel).toBe("29 de junho a 5 de julho");
  });

  it("a janela de 90 dias termina junto com a semana", () => {
    const week = weekWindowFor(new Date("2026-07-22T15:00:00Z"));
    const days = (week.endsAt.getTime() - week.windowStartsAt.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(90);
  });

  it("cobre a semana inteira sem buraco nem sobreposição", () => {
    const week = weekWindowFor(new Date("2026-07-22T15:00:00Z"));
    const next = shiftWeeks(week, -1);
    expect(next.startsAt.getTime() - week.endsAt.getTime()).toBe(1);
  });

  it("numera a semana ISO na virada do ano", () => {
    // 01/01/2027 é sexta — ISO 2026-W53.
    expect(weekWindowFor(new Date("2027-01-01T12:00:00Z")).weekKey).toBe("2026-W53");
    expect(weekWindowFor(new Date("2027-01-05T12:00:00Z")).weekKey).toBe("2027-W01");
  });
});

describe("lastClosedWeek", () => {
  it("na segunda de manhã fala da semana que acabou", () => {
    // Segunda 27/07/2026, 06:00 BRT = 09:00 UTC.
    const week = lastClosedWeek(new Date("2026-07-27T09:00:00Z"));
    expect(week.weekKey).toBe("2026-W30");
    expect(week.rangeLabel).toBe("20 a 26 de julho");
  });

  it("na quinta da reunião ainda fala da mesma semana", () => {
    const week = lastClosedWeek(new Date("2026-07-30T22:00:00Z"));
    expect(week.weekKey).toBe("2026-W30");
  });
});

describe("shiftWeeks / weekKeyBack", () => {
  const week = weekWindowFor(new Date("2026-07-22T15:00:00Z"));

  it("recua a quantidade pedida", () => {
    expect(weekKeyBack(week, 1)).toBe("2026-W29");
    expect(weekKeyBack(week, 3)).toBe("2026-W27");
  });

  it("atravessa a virada do ano para trás", () => {
    const jan = weekWindowFor(new Date("2027-01-14T12:00:00Z"));
    expect(jan.weekKey).toBe("2027-W02");
    expect(weekKeyBack(jan, 3)).toBe("2026-W52");
  });
});

describe("gridPosition", () => {
  it("lê dia e faixa no fuso do relatório, não em UTC", () => {
    // Domingo 26/07 às 20:00 BRT = segunda 27/07 23:00 UTC.
    const position = gridPosition(new Date("2026-07-26T23:00:00Z"));
    expect(position.dayOfWeek).toBe(0); // domingo
    expect(position.slot).toBe(5); // 20–24h
  });

  it("meia-noite cai na primeira faixa", () => {
    const position = gridPosition(new Date("2026-07-20T03:10:00Z"));
    expect(position.dayOfWeek).toBe(1); // segunda
    expect(position.slot).toBe(0);
  });
});
