// mapaSeedSynthesisMerge.test.ts

import {
  mergeMapaSeedIntoSynthesis,
  loadMapaSeedForSynthesisMerge,
  type MapaSeedSynthesisInput,
} from "./mapaSeedSynthesisMerge";
import type {
  CreatorStrategicProfileSynthesis,
  CreatorStrategicProfileSynthesisSignal,
} from "./creatorStrategicProfileSynthesis";

// ── Mock do modelo para o loader ────────────────────────────────────────────
const mockFindOne = jest.fn();
jest.mock("@/app/models/MapaSeed", () => ({
  __esModule: true,
  default: { findOne: (...a: unknown[]) => mockFindOne(...a) },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function sig(label: string, evidenceCount: number, ids: string[] = ["v1"]): CreatorStrategicProfileSynthesisSignal {
  return { label, summary: label, evidenceCount, diagnosisIds: ids };
}

function emptySynthesis(over?: Partial<CreatorStrategicProfileSynthesis>): CreatorStrategicProfileSynthesis {
  return {
    id: "s1",
    status: "empty",
    analyzedReadingsCount: 0,
    mainNarrative: null,
    testedNarratives: [],
    recurringPatterns: [],
    recurringTensions: [],
    strengths: [],
    commercialTerritories: [],
    collabTerritories: [],
    narrativeTerritories: [],
    dominantTone: null,
    toneSignals: [],
    executionPatterns: [],
    commercialReasoning: [],
    tacticalExperiments: [],
    confirmedLifeAssets: [],
    topPerformingPattern: null,
    nextStrategicMove: null,
    warnings: [],
    generatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

const fullSeed: MapaSeedSynthesisInput = {
  narrativeLabel: "Ajuda criadores a usar IA com autenticidade",
  territories: ["Tecnologia", "Criação de conteúdo"],
  adjacentNarratives: ["Produtividade"],
  assets: ["Home office", "Setup de gravação"],
  tone: "Didático e direto",
  evidenceWeight: 2,
};

// ── Testes da função pura ─────────────────────────────────────────────────────

describe("mergeMapaSeedIntoSynthesis", () => {
  it("é no-op quando mapa é null (sem regressão para só-vídeo)", () => {
    const syn = emptySynthesis();
    expect(mergeMapaSeedIntoSynthesis(syn, null)).toBe(syn);
  });

  it("preenche síntese vazia com o MapaSeed e sai do status 'empty'", () => {
    const merged = mergeMapaSeedIntoSynthesis(emptySynthesis(), fullSeed);
    expect(merged.mainNarrative?.label).toBe(fullSeed.narrativeLabel);
    expect(merged.mainNarrative?.confidence).toBe("medium"); // weight 2
    expect(merged.narrativeTerritories.map((t) => t.label)).toEqual(["Tecnologia", "Criação de conteúdo"]);
    expect(merged.toneSignals.map((t) => t.label)).toEqual(["Didático e direto"]);
    expect(merged.dominantTone).toBe("Didático e direto");
    expect(merged.confirmedLifeAssets.map((a) => a.label)).toEqual(["Home office", "Setup de gravação"]);
    expect(merged.testedNarratives.map((t) => t.label)).toEqual(["Produtividade"]);
    expect(merged.status).toBe("signals_emerging");
  });

  it("soma evidência quando a narrativa central coincide entre vídeo e MapaSeed", () => {
    const syn = emptySynthesis({
      status: "first_reading",
      mainNarrative: { ...sig("Ajuda criadores a usar IA com autenticidade", 2), confidence: "medium" },
    });
    const merged = mergeMapaSeedIntoSynthesis(syn, fullSeed);
    expect(merged.mainNarrative?.evidenceCount).toBe(4); // 2 (vídeo) + 2 (seed)
    expect(merged.mainNarrative?.confidence).toBe("high");
    // não duplica nas adjacentes
    expect(merged.testedNarratives.map((t) => t.label)).toEqual(["Produtividade"]);
  });

  it("narrativa distinta do vídeo (empate) mantém a do vídeo e rebaixa a do MapaSeed a adjacente", () => {
    const syn = emptySynthesis({
      status: "first_reading",
      mainNarrative: { ...sig("Bastidores da vida de músico", 2), confidence: "medium" },
    });
    const merged = mergeMapaSeedIntoSynthesis(syn, { ...fullSeed, evidenceWeight: 2 });
    expect(merged.mainNarrative?.label).toBe("Bastidores da vida de músico");
    expect(merged.testedNarratives.map((t) => t.label)).toEqual(
      expect.arrayContaining(["Ajuda criadores a usar IA com autenticidade", "Produtividade"]),
    );
  });

  it("MapaSeed com mais evidência que o vídeo assume a central e rebaixa a do vídeo", () => {
    const syn = emptySynthesis({
      status: "first_reading",
      mainNarrative: { ...sig("Hipótese fraca de vídeo", 1), confidence: "low" },
    });
    const merged = mergeMapaSeedIntoSynthesis(syn, { ...fullSeed, evidenceWeight: 2 });
    expect(merged.mainNarrative?.label).toBe(fullSeed.narrativeLabel);
    expect(merged.testedNarratives.map((t) => t.label)).toContain("Hipótese fraca de vídeo");
  });

  it("dedupe de território por rótulo normalizado, somando evidência", () => {
    const syn = emptySynthesis({
      narrativeTerritories: [sig("Tecnologia", 3, ["v1", "v2", "v3"])],
    });
    const merged = mergeMapaSeedIntoSynthesis(syn, {
      narrativeLabel: null,
      territories: ["tecnologia", "Música"],
      adjacentNarratives: [],
      assets: [],
      tone: null,
      evidenceWeight: 2,
    });
    const tecnologia = merged.narrativeTerritories.find((t) => t.label === "Tecnologia");
    expect(merged.narrativeTerritories).toHaveLength(2); // Tecnologia (merge) + Música (novo)
    expect(tecnologia?.evidenceCount).toBe(5); // 3 + 2
    expect(merged.narrativeTerritories.map((t) => t.label)).toContain("Música");
  });

  it("preserva dominantTone do vídeo quando já existe", () => {
    const syn = emptySynthesis({ dominantTone: "Reflexivo", toneSignals: [sig("Reflexivo", 2)] });
    const merged = mergeMapaSeedIntoSynthesis(syn, { ...fullSeed });
    expect(merged.dominantTone).toBe("Reflexivo");
    expect(merged.toneSignals.map((t) => t.label)).toEqual(["Reflexivo", "Didático e direto"]);
  });
});

// ── Testes do loader ──────────────────────────────────────────────────────────

describe("loadMapaSeedForSynthesisMerge", () => {
  function mockDoc(mapa: object | null) {
    mockFindOne.mockReturnValue({
      select: () => ({ lean: () => Promise.resolve(mapa ? { mapa } : null) }),
    });
  }

  beforeEach(() => jest.clearAllMocks());

  it("retorna null quando não há MapaSeed", async () => {
    mockDoc(null);
    expect(await loadMapaSeedForSynthesisMerge("u1")).toBeNull();
  });

  it("retorna null quando o MapaSeed está totalmente vazio (no-op)", async () => {
    mockDoc({ narrativa_central: "", territorios: [], assets: [], narrativas_adjacentes: [], tom: "" });
    expect(await loadMapaSeedForSynthesisMerge("u1")).toBeNull();
  });

  it("peso 2 para instagram_enriched com amostra suficiente", async () => {
    mockDoc({
      narrativa_central: "Narrativa do IG",
      territorios: ["Tecnologia"],
      maturidade: "instagram_enriched",
      amostragem_instagram: "suficiente",
    });
    const out = await loadMapaSeedForSynthesisMerge("u1");
    expect(out?.evidenceWeight).toBe(2);
    expect(out?.narrativeLabel).toBe("Narrativa do IG");
  });

  it("peso 1 para amostra baixa ou só onboarding", async () => {
    mockDoc({ narrativa_central: "Narrativa", maturidade: "instagram_enriched", amostragem_instagram: "baixa" });
    expect((await loadMapaSeedForSynthesisMerge("u1"))?.evidenceWeight).toBe(1);
  });

  it("é best-effort: erro no DB retorna null", async () => {
    mockFindOne.mockReturnValue({ select: () => ({ lean: () => Promise.reject(new Error("db")) }) });
    expect(await loadMapaSeedForSynthesisMerge("u1")).toBeNull();
  });
});
