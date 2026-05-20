/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";
import { POST, GET, PUT, PATCH, DELETE } from "./route";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  isRealUploadEnabled,
  isTemporaryUploadSessionEnabled,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag";
import { isVideoNarrativeRealAnalysisE2EEnabled } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisFeatureFlag";
import { runVideoNarrativeRealAnalysisOrchestrator } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisOrchestrator";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag", () => ({
  isMobileStrategicProfileEnabled: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag", () => ({
  isTemporaryUploadSessionEnabled: jest.fn(),
  isRealUploadEnabled: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisFeatureFlag", () => ({
  isVideoNarrativeRealAnalysisE2EEnabled: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisOrchestrator", () => ({
  runVideoNarrativeRealAnalysisOrchestrator: jest.fn(),
}));

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const runOrchestrator = runVideoNarrativeRealAnalysisOrchestrator as jest.Mock;

const validPayload = {
  uploadSessionId: "video-temp-upload-session-abc_123",
  temporaryUpload: {
    objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1024 * 1024,
    uploadedAt: "2026-05-19T20:00:00.000Z",
  },
  creatorGoal: "Quero melhorar autoridade sem perder leveza.",
  selectedGoalOption: "authority",
  quickAnswers: [{ id: "represents_current_phase", value: "sim" }],
  consentTextVersion: "mobile_strategic_profile_temporary_video_v1",
};

function createRequest(body: unknown) {
  return new NextRequest("http://localhost/api/dashboard/mobile-strategic-profile/analyze-real", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET / PUT / PATCH / DELETE /api/dashboard/mobile-strategic-profile/analyze-real", () => {
  it("bloqueia métodos não suportados", async () => {
    expect((await GET()).status).toBe(405);
    expect((await PUT()).status).toBe(405);
    expect((await PATCH()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });
});

describe("POST /api/dashboard/mobile-strategic-profile/analyze-real", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(true);
    (isTemporaryUploadSessionEnabled as jest.Mock).mockReturnValue(true);
    (isRealUploadEnabled as jest.Mock).mockReturnValue(true);
    (isVideoNarrativeRealAnalysisE2EEnabled as jest.Mock).mockReturnValue(true);
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "usr_admin", email: "admin@example.com", role: "admin", planStatus: "active" },
    });
    runOrchestrator.mockResolvedValue({
      ok: true,
      snapshotUpdated: true,
      source: "gemini_real_allowlist",
      snapshot: { schemaVersion: "mobile_strategic_profile_snapshot_v1" },
    });
  });

  it("bloqueia usuário anônimo", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(401);
    expect(runOrchestrator).not.toHaveBeenCalled();
  });

  it("bloqueia feature flag real analysis desligada", async () => {
    (isVideoNarrativeRealAnalysisE2EEnabled as jest.Mock).mockReturnValue(false);
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(403);
    expect(runOrchestrator).not.toHaveBeenCalled();
  });

  it("bloqueia upload real desligado", async () => {
    (isRealUploadEnabled as jest.Mock).mockReturnValue(false);
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(403);
    expect(runOrchestrator).not.toHaveBeenCalled();
  });

  it("bloqueia payloads proibidos", async () => {
    for (const forbidden of ["file", "uploadUrl", "signedUrl", "base64"]) {
      const res = await POST(createRequest({ ...validPayload, [forbidden]: "x" }));
      expect(res.status).toBe(400);
    }
  });

  it("bloqueia payload grande demais", async () => {
    const res = await POST(createRequest({ ...validPayload, creatorGoal: "a".repeat(8000) }));
    expect(res.status).toBe(400);
  });

  it("bloqueia sem uploadSessionId", async () => {
    const res = await POST(createRequest({ ...validPayload, uploadSessionId: "" }));
    expect(res.status).toBe(400);
  });

  it("bloqueia sem consentTextVersion", async () => {
    const res = await POST(createRequest({ ...validPayload, consentTextVersion: "" }));
    expect(res.status).toBe(400);
  });

  it("retorna bloqueio seguro do orquestrador sem vazar secrets", async () => {
    runOrchestrator.mockResolvedValue({
      ok: false,
      status: "blocked",
      message: "Análise real indisponível para este usuário.",
      safeIssueCode: "gemini_user_not_allowed",
    });
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("admin@example.com");
    expect(JSON.stringify(body)).not.toContain("temporary/video-narrative");
  });

  it("retorna snapshot seguro no sucesso", async () => {
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.source).toBe("gemini_real_allowlist");
    expect(runOrchestrator).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          uploadSessionId: validPayload.uploadSessionId,
          temporaryUpload: expect.objectContaining({ mimeType: "video/mp4" }),
        }),
      }),
    );
  });
});
