import { buildAudienceInsights } from "./audienceInsightsService";
import { getAverageEngagementByGroupings } from "@/utils/getAverageEngagementByGrouping";
import { getLatestAudienceDemographics } from "@/app/lib/dataService/demographicService";
import MetricMock from "@/app/models/Metric";

jest.mock("@/utils/getAverageEngagementByGrouping", () => ({
  getAverageEngagementByGroupings: jest.fn(),
}));
jest.mock("@/app/lib/dataService/demographicService", () => ({
  getLatestAudienceDemographics: jest.fn(),
}));
// MetricModel.find().select().lean() — mockado com posts vazios por padrão
// (os testes de ritmo/atenção/propagação vivem nos módulos dedicados)
jest.mock("@/app/models/Metric", () => ({
  __esModule: true,
  default: {
    find: jest.fn(() => ({
      select: jest.fn(() => ({
        lean: jest.fn(() => Promise.resolve([])),
      })),
    })),
  },
}));

const mockGroupings = getAverageEngagementByGroupings as jest.Mock;
const mockDemographics = getLatestAudienceDemographics as jest.Mock;

const USER = "507f1f77bcf86cd799439011";

/**
 * Helper: the service agora chama getAverageEngagementByGroupings 3×:
 *   1. stats.saved (context/tone/proposal/format)
 *   2. stats.reach (format)
 *   3. stats.shares (context/tone/proposal/format)
 */
function mockCalls(
  saved: Record<string, any[]>,
  reach: Record<string, any[]>,
  shares: Record<string, any[]> = {},
) {
  mockGroupings.mockReset();
  mockGroupings
    .mockResolvedValueOnce(saved)
    .mockResolvedValueOnce(reach)
    .mockResolvedValueOnce(shares);
}

const r = (name: string, value: number, postsCount: number) => ({ name, value, postsCount });

beforeEach(() => {
  // Por padrão, sem demografia (a maioria dos testes só exercita saves×mapa).
  mockDemographics.mockReset();
  mockDemographics.mockResolvedValue(null);
});

