/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import { upsertStrategicProfileSnapshot } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileSnapshotService";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag", () => ({
  isMobileStrategicProfileEnabled: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/mobileStrategicProfileSnapshotService", () => ({
  upsertStrategicProfileSnapshot: jest.fn(),
}));

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;

function createRequest(body: any) {
  return new NextRequest("http://localhost/api/dashboard/mobile-strategic-profile/analyze", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/dashboard/mobile-strategic-profile/analyze", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE = "mock";
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(true);
  });

  it("bloqueia acesso se a feature flag estiver desativada", async () => {
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(false);

    const res = await POST(createRequest({ creatorGoal: "sponsored_content" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.message).toContain("Perfil Estratégico mobile está desativado");
  });

  it("bloqueia acesso se usuário estiver deslogado/anônimo", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await POST(createRequest({ creatorGoal: "sponsored" }));
    expect(res.status).toBe(401);
  });

  it("bloqueia se o provider mode não for mock", async () => {
    process.env.VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE = "real";
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "usr_12" } });

    const res = await POST(createRequest({ creatorGoal: "sponsored" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Apenas modo de simulação (mock) é suportado");
  });

  it("bloqueia payload contendo chave restrita file", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "usr_12" } });

    const res = await POST(createRequest({ creatorGoal: "sponsored", file: "video.mp4" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("não é permitido nesta rota");
  });

  it("bloqueia payload contendo chave restrita videoUrl", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "usr_12" } });

    const res = await POST(createRequest({ creatorGoal: "sponsored", videoUrl: "https://youtube.com" }));
    expect(res.status).toBe(400);
  });

  it("bloqueia payload contendo string em Base64", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "usr_12" } });

    const res = await POST(createRequest({ creatorGoal: "data:image/png;base64,iVBORw0KGgoAAA" }));
    expect(res.status).toBe(400);
  });

  it("bloqueia payload com assinaturas de signed URLs ou chaves de mídia", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "usr_12" } });

    const res = await POST(createRequest({ creatorGoal: "url?signature=123" }));
    expect(res.status).toBe(400);
  });

  it("processa com sucesso e salva snapshot com fonte mock_analysis", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "usr_12", planStatus: "active" },
    });

    const mockSnapshot = {
      schemaVersion: "mobile_strategic_profile_snapshot_v1",
      profileState: "active",
      unlockedSignals: [],
      pendingSignals: [],
      recurringPatterns: [],
      opportunities: [],
      diagnosisSummary: "Resumo do diagnóstico",
      commercialSummary: "Resumo comercial",
      lastAnalysisSummary: "Último vídeo analisado",
    };

    (upsertStrategicProfileSnapshot as jest.Mock).mockResolvedValue({
      userId: "usr_12",
      snapshot: mockSnapshot,
      source: "mock_analysis",
    });

    const res = await POST(
      createRequest({
        creatorGoal: "Quero crescer em publis orgânicas",
        selectedGoalOption: "sponsored_content",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.snapshotUpdated).toBe(true);
    expect(body.snapshot.schemaVersion).toBe("mobile_strategic_profile_snapshot_v1");

    expect(upsertStrategicProfileSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "usr_12",
        source: "mock_analysis",
      })
    );
  });
});
