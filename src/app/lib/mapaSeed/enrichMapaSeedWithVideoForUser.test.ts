// src/app/lib/mapaSeed/enrichMapaSeedWithVideoForUser.test.ts

import { enrichMapaSeedWithVideoForUser } from "./enrichMapaSeedWithVideoForUser";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockMapaSave = jest.fn().mockResolvedValue(undefined);
const mockMapaFindOne = jest.fn();
jest.mock("@/app/models/MapaSeed", () => ({
  __esModule: true,
  default: { findOne: (...args: unknown[]) => mockMapaFindOne(...args) },
}));

// Mantém o readingFeedsNarrativeMap real (predicado puro), mocka só a query.
const mockListReadings = jest.fn();
jest.mock("@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisReadService", () => {
  const actual = jest.requireActual(
    "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeDiagnosisReadService",
  );
  return {
    ...actual,
    listRecentCreatorVideoNarrativeDiagnosesForUser: (...args: unknown[]) =>
      mockListReadings(...args),
  };
});

const mockBuildSynthesis = jest.fn();
jest.mock("@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis", () => ({
  buildCreatorStrategicProfileSynthesis: (...args: unknown[]) => mockBuildSynthesis(...args),
}));

const mockEnrichVideo = jest.fn();
jest.mock("./enrichMapaWithVideoReadings", () => ({
  enrichMapaWithVideoReadings: (...args: unknown[]) => mockEnrichVideo(...args),
}));

const mockGetConfirmations = jest.fn().mockResolvedValue(null);
jest.mock("@/app/dashboard/boards/videoUpload/mapConfirmationsService", () => ({
  getMapConfirmationsSnapshot: (...args: unknown[]) => mockGetConfirmations(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMapaDoc(overrides?: object) {
  return {
    mapa: { maturidade: "instagram_enriched", narrativa_central: "atual" },
    save: mockMapaSave,
    ...overrides,
  };
}

const yesReading = { diagnosisId: "r1", publishIntent: "yes" };
const noReading = { diagnosisId: "r2", publishIntent: "no" };
const legacyReading = { diagnosisId: "r3", publishIntent: null };

const richSynthesis = { status: "pattern_in_formation", analyzedReadingsCount: 2 };
const enrichedMapa = { maturidade: "video_enriched", narrativa_central: "refinada" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("enrichMapaSeedWithVideoForUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfirmations.mockResolvedValue(null);
  });

  it("enriquece e salva quando há leituras publicadas e síntese válida", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockListReadings.mockResolvedValue([yesReading, legacyReading]);
    mockBuildSynthesis.mockReturnValue(richSynthesis);
    mockEnrichVideo.mockResolvedValue(enrichedMapa);

    await enrichMapaSeedWithVideoForUser("user123");

    // Síntese construída apenas com leituras que alimentam o mapa.
    expect(mockBuildSynthesis).toHaveBeenCalledWith({
      readings: [yesReading, legacyReading],
    });
    expect(mockEnrichVideo).toHaveBeenCalledWith(
      expect.objectContaining({ maturidade: "instagram_enriched" }),
      richSynthesis,
      expect.objectContaining({ narrativeLocked: false, toneLocked: false }),
    );
    expect(mockMapaSave).toHaveBeenCalledTimes(1);
  });

  it("deriva locks das confirmações (tom confirmado → toneLocked)", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockListReadings.mockResolvedValue([yesReading]);
    mockBuildSynthesis.mockReturnValue(richSynthesis);
    mockEnrichVideo.mockResolvedValue(enrichedMapa);
    mockGetConfirmations.mockResolvedValue({ narrative: "pending", tone: "confirmed" });

    await enrichMapaSeedWithVideoForUser("user123");

    expect(mockEnrichVideo).toHaveBeenCalledWith(
      expect.anything(),
      richSynthesis,
      expect.objectContaining({ narrativeLocked: false, toneLocked: true }),
    );
  });

  it("exclui leituras 'no' antes de construir a síntese", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockListReadings.mockResolvedValue([yesReading, noReading, legacyReading]);
    mockBuildSynthesis.mockReturnValue(richSynthesis);
    mockEnrichVideo.mockResolvedValue(enrichedMapa);

    await enrichMapaSeedWithVideoForUser("user123");

    // A leitura 'no' não entra na síntese.
    expect(mockBuildSynthesis).toHaveBeenCalledWith({
      readings: [yesReading, legacyReading],
    });
  });

  it("não faz nada se MapaSeed não existe", async () => {
    mockMapaFindOne.mockResolvedValue(null);

    await enrichMapaSeedWithVideoForUser("user123");

    expect(mockListReadings).not.toHaveBeenCalled();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("não faz nada se não há leituras publicadas (todas 'no')", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockListReadings.mockResolvedValue([noReading, { diagnosisId: "r4", publishIntent: "no" }]);

    await enrichMapaSeedWithVideoForUser("user123");

    expect(mockBuildSynthesis).not.toHaveBeenCalled();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("não faz nada se a síntese está vazia", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockListReadings.mockResolvedValue([yesReading]);
    mockBuildSynthesis.mockReturnValue({ status: "empty", analyzedReadingsCount: 0 });

    await enrichMapaSeedWithVideoForUser("user123");

    expect(mockEnrichVideo).not.toHaveBeenCalled();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("é non-fatal: não lança se o cross-reference de LLM falha", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockListReadings.mockResolvedValue([yesReading]);
    mockBuildSynthesis.mockReturnValue(richSynthesis);
    mockEnrichVideo.mockRejectedValue(new Error("LLM timeout"));

    await expect(enrichMapaSeedWithVideoForUser("user123")).resolves.toBeUndefined();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("é non-fatal: não lança se connectToDatabase falha", async () => {
    const { connectToDatabase } = require("@/app/lib/mongoose");
    (connectToDatabase as jest.Mock).mockRejectedValueOnce(new Error("db down"));

    await expect(enrichMapaSeedWithVideoForUser("user123")).resolves.toBeUndefined();
  });
});
