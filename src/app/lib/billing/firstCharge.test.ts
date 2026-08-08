import {
  buildFreeMonthNotice,
  buildNextChargeNotice,
  formatChargeDate,
  resolveFirstChargeDate,
} from "./firstCharge";

describe("resolveFirstChargeDate", () => {
  it("advances exactly one month", () => {
    expect(resolveFirstChargeDate(new Date(2026, 7, 6))).toEqual(new Date(2026, 8, 6));
  });

  it("clamps to the last day when the target month is shorter", () => {
    expect(resolveFirstChargeDate(new Date(2026, 0, 31))).toEqual(new Date(2026, 1, 28));
    expect(resolveFirstChargeDate(new Date(2026, 2, 31))).toEqual(new Date(2026, 3, 30));
  });

  it("crosses the year boundary", () => {
    expect(resolveFirstChargeDate(new Date(2026, 11, 15))).toEqual(new Date(2027, 0, 15));
  });

  it("handles February 29 on a leap year", () => {
    expect(resolveFirstChargeDate(new Date(2028, 1, 29))).toEqual(new Date(2028, 2, 29));
  });
});

describe("formatChargeDate", () => {
  it("writes the day and month in Portuguese, without the year", () => {
    expect(formatChargeDate(new Date(2026, 8, 6))).toBe("6 de setembro");
  });
});

describe("buildFreeMonthNotice", () => {
  it("names the date and the price the person will actually pay", () => {
    expect(
      buildFreeMonthNotice({ monthlyPriceLabel: "R$ 97,00", from: new Date(2026, 7, 6) }),
    ).toBe("Grátis até 6 de setembro. Depois R$ 97,00/mês, cancela quando quiser.");
  });
});

describe("buildNextChargeNotice", () => {
  it("uses the real date coming from Stripe", () => {
    expect(buildNextChargeNotice(new Date(2026, 8, 6))).toBe(
      "Sua próxima cobrança é em 6 de setembro.",
    );
  });

  it("says nothing when there is no date to promise", () => {
    expect(buildNextChargeNotice(null)).toBeNull();
    expect(buildNextChargeNotice(new Date("nonsense"))).toBeNull();
  });
});
