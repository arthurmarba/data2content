import { matchCollabsForPautas } from "./perPautaCollabMatchingService";

// ── Mocks ───────────────────────────────────────────────────────────────────

const mockBuildPool = jest.fn();
const mockBuildMatch = jest.fn();
const mockFitReason = jest.fn();
jest.mock("./narrativeCollabMatchingService", () => ({
  buildNarrativeCandidatePool: (...a: unknown[]) => mockBuildPool(...a),
  buildMatchFromCandidate: (...a: unknown[]) => mockBuildMatch(...a),
  generateNarrativeFitReason: (...a: unknown[]) => mockFitReason(...a),
}));

// Ranker determinístico: devolve o pool na ordem (o melhor é o primeiro livre).
jest.mock("./collabComplementarity", () => ({
  rankByComplementarity: (_v: unknown, pool: unknown[]) => pool,
}));

function poolEntry(userId: string) {
  return { userId, user: { _id: userId }, reading: { videoReading: { mainNarrative: `n-${userId}` } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFitReason.mockResolvedValue("GEMINI_FIT");
  // buildMatch ecoa o id do candidato + o fitReason recebido, para asserts.
  mockBuildMatch.mockImplementation((eligible: any, _labels: unknown, _terr: unknown, fit: string) => ({
    id: eligible.userId,
    narrativeFitReason: fit,
  }));
});

describe("matchCollabsForPautas", () => {
  it("dedup por território: pautas do mesmo território compartilham o match", async () => {
    mockBuildPool.mockResolvedValue({ pool: [poolEntry("c1"), poolEntry("c2")], candidateTerritoriesById: new Map() });
    const pautas = [
      { id: "p1", territory: "Paternidade" },
      { id: "p2", territory: "paternidade" }, // mesmo território (case-insensitive)
      { id: "p3", territory: "Carreira" },
    ];

    const r = await matchCollabsForPautas("viewer", pautas, "minha narrativa");

    // 2 territórios únicos → ranker chamado 2×
    expect(r.get("p1")?.id).toBe("c1");
    expect(r.get("p2")?.id).toBe("c1"); // mesmo match de p1
    expect(r.get("p3")?.id).toBe("c2"); // território diferente → outro criador (excludeIds)
  });

  it("excludeIds: não repete o mesmo criador entre territórios", async () => {
    mockBuildPool.mockResolvedValue({ pool: [poolEntry("c1"), poolEntry("c2")], candidateTerritoriesById: new Map() });
    const r = await matchCollabsForPautas("viewer", [
      { id: "p1", territory: "A" },
      { id: "p2", territory: "B" },
    ], "narrativa");
    expect(r.get("p1")?.id).toBe("c1");
    expect(r.get("p2")?.id).toBe("c2");
  });

  it("sem candidato livre → pauta fica null", async () => {
    mockBuildPool.mockResolvedValue({ pool: [poolEntry("c1")], candidateTerritoriesById: new Map() });
    const r = await matchCollabsForPautas("viewer", [
      { id: "p1", territory: "A" },
      { id: "p2", territory: "B" }, // só há c1, já usado em A
    ], "narrativa");
    expect(r.get("p1")?.id).toBe("c1");
    expect(r.get("p2")).toBeNull();
  });

  it("teto de chamadas Gemini: estourado, usa fallback (sem chamar Gemini)", async () => {
    mockBuildPool.mockResolvedValue({
      pool: [poolEntry("c1"), poolEntry("c2"), poolEntry("c3")],
      candidateTerritoriesById: new Map(),
    });
    const r = await matchCollabsForPautas(
      "viewer",
      [
        { id: "p1", territory: "A" },
        { id: "p2", territory: "B" },
        { id: "p3", territory: "C" },
      ],
      "narrativa",
      { geminiCallCap: 1 },
    );
    expect(mockFitReason).toHaveBeenCalledTimes(1); // só 1 chamada Gemini
    expect(r.get("p1")?.narrativeFitReason).toBe("GEMINI_FIT");
    expect(r.get("p2")?.narrativeFitReason).toContain("B"); // fallback derivado do território
    expect(r.get("p3")?.narrativeFitReason).toContain("C");
  });

  it("pauta sem território → null, e não chama o pool se nenhuma tem território", async () => {
    const r = await matchCollabsForPautas("viewer", [{ id: "p1", territory: "" }], "narrativa");
    expect(r.get("p1")).toBeNull();
    expect(mockBuildPool).not.toHaveBeenCalled();
  });

  it("pool vazio/null → todas as pautas null", async () => {
    mockBuildPool.mockResolvedValue(null);
    const r = await matchCollabsForPautas("viewer", [{ id: "p1", territory: "A" }], "narrativa");
    expect(r.get("p1")).toBeNull();
  });
});
