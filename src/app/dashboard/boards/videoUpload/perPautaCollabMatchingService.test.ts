import { matchCollabsForPautas } from "./perPautaCollabMatchingService";

// ── Mocks ───────────────────────────────────────────────────────────────────
// Só o serviço de narrativa é mockado (pool + buildMatch + Gemini). O scoring de
// território (collabComplementarity) roda DE VERDADE — é o que garante coerência.

const mockBuildPool = jest.fn();
const mockBuildMatch = jest.fn();
const mockCollabContext = jest.fn();
jest.mock("./narrativeCollabMatchingService", () => ({
  buildNarrativeCandidatePool: (...a: unknown[]) => mockBuildPool(...a),
  buildMatchFromCandidate: (...a: unknown[]) => mockBuildMatch(...a),
  generateCollabContext: (...a: unknown[]) => mockCollabContext(...a),
}));

/** Candidato com territórios reais (o que dá relevância ao match por-pauta). */
function poolEntry(userId: string, territories: string[]) {
  return { userId, user: { _id: userId }, reading: { videoReading: { mainNarrative: `narrativa de ${userId}` } }, territories };
}
/** Monta o NarrativeCandidatePool (pool + mapa de territórios por userId). */
function poolOf(...entries: Array<ReturnType<typeof poolEntry>>) {
  return {
    pool: entries.map(({ territories, ...e }) => e),
    candidateTerritoriesById: new Map(entries.map((e) => [e.userId, e.territories])),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCollabContext.mockResolvedValue({ fitReason: "GEMINI_FIT", recordingIdea: "GEMINI_REC" });
  mockBuildMatch.mockImplementation((eligible: any, _labels: unknown, _terr: unknown, fit: string, rec?: string) => ({
    id: eligible.userId,
    narrativeFitReason: fit,
    collabRecordingIdea: rec ?? null,
  }));
});

describe("matchCollabsForPautas", () => {
  it("dedup por território: pautas do mesmo território compartilham o match", async () => {
    mockBuildPool.mockResolvedValue(poolOf(
      poolEntry("c1", ["Paternidade", "Carreira"]),
      poolEntry("c2", ["Paternidade", "Carreira"]),
    ));
    const r = await matchCollabsForPautas("viewer", [
      { id: "p1", territory: "Paternidade" },
      { id: "p2", territory: "paternidade" }, // mesmo território (case-insensitive)
      { id: "p3", territory: "Carreira" },
    ], "minha narrativa");

    expect(r.get("p1")?.id).toBe("c1");
    expect(r.get("p2")?.id).toBe("c1"); // mesmo match de p1
    expect(r.get("p3")?.id).toBe("c2"); // território diferente → outro criador (excludeIds)
  });

  it("excludeIds: não repete o mesmo criador entre territórios", async () => {
    mockBuildPool.mockResolvedValue(poolOf(
      poolEntry("c1", ["Paternidade", "Carreira"]),
      poolEntry("c2", ["Paternidade", "Carreira"]),
    ));
    const r = await matchCollabsForPautas("viewer", [
      { id: "p1", territory: "Paternidade" },
      { id: "p2", territory: "Carreira" },
    ], "narrativa");
    expect(r.get("p1")?.id).toBe("c1");
    expect(r.get("p2")?.id).toBe("c2");
  });

  it("sem candidato livre → pauta fica null", async () => {
    mockBuildPool.mockResolvedValue(poolOf(poolEntry("c1", ["Paternidade", "Carreira"])));
    const r = await matchCollabsForPautas("viewer", [
      { id: "p1", territory: "Paternidade" },
      { id: "p2", territory: "Carreira" }, // só há c1, já usado em Paternidade
    ], "narrativa");
    expect(r.get("p1")?.id).toBe("c1");
    expect(r.get("p2")).toBeNull();
  });

  it("coerência: criador sem laço com o território NÃO casa (pauta fica null)", async () => {
    // c1 só fala de Beleza; a pauta é de Tecnologia → sem sobreposição → null.
    mockBuildPool.mockResolvedValue(poolOf(poolEntry("c1", ["Beleza", "Maquiagem"])));
    const r = await matchCollabsForPautas("viewer", [
      { id: "p1", territory: "Tecnologia" },
    ], "narrativa");
    expect(r.get("p1")).toBeNull();
    expect(mockCollabContext).not.toHaveBeenCalled(); // nem gasta Gemini
  });

  it("teto de chamadas Gemini: estourado, usa fallback (sem chamar Gemini)", async () => {
    mockBuildPool.mockResolvedValue(poolOf(
      poolEntry("c1", ["Paternidade", "Carreira", "Saude"]),
      poolEntry("c2", ["Paternidade", "Carreira", "Saude"]),
      poolEntry("c3", ["Paternidade", "Carreira", "Saude"]),
    ));
    const r = await matchCollabsForPautas("viewer", [
      { id: "p1", territory: "Paternidade" },
      { id: "p2", territory: "Carreira" },
      { id: "p3", territory: "Saude" },
    ], "narrativa", { geminiCallCap: 1 });

    expect(mockCollabContext).toHaveBeenCalledTimes(1); // só 1 chamada Gemini
    expect(r.get("p1")?.narrativeFitReason).toBe("GEMINI_FIT");
    expect(r.get("p2")?.narrativeFitReason).toContain("Carreira"); // fallback derivado do território
    expect(r.get("p3")?.narrativeFitReason).toContain("Saude");
  });

  it("pauta sem território → null, e não chama o pool se nenhuma tem território", async () => {
    const r = await matchCollabsForPautas("viewer", [{ id: "p1", territory: "" }], "narrativa");
    expect(r.get("p1")).toBeNull();
    expect(mockBuildPool).not.toHaveBeenCalled();
  });

  it("pool vazio/null → todas as pautas null", async () => {
    mockBuildPool.mockResolvedValue(null);
    const r = await matchCollabsForPautas("viewer", [{ id: "p1", territory: "Paternidade" }], "narrativa");
    expect(r.get("p1")).toBeNull();
  });
});
