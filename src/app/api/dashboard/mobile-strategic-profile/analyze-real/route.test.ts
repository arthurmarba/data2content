/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import fs from "fs";
import path from "path";
import { NextRequest } from "next/server";
import { POST, GET, PUT, PATCH, DELETE } from "./route";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  isRealUploadEnabled,
  isTemporaryUploadSessionEnabled,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag";
import { isVideoNarrativeRealAnalysisE2EEnabled } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisFeatureFlag";
import { runVideoNarrativeRealAnalysisOrchestrator } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealAnalysisOrchestrator";
import { deleteLocalVideoNarrativeTemporaryUpload } from "@/app/dashboard/boards/videoUpload/videoNarrativeLocalTemporaryUploadStore";

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

jest.mock("@/app/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/app/dashboard/boards/videoUpload/videoNarrativeLocalTemporaryUploadStore", () => {
  const actual = jest.requireActual("@/app/dashboard/boards/videoUpload/videoNarrativeLocalTemporaryUploadStore");
  return {
    ...actual,
    deleteLocalVideoNarrativeTemporaryUpload: jest.fn(),
  };
});

jest.mock("@/app/lib/planGuard", () => ({
  ensurePlannerAccess: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/narrativeMapReadingQuotaService", () => ({
  assertCanStartNarrativeMapReading: jest.fn(),
}));

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const runOrchestrator = runVideoNarrativeRealAnalysisOrchestrator as jest.Mock;
const deleteLocalUpload = deleteLocalVideoNarrativeTemporaryUpload as jest.Mock;
const logger = require("@/app/lib/logger").logger as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};
const ensurePlannerAccess = require("@/app/lib/planGuard").ensurePlannerAccess as jest.Mock;
const assertCanStartNarrativeMapReading =
  require("@/app/dashboard/boards/videoUpload/narrativeMapReadingQuotaService")
    .assertCanStartNarrativeMapReading as jest.Mock;

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
    ensurePlannerAccess.mockResolvedValue({ ok: true, normalizedStatus: null, source: "database" });
    assertCanStartNarrativeMapReading.mockResolvedValue({
      ok: true,
      state: "admin",
      quota: { monthKey: "2026-05", usedTotal: 0, usedThisMonth: 0, freeTotalLimit: 1, proMonthlyLimit: 10 },
      message: "Leitura disponível.",
    });
    runOrchestrator.mockResolvedValue({
      ok: true,
      realAnalysis: true,
      source: "gemini_real_allowlist",
      videoReadingPersistence: { attempted: true, saved: true, diagnosisId: "diagnosis-real-1" },
      synthesisSnapshotWrite: {
        attempted: true,
        written: true,
        synthesisStatus: "first_reading",
        analyzedReadingsCount: 1,
        snapshotId: "snapshot-1",
        updatedAt: "2026-05-19T20:00:00.000Z",
      },
      evidenceAnchorsUsed: true,
      cleanupAttempted: true,
      usageLimitChecked: true,
      allowlistGatePassed: true,
      adaptiveQuiz: { questions: [], reasons: [], suggestedNextStep: "build_diagnosis" },
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

  it("bloqueia análise real quando o crédito gratuito já foi usado", async () => {
    assertCanStartNarrativeMapReading.mockResolvedValue({
      ok: false,
      state: "free_preview_used",
      quota: { monthKey: "2026-05", usedTotal: 1, usedThisMonth: 1, freeTotalLimit: 1, proMonthlyLimit: 10 },
      message: "Limite de leituras indisponível.",
    });

    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe("reading_quota_unavailable");
    expect(body.accessState).toBe("free_preview_used");
    expect(runOrchestrator).not.toHaveBeenCalled();
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
    expect(JSON.stringify(body)).not.toContain("gemini");
    expect(body.bugIndicator).toBe("MOBILE_STRATEGIC_PROFILE_REAL_ANALYSIS_BUG");
    expect(body.requestId).toEqual(expect.stringContaining("msp-real-"));
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("route_orchestrator_failed"),
      expect.objectContaining({
        bugIndicator: "MOBILE_STRATEGIC_PROFILE_REAL_ANALYSIS_BUG",
        responseCode: "provider_user_not_allowed",
      }),
    );
  });

  it("retorna snapshot seguro no sucesso", async () => {
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.source).toBeUndefined();
    expect(body.snapshot).toEqual({
      diagnosisSummary: "Primeira análise registrada. Seu Perfil estratégico começou a se formar.",
      unlockedSignals: [],
      opportunities: [],
    });
    expect(body.videoReadingPersistence).toEqual({
      attempted: true,
      saved: true,
      diagnosisId: "diagnosis-real-1",
    });
    expect(body.e2eBetaAudit).toEqual({
      realAnalysis: true,
      evidenceAnchorsUsed: true,
      cleanupAttempted: true,
      usageLimitChecked: true,
      allowlistGatePassed: true,
    });
    expect(runOrchestrator).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          uploadSessionId: validPayload.uploadSessionId,
          temporaryUpload: expect.objectContaining({ mimeType: "video/mp4" }),
        }),
        deps: expect.objectContaining({
          evaluateAllowlist: expect.any(Function),
          assertCanRunRealAnalysis: expect.any(Function),
        }),
      }),
    );
  });

  it("não retorna sucesso quando o provider não trouxe evidências do vídeo", async () => {
    runOrchestrator.mockResolvedValueOnce({
      ok: true,
      realAnalysis: true,
      source: "gemini_real_allowlist",
      videoReadingPersistence: { attempted: true, saved: true, diagnosisId: "diagnosis-real-1" },
      synthesisSnapshotWrite: { attempted: true, written: true },
      evidenceAnchorsUsed: false,
      cleanupAttempted: false,
      usageLimitChecked: true,
      allowlistGatePassed: true,
      adaptiveQuiz: { questions: [], reasons: [], suggestedNextStep: "build_diagnosis" },
    });

    const res = await POST(createRequest(validPayload));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("video_evidence_missing");
  });

  it("não retorna sucesso quando a leitura real não foi salva", async () => {
    runOrchestrator.mockResolvedValueOnce({
      ok: true,
      realAnalysis: true,
      source: "gemini_real_allowlist",
      videoReadingPersistence: { attempted: true, saved: false, errorCode: "save_failed" },
      synthesisSnapshotWrite: { attempted: false, written: false, skippedReason: "saved_reading_not_found" },
      evidenceAnchorsUsed: true,
      cleanupAttempted: false,
      usageLimitChecked: true,
      allowlistGatePassed: true,
      adaptiveQuiz: { questions: [], reasons: [], suggestedNextStep: "build_diagnosis" },
    });

    const res = await POST(createRequest(validPayload));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("reading_not_saved");
  });

  it("não retorna sucesso quando a síntese do Perfil não foi escrita", async () => {
    runOrchestrator.mockResolvedValueOnce({
      ok: true,
      realAnalysis: true,
      source: "gemini_real_allowlist",
      videoReadingPersistence: { attempted: true, saved: true, diagnosisId: "diagnosis-real-1" },
      synthesisSnapshotWrite: { attempted: true, written: false, skippedReason: "synthesis_snapshot_write_failed" },
      evidenceAnchorsUsed: true,
      cleanupAttempted: false,
      usageLimitChecked: true,
      allowlistGatePassed: true,
      adaptiveQuiz: { questions: [], reasons: [], suggestedNextStep: "build_diagnosis" },
    });

    const res = await POST(createRequest(validPayload));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.code).toBe("profile_synthesis_not_written");
  });

  it("repassa planStatus active revalidado do DB para o orquestrador", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "usr_manual", email: "manual@example.com", role: "user", planStatus: "inactive" },
    });
    ensurePlannerAccess.mockResolvedValue({ ok: true, normalizedStatus: "active", source: "database" });
    assertCanStartNarrativeMapReading.mockResolvedValue({
      ok: true,
      state: "pro_needs_instagram",
      quota: { monthKey: "2026-05", usedTotal: 1, usedThisMonth: 0, freeTotalLimit: 1, proMonthlyLimit: 10 },
      message: "Leitura disponível.",
    });

    const res = await POST(createRequest(validPayload));

    expect(res.status).toBe(200);
    expect(ensurePlannerAccess).toHaveBeenCalledWith(expect.objectContaining({
      forceReload: true,
      userId: "usr_manual",
    }));
    expect(runOrchestrator).toHaveBeenCalledWith(expect.objectContaining({
      user: expect.objectContaining({ planStatus: "active" }),
    }));
  });

  it("localhost com upload temporário local bypassa cota beta e marca usuário como dev apenas no orquestrador", async () => {
    process.env.VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED = "1";
    const localPayload = {
      ...validPayload,
      uploadSessionId: "video-temp-upload-session-local-abc_123",
      temporaryUpload: {
        ...validPayload.temporaryUpload,
        objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-local-abc_123.mp4",
      },
    };

    const res = await POST(createRequest(localPayload));
    expect(res.status).toBe(200);
    expect(runOrchestrator).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({ isDev: true }),
        deps: expect.objectContaining({
          assertCanRunRealAnalysis: expect.any(Function),
          recordUsageAttempt: expect.any(Function),
          recordUsageSuccess: expect.any(Function),
          recordUsageFailure: expect.any(Function),
        }),
      }),
    );
    delete process.env.VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED;
  });

  it("localhost preserva upload temporário local quando a análise falha para permitir retry", async () => {
    process.env.VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED = "1";
    const localPayload = {
      ...validPayload,
      uploadSessionId: "video-temp-upload-session-local-abc_123",
      temporaryUpload: {
        ...validPayload.temporaryUpload,
        objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-local-abc_123.mp4",
      },
    };

    const res = await POST(createRequest(localPayload));
    expect(res.status).toBe(200);
    const cleanupTemporaryUpload = runOrchestrator.mock.calls[0][0].deps.cleanupTemporaryUpload;

    await cleanupTemporaryUpload({
      uploadSessionId: localPayload.uploadSessionId,
      objectKey: localPayload.temporaryUpload.objectKey,
      reason: "analysis_failed",
    });
    expect(deleteLocalUpload).not.toHaveBeenCalled();

    await cleanupTemporaryUpload({
      uploadSessionId: localPayload.uploadSessionId,
      objectKey: localPayload.temporaryUpload.objectKey,
      reason: "analysis_completed",
    });
    expect(deleteLocalUpload).toHaveBeenCalledWith({ sessionId: localPayload.uploadSessionId });

    delete process.env.VIDEO_NARRATIVE_LOCAL_DISCARD_UPLOAD_ENABLED;
  });
});

describe("MM88 runbook", () => {
  it("documenta checklist E2E, rollback e verificação de cleanup sem secrets", () => {
    const runbookPath = path.join(
      process.cwd(),
      "src/app/dashboard/boards/videoUpload/MM88_GATED_REAL_ENDPOINT_E2E_BETA_RUNBOOK.md",
    );
    const content = fs.readFileSync(runbookPath, "utf8");

    expect(content).toContain("Checklist Antes de Testar");
    expect(content).toContain("Rollback");
    expect(content).toContain("Verificação de Cleanup");
    expect(content).toContain("leitura");
    expect(content).toContain("síntese");
    expect(content).toContain("snapshot");
    expect(content).not.toMatch(/AIza|secret=|GEMINI_API_KEY=|GOOGLE_GENAI_API_KEY=/i);
  });
});
