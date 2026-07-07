import { summarizeAudienceDemographics } from "./audienceContextSummaryService";

describe("summarizeAudienceDemographics", () => {
  it("retorna null sem snapshot", () => {
    expect(summarizeAudienceDemographics(null)).toBeNull();
    expect(summarizeAudienceDemographics(undefined)).toBeNull();
  });

  it("retorna null quando não há distribuição aproveitável", () => {
    expect(
      summarizeAudienceDemographics({
        follower_demographics: { gender: {}, age: {}, city: {}, country: {} },
      }),
    ).toBeNull();
  });

  it("condensa gênero, faixa etária e localização com percentuais", () => {
    const summary = summarizeAudienceDemographics({
      follower_demographics: {
        gender: { F: 620, M: 380 },
        age: { "25-34": 410, "18-24": 300, "35-44": 290 },
        city: { "São Paulo": 500, "Rio de Janeiro": 300, "Curitiba": 200 },
      },
    });
    expect(summary).toEqual({
      topGender: "mulheres",
      topGenderPct: 62,
      topAgeRange: "25-34",
      topAgeRangePct: 41,
      topLocations: ["São Paulo", "Rio de Janeiro"],
    });
  });

  it("prefere a audiência engajada e cai para país quando não há cidade", () => {
    const summary = summarizeAudienceDemographics({
      follower_demographics: { gender: { M: 900, F: 100 } },
      engaged_audience_demographics: {
        gender: { F: 700, M: 300 },
        country: { BR: 800, PT: 200 },
      },
    });
    expect(summary?.topGender).toBe("mulheres");
    expect(summary?.topGenderPct).toBe(70);
    expect(summary?.topLocations).toEqual(["BR", "PT"]);
  });
});
