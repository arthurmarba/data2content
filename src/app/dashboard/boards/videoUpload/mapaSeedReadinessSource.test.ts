import { getMapaSeedReadinessSource } from "./mapaSeedReadinessSource";
import MapaSeedModel from "@/app/models/MapaSeed";

jest.mock("@/app/models/MapaSeed", () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

const mockFindOne = (MapaSeedModel as unknown as { findOne: jest.Mock }).findOne;

// Mocka a cadeia findOne(...).select(...).lean()
function mockMapaDoc(doc: unknown) {
  mockFindOne.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(doc),
    }),
  });
}

beforeEach(() => jest.clearAllMocks());

describe("getMapaSeedReadinessSource", () => {
  it("sem MapaSeed → fonte vazia", async () => {
    mockMapaDoc(null);
    const r = await getMapaSeedReadinessSource("u1");
    expect(r).toEqual({
      hasNarrative: false,
      narrativeLabel: null,
      hasTerritories: false,
      territories: [],
      tone: null,
      assets: [],
      temas: [],
      lastEnrichedAt: null,
    });
  });

  it("MapaSeed semente (só narrativa do onboarding) → narrativa sim, territórios não", async () => {
    mockMapaDoc({ mapa: { narrativa_central: "Comida como prazer, não punição", territorios: [], tom: "" } });
    const r = await getMapaSeedReadinessSource("u1");
    expect(r.hasNarrative).toBe(true);
    expect(r.narrativeLabel).toBe("Comida como prazer, não punição");
    expect(r.hasTerritories).toBe(false);
    expect(r.tone).toBeNull();
  });

  it("MapaSeed enriquecido (Instagram) → narrativa + territórios + tom + assets + temas", async () => {
    mockMapaDoc({
      mapa: {
        narrativa_central: "Autocuidado e equilíbrio",
        territorios: ["Receitas práticas", "  ", "Mitos nutricionais"],
        temas: ["Cozinhar depois de um dia exausto", "  ", "Montar a marmita da semana"],
        assets: ["Praia", "Metrô", "  "],
        tom: "Acolhedor e direto",
      },
    });
    const r = await getMapaSeedReadinessSource("u1");
    expect(r.hasNarrative).toBe(true);
    // filtra território em branco
    expect(r.territories).toEqual(["Receitas práticas", "Mitos nutricionais"]);
    expect(r.hasTerritories).toBe(true);
    expect(r.tone).toBe("Acolhedor e direto");
    // assets e temas chegam limpos (sem chips em branco)
    expect(r.assets).toEqual(["Praia", "Metrô"]);
    expect(r.temas).toEqual(["Cozinhar depois de um dia exausto", "Montar a marmita da semana"]);
  });

  it("MapaSeed sem assets/temas → arrays vazios (não quebra)", async () => {
    mockMapaDoc({
      mapa: { narrativa_central: "X", territorios: ["T"], tom: "Y" },
    });
    const r = await getMapaSeedReadinessSource("u1");
    expect(r.assets).toEqual([]);
    expect(r.temas).toEqual([]);
  });

  it("narrativa só com espaços → não conta", async () => {
    mockMapaDoc({ mapa: { narrativa_central: "   ", territorios: ["Algo"], tom: null } });
    const r = await getMapaSeedReadinessSource("u1");
    expect(r.hasNarrative).toBe(false);
    expect(r.narrativeLabel).toBeNull();
    expect(r.hasTerritories).toBe(true);
  });

  it("erro no banco → fonte vazia (best-effort, nunca lança)", async () => {
    mockFindOne.mockImplementation(() => {
      throw new Error("db down");
    });
    await expect(getMapaSeedReadinessSource("u1")).resolves.toEqual({
      hasNarrative: false,
      narrativeLabel: null,
      hasTerritories: false,
      territories: [],
      tone: null,
      assets: [],
      temas: [],
      lastEnrichedAt: null,
    });
  });

  it("expõe o enriquecimento mais recente (max de Instagram e vídeo)", async () => {
    const igAt = new Date("2026-06-01T10:00:00.000Z");
    const videoAt = new Date("2026-06-05T10:00:00.000Z");
    mockMapaDoc({
      mapa: { narrativa_central: "X", territorios: ["T"], tom: "Y" },
      instagramEnrichedAt: igAt,
      videoEnrichedAt: videoAt,
    });
    const r = await getMapaSeedReadinessSource("u1");
    expect(r.lastEnrichedAt).toEqual(videoAt); // vídeo é o mais recente
  });

  it("lastEnrichedAt é null quando o mapa nunca foi enriquecido", async () => {
    mockMapaDoc({ mapa: { narrativa_central: "X", territorios: ["T"], tom: "Y" } });
    const r = await getMapaSeedReadinessSource("u1");
    expect(r.lastEnrichedAt).toBeNull();
  });
});
