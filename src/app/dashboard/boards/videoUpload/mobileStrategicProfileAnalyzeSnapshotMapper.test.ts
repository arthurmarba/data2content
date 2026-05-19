import { mapAnalysisToSnapshotPayload, cleanForbiddenText } from "./mobileStrategicProfileAnalyzeSnapshotMapper";
import { createEmptyVideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";

describe("mobileStrategicProfileAnalyzeSnapshotMapper", () => {
  it("sanitiza termos proibidos com regex insensível a maiúsculas/minúsculas", () => {
    expect(cleanForbiddenText("Meu score é bom")).toBe("Meu é bom");
    expect(cleanForbiddenText("Sem nota ou pontos de ranking")).toBe("Sem ou de");
    expect(cleanForbiddenText("Viralizar garantido e certeza absoluta")).toBe("Viralizar e absoluta");
    expect(cleanForbiddenText("Tem histórico de vídeos salvos")).toBe("Tem histórico de");
    expect(cleanForbiddenText("Novo Mídia Kit mobile")).toBe("mobile");
  });

  it("converte uma análise útil em snapshot versionado com limites de tamanho seguros", () => {
    const analysis = {
      ...createEmptyVideoNarrativeAnalysis({ id: "test-id" }),
      summary: "Rotina de bastidores da pauta de autocuidado.",
      spokenTopics: ["autocuidado", "bastidores"],
      diagnosis: {
        strengths: ["Conexão direta com a audiência."],
        weaknesses: [],
        recommendedAdjustments: ["Deixar o gancho mais evidente."],
      },
      brandMatch: {
        enabled: true,
        territories: ["beleza"],
        whyBrandsWouldFit: "Boa narrativa para marcas de cuidados corporais.",
      },
      profileSignals: [
        { type: "recurring_theme", value: "Autenticidade", confidence: "high", shouldPersistLater: true },
      ] as any[],
    };

    const snapshot = mapAnalysisToSnapshotPayload(analysis);

    expect(snapshot.schemaVersion).toBe("mobile_strategic_profile_snapshot_v1");
    expect(snapshot.profileState).toBe("active");
    expect(snapshot.diagnosisSummary).toBe("Rotina de bastidores da pauta de autocuidado.");
    expect(snapshot.recurringPatterns).toContain("Conexão direta com a audiência.");
    expect(snapshot.recurringPatterns).toContain("Autenticidade");
    expect(snapshot.opportunities).toContain("beleza");
    expect(snapshot.unlockedSignals).toContain("autocuidado");
    expect(snapshot.pendingSignals).toContain("Deixar o gancho mais evidente.");
    expect(snapshot.commercialSummary).toBe("Boa narrativa para marcas de cuidados corporais.");
  });

  it("resguarda queda para textos vazios ou ausentes de forma elegante", () => {
    const analysis = createEmptyVideoNarrativeAnalysis({ id: "empty" });
    const snapshot = mapAnalysisToSnapshotPayload(analysis);

    expect(snapshot.schemaVersion).toBe("mobile_strategic_profile_snapshot_v1");
    expect(snapshot.profileState).toBe("active");
    expect(snapshot.diagnosisSummary).toBe("Diagnóstico estratégico ativo baseado no seu último vídeo.");
    expect(snapshot.recurringPatterns).toEqual([]);
    expect(snapshot.opportunities).toEqual([]);
  });
});
