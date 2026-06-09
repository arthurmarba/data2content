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

/** Faz a PRÓXIMA chamada de aggregate(...).exec() resolver para `rows`. */
function aggregateResolvesOnce(rows: unknown[]) {
  mockAggregate.mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(rows) });
}

/** Linha agregada de seguidores para os criadores com a distribuição dada. */
function followersRow(followers: number[]) {
  const avg = followers.reduce((a, b) => a + b, 0) / followers.length;
  return { _id: null, followers, sample: followers.length, avg };
}

const FIVE = [10_000, 20_000, 30_000, 40_000, 50_000]; // p25=20k, p75=40k

describe("narrativePubliStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna a faixa da NARRATIVA quando a coorte específica tem amostra suficiente", async () => {
    aggregateResolvesOnce([followersRow(FIVE)]); // 1ª chamada: coorte da narrativa

    const stats = await fetchNarrativePubliStats("ensino_conhecimento");

    expect(stats.source).toBe("dynamic");
    expect(stats.scope).toBe("narrative");
    expect(stats.sample).toBe(5);
    expect(stats.avgFollowers).toBe(30_000);
    expect(stats.label).toBe("conteúdo educativo");
    expect(stats.min).toBe(390);
    expect(stats.max).toBe(790);
    expect(mockAggregate).toHaveBeenCalledTimes(1); // não precisou alargar
  });

  it("ALARGA para a plataforma quando a narrativa tem amostra insuficiente", async () => {
    aggregateResolvesOnce([followersRow([10_000, 20_000])]); // narrativa: só 2 → rala
    aggregateResolvesOnce([followersRow(FIVE)]); // plataforma: 5 → suficiente

    const stats = await fetchNarrativePubliStats("ensino_conhecimento");

    expect(stats.source).toBe("dynamic");
    expect(stats.scope).toBe("platform");
    expect(stats.sample).toBe(5);
    // preço ainda usa o CPM da narrativa do criador
    expect(stats.min).toBe(390);
    expect(stats.max).toBe(790);
    expect(mockAggregate).toHaveBeenCalledTimes(2);
  });

  it("vai direto para a plataforma quando a narrativa é desconhecida (sem coorte específica)", async () => {
    aggregateResolvesOnce([followersRow(FIVE)]); // só a chamada de plataforma

    const stats = await fetchNarrativePubliStats("inexistente");

    expect(stats.source).toBe("dynamic");
    expect(stats.scope).toBe("platform");
    expect(mockAggregate).toHaveBeenCalledTimes(1); // narrativa desconhecida não consulta coorte específica
  });

  it("retorna insufficient só quando NEM a plataforma tem amostra suficiente", async () => {
    aggregateResolvesOnce([followersRow([10_000, 20_000])]); // narrativa: rala
    aggregateResolvesOnce([followersRow([15_000, 25_000])]); // plataforma: rala

    const stats = await fetchNarrativePubliStats("ensino_conhecimento");

    expect(stats.source).toBe("insufficient");
    expect(stats.scope).toBeNull();
    expect(stats.min).toBeNull();
    expect(stats.sample).toBe(2);
  });

  it("consulta a coorte da narrativa por todas as chaves equivalentes e exige seguidores reais", async () => {
    aggregateResolvesOnce([followersRow(FIVE)]);
    await fetchNarrativePubliStats("ensino_conhecimento");

    const pipeline = mockAggregate.mock.calls[0][0] as any[];
    const matchKeys = pipeline[0].$match["onboardingAnswers.whyYouCreate"].$in;
    expect(matchKeys).toEqual(
      expect.arrayContaining(["ensino_conhecimento", "compartilho_aprendizado", "ensino_habilidade"]),
    );
    expect(pipeline[0].$match.followers_count).toEqual({ $gt: 0 });
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
