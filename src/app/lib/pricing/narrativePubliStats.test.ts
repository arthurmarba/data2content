import { fetchNarrativePubliStats, safeFetchNarrativePubliStats, MIN_SAMPLE } from "./narrativePubliStats";
import UserModel from "@/app/models/User";

jest.mock("@/app/lib/mongoose", () => ({
  __esModule: true,
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { aggregate: jest.fn() },
}));

jest.mock("@/app/lib/logger", () => ({
  __esModule: true,
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

const mockAggregate = (UserModel as any).aggregate as jest.Mock;

/** Helper: faz aggregate(...).exec() resolver para `rows`. */
function aggregateResolves(rows: unknown[]) {
  mockAggregate.mockReturnValue({ exec: jest.fn().mockResolvedValue(rows) });
}

describe("narrativePubliStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna insufficient para narrativa desconhecida sem nem consultar o banco", async () => {
    const stats = await fetchNarrativePubliStats("inexistente");
    expect(stats.source).toBe("insufficient");
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it("retorna insufficient quando a amostra é menor que MIN_SAMPLE", async () => {
    aggregateResolves([
      { _id: null, followers: [10_000, 20_000], sample: 2, avg: 15_000 },
    ]);
    const stats = await fetchNarrativePubliStats("ensino_conhecimento");
    expect(stats.source).toBe("insufficient");
    expect(stats.sample).toBe(2);
    expect(stats.min).toBeNull();
  });

  it("retorna a faixa dinâmica (p25–p75) quando há amostra suficiente", async () => {
    const followers = [10_000, 20_000, 30_000, 40_000, 50_000];
    aggregateResolves([
      { _id: null, followers, sample: followers.length, avg: 30_000 },
    ]);

    const stats = await fetchNarrativePubliStats("ensino_conhecimento");

    expect(stats.source).toBe("dynamic");
    expect(stats.sample).toBe(5);
    expect(stats.avgFollowers).toBe(30_000);
    expect(stats.label).toBe("conteúdo educativo");
    // p25 = 20k, p75 = 40k → faixa de preço para cpm 18
    expect(stats.min).toBe(390);
    expect(stats.max).toBe(790);
  });

  it("consulta a coorte por todas as chaves equivalentes da narrativa", async () => {
    aggregateResolves([{ _id: null, followers: [10_000, 20_000, 30_000, 40_000, 50_000], sample: 5, avg: 30_000 }]);
    await fetchNarrativePubliStats("ensino_conhecimento");

    const pipeline = mockAggregate.mock.calls[0][0] as any[];
    const matchKeys = pipeline[0].$match["onboardingAnswers.whyYouCreate"].$in;
    expect(matchKeys).toEqual(
      expect.arrayContaining(["ensino_conhecimento", "compartilho_aprendizado", "ensino_habilidade"]),
    );
  });

  it("safeFetch engole erros e devolve insufficient", async () => {
    mockAggregate.mockReturnValue({ exec: jest.fn().mockRejectedValue(new Error("db down")) });
    const stats = await safeFetchNarrativePubliStats("ensino_conhecimento");
    expect(stats.source).toBe("insufficient");
  });

  it("MIN_SAMPLE é um limiar positivo", () => {
    expect(MIN_SAMPLE).toBeGreaterThan(0);
  });
});
