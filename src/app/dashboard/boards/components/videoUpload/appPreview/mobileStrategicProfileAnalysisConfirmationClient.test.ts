import { buildAnalysisConfirmationDataFromReading } from "./mobileStrategicProfileAnalysisConfirmationClient";

describe("mobileStrategicProfileAnalysisConfirmationClient", () => {
  it("builds visible confirmation cards from the saved reading", () => {
    const result = buildAnalysisConfirmationDataFromReading({
      videoReading: {
        summary: "O vídeo mostra humor cotidiano com identificação rápida.",
        mainNarrative: "humor cotidiano com identificação rápida",
        dominantInsight: "A força está na situação reconhecível.",
      },
      commercialReading: {
        brandTerritories: ["rotina real"],
      },
      strategicRecommendation: {
        nextExperiment: "Repetir o conflito logo na abertura.",
      },
      profileContribution: {
        profileImpactPreview: "Cria uma primeira pista para acompanhar nas próximas análises.",
      },
    });

    expect(result).toEqual({
      diagnosisSummary: "O video aponta para humor cotidiano com identificacao rapida como sinal do mapa narrativo.",
      unlockedSignals: [
        "Sinal narrativo: humor cotidiano com identificacao rapida",
        "A força está na situação reconhecível.",
      ],
      opportunities: ["Próximo passo: Repetir o conflito logo na abertura."],
    });
  });

  it("evita repetir o tema do video como narrativa apos uma leitura ruim", () => {
    const badBunnyReading =
      "O criador analisa a performance de Bad Bunny no Super Bowl como uma estrategia de negocio, destacando a independencia do artista, a propriedade intelectual e o impacto cultural para construcao de comunidade leal e global.";

    const result = buildAnalysisConfirmationDataFromReading({
      videoReading: {
        summary: `Esse video comunica uma direcao de conteudo ligada a ${badBunnyReading}`,
        mainNarrative: badBunnyReading,
        dominantInsight: `Pelo video, a leitura principal aponta para ${badBunnyReading}`,
      },
      commercialReading: {
        brandTerritories: ["Educacao Corporativa"],
      },
      strategicRecommendation: {
        nextExperiment: "Refinar a abertura antes de transformar o video em roteiro.",
      },
      profileContribution: {
        profileImpactPreview: "Cria uma primeira pista para acompanhar nas proximas analises.",
      },
    });

    expect(result?.unlockedSignals[0]).toBe("Sinal narrativo: Autonomia criativa como negocio cultural");
    expect(JSON.stringify(result)).not.toContain("O criador analisa");
    expect(JSON.stringify(result)).not.toContain("Esse video comunica uma direcao");
  });
});
