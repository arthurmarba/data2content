import {
  dateStatus,
  htmlToLines,
  inferFormats,
  inferPlatforms,
  inferTerritories,
  parseBrazilianDate,
  parseBrazilianMoney,
  stableOpportunityId,
} from "./normalization";

describe("campaign radar normalization", () => {
  it("normalizes Brazilian currency values", () => {
    expect(parseBrazilianMoney("R$ 1.250,50")).toBe(1250.5);
    expect(parseBrazilianMoney("3000")).toBe(3000);
  });

  it("normalizes supported dates", () => {
    expect(parseBrazilianDate("até 06/09/2026")).toBe("2026-09-06");
    expect(parseBrazilianDate("6 de setembro de 2026")).toBe("2026-09-06");
    expect(parseBrazilianDate("2026-09-06T10:00:00Z")).toBe("2026-09-06");
  });

  it("does not keep script content when extracting public page lines", () => {
    expect(htmlToLines("<h1>Campanha</h1><script>prompt malicioso</script><p>Prazo aberto</p>")).toEqual([
      "Campanha",
      "Prazo aberto",
    ]);
  });

  it("infers canonical territories without duplicates", () => {
    expect(inferTerritories("Receitas, gastronomia e rotina de restaurante")).toEqual([
      "Gastronomia",
      "Lifestyle",
    ]);
  });

  it("recovers platforms and formats from descriptive text", () => {
    const text = "Entregas: 1 Reels no Instagram, 3 Stories e 1 carrossel no Pinterest.";
    expect(inferPlatforms(text)).toEqual(["Instagram", "Pinterest"]);
    expect(inferFormats(text)).toEqual(["Reel", "Stories", "Carrossel"]);
  });

  it("closes a campaign only after the end of its deadline in Sao Paulo", () => {
    expect(dateStatus("2026-08-31", new Date("2026-08-31T20:00:00-03:00"))).toBe("open");
    expect(dateStatus("2026-08-31", new Date("2026-09-01T00:00:01-03:00"))).toBe("closed");
  });

  it("creates stable source-scoped identifiers", () => {
    const first = stableOpportunityId("source", "https://example.com/x", "Campanha A");
    const second = stableOpportunityId("source", "https://example.com/x", "Campanha A");
    expect(first).toBe(second);
    expect(first).toMatch(/^source:[a-f0-9]{16}$/);
  });
});
