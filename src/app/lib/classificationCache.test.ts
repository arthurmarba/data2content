import type { ClassificationResult } from "./classificationRuntime";

// ── Mock do cliente Redis ────────────────────────────────────────────────────
const store = new Map<string, string>();
const mockGet = jest.fn(async (k: string) => store.get(k) ?? null);
const mockSet = jest.fn(async (k: string, v: string) => {
  store.set(k, v);
  return "OK";
});
const mockConnect = jest.fn(async () => undefined);
const clientStub = {
  isOpen: true,
  on: jest.fn(),
  connect: mockConnect,
  get: mockGet,
  set: mockSet,
};
jest.mock("redis", () => ({ createClient: jest.fn(() => clientStub) }));
jest.mock("./logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const RESULT: ClassificationResult = {
  format: ["reel"],
  proposal: ["tips"],
  context: [],
  tone: [],
  references: [],
  contentIntent: ["teach"],
  narrativeForm: [],
  contentSignals: [],
  stance: [],
  proofStyle: [],
  commercialMode: [],
};

const ORIGINAL_ENV = { ...process.env };

describe("classificationCache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.clear();
    process.env = { ...ORIGINAL_ENV, REDIS_URL: "redis://localhost:6379" };
    delete process.env.CLASSIFICATION_CACHE_ENABLED;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // Import tardio para reler env / resetar singleton de conexão a cada caso.
  function load() {
    let mod!: typeof import("./classificationCache");
    jest.isolateModules(() => {
      mod = require("./classificationCache");
    });
    return mod;
  }

  it("miss → null sem nada gravado", async () => {
    const { getCachedClassification } = load();
    await expect(getCachedClassification("uma legenda", "gpt-4o-mini")).resolves.toBeNull();
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("set depois get → hit retorna o mesmo resultado", async () => {
    const { getCachedClassification, setCachedClassification } = load();
    await setCachedClassification("uma legenda", "gpt-4o-mini", RESULT);
    await expect(getCachedClassification("uma legenda", "gpt-4o-mini")).resolves.toEqual(RESULT);
  });

  it("normaliza descrição: espaços/caixa diferentes batem na mesma chave", async () => {
    const { getCachedClassification, setCachedClassification } = load();
    await setCachedClassification("Uma   Legenda", "gpt-4o-mini", RESULT);
    await expect(getCachedClassification("uma legenda", "gpt-4o-mini")).resolves.toEqual(RESULT);
  });

  it("modelo diferente = chave diferente (não serve cache de outro modelo)", async () => {
    const { getCachedClassification, setCachedClassification } = load();
    await setCachedClassification("uma legenda", "gpt-4o-mini", RESULT);
    await expect(getCachedClassification("uma legenda", "gpt-4o")).resolves.toBeNull();
  });

  it("sem REDIS_URL → no-op (não toca o cliente)", async () => {
    delete process.env.REDIS_URL;
    const { getCachedClassification, setCachedClassification } = load();
    await setCachedClassification("uma legenda", "gpt-4o-mini", RESULT);
    await expect(getCachedClassification("uma legenda", "gpt-4o-mini")).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it("CLASSIFICATION_CACHE_ENABLED=false → desligado", async () => {
    process.env.CLASSIFICATION_CACHE_ENABLED = "false";
    const { getCachedClassification } = load();
    await expect(getCachedClassification("uma legenda", "gpt-4o-mini")).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("descrição vazia → null sem tocar o Redis", async () => {
    const { getCachedClassification } = load();
    await expect(getCachedClassification("   ", "gpt-4o-mini")).resolves.toBeNull();
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("erro no get é engolido → retorna null (degradação graciosa)", async () => {
    mockGet.mockRejectedValueOnce(new Error("boom"));
    const { getCachedClassification } = load();
    await expect(getCachedClassification("uma legenda", "gpt-4o-mini")).resolves.toBeNull();
  });
});
