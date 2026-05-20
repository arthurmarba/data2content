import { runVideoNarrativeRealAnalysisOrchestrator } from "./videoNarrativeRealAnalysisOrchestrator";
import { geminiVideoNarrativeResponseFixture } from "./__fixtures__/geminiVideoNarrativeResponse.fixture";

const env = {
  VIDEO_NARRATIVE_GEMINI_PROVIDER_ENABLED: "true",
  VIDEO_NARRATIVE_GEMINI_ALLOWLIST_ENABLED: "1",
  VIDEO_NARRATIVE_GEMINI_MODEL: "gemini-test",
  GOOGLE_GEMINI_API_KEY: "test-key",
};

const payload = {
  uploadSessionId: "video-temp-upload-session-abc_123",
  temporaryUpload: {
    objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1024,
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

describe("runVideoNarrativeRealAnalysisOrchestrator", () => {
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

  it("chama provider fake, mapeia, salva snapshot e aciona cleanup", async () => {
    const runProvider = jest.fn().mockResolvedValue({
      ok: true,
      provider: "gemini",
      mode: "ready",
      promptVersion: "video_narrative_gemini_mm66_v1",
      analysis: geminiVideoNarrativeResponseFixture,
      issues: [],
    });
    const upsertSnapshot = jest.fn(async (input) => input);
    const cleanupTemporaryUpload = jest.fn().mockResolvedValue(undefined);

    const result = await runVideoNarrativeRealAnalysisOrchestrator({
      payload,
      user,
      deps: {
        env,
        requestId: "req-test",
        now: () => new Date("2026-05-19T20:00:00.000Z"),
        runProvider,
        upsertSnapshot,
        cleanupTemporaryUpload,
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
      }),
    );
    expect(upsertSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user.id,
        source: "gemini_real_allowlist",
        snapshot: expect.not.objectContaining({
          objectKey: expect.anything(),
          uploadUrl: expect.anything(),
          rawResponse: expect.anything(),
        }),
      }),
    );
    const snapshotArg = upsertSnapshot.mock.calls[0][0].snapshot;
    expect(JSON.stringify(snapshotArg)).not.toContain("temporary/video-narrative");
    expect(JSON.stringify(snapshotArg)).not.toContain("uploadUrl");
    expect(cleanupTemporaryUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        uploadSessionId: payload.uploadSessionId,
        objectKey: payload.temporaryUpload.objectKey,
        reason: "analysis_completed",
      }),
    );
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
      },
    });

    expect(result.ok).toBe(false);
    expect(result.message).toBe("Não foi possível concluir a análise real agora.");
    expect(JSON.stringify(result)).not.toContain("raw provider stack");
    expect(cleanupTemporaryUpload).toHaveBeenCalledWith(expect.objectContaining({ reason: "analysis_failed" }));
  });

  it("erro do snapshot não vaza stack trace", async () => {
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
          analysis: geminiVideoNarrativeResponseFixture,
        }),
        upsertSnapshot: jest.fn().mockRejectedValue(new Error("mongo stack secret")),
      },
    });

    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain("mongo stack secret");
  });
});
