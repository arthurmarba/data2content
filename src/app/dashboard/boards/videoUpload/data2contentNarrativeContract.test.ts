import {
  buildData2ContentNarrativeContract,
  compactD2CNarrativeLabel,
  compactD2CTension,
  uniqueD2CTexts,
} from "./data2contentNarrativeContract";

const BAD_BUNNY_READING =
  "O criador analisa a performance de Bad Bunny no Super Bowl como uma estrategia de negocio, destacando a independencia do artista, a propriedade intelectual e o impacto cultural para construcao de comunidade leal e global.";

describe("data2contentNarrativeContract", () => {
  it("separa tema do video de sinal narrativo do creator", () => {
    const contract = buildData2ContentNarrativeContract({
      mainNarrative: BAD_BUNNY_READING,
      whatVideoCommunicates: `Esse video comunica uma direcao de conteudo ligada a ${BAD_BUNNY_READING}`,
      strategicReading: `Pelo video, a leitura principal aponta para ${BAD_BUNNY_READING}`,
      creatorSignals: ["propriedade intelectual", "cultura pop", "comunidade"],
      brandTerritories: ["Educacao Corporativa"],
    });

    expect(contract.videoSubject).toBe("Bad Bunny no Super Bowl");
    expect(contract.centralNarrativeCandidate).toBe("Autonomia criativa como negocio cultural");
    expect(contract.centralNarrativeCandidate).not.toContain("Bad Bunny");
    expect(contract.centralNarrativeCandidate).not.toContain("O criador analisa");
    expect(contract.creatorPointOfView).toContain("cultura pop");
    expect(contract.creatorPointOfView).toContain("propriedade intelectual");
  });

  it("compacta labels longos e genéricos antes de virar card", () => {
    expect(compactD2CNarrativeLabel([BAD_BUNNY_READING])).toBe("Autonomia criativa como negocio cultural");
  });

  it("transforma tensoes de prompt ruim em uma acao de mapa", () => {
    expect(compactD2CTension([
      "A narrativa não explicita a aplicabilidade direta desses insights de estrategia de artista.",
    ])).toBe("Separar tema do video de narrativa");
  });

  it("deduplica textos equivalentes para superficies calmas", () => {
    expect(uniqueD2CTexts([
      "Narrativa em observação: humor cotidiano",
      "humor cotidiano",
      "A força está na situação reconhecível.",
    ], 3)).toEqual([
      "Narrativa em observação: humor cotidiano",
      "A força está na situação reconhecível.",
    ]);
  });
});
