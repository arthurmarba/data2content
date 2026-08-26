import { territoryStructureContextFromSnapshot } from "./territoryStructureEvidenceService";

describe("territoryStructureEvidenceService", () => {
  it("retorna apenas estruturas com volume, diversidade e índice positivo", () => {
    const result = territoryStructureContextFromSnapshot({
      weekKey: "2026-W33",
      territoryId: "cozinha",
      territoryLabel: "Gastronomia",
      creators: 12,
      cutoff: { windowDays: 90 },
      elements: [
        { kind: "formato", key: "Tutorial/Passo a Passo", label: "Tutorial/Passo a Passo", rank: 1, occurrences: 4, creators: 3, occurrencesInWindow: 9, metrics: [{ metric: "retencao", index: 1.3 }], fitsCount: 4, fitsOutOf: 12, pullsDown: false, evidence: "sinal" },
        { kind: "formato", key: "Review", label: "Review", rank: 2, occurrences: 1, creators: 1, occurrencesInWindow: 2, metrics: [{ metric: "retencao", index: 1.8 }], fitsCount: 1, fitsOutOf: 12, pullsDown: false, evidence: "indicio" },
      ],
    });
    expect(result?.patterns).toEqual([expect.objectContaining({ pattern: "problem_demo_explanation_action", posts: 9 })]);
  });
});

