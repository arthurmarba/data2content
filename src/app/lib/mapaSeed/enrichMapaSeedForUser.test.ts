// src/app/lib/mapaSeed/enrichMapaSeedForUser.test.ts

import { enrichMapaSeedWithInstagram } from "./enrichMapaSeedForUser";

// ── Mocks ─────────────────────────────────────────────────────────────────────

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const mockMapaSave = jest.fn().mockResolvedValue(undefined);
const mockMapaFindOne = jest.fn();
const mockMapaCreate = jest.fn();
jest.mock("@/app/models/MapaSeed", () => ({
  __esModule: true,
  default: {
    findOne: (...args: unknown[]) => mockMapaFindOne(...args),
    create: (...args: unknown[]) => mockMapaCreate(...args),
  },
}));

const mockGetConnectionDetails = jest.fn();
jest.mock("@/app/lib/instagram/db/userActions", () => ({
  getInstagramConnectionDetails: (...args: unknown[]) =>
    mockGetConnectionDetails(...args),
}));

const mockFetchMedia = jest.fn();
jest.mock("@/app/lib/instagram/api/fetchers", () => ({
  fetchInstagramMedia: (...args: unknown[]) => mockFetchMedia(...args),
}));

const mockAnalyzePosts = jest.fn();
jest.mock("./analyzeInstagramPosts", () => ({
  analyzeInstagramPosts: (...args: unknown[]) => mockAnalyzePosts(...args),
}));

const mockEnrichMapa = jest.fn();
jest.mock("./enrichMapaWithInstagram", () => ({
  enrichMapaWithInstagram: (...args: unknown[]) => mockEnrichMapa(...args),
}));

const mockMetricLean = jest.fn().mockResolvedValue([]);
jest.mock("@/app/models/Metric", () => ({
  __esModule: true,
  default: {
    find: () => ({ select: () => ({ lean: (...args: unknown[]) => mockMetricLean(...args) }) }),
  },
}));

