import {
  buildContentPotentialDecision,
  buildContentPotentialStrengthsAndRisks,
  compareContentPotentialScans,
} from "./videoNarrativeContentPotentialPresentation";
import { buildFallbackVideoNarrativeContentPotentialScan } from "./videoNarrativeContentPotentialScan";

function scan() {
  const base = buildFallbackVideoNarrativeContentPotentialScan({ selectedGoalOption: "retention" });
  return {
    ...base,
    band: "promising_with_adjustment" as const,
    dimensions: {
      openingClarity: { status: "weak" as const, evidence: "A promessa depende do áudio.", adjustment: "Escrever a pergunta na tela.", window: "0-3s" as const },
      attentionArchitecture: { status: "strong" as const, evidence: "A imagem progride.", adjustment: null, window: "0-10s" as const },
      shareImpulse: { status: "mixed" as const, evidence: "A utilidade fica implícita.", adjustment: "Fechar com uma síntese.", window: "full_video" as const },
      promiseDelivery: { status: "strong" as const, evidence: "O final cumpre a promessa.", adjustment: null, window: "full_video" as const },
      narrativeFit: { status: "unknown" as const, evidence: "Sem histórico.", adjustment: null, window: "creator_history" as const },
    },
  };
}

describe("videoNarrativeContentPotentialPresentation", () => {
  it("keeps the decision practical and grounded", () => {
    expect(buildContentPotentialDecision(scan(), "A ideia funciona depois de explicitar a abertura.")).toEqual(expect.objectContaining({
      title: "Vale postar depois de um ajuste.",
      reason: "A ideia funciona depois de explicitar a abertura.",
    }));
  });

  it("limits strengths and prioritizes weak risks", () => {
    const result = buildContentPotentialStrengthsAndRisks(scan());
    expect(result.strengths).toHaveLength(2);
    expect(result.risks[0]).toEqual(expect.objectContaining({ key: "openingClarity", status: "weak" }));
  });

  it("compares an adjusted version without performance promises", () => {
    const before = scan();
    const after = {
      ...before,
      dimensions: {
        ...before.dimensions,
        openingClarity: { ...before.dimensions.openingClarity, status: "strong" as const, evidence: "A pergunta aparece na tela." },
      },
    };
    expect(compareContentPotentialScans(before, after).improvements).toEqual([
      expect.objectContaining({ key: "openingClarity", evidence: "A pergunta aparece na tela." }),
    ]);
  });
});
