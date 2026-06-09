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
jest.mock("@/app/models/MapaSeed", () => ({
  __esModule: true,
  default: { findOne: (...args: unknown[]) => mockMapaFindOne(...args) },
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
  });

  it("enriquece e salva quando todos os dados estão disponíveis", async () => {
    mockMapaFindOne.mockResolvedValue(makeMapaDoc());
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: fakePosts });
    mockAnalyzePosts.mockResolvedValue(fakePadroes);
    mockEnrichMapa.mockResolvedValue(fakeMapaEnriquecido);

    await enrichMapaSeedWithInstagram("user123");

    expect(mockAnalyzePosts).toHaveBeenCalledWith(fakePosts);
    expect(mockEnrichMapa).toHaveBeenCalledWith(
      expect.objectContaining({ maturidade: "seed" }),
      fakePadroes,
    );
    expect(mockMapaSave).toHaveBeenCalledTimes(1);
  });

  it("não faz nada se MapaSeed não existe", async () => {
    mockMapaFindOne.mockResolvedValue(null);

    await enrichMapaSeedWithInstagram("user123");

    expect(mockGetConnectionDetails).not.toHaveBeenCalled();
    expect(mockMapaSave).not.toHaveBeenCalled();
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

  it("ignora throttle e re-enriquece se maturidade ainda é seed (independente de tempo)", async () => {
    // Mapa recém atualizado mas ainda seed — deve enriquecer
    mockMapaFindOne.mockResolvedValue(
      makeMapaDoc({ updatedAt: new Date(), mapa: { maturidade: "seed" } }),
    );
    mockGetConnectionDetails.mockResolvedValue(fakeConnection);
    mockFetchMedia.mockResolvedValue({ success: true, data: fakePosts });
    mockAnalyzePosts.mockResolvedValue(fakePadroes);
    mockEnrichMapa.mockResolvedValue(fakeMapaEnriquecido);

    await enrichMapaSeedWithInstagram("user123");

    expect(mockMapaSave).toHaveBeenCalledTimes(1);
  });

  it("aplica throttle: ignora re-enriquecimento se já é instagram_enriched e atualizado há menos de 12h", async () => {
    mockMapaFindOne.mockResolvedValue(
      makeMapaDoc({
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h atrás
        mapa: { maturidade: "instagram_enriched" },
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