describe("buildAudienceInsights", () => {
  it("detects an orphan territory: high saves/post, low frequency", async () => {
    mockCalls(
      {
        context: [
          r("Performance como estratégia", 5, 20), // muito explorado, baixo reconhecimento
          r("Bastidor e processo", 40, 6), // pouco explorado, alto reconhecimento → órfão
        ],
        tone: [],
        proposal: [],
        format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER);

    expect(result.orphanTerritory).toEqual({
      label: "Bastidor e processo",
      avgSaves: 40,
      postCount: 6,
    });
    expect(result.hasAny).toBe(true);
  });

  it("does NOT flag orphan when the most-saved territory is also the most posted", async () => {
    mockCalls(
      {
        context: [
          r("Bastidor", 40, 30), // mais guardado E mais postado → não é órfão
          r("Performance", 5, 10),
        ],
        tone: [],
        proposal: [],
        format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER);
    expect(result.orphanTerritory).toBeNull();
  });

  it("ignores categories below the confidence floor (<5 posts)", async () => {
    mockCalls(
      {
        context: [
          r("Tema sortudo", 99, 4), // 4 posts — abaixo do piso de 5, deve ser ignorado
          r("Tema real", 10, 8),
        ],
        tone: [],
        proposal: [],
        format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER);
    // "Tema sortudo" filtrado → sobra só 1 elegível → sem comparação → null
    expect(result.orphanTerritory).toBeNull();
  });

  it("detects format inversion when reach leader ≠ saves leader by a material margin", async () => {
    mockCalls(
      {
        context: [],
        tone: [],
        proposal: [],
        format: [r("Carrossel", 30, 10), r("Reels", 10, 12)], // saves: carrossel lidera (3×)
      },
      { format: [r("Reels", 5000, 12), r("Carrossel", 1200, 10)] }, // reach: reels lidera (4×)
    );

    const result = await buildAudienceInsights(USER);
    expect(result.formatInversion).toEqual({
      reachLeaderLabel: "Reels",
      savesLeaderLabel: "Carrossel",
    });
  });

  it("does NOT flag inversion when same format leads both", async () => {
    mockCalls(
      {
        context: [],
        tone: [],
        proposal: [],
        format: [r("Reels", 30, 10)],
      },
      { format: [r("Reels", 5000, 10)] },
    );

    const result = await buildAudienceInsights(USER);
    expect(result.formatInversion).toBeNull();
  });

  it("does NOT flag inversion on a near-tie (within margin)", async () => {
    // Foto lidera reach por ~15%, mas saves estão empatados (~3%) → ruído, não insight.
    mockCalls(
      {
        context: [],
        tone: [],
        proposal: [],
        format: [r("Foto", 2.7, 10), r("Reels", 2.77, 310)],
      },
      { format: [r("Foto", 1585, 10), r("Reels", 1374, 310)] },
    );

    const result = await buildAudienceInsights(USER);
    expect(result.formatInversion).toBeNull();
  });

  it("picks resonant tone and intent (contentIntent V2) by highest avg saves", async () => {
    mockCalls(
      {
        context: [],
        tone: [r("Íntimo", 25, 5), r("Direto", 8, 10)],
        // Intenção agora vem de contentIntent (V2); "Converter" é comercial → excluído.
        contentIntent: [r("Ensinar", 30, 6), r("Converter", 40, 7)],
        format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER);
    expect(result.resonantTone?.label).toBe("Íntimo");
    expect(result.resonantIntent?.label).toBe("Ensinar");
  });

  it("rejects a small-sample winner in favor of a high-volume tone", async () => {
    // "Nicho" tem média maior mas só 5 posts vs "Base" com 40 → variância, não sinal.
    mockCalls(
      {
        context: [],
        tone: [r("Nicho", 50, 5), r("Base", 10, 40)],
        proposal: [],
        format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER);
    expect(result.resonantTone?.label).toBe("Base");
  });

  it("excludes commercial tones from 'what resonates'", async () => {
    // O tom promocional lidera em saves, mas vender ≠ reconhecimento narrativo.
    mockCalls(
      {
        context: [],
        tone: [r("Promocional/Comercial", 99, 50), r("Íntimo", 10, 40)],
        proposal: [],
        format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER);
    expect(result.resonantTone?.label).toBe("Íntimo");
  });

  it("opens the card on demographics alone (the anchor — card must never be empty)", async () => {
    mockCalls(
      { context: [], tone: [], proposal: [], format: [] },
      { format: [] },
    );
    mockDemographics.mockResolvedValue({
      follower_demographics: {
        gender: { F: 100 },
        age: { "25-34": 50 },
        city: { "Rio de Janeiro": 10 },
        country: {},
      },
    });

    const result = await buildAudienceInsights(USER);
    expect(result.demographics).not.toBeNull();
    // Decisão de produto: a demografia é a âncora que garante o card.
    expect(result.hasAny).toBe(true);
  });

  it("does NOT flag divergence against a placeholder territory", async () => {
    // Audiência guarda muito "Tecnologia/Digital", mas o mapa só tem um label
    // genérico ("Território de marca possível") — comparar contra ele seria fingir
    // um centro de mapa que não existe. Divergência deve ficar null.
    mockCalls(
      {
        context: [r("Tecnologia/Digital", 5, 8), r("Outro", 1, 6)],
        tone: [], proposal: [], format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER, {
      confirmedTerritoryLabels: ["Território de marca possível"],
    });
    expect(result.territoryDivergence).toBeNull();
  });

  it("flags divergence against a REAL confirmed territory", async () => {
    mockCalls(
      {
        context: [r("Tecnologia/Digital", 5, 8), r("Outro", 1, 6)],
        tone: [], proposal: [], format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER, {
      // mistura placeholder + território real; o placeholder é ignorado
      confirmedTerritoryLabels: ["Território de marca possível", "Autocuidado"],
    });
    expect(result.territoryDivergence?.audienceLabel).toBe("Tecnologia/Digital");
    expect(result.territoryDivergence?.mapLabel).toBe("Autocuidado");
  });

  it("dedups território: orphan and divergence on the same território keeps only divergence", async () => {
    // "Alpha" é top-saves, frequência abaixo da mediana (órfão) E fora do mapa (divergência).
    // Mostrar os dois repetiria a mesma verdade → mantém só a divergência.
    mockCalls(
      {
        context: [r("Alpha", 40, 8), r("Beta", 5, 20), r("Gamma", 4, 20), r("Delta", 3, 20)],
        tone: [], proposal: [], format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER, {
      confirmedTerritoryLabels: ["Outra coisa"],
    });
    expect(result.territoryDivergence?.audienceLabel).toBe("Alpha");
    expect(result.orphanTerritory).toBeNull(); // suprimido — mesmo território da divergência
  });

  it("surfaces the resonant territory when there is NO map to diverge against", async () => {
    // Sem confirmedTerritoryLabels → sem divergência → o assunto mais guardado
    // aparece direto como território de reconhecimento.
    mockCalls(
      {
        context: [r("Tecnologia/Digital", 5, 8), r("Outro assunto", 1, 6)],
        tone: [], proposal: [], format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER); // sem mapa
    expect(result.territoryDivergence).toBeNull();
    expect(result.resonantTerritory?.label).toBe("Tecnologia/Digital");
  });

  it("does NOT duplicate territory: when divergence fires, resonantTerritory is null", async () => {
    mockCalls(
      {
        context: [r("Tecnologia/Digital", 5, 8), r("Outro assunto", 1, 6)],
        tone: [], proposal: [], format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER, {
      confirmedTerritoryLabels: ["Autocuidado"],
    });
    expect(result.territoryDivergence?.audienceLabel).toBe("Tecnologia/Digital");
    expect(result.resonantTerritory).toBeNull(); // já mostrado pela divergência
  });

  it("rolls up context children to the family, labeled by the dominant child", async () => {
    // Filhos da mesma família (Estilo de Vida e Bem-Estar) — Beleza domina (30 de 35).
    mockCalls(
      {
        context: [
          r("Beleza/Cuidados Pessoais", 3, 30),
          r("Fitness/Esporte", 2, 5),
          r("Tecnologia/Digital", 1, 6), // outra família (Hobbies)
        ],
        tone: [], proposal: [], format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER); // sem mapa → resonantTerritory
    // família Estilo de Vida vence; rótulo = filho dominante "Beleza/Cuidados Pessoais"
    expect(result.resonantTerritory?.label).toBe("Beleza/Cuidados Pessoais");
  });

  it("rolls up to the PARENT label when no child dominates", async () => {
    // Três filhos espalhados na mesma família (10/10/10) — nenhum ≥50%.
    mockCalls(
      {
        context: [
          r("Beleza/Cuidados Pessoais", 3, 10),
          r("Fitness/Esporte", 3, 10),
          r("Saúde/Bem-Estar", 3, 10),
          r("Tecnologia/Digital", 1, 6),
        ],
        tone: [], proposal: [], format: [],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER);
    // espalhado → rótulo da família-pai
    expect(result.resonantTerritory?.label).toBe("Estilo de Vida e Bem-Estar");
  });

  it("surfaces narrative form and stance (V2/V2.5 dimensions) by saves", async () => {
    mockCalls(
      {
        context: [], tone: [], proposal: [], format: [],
        narrativeForm: [r("Bastidores", 8, 12), r("Tutorial", 3, 10)],
        stance: [r("Depoimento", 6, 20), r("Crítico", 2, 8)],
      },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER);
    expect(result.resonantNarrativeForm?.label).toBe("Bastidores");
    expect(result.resonantStance?.label).toBe("Depoimento");
    expect(result.hasAny).toBe(true);
  });

  it("detects engaged≠follower divergence (gender) with a clear leader on both sides", async () => {
    mockCalls({ context: [], tone: [], proposal: [], format: [] }, { format: [] });
    mockDemographics.mockResolvedValue({
      follower_demographics: { gender: { F: 1000, M: 200 }, age: {}, city: {}, country: {} },
      engaged_audience_demographics: { gender: { M: 80, F: 30 }, age: {}, city: {}, country: {} },
    });

    const result = await buildAudienceInsights(USER);
    expect(result.engagedDivergence).toEqual({
      dimension: "gênero",
      followerLabel: "feminino",
      engagedLabel: "masculino",
    });
    expect(result.hasAny).toBe(true);
  });

  it("does NOT flag engaged divergence when tops align", async () => {
    mockCalls({ context: [], tone: [], proposal: [], format: [] }, { format: [] });
    mockDemographics.mockResolvedValue({
      follower_demographics: { gender: { F: 1000, M: 200 }, age: { "35-44": 500 }, city: {}, country: {} },
      engaged_audience_demographics: { gender: { F: 80, M: 10 }, age: { "35-44": 60 }, city: {}, country: {} },
    });

    const result = await buildAudienceInsights(USER);
    expect(result.engagedDivergence).toBeNull();
  });

  it("does NOT flag engaged divergence on a near-tie (no clear leader)", async () => {
    mockCalls({ context: [], tone: [], proposal: [], format: [] }, { format: [] });
    mockDemographics.mockResolvedValue({
      follower_demographics: { gender: { F: 1000, M: 200 }, age: {}, city: {}, country: {} },
      // engajado quase empatado (52/48) → sem líder claro (< 1.2×) → não surfa
      engaged_audience_demographics: { gender: { M: 52, F: 48 }, age: {}, city: {}, country: {} },
    });

    const result = await buildAudienceInsights(USER);
    expect(result.engagedDivergence).toBeNull();
  });

  it("detects a rising territory (saves growing in the recent half)", async () => {
    // Posts no mesmo território (fitness_sports): 1ª metade da janela com saves baixos,
    // 2ª metade com saves altos → tendência de alta.
    const now = Date.now();
    const post = (daysAgo: number, saved: number) => ({
      postDate: new Date(now - daysAgo * 86400000), stats: { saved }, context: ["fitness_sports"],
    });
    const docs = [
      post(80, 1), post(75, 1), post(70, 2), post(65, 1), // mais antigos
      post(30, 6), post(20, 7), post(15, 6), post(10, 8), // recentes
    ];
    (MetricMock.find as jest.Mock).mockReturnValueOnce({
      select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })),
    });
    mockCalls({ context: [], tone: [], proposal: [], format: [] }, { format: [] });

    // periodDays=90 explícito (com 8 posts a janela adaptativa cairia em all_time, sem corte temporal).
    const result = await buildAudienceInsights(USER, { periodDays: 90 });
    expect(result.risingTerritory?.label).toBe("Fitness/Esporte");
  });

  it("detects a surgical combo (território × momento) and suppresses plain rhythm", async () => {
    // 10 posts de fitness à NOITE com saves altos vs fitness em outras horas baixos.
    const now = Date.now();
    const atHour = (hourUTC: number, saved: number) => {
      const dt = new Date(now - 5 * 86400000);
      dt.setUTCHours(hourUTC, 0, 0, 0);
      return { postDate: dt, stats: { saved }, context: ["fitness_sports"] };
    };
    const docs = [
      // noite (21h UTC → 18h SP) — saves altos, 10 posts
      ...Array.from({ length: 10 }, () => atHour(23, 10)),
      // manhã/tarde — saves baixos, 10 posts
      ...Array.from({ length: 10 }, () => atHour(13, 1)),
    ];
    (MetricMock.find as jest.Mock).mockReturnValueOnce({
      select: jest.fn(() => ({ lean: jest.fn(() => Promise.resolve(docs)) })),
    });
    mockCalls({ context: [], tone: [], proposal: [], format: [] }, { format: [] });

    const result = await buildAudienceInsights(USER, { periodDays: 90 });
    expect(result.combo).not.toBeNull();
    expect(result.combo?.territoryLabel).toBe("Fitness/Esporte");
    expect(result.combo?.whenKind).toBe("timeOfDay");
    // combo presente → rhythm suprimido (não repete o "quando")
    expect(result.rhythm).toBeNull();
  });

  it("returns all-null/hasAny=false when there is no confident signal", async () => {
    mockCalls(
      { context: [], tone: [], proposal: [], format: [] },
      { format: [] },
    );

    const result = await buildAudienceInsights(USER);
    expect(result.hasAny).toBe(false);
    expect(result.orphanTerritory).toBeNull();
    expect(result.resonantTone).toBeNull();
  });

  it("returns empty insights gracefully when the data layer throws", async () => {
    mockGroupings.mockReset();
    mockGroupings.mockRejectedValue(new Error("db down"));

    const result = await buildAudienceInsights(USER);
    expect(result.hasAny).toBe(false);
  });
});
