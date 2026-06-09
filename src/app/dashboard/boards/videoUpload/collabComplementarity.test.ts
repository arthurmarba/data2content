import {
  significantWords,
  buildViewerTokens,
  complementarityScore,
  rankByComplementarity,
  findSharedLabel,
  findSharedLabels,
  findDistinctLabels,
} from "./collabComplementarity";

describe("collabComplementarity", () => {
  describe("significantWords", () => {
    it("remove conectores genéricos e palavras curtas", () => {
      expect(significantWords("Autonomia criativa como negócio cultural"))
        .toEqual(["autonomia", "criativa", "negocio", "cultural"]);
    });
    it("deduplica e normaliza acentos/pontuação", () => {
      expect(significantWords("Tecnologia/Digital e tecnologia")).toEqual(["tecnologia", "digital"]);
    });
  });

  describe("complementarityScore", () => {
    const viewer = buildViewerTokens(["Autonomia criativa como negócio cultural", "Humor"]);

    it("pontua mais alto quem tem terreno comum E ângulo novo (ponto ideal)", () => {
      // compartilha "humor" + traz "tecnologia/ensino" (novo)
      const sweet = complementarityScore(viewer, "Humor aplicado a tecnologia e ensino");
      // só terreno comum, nada novo (clone)
      const clone = complementarityScore(viewer, "Humor");
      // nada em comum
      const unrelated = complementarityScore(viewer, "Culinária vegana afetiva");
      expect(sweet).toBeGreaterThan(clone);
      expect(sweet).toBeGreaterThan(unrelated);
    });

    it("penaliza clone (terreno comum sem ângulo novo)", () => {
      expect(complementarityScore(viewer, "Humor")).toBeLessThan(
        complementarityScore(viewer, "Humor e fotografia analógica"),
      );
    });

    it("penaliza ausência total de terreno comum", () => {
      expect(complementarityScore(viewer, "Jardinagem urbana")).toBeLessThan(
        complementarityScore(viewer, "Negócio cultural e dança"),
      );
    });

    it("texto vazio = 0", () => {
      expect(complementarityScore(viewer, "")).toBe(0);
    });
  });

  describe("rankByComplementarity", () => {
    it("ordena o melhor complemento primeiro e é estável em empates", () => {
      const viewerTexts = ["Autonomia criativa como negócio cultural"];
      const candidates = [
        { id: "a", narrative: "Jardinagem urbana" },                       // sem comum
        { id: "b", narrative: "Negócio cultural com fotografia e dança" },  // comum + novo (melhor)
        { id: "c", narrative: "Autonomia criativa total" },                // comum, pouco novo
      ];
      const ranked = rankByComplementarity(viewerTexts, candidates, (c) => c.narrative);
      expect(ranked[0]!.id).toBe("b");
      expect(ranked[ranked.length - 1]!.id).toBe("a");
    });

    it("não muta o array de entrada", () => {
      const input = [{ t: "Humor" }, { t: "Negócio cultural" }];
      const copy = [...input];
      rankByComplementarity(["Negócio cultural"], input, (c) => c.t);
      expect(input).toEqual(copy);
    });
  });

  describe("findSharedLabel", () => {
    const viewerTerritories = ["Humor do dia a dia", "Negócio cultural", "Bastidor e processo"];

    it("retorna o rótulo ORIGINAL do viewer (limpo) que casa com o candidato", () => {
      expect(findSharedLabel(viewerTerritories, "Humor aplicado a tecnologia"))
        .toBe("Humor do dia a dia");
    });

    it("casa mesmo com acento/caixa diferente", () => {
      expect(findSharedLabel(viewerTerritories, "fala muito de NEGOCIO e empreendedorismo"))
        .toBe("Negócio cultural");
    });

    it("retorna null quando não há terreno comum", () => {
      expect(findSharedLabel(viewerTerritories, "Culinária vegana")).toBeNull();
    });

    it("ignora conectores genéricos (não casa por 'dia'/'processo' sozinho? casa por palavra real)", () => {
      // "tecnologia" não está em nenhum território → null
      expect(findSharedLabel(viewerTerritories, "Tecnologia e gadgets")).toBeNull();
    });
  });

  describe("findSharedLabels (plural)", () => {
    const viewerTerritories = ["Humor do dia a dia", "Negócio cultural", "Bastidor e processo"];

    it("retorna todos os territórios que casam, capados", () => {
      const r = findSharedLabels(viewerTerritories, "Histórias de humor, negócio cultural e bastidor", 3);
      expect(r).toEqual(["Humor do dia a dia", "Negócio cultural", "Bastidor e processo"]);
    });

    it("respeita o cap", () => {
      expect(findSharedLabels(viewerTerritories, "humor negocio bastidor", 2)).toHaveLength(2);
    });

    it("array vazio quando não há terreno comum", () => {
      expect(findSharedLabels(viewerTerritories, "Culinária vegana")).toEqual([]);
    });
  });

  describe("findDistinctLabels", () => {
    const viewerTerritories = ["Humor do dia a dia", "Negócio cultural"];

    it("retorna os territórios DELA que você não tem", () => {
      const dela = ["Negócio cultural", "Educação Corporativa", "Tecnologia"];
      // "Negócio cultural" sobrepõe → fica de fora; sobram os novos
      expect(findDistinctLabels(viewerTerritories, dela, 3))
        .toEqual(["Educação Corporativa", "Tecnologia"]);
    });

    it("respeita o cap e ignora vazios", () => {
      const dela = ["Fotografia", "Dança", "Viagem", "Moda"];
      expect(findDistinctLabels(viewerTerritories, dela, 2)).toEqual(["Fotografia", "Dança"]);
    });

    it("array vazio quando tudo dela já é seu", () => {
      expect(findDistinctLabels(viewerTerritories, ["Humor do dia a dia"])).toEqual([]);
    });
  });
});
