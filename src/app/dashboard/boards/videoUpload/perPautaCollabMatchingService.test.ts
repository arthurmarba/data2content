import { matchCollabsForPautas } from "./perPautaCollabMatchingService";

// ── Mocks ───────────────────────────────────────────────────────────────────
// Mockamos o serviço de narrativa (pool + buildMatch + atribuição semântica do
// Gemini). O scoring determinístico de território (collabComplementarity) roda
// DE VERDADE — é o fallback que garante coerência quando o LLM não opina.

const mockBuildPool = jest.fn();
const mockBuildMatch = jest.fn();
const mockAssign = jest.fn();
jest.mock("./narrativeCollabMatchingService", () => ({
  buildNarrativeCandidatePool: (...a: unknown[]) => mockBuildPool(...a),
  buildMatchFromCandidate: (...a: unknown[]) => mockBuildMatch(...a),
  assignCollabsByTerritory: (...a: unknown[]) => mockAssign(...a),
}));

/** Candidato com territórios reais (o que dá relevância ao match por-pauta). */
function poolEntry(userId: string, territories: string[]) {
  return { userId, user: { _id: userId, name: userId }, reading: { videoReading: { mainNarrative: `narrativa de ${userId}` } }, territories };
}
function poolOf(...entries: Array<ReturnType<typeof poolEntry>>) {
  return {
    pool: entries.map(({ territories, ...e }) => e),
    candidateTerritoriesById: new Map(entries.map((e) => [e.userId, e.territories])),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAssign.mockResolvedValue(new Map()); // por padrão: LLM "não opina" → determinístico
  mockBuildMatch.mockImplementation((eligible: any, _labels: unknown, _terr: unknown, fit: string, rec?: string) => ({
    id: eligible.userId,
    narrativeFitReason: fit,
    collabRecordingIdea: rec ?? null,
  }));
});

describe("matchCollabsForPautas — fallback determinístico (LLM não opina)", () => {
  it("dedup por território: pautas do mesmo território compartilham o match", async () => {
    mockBuildPool.mockResolvedValue(poolOf(
      poolEntry("c1", ["Paternidade", "Carreira"]),
      poolEntry("c2", ["Paternidade", "Carreira"]),
    ));
    const r = await matchCollabsForPautas("viewer", [
      { id: "p1", territory: "Paternidade" },
      { id: "p2", territory: "paternidade" },
      { id: "p3", territory: "Carreira" },
    ], "minha narrativa");

    expect(r.get("p1")?.id).toBe("c1");
    expect(r.get("p2")?.id).toBe("c1");
    expect(r.get("p3")?.id).toBe("c2"); // excludeIds
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
      { id: "p2", territory: "Carreira" },
    ], "narrativa");
    expect(r.get("p1")?.id).toBe("c1");
    expect(r.get("p2")).toBeNull();
  });

  it("coerência: criador sem laço com o território NÃO casa (pauta fica null)", async () => {
    mockBuildPool.mockResolvedValue(poolOf(poolEntry("c1", ["Beleza", "Maquiagem"])));
    const r = await matchCollabsForPautas("viewer", [{ id: "p1", territory: "Tecnologia" }], "narrativa");
    expect(r.get("p1")).toBeNull();
  });

  it("geminiCallCap 0 desliga o LLM → não chama assignCollabsByTerritory", async () => {
    mockBuildPool.mockResolvedValue(poolOf(poolEntry("c1", ["Paternidade"])));
    const r = await matchCollabsForPautas("viewer", [{ id: "p1", territory: "Paternidade" }], "narrativa", { geminiCallCap: 0 });
    expect(mockAssign).not.toHaveBeenCalled();
    expect(r.get("p1")?.id).toBe("c1"); // determinístico
  });
});

describe("matchCollabsForPautas — atribuição semântica (Gemini)", () => {
  it("usa a escolha do LLM mesmo que não seja a do word-overlap, com fit/recording dele", async () => {
    mockBuildPool.mockResolvedValue(poolOf(
      poolEntry("c1", ["Paternidade"]),
      poolEntry("c2", ["Empreendedorismo"]), // word-overlap NÃO casaria "Negócios"
    ));
    mockAssign.mockResolvedValue(new Map([
      ["negócios criativos", { candidateId: "c2", fitReason: "LLM_FIT", recordingIdea: "LLM_REC" }],
    ]));
    const r = await matchCollabsForPautas("viewer", [{ id: "p1", territory: "Negócios criativos" }], "narrativa");
    expect(r.get("p1")?.id).toBe("c2"); // semântico: empreendedorismo ↔ negócios
    expect(r.get("p1")?.narrativeFitReason).toBe("LLM_FIT");
    expect(r.get("p1")?.collabRecordingIdea).toBe("LLM_REC");
  });

  it("LLM diz null → respeita (null), mesmo com word-overlap disponível", async () => {
    mockBuildPool.mockResolvedValue(poolOf(poolEntry("c1", ["Paternidade"])));
    mockAssign.mockResolvedValue(new Map([
      ["paternidade", { candidateId: null, fitReason: "", recordingIdea: null }],
    ]));
    const r = await matchCollabsForPautas("viewer", [{ id: "p1", territory: "Paternidade" }], "narrativa");
    expect(r.get("p1")).toBeNull();
  });

  it("LLM alucina id inexistente → cai no determinístico", async () => {
    mockBuildPool.mockResolvedValue(poolOf(poolEntry("c1", ["Paternidade"])));
    mockAssign.mockResolvedValue(new Map([
      ["paternidade", { candidateId: "FANTASMA", fitReason: "x", recordingIdea: null }],
    ]));
    const r = await matchCollabsForPautas("viewer", [{ id: "p1", territory: "Paternidade" }], "narrativa");
    expect(r.get("p1")?.id).toBe("c1"); // fallback determinístico recupera
  });
});

describe("matchCollabsForPautas — guardas", () => {
  it("pauta sem território → null, e não chama o pool", async () => {
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
