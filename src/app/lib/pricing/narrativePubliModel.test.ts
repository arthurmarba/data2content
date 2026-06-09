import {
  estimateJusto,
  priceRangeFromFollowers,
  fallbackPubliRange,
  equivalentNarrativeKeys,
  resolveNarrativeDef,
  DEFAULT_NARRATIVE_DEF,
  REACH_RATE,
  CONTENT_UNITS,
  BRAND_MEDIUM_MULTIPLIER,
} from "./narrativePubliModel";

describe("narrativePubliModel", () => {
  describe("estimateJusto", () => {
    it("aplica a fórmula linear (alcance/1000 × cpm × mult × unidades)", () => {
      const followers = 40_000;
      const cpm = 18;
      const expected =
        ((followers * REACH_RATE) / 1000) * cpm * BRAND_MEDIUM_MULTIPLIER * CONTENT_UNITS;
      expect(estimateJusto(cpm, followers)).toBeCloseTo(expected, 5);
    });

    it("é linear no nº de seguidores", () => {
      expect(estimateJusto(20, 100_000)).toBeCloseTo(estimateJusto(20, 10_000) * 10, 5);
    });
  });

  describe("priceRangeFromFollowers", () => {
    it("calcula a faixa arredondada para a narrativa de ensino (cpm 18)", () => {
      const { min, max, label } = priceRangeFromFollowers("ensino_conhecimento", 20_000, 40_000);
      expect(min).toBe(390);
      expect(max).toBe(790);
      expect(label).toBe("conteúdo educativo");
    });

    it("narrativa desconhecida cai no default (cpm 22, rótulo genérico)", () => {
      const { label } = priceRangeFromFollowers("inexistente", 10_000, 50_000);
      expect(label).toBe(DEFAULT_NARRATIVE_DEF.label);
    });
  });

  describe("fallbackPubliRange", () => {
    it("usa a banda determinística 10–50k", () => {
      expect(fallbackPubliRange("ensino_conhecimento")).toEqual(
        priceRangeFromFollowers("ensino_conhecimento", 10_000, 50_000),
      );
    });
  });

  describe("equivalentNarrativeKeys", () => {
    it("agrupa as chaves educativas (incl. legadas)", () => {
      const keys = equivalentNarrativeKeys("ensino_conhecimento");
      expect(keys).toEqual(
        expect.arrayContaining(["ensino_conhecimento", "compartilho_aprendizado", "ensino_habilidade"]),
      );
      expect(keys).toHaveLength(3);
    });

    it("retorna [] para narrativa desconhecida (sem coorte confiável)", () => {
      expect(equivalentNarrativeKeys("inexistente")).toEqual([]);
      expect(equivalentNarrativeKeys(undefined)).toEqual([]);
    });
  });

  describe("resolveNarrativeDef", () => {
    it("cai no default quando a narrativa é desconhecida", () => {
      expect(resolveNarrativeDef("inexistente")).toEqual(DEFAULT_NARRATIVE_DEF);
    });
  });
});
