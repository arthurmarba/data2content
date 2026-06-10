// src/app/lib/mapaSeed/enrichMapaWithVideoReadings.test.ts

import {
  enrichMapaWithVideoReadings,
  buildVideoSynthesisDigest,
} from "./enrichMapaWithVideoReadings";
import type { IMapaData } from "@/app/models/MapaSeed";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockCallClaude = jest.fn();
jest.mock("@/app/lib/claudeService", () => ({
  callClaudeJSON: (...args: unknown[]) => mockCallClaude(...args),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeMapa(overrides?: Partial<IMapaData>): IMapaData {
  return {
    narrativa_central: "narrativa declarada",
    territorios: ["t1"],
    narrativas_adjacentes: ["adj1"],
    assets: ["a1"],
    tom: "reflexivo",
    formatos: ["reels"],
    maturidade: "instagram_enriched",
    fonte: ["onboarding_declarativo", "instagram"],
    observacoes: [],
    amostragem_instagram: "suficiente",
    ...overrides,
  };
}

function makeSynthesis(
  overrides?: Partial<CreatorStrategicProfileSynthesis>,
): CreatorStrategicProfileSynthesis {
  const signal = (label: string) => ({ label, summary: "s", evidenceCount: 2, diagnosisIds: ["d"] });
  return {
    id: "syn",
    status: "pattern_in_formation",
    analyzedReadingsCount: 3,
    mainNarrative: { ...signal("narrativa de vídeo"), confidence: "high" },
    testedNarratives: [],
    recurringPatterns: [signal("padrão A")],
    recurringTensions: [],
    strengths: [],
    commercialTerritories: [],
    collabTerritories: [],
    narrativeTerritories: [signal("território vídeo")],
    dominantTone: "íntimo",
    toneSignals: [signal("íntimo")],
    executionPatterns: [],
    commercialReasoning: [],
    tacticalExperiments: [],
    confirmedLifeAssets: [signal("cachorro")],
    topPerformingPattern: "cachorro",
    nextStrategicMove: null,
    warnings: [],
    generatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildVideoSynthesisDigest", () => {
  it("extrai rótulos compactos da síntese", () => {
    const digest = buildVideoSynthesisDigest(makeSynthesis());

    expect(digest).toEqual({
      narrativa_central: "narrativa de vídeo",
      confianca_narrativa: "high",
      territorios: ["território vídeo"],
      tom_dominante: "íntimo",
      assets_recorrentes: ["cachorro"],
      padroes_recorrentes: ["padrão A"],
      leituras_analisadas: 3,
    });
  });
});

describe("enrichMapaWithVideoReadings", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna o mapa inalterado quando não há leituras analisadas", async () => {
    const mapa = makeMapa();
    const result = await enrichMapaWithVideoReadings(
      mapa,
      makeSynthesis({ analyzedReadingsCount: 0 }),
    );

    expect(result).toBe(mapa);
    expect(mockCallClaude).not.toHaveBeenCalled();
  });

  it("cruza com LLM e marca maturidade video_enriched + fonte video", async () => {
    mockCallClaude.mockResolvedValue({
      narrativa_central: "narrativa refinada",
      territorios: ["t1", "território vídeo"],
      narrativas_adjacentes: ["adj1"],
      assets: ["a1", "cachorro"],
      tom: "íntimo",
      formatos: ["reels"],
      observacoes: ["tom declarado divergiu do tom dos vídeos"],
    });

    const result = await enrichMapaWithVideoReadings(makeMapa(), makeSynthesis());

    expect(result.maturidade).toBe("video_enriched");
    expect(result.fonte).toEqual(["onboarding_declarativo", "instagram", "video"]);
    expect(result.narrativa_central).toBe("narrativa refinada");
    expect(result.assets).toContain("cachorro");
  });

  it("não duplica 'video' em fonte se já presente", async () => {
    mockCallClaude.mockResolvedValue({
      narrativa_central: "n",
      tom: "t",
    });

    const result = await enrichMapaWithVideoReadings(
      makeMapa({ fonte: ["onboarding_declarativo", "video"] }),
      makeSynthesis(),
    );

    expect(result.fonte).toEqual(["onboarding_declarativo", "video"]);
  });

  it("lança quando o LLM retorna sem campos obrigatórios", async () => {
    mockCallClaude.mockResolvedValue({ territorios: ["x"] });

    await expect(
      enrichMapaWithVideoReadings(makeMapa(), makeSynthesis()),
    ).rejects.toThrow(/campos obrigatórios/);
  });

  it("usa campos do mapa atual como fallback quando o LLM omite arrays", async () => {
    mockCallClaude.mockResolvedValue({
      narrativa_central: "n",
      tom: "t",
      // sem territorios/assets/formatos → fallback do mapa atual
    });

    const mapa = makeMapa();
    const result = await enrichMapaWithVideoReadings(mapa, makeSynthesis());

    expect(result.territorios).toEqual(mapa.territorios);
    expect(result.assets).toEqual(mapa.assets);
    expect(result.formatos).toEqual(mapa.formatos);
  });

  it("narrativeLocked: mantém a narrativa confirmada e registra divergência dos vídeos", async () => {
    mockCallClaude.mockResolvedValue({
      narrativa_central: "narrativa refinada pelos vídeos",
      tom: "reflexivo",
      observacoes: [],
    });

    const result = await enrichMapaWithVideoReadings(makeMapa(), makeSynthesis(), {
      narrativeLocked: true,
      toneLocked: false,
    });

    expect(result.narrativa_central).toBe("narrativa declarada");
    expect(result.observacoes?.some((o) => o.includes("Seus vídeos sugerem"))).toBe(true);
  });

  it("toneLocked: mantém o tom confirmado e registra divergência dos vídeos", async () => {
    mockCallClaude.mockResolvedValue({
      narrativa_central: "narrativa declarada",
      tom: "acelerado",
      observacoes: [],
    });

    const result = await enrichMapaWithVideoReadings(makeMapa(), makeSynthesis(), {
      narrativeLocked: false,
      toneLocked: true,
    });

    expect(result.tom).toBe("reflexivo");
    expect(result.observacoes?.some((o) => o.includes("nos vídeos"))).toBe(true);
  });
});
