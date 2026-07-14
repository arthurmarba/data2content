import { runVideoNarrativeRealAnalysisOrchestrator } from "./videoNarrativeRealAnalysisOrchestrator";
import { geminiVideoNarrativeResponseFixture } from "./__fixtures__/geminiVideoNarrativeResponse.fixture";
import { resolveVideoNarrativeTemporaryStorageObject } from "./videoNarrativeTemporaryStorageRuntimeResolver";
import { resolveVideoNarrativeTemporaryStorageInput } from "./videoNarrativeTemporaryStorageRuntimeAdapter";

jest.mock("./videoNarrativeTemporaryStorageRuntimeResolver", () => ({
  resolveVideoNarrativeTemporaryStorageObject: jest.fn(),
}));

jest.mock("./videoNarrativeTemporaryStorageRuntimeAdapter", () => ({
  resolveVideoNarrativeTemporaryStorageInput: jest.fn(),
}));

jest.mock("@/app/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const logger = require("@/app/lib/logger").logger as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

const env = {
  VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED: "true",
  VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
  VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED: "1",
  VIDEO_NARRATIVE_GEMINI_MODEL: "gemini-test",
  GOOGLE_GEMINI_API_KEY: "test-key",
};

const payload = {
  uploadSessionId: "video-temp-upload-session-abc_123",
  temporaryUpload: {
    objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1024,
    durationSeconds: 30,
    uploadedAt: "2026-05-19T20:00:00.000Z",
  },
  creatorGoal: "Quero ganhar autoridade.",
  selectedGoalOption: "authority" as const,
  quickAnswers: [{ id: "represents_current_phase", value: "sim" }],
  consentTextVersion: "mobile_strategic_profile_temporary_video_v1",
};

const user = {
  id: "507f1f77bcf86cd799439011",
  email: "admin@example.com",
  role: "admin",
  planStatus: "active",
  name: "Creator",
};

const usageDeps = {
  assertCanRunRealAnalysis: jest.fn().mockResolvedValue({
    ok: true,
    tier: "admin_dev",
    policy: {
      tier: "admin_dev",
      dailyLimit: 20,
      monthlyLimit: 100,
      maxFileSizeBytes: 100 * 1024 * 1024,
      cooldownSeconds: 15,
      allowRealAnalysis: true,
    },
  }),
  recordUsageAttempt: jest.fn().mockResolvedValue(undefined),
  recordUsageSuccess: jest.fn().mockResolvedValue(undefined),
  recordUsageFailure: jest.fn().mockResolvedValue(undefined),
  probeMedia: jest.fn().mockResolvedValue({
    ok: true,
    metadata: { sizeBytes: 1024, durationSeconds: 30, mimeType: "video/mp4" },
  }),
};

describe("runVideoNarrativeRealAnalysisOrchestrator", () => {
  beforeEach(() => {
    (resolveVideoNarrativeTemporaryStorageObject as jest.Mock).mockReturnValue({
      ok: true,
      status: "ready",
      safeMessage: "",
      issues: [],
    });
    (resolveVideoNarrativeTemporaryStorageInput as jest.Mock).mockResolvedValue({
      ok: true,
      status: "ready",
      geminiInput: {
        mimeType: "video/mp4",
        bytes: new Uint8Array([1, 2, 3]),
        source: "temporary_storage",
      },
      safeDebugSummary: {
        mimeType: "video/mp4",
        sizeBytes: 1024,
        provider: "cloudflare_r2",
      },
    });
    usageDeps.assertCanRunRealAnalysis.mockResolvedValue({
      ok: true,
      tier: "admin_dev",
      policy: {
        tier: "admin_dev",
        dailyLimit: 20,
        monthlyLimit: 100,
        maxFileSizeBytes: 100 * 1024 * 1024,
        cooldownSeconds: 15,
        allowRealAnalysis: true,
      },
    });
    usageDeps.recordUsageAttempt.mockResolvedValue(undefined);
    usageDeps.recordUsageSuccess.mockResolvedValue(undefined);
    usageDeps.recordUsageFailure.mockResolvedValue(undefined);
    usageDeps.probeMedia.mockResolvedValue({
      ok: true,
      metadata: { sizeBytes: 1024, durationSeconds: 30, mimeType: "video/mp4" },
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("bloqueia provider disabled sem chamar rede ou snapshot", async () => {
    const runProvider = jest.fn();
    const upsertSnapshot = jest.fn();
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user,
      deps: { env: { ...env, VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED: "" }, runProvider, upsertSnapshot },
    });

    expect(result.ok).toBe(false);
    expect(runProvider).not.toHaveBeenCalled();
    expect(upsertSnapshot).not.toHaveBeenCalled();
  });

  it("bloqueia usuário comum antes do provider", async () => {
    const runProvider = jest.fn();
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user: { ...user, role: "creator", email: "common@example.com" },
      deps: { env, runProvider },
    });

    expect(result.ok).toBe(false);
    expect(runProvider).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("common@example.com");
  });

  it("retorna erro seguro se storage resolver falhar", async () => {
    (resolveVideoNarrativeTemporaryStorageObject as jest.Mock).mockReturnValue({
      ok: false,
      status: "missing_storage_adapter",
      safeMessage: "A análise real ainda precisa da conexão temporária de storage.",
      issues: [{ code: "missing", message: "faltando" }],
    });

    const runProvider = jest.fn();
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user,
      deps: { env, runProvider, ...usageDeps },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("blocked");
      expect(result.message).toBe("Não conseguimos preparar o vídeo temporário para análise agora.");
      expect(result.safeIssueCode).toBe("missing_storage_adapter");
    }
    expect(runProvider).not.toHaveBeenCalled();
    expect(usageDeps.recordUsageAttempt).toHaveBeenCalled();
    expect(usageDeps.recordUsageFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "missing_storage_adapter" }),
    );
  });

  it("limite atingido bloqueia antes de storage e Gemini", async () => {
    const runProvider = jest.fn();
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user,
      deps: {
        env,
        runProvider,
        assertCanRunRealAnalysis: jest.fn().mockResolvedValue({
          ok: false,
          tier: "allowlist",
          code: "daily_limit_reached",
          message: "daily_limit_reached",
          policy: {
            tier: "allowlist",
            dailyLimit: 5,
            monthlyLimit: 20,
            maxFileSizeBytes: 100 * 1024 * 1024,
            cooldownSeconds: 60,
            allowRealAnalysis: true,
          },
        }),
        recordUsageAttempt: usageDeps.recordUsageAttempt,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe("blocked");
      expect(result.safeIssueCode).toBe("daily_limit_reached");
      expect(result.message).toBe("Você atingiu o limite de análises reais do beta por hoje.");
    }
    expect(resolveVideoNarrativeTemporaryStorageObject).not.toHaveBeenCalled();
    expect(resolveVideoNarrativeTemporaryStorageInput).not.toHaveBeenCalled();
    expect(runProvider).not.toHaveBeenCalled();
    expect(usageDeps.recordUsageAttempt).not.toHaveBeenCalled();
  });

  it("sem flags chama provider fake, não persiste leitura/snapshot e aciona cleanup", async () => {
    const runProvider = jest.fn().mockResolvedValue({
      ok: true,
      provider: "gemini",
      mode: "ready",
      promptVersion: "video_narrative_gemini_mm66_v1",
      analysis: geminiVideoNarrativeResponseFixture,
      issues: [],
    });
    const saveReading = jest.fn();
    const runSynthesisSnapshotWrite = jest.fn();
    const cleanupTemporaryUpload = jest.fn().mockResolvedValue(undefined);

    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user,
      deps: {
        env,
        requestId: "req-test",
        now: () => new Date("2026-05-19T20:00:00.000Z"),
        runProvider,
        saveReading,
        runSynthesisSnapshotWrite,
        cleanupTemporaryUpload,
        ...usageDeps,
      },
    });

    expect(result.ok).toBe(true);
    expect(runProvider).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          creatorGoal: payload.creatorGoal,
          temporaryUpload: expect.objectContaining({ uploadSessionId: payload.uploadSessionId }),
          requestId: "req-test",
        }),
        skipAllowlist: true,
      }),
    );
    expect(saveReading).not.toHaveBeenCalled();
    expect(runSynthesisSnapshotWrite).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.videoReadingPersistence).toEqual({
        attempted: false,
        saved: false,
        skippedReason: "persist_reading_disabled",
      });
      expect(result.synthesisSnapshotWrite).toEqual({
        attempted: false,
        written: false,
        skippedReason: "synthesis_write_disabled",
      });
      expect(result.evidenceAnchorsUsed).toBe(true);
    }
    expect(JSON.stringify(result)).not.toContain("temporary/video-narrative");
    expect(JSON.stringify(result)).not.toContain("uploadUrl");
    expect(cleanupTemporaryUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadSessionId: payload.uploadSessionId,
        objectKey: payload.temporaryUpload.objectKey,
        reason: "analysis_completed",
      }),
    );
    expect(usageDeps.recordUsageAttempt).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id }),
    );
    expect(usageDeps.recordUsageSuccess).toHaveBeenCalledWith(
      expect.objectContaining({ userId: user.id }),
    );
  });

  it("com flags salva leitura, roda síntese acumulada e escreve snapshot guardado", async () => {
    const saveReading = jest.fn().mockResolvedValue({
      ok: true,
      diagnosisId: "diagnosis-real-1",
      profileContribution: {
        type: "opens_new_hypothesis",
        confidence: "medium",
        weight: "low",
        profileImpactPreview: "Nova hipótese de leitura.",
      },
    });
    const runSynthesisSnapshotWrite = jest.fn().mockResolvedValue({
      attempted: true,
      written: true,
      synthesisStatus: "first_reading",
      analyzedReadingsCount: 1,
      snapshotId: "snapshot-1",
      updatedAt: "2026-05-19T20:00:00.000Z",
    });

    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload: { ...payload, persistReading: true, persistSynthesisSnapshot: true },
      user,
      deps: {
        env,
        requestId: "req-test",
        now: () => new Date("2026-05-19T20:00:00.000Z"),
        runProvider: jest.fn().mockResolvedValue({
          ok: true,
          provider: "gemini",
          mode: "ready",
          promptVersion: "video_narrative_gemini_mm66_v1",
          analysis: geminiVideoNarrativeResponseFixture,
          issues: [],
        }),
        saveReading,
        runSynthesisSnapshotWrite,
        ...usageDeps,
      },
    });

    expect(result.ok).toBe(true);
    expect(saveReading).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        source: "real",
        strategicDiagnosis: expect.objectContaining({
          evidenceAnchors: expect.objectContaining({
            speechQuotes: expect.arrayContaining([
              expect.objectContaining({ source: "creator_spoken" }),
            ]),
          }),
        }),
        safeVideoMetadata: expect.not.objectContaining({
          objectKey: expect.anything(),
          uploadUrl: expect.anything(),
          signedUrl: expect.anything(),
        }),
      }),
    );
    expect(runSynthesisSnapshotWrite).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        savedDiagnosisId: "diagnosis-real-1",
        enableSnapshotWrite: true,
        source: "real_internal",
      }),
    );
    if (result.ok) {
      expect(result.videoReadingPersistence.saved).toBe(true);
      expect(result.synthesisSnapshotWrite.written).toBe(true);
    }
    expect(JSON.stringify(result)).not.toContain("temporary/video-narrative");
  });

  it("erro do provider vira mensagem segura e tenta cleanup", async () => {
    const cleanupTemporaryUpload = jest.fn().mockResolvedValue(undefined);
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user,
      deps: {
        env,
        runProvider: jest.fn().mockResolvedValue({
          ok: false,
          provider: "gemini",
          mode: "failed",
          promptVersion: "v1",
          issues: [{ code: "external_secret_error", severity: "blocker", message: "raw provider stack" }],
        }),
        cleanupTemporaryUpload,
        ...usageDeps,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("A análise real está temporariamente indisponível.");
    expect(JSON.stringify(result)).not.toContain("raw provider stack");
    expect(JSON.stringify(result)).not.toContain("external_secret_error");
    expect(cleanupTemporaryUpload).toHaveBeenCalledWith(expect.objectContaining({ reason: "analysis_failed" }));
    expect(usageDeps.recordUsageFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "gemini_provider_failed" }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("orchestrator_provider_failed"),
      expect.objectContaining({
        bugIndicator: "MOBILE_STRATEGIC_PROFILE_REAL_ANALYSIS_BUG",
        component: "videoNarrativeRealAnalysisOrchestrator",
        providerIssueCode: "external_secret_error",
        safeProviderIssueCode: "gemini_provider_failed",
      }),
    );
  });

  it("preserva código seguro quando o provider nega permissão", async () => {
    const cleanupTemporaryUpload = jest.fn().mockResolvedValue(undefined);
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user,
      deps: {
        env,
        runProvider: jest.fn().mockResolvedValue({
          ok: false,
          provider: "gemini",
          mode: "failed",
          promptVersion: "v1",
          issues: [{ code: "gemini_file_permission_denied", severity: "blocker", message: "Provider indisponível" }],
        }),
        cleanupTemporaryUpload,
        ...usageDeps,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.safeIssueCode).toBe("gemini_file_permission_denied");
    expect(result.message).toBe("A análise real está temporariamente indisponível.");
    expect(usageDeps.recordUsageFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "gemini_file_permission_denied" }),
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("orchestrator_provider_failed"),
      expect.objectContaining({
        providerIssueCode: "gemini_file_permission_denied",
        safeProviderIssueCode: "gemini_file_permission_denied",
      }),
    );
  });

  it("bloqueia sucesso quando a IA não devolve evidências do vídeo", async () => {
    const cleanupTemporaryUpload = jest.fn().mockResolvedValue(undefined);
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user,
      deps: {
        env,
        runProvider: jest.fn().mockResolvedValue({
          ok: true,
          provider: "gemini",
          mode: "ready",
          promptVersion: "v1",
          analysis: {
            ...geminiVideoNarrativeResponseFixture,
            evidenceAnchors: {
              speechQuotes: [],
              sceneAnchors: [],
              creatorIntentAnchor: null,
              profilePatternAnchors: [],
              instagramAnchors: [],
            },
          },
        }),
        cleanupTemporaryUpload,
        ...usageDeps,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.safeIssueCode).toBe("video_evidence_missing");
      expect(result.evidenceAnchorsUsed).toBe(false);
    }
    expect(cleanupTemporaryUpload).toHaveBeenCalledWith(expect.objectContaining({ reason: "analysis_failed" }));
    expect(usageDeps.recordUsageFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "video_evidence_missing" }),
    );
  });

  it("resposta não-JSON do provider vira erro de diagnóstico inválido", async () => {
    const cleanupTemporaryUpload = jest.fn().mockResolvedValue(undefined);
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user,
      deps: {
        env,
        runProvider: jest.fn().mockResolvedValue({
          ok: false,
          provider: "gemini",
          mode: "failed",
          promptVersion: "v1",
          issues: [{ code: "invalid_json", severity: "blocker", message: "raw response was not JSON" }],
        }),
        cleanupTemporaryUpload,
        ...usageDeps,
      },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Não conseguimos transformar a análise em um diagnóstico válido.");
    expect(JSON.stringify(result)).not.toContain("raw response was not JSON");
    expect(cleanupTemporaryUpload).toHaveBeenCalledWith(expect.objectContaining({ reason: "analysis_failed" }));
    expect(usageDeps.recordUsageFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "invalid_json" }),
    );
  });

  it("erro de snapshot guardado não vaza stack trace", async () => {
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload: { ...payload, persistReading: true, persistSynthesisSnapshot: true },
      user,
      deps: {
        env,
        runProvider: jest.fn().mockResolvedValue({
          ok: true,
          provider: "gemini",
          mode: "ready",
          promptVersion: "v1",
          analysis: geminiVideoNarrativeResponseFixture,
        }),
        saveReading: jest.fn().mockResolvedValue({
          ok: true,
          diagnosisId: "diagnosis-real-1",
          profileContribution: {
            type: "opens_new_hypothesis",
            confidence: "medium",
            weight: "low",
            profileImpactPreview: "Nova hipótese de leitura.",
          },
        }),
        runSynthesisSnapshotWrite: jest.fn().mockResolvedValue({
          attempted: true,
          written: false,
          skippedReason: "synthesis_snapshot_write_failed",
        }),
        ...usageDeps,
      },
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("mongo stack secret");
    expect(usageDeps.recordUsageFailure).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "synthesis_snapshot_write_failed" }),
    );
  });

  it("não limpa upload temporário como concluído se a leitura não for salva", async () => {
    const cleanupTemporaryUpload = jest.fn().mockResolvedValue(undefined);
    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload: { ...payload, persistReading: true, persistSynthesisSnapshot: true },
      user,
      deps: {
        env,
        runProvider: jest.fn().mockResolvedValue({
          ok: true,
          provider: "gemini",
          mode: "ready",
          promptVersion: "v1",
          analysis: geminiVideoNarrativeResponseFixture,
        }),
        saveReading: jest.fn().mockResolvedValue({
          ok: false,
          errorCode: "diagnosis_persistence_failed",
          message: "Nao foi possivel salvar a leitura documentada deste video agora.",
        }),
        cleanupTemporaryUpload,
        ...usageDeps,
      },
    });

    expect(result.ok).toBe(false);
    expect(cleanupTemporaryUpload).not.toHaveBeenCalledWith(expect.objectContaining({ reason: "analysis_completed" }));
  });
});
