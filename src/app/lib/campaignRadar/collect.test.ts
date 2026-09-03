import { campaignReportDate } from "./collect";

describe("campaign radar batch", () => {
  test("uses the Sao Paulo calendar date for evening collections", () => {
    expect(campaignReportDate(new Date("2026-08-31T21:30:00-03:00"))).toBe("2026-08-31");
  });
});
