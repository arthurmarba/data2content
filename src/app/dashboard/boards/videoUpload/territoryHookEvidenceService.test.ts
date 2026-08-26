import type { IWeeklyTerritoryElement } from "@/app/models/WeeklyTerritoryReport";
import {
  isTerritoryHookEvidenceEnabled,
  territoryHookEvidenceAllowsTerritory,
  territoryHookContextFromSnapshot,
} from "./territoryHookEvidenceService";

function element(overrides: Partial<IWeeklyTerritoryElement> = {}): IWeeklyTerritoryElement {
  return {
    kind: "gancho",
    key: "question",
    label: "Pergunta direta",
    rank: 1,
    occurrences: 4,
    creators: 3,
    occurrencesInWindow: 18,
    metrics: [{ metric: "retencao", index: 1.35 }],
    fitsCount: 6,
    fitsOutOf: 8,
    pullsDown: false,
    evidence: "tendencia",
    ...overrides,
  };
}

describe("territoryHookContextFromSnapshot", () => {
  it("expõe apenas padrões coletivos com lastro, sem frases de terceiros", () => {
    const context = territoryHookContextFromSnapshot({
      weekKey: "2026-W34",
      territoryId: "treino",
      territoryLabel: "Treino",
      creators: 5,
      cutoff: { windowDays: 90 },
      elements: [
        element(),
        element({ key: "contrarian", label: "Quebra de crença", metrics: [{ metric: "retencao", index: 0.8 }], pullsDown: true }),
        element({ key: "diagnostic", label: "frase exata de terceiro", evidence: "indicio" }),
      ],
    });

    expect(context?.patterns).toEqual([{
      pattern: "question",
      label: "Pergunta direta",
      performanceIndex: 1.35,
      posts: 18,
      creators: 6,
      evidence: "tendencia",
    }]);
    expect(JSON.stringify(context)).not.toContain("frase exata de terceiro");
  });

  it("degrada para null quando nenhum padrão supera os critérios", () => {
    expect(territoryHookContextFromSnapshot({
      weekKey: "2026-W34",
      territoryId: "treino",
      territoryLabel: "Treino",
      creators: 2,
      elements: [element({ occurrencesInWindow: 2 })],
    })).toBeNull();
  });
});

describe("isTerritoryHookEvidenceEnabled", () => {
  it("fica desligado por padrão e só liga explicitamente", () => {
    expect(isTerritoryHookEvidenceEnabled({})).toBe(false);
    expect(isTerritoryHookEvidenceEnabled({ VIDEO_NARRATIVE_TERRITORY_HOOKS_ENABLED: "1" })).toBe(true);
  });

  it("exige allowlist explícita do território mesmo com a flag ligada", () => {
    expect(territoryHookEvidenceAllowsTerritory("cozinha", {
      VIDEO_NARRATIVE_TERRITORY_HOOKS_ENABLED: "1",
    })).toBe(false);
    expect(territoryHookEvidenceAllowsTerritory("cozinha", {
      VIDEO_NARRATIVE_TERRITORY_HOOKS_ENABLED: "1",
      VIDEO_NARRATIVE_TERRITORY_HOOKS_TERRITORIES: "beleza, cozinha",
    })).toBe(true);
  });
});
