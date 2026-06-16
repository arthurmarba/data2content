import { loadStrategicMapSummary } from "./loadStrategicMapSummary";
import MapaSeedModel from "@/app/models/MapaSeed";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/app/models/MapaSeed", () => ({ __esModule: true, default: { findOne: jest.fn() } }));

const mockFindOne = (MapaSeedModel as unknown as { findOne: jest.Mock }).findOne;

// Mocka a cadeia findOne(...).select(...).lean()
function mockMapa(doc: unknown) {
  mockFindOne.mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(doc),
    }),
  });
}

const VALID_USER_ID = "507f1f77bcf86cd799439011";

describe("loadStrategicMapSummary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("userId inválido → resumo vazio sem tocar o banco", async () => {
    const r = await loadStrategicMapSummary("nao-é-objectid");
    expect(r).toEqual({ hasMap: false, narrative: null, territories: [], assets: [], tone: null });
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it("sem MapaSeed → resumo vazio", async () => {
    mockMapa(null);
    const r = await loadStrategicMapSummary(VALID_USER_ID);
    expect(r.hasMap).toBe(false);
  });

  it("mapa completo → narrativa + territórios + assets + tom", async () => {
    mockMapa({
      mapa: {
        narrativa_central: "um estrategista que defende autonomia criativa",
        territorios: ["Autonomia criativa", "Negócios criativos"],
        assets: ["Casado", "Mora no interior"],
        tom: "reflexivo e direto",
      },
    });
    const r = await loadStrategicMapSummary(VALID_USER_ID);
    expect(r).toEqual({
      hasMap: true,
      narrative: "um estrategista que defende autonomia criativa",
      territories: ["Autonomia criativa", "Negócios criativos"],
      assets: ["Casado", "Mora no interior"],
      tone: "reflexivo e direto",
    });
  });

  it("conserta acentos mutilados do gerador (cabe00e7a → cabeça)", async () => {
    mockMapa({ mapa: { narrativa_central: "um cara com a cabe00e7a no surf", territorios: [], assets: [] } });
    const r = await loadStrategicMapSummary(VALID_USER_ID);
    expect(r.narrative).toBe("um cara com a cabeça no surf");
  });

  it("só narrativa (semente) → hasMap true, arrays vazios", async () => {
    mockMapa({ mapa: { narrativa_central: "quem eu sou", territorios: [], assets: [] } });
    const r = await loadStrategicMapSummary(VALID_USER_ID);
    expect(r.hasMap).toBe(true);
    expect(r.territories).toEqual([]);
    expect(r.tone).toBeNull();
  });

  it("filtra entradas vazias dos arrays", async () => {
    mockMapa({ mapa: { narrativa_central: "", territorios: ["Negócios", ""], assets: [""] } });
    const r = await loadStrategicMapSummary(VALID_USER_ID);
    expect(r.territories).toEqual(["Negócios"]);
    expect(r.assets).toEqual([]);
    expect(r.narrative).toBeNull();
    expect(r.hasMap).toBe(true); // território presente
  });

  it("erro no banco → resumo vazio (não lança)", async () => {
    mockFindOne.mockImplementation(() => { throw new Error("db down"); });
    await expect(loadStrategicMapSummary(VALID_USER_ID)).resolves.toEqual({
      hasMap: false, narrative: null, territories: [], assets: [], tone: null,
    });
  });
});
