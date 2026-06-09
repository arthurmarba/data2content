// src/app/api/dashboard/mobile-strategic-profile/diagnosis/[id]/publish-intent/route.test.ts

import { PATCH } from "./route";

// ── Auth & infra mocks ────────────────────────────────────────────────────────

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag", () => ({
  isMobileStrategicProfileEnabled: jest.fn().mockReturnValue(true),
}));

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

const mockFindOneAndUpdate = jest.fn();
jest.mock("@/app/models/CreatorVideoNarrativeDiagnosis", () => ({
  __esModule: true,
  default: { findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args) },
}));

jest.mock("@/app/models/Metric", () => ({
  __esModule: true,
  default: { updateOne: jest.fn().mockResolvedValue({}) },
}));

const mockRunSynthesis = jest.fn().mockResolvedValue({ written: true });
jest.mock(
  "@/app/dashboard/boards/videoUpload/creatorVideoNarrativeMockSynthesisSnapshotWriteOrchestrator",
  () => ({
    runControlledVideoReadingSynthesisSnapshotWrite: (...args: unknown[]) =>
      mockRunSynthesis(...args),
  }),
);

const mockEnqueueVideo = jest.fn().mockResolvedValue(undefined);
jest.mock("@/app/lib/mapaSeed/enqueueMapaVideoEnrichment", () => ({
  enqueueMapaVideoEnrichment: (...args: unknown[]) => mockEnqueueVideo(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const { getServerSession } = require("next-auth/next");

function authenticatedSession(userId = "665f0f2c8a0b7d1f2c3a4b5c") {
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: userId } });
}

function makeRequest(body: object, diagnosisId = "diag-abc") {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Request;
}

function makeParams(id = "diag-abc") {
  return { params: { id } };
}

function diagnosisDoc(overrides?: object) {
  return {
    diagnosisId: "diag-abc",
    contentContext: null,
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("PATCH /diagnosis/[id]/publish-intent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(diagnosisDoc()) });
  });

  it("retorna 401 se não autenticado", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await PATCH(makeRequest({ publishIntent: "yes" }), makeParams());

    expect(res.status).toBe(401);
  });

  it("retorna 404 se feature flag desabilitada", async () => {
    const { isMobileStrategicProfileEnabled } = require(
      "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag",
    );
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValueOnce(false);
    authenticatedSession();

    const res = await PATCH(makeRequest({ publishIntent: "yes" }), makeParams());

    expect(res.status).toBe(404);
  });

  it("retorna 400 se publishIntent inválido", async () => {
    authenticatedSession();

    const res = await PATCH(makeRequest({ publishIntent: "unsure" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toMatch(/'yes' ou 'no'/);
  });

  it("salva publishIntent='yes' e retorna ok, SEM re-síntese, COM enqueue de vídeo", async () => {
    authenticatedSession();

    const res = await PATCH(makeRequest({ publishIntent: "yes" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, publishIntent: "yes" });
    expect(mockRunSynthesis).not.toHaveBeenCalled();
    expect(mockEnqueueVideo).toHaveBeenCalledWith("665f0f2c8a0b7d1f2c3a4b5c");
  });

  it("declarar 'no' NÃO enfileira enriquecimento de vídeo", async () => {
    authenticatedSession();

    await PATCH(makeRequest({ publishIntent: "no" }), makeParams());

    expect(mockEnqueueVideo).not.toHaveBeenCalled();
  });

  it("enqueue de vídeo é non-fatal: retorna 200 mesmo se falhar", async () => {
    authenticatedSession();
    mockEnqueueVideo.mockRejectedValueOnce(new Error("QStash fora do ar"));

    const res = await PATCH(makeRequest({ publishIntent: "yes" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("salva publishIntent='no', retorna ok, E dispara re-síntese", async () => {
    authenticatedSession();

    const res = await PATCH(makeRequest({ publishIntent: "no" }), makeParams("diag-xyz"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, publishIntent: "no" });
    expect(mockRunSynthesis).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "665f0f2c8a0b7d1f2c3a4b5c",
        savedDiagnosisId: "diag-xyz",
        enableSnapshotWrite: true,
        source: "real_internal",
      }),
    );
  });

  it("re-síntese é non-fatal: retorna 200 mesmo se falhar", async () => {
    authenticatedSession();
    mockRunSynthesis.mockRejectedValueOnce(new Error("DB explodiu"));

    const res = await PATCH(makeRequest({ publishIntent: "no" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
  });

  it("retorna 404 quando diagnóstico não encontrado", async () => {
    authenticatedSession();
    mockFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(null) });

    const res = await PATCH(makeRequest({ publishIntent: "no" }), makeParams());

    expect(res.status).toBe(404);
    expect(mockRunSynthesis).not.toHaveBeenCalled();
  });

  it("re-síntese não é chamada quando diagnóstico não existe", async () => {
    authenticatedSession();
    mockFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(null) });

    await PATCH(makeRequest({ publishIntent: "no" }), makeParams());

    expect(mockRunSynthesis).not.toHaveBeenCalled();
  });
});