const mockGetConfirmations = jest.fn().mockResolvedValue(null);
jest.mock("@/app/dashboard/boards/videoUpload/mapConfirmationsService", () => ({
  getMapConfirmationsSnapshot: (...args: unknown[]) => mockGetConfirmations(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeMapaDoc(overrides?: object) {
  return {
    mapa: { maturidade: "seed", narrativa_central: "test" },
    updatedAt: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48h atrás
    save: mockMapaSave,
    ...overrides,
  };
}

const fakePosts = [{ id: "1", caption: "post 1" }];
const fakePadroes = { amostragem: "suficiente", temas_recorrentes: ["x"] };
const fakeMapaEnriquecido = { maturidade: "instagram_enriched", narrativa_central: "enriched" };
const fakeConnection = { accessToken: "token", accountId: "ig123" };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("enrichMapaSeedWithInstagram", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetConfirmations.mockResolvedValue(null);
  });

  it("enriquece e salva quando todos os dados estão disponíveis", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: fakePosts });
    mockAnalyzePosts.mockResolvedValue(fakePadroes);
    mockEnrichMapa.mockResolvedValue(fakeMapaEnriquecido);

    await enrichMapaSeedWithInstagram("user123");

    expect(mockAnalyzePosts).toHaveBeenCalledWith(
      fakePosts,
      expect.objectContaining({ resonanceByMediaId: expect.any(Map) }),
    );
    expect(mockEnrichMapa).toHaveBeenCalledWith(
      expect.objectContaining({ maturidade: "seed" }),
      fakePadroes,
      expect.objectContaining({ narrativeLocked: false, toneLocked: false }),
    );
    expect(mockMapaSave).toHaveBeenCalledTimes(1);
  });

  it("deriva locks das confirmações do criador (narrativa confirmada → narrativeLocked)", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: fakePosts });
    mockAnalyzePosts.mockResolvedValue(fakePadroes);
    mockEnrichMapa.mockResolvedValue(fakeMapaEnriquecido);
    mockGetConfirmations.mockResolvedValue({ narrative: "confirmed", tone: "pending" });

    await enrichMapaSeedWithInstagram("user123");

    expect(mockEnrichMapa).toHaveBeenCalledWith(
      expect.anything(),
      fakePadroes,
      expect.objectContaining({ narrativeLocked: true, toneLocked: false }),
    );
  });

  it("auto-cria um MapaSeed-semente e segue o enriquecimento quando não existe", async () => {
    mockMapaFindOne.mockResolvedValue(null);
    mockMapaCreate.mockResolvedValue(
      makeMapaDoc({ mapa: { maturidade: "seed", narrativa_central: "" } }),
    );
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: fakePosts });
    mockAnalyzePosts.mockResolvedValue(fakePadroes);
    mockEnrichMapa.mockResolvedValue(fakeMapaEnriquecido);

    await enrichMapaSeedWithInstagram("user123");

    // Auto-cura: cria o seed vazio com fonte instagram e prossegue até o enrich/save.
    expect(mockMapaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user123",
        mapa: expect.objectContaining({ maturidade: "seed", fonte: ["instagram"] }),
      }),
    );
    expect(mockAnalyzePosts).toHaveBeenCalled();
    expect(mockMapaSave).toHaveBeenCalledTimes(1);
  });

  it("não faz nada se Instagram não está conectado", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockGetConnectionDetails.mockResolvedValue(null);

    await enrichMapaSeedWithInstagram("user123");

    expect(mockFetchMedia).not.toHaveBeenCalled();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("não faz nada se token está ausente", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockGetConnectionDetails.mockResolvedValue({ accessToken: null, accountId: "ig123" });

    await enrichMapaSeedWithInstagram("user123");

    expect(mockFetchMedia).not.toHaveBeenCalled();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("não faz nada se fetch de mídia retorna vazio", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: [] });

    await enrichMapaSeedWithInstagram("user123");

    expect(mockAnalyzePosts).not.toHaveBeenCalled();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("não faz nada se fetch de mídia falha", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: false, error: "network error" });

    await enrichMapaSeedWithInstagram("user123");

    expect(mockAnalyzePosts).not.toHaveBeenCalled();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("re-enriquece quando nunca houve enriquecimento por Instagram (instagramEnrichedAt ausente)", async () => {
    // Sem instagramEnrichedAt — mesmo que o vídeo tenha bumped updatedAt/maturidade,
    // o stream de Instagram deve rodar.
    mockMapaFindOne.mockResolvedValue(
      makeMapaDoc({ updatedAt: new Date(), mapa: { maturidade: "video_enriched" } }),
    );
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: fakePosts });
    mockAnalyzePosts.mockResolvedValue(fakePadroes);
    mockEnrichMapa.mockResolvedValue(fakeMapaEnriquecido);

    await enrichMapaSeedWithInstagram("user123");

    expect(mockMapaSave).toHaveBeenCalledTimes(1);
  });

  it("carimba instagramEnrichedAt ao salvar", async () => {
    const doc = makeMapaDoc();
    mockMapaFindOne.mockResolvedValue(doc);
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: fakePosts });
    mockAnalyzePosts.mockResolvedValue(fakePadroes);
    mockEnrichMapa.mockResolvedValue(fakeMapaEnriquecido);

    await enrichMapaSeedWithInstagram("user123");

    expect((doc as { instagramEnrichedAt?: Date }).instagramEnrichedAt).toBeInstanceOf(Date);
  });

  it("aplica throttle por fonte: ignora se instagramEnrichedAt < 12h (mesmo após enriquecimento por vídeo)", async () => {
    mockMapaFindOne.mockResolvedValue(
      makeMapaDoc({
        // Vídeo mexeu no doc agora, mas o IG rodou há 2h — deve respeitar o próprio timestamp.
        updatedAt: new Date(),
        mapa: { maturidade: "video_enriched" },
        instagramEnrichedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h atrás
      }),
    );

    await enrichMapaSeedWithInstagram("user123");

    expect(mockGetConnectionDetails).not.toHaveBeenCalled();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("é non-fatal: não lança se enrichMapaWithInstagram falha", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: fakePosts });
    mockAnalyzePosts.mockResolvedValue(fakePadroes);
    mockEnrichMapa.mockRejectedValue(new Error("AI timeout"));

    await expect(enrichMapaSeedWithInstagram("user123")).resolves.toBeUndefined();
    expect(mockMapaSave).not.toHaveBeenCalled();
  });

  it("é non-fatal: não lança se connectToDatabase falha", async () => {
    const { connectToDatabase } = require("@/app/lib/mongoose");
    (connectToDatabase as jest.Mock).mockRejectedValueOnce(new Error("db down"));

    await expect(enrichMapaSeedWithInstagram("user123")).resolves.toBeUndefined();
  });

  it("limita posts a 30 mesmo quando mais são retornados", async () => {
    const manyPosts = Array.from({ length: 50 }, (_, i) => ({ id: String(i) }));
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: manyPosts });
    mockAnalyzePosts.mockResolvedValue(fakePadroes);
    mockEnrichMapa.mockResolvedValue(fakeMapaEnriquecido);

    await enrichMapaSeedWithInstagram("user123");

    const calledWith = mockAnalyzePosts.mock.calls[0][0];
    expect(calledWith).toHaveLength(30);
  });
});
