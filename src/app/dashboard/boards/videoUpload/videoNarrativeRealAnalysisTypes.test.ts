import { validateVideoNarrativeRealAnalysisPayload } from "./videoNarrativeRealAnalysisTypes";

const validPayload = {
  uploadSessionId: "video-temp-upload-session-abc_123",
  temporaryUpload: {
    objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1024,
    uploadedAt: "2026-05-19T20:00:00.000Z",
  },
  creatorGoal: "Quero melhorar retenção.",
  selectedGoalOption: "retention",
  quickAnswers: [{ id: "represents_current_phase", value: "sim" }],
  consentTextVersion: "mobile_strategic_profile_temporary_video_v1",
};

describe("validateVideoNarrativeRealAnalysisPayload", () => {
  it("aceita payload real seguro", () => {
    const result = validateVideoNarrativeRealAnalysisPayload(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.temporaryUpload?.objectKey).toBe(validPayload.temporaryUpload.objectKey);
    }
  });

  it("aceita flags explícitas de persistência sem exigir snapshot por padrão", () => {
    const withoutFlags = validateVideoNarrativeRealAnalysisPayload(validPayload);
    expect(withoutFlags.ok).toBe(true);
    if (withoutFlags.ok) {
      expect(withoutFlags.payload.persistReading).toBeUndefined();
      expect(withoutFlags.payload.persistSynthesisSnapshot).toBeUndefined();
    }

    const withFlags = validateVideoNarrativeRealAnalysisPayload({
      ...validPayload,
      persistReading: true,
      persistSynthesisSnapshot: true,
    });
    expect(withFlags.ok).toBe(true);
    if (withFlags.ok) {
      expect(withFlags.payload.persistReading).toBe(true);
      expect(withFlags.payload.persistSynthesisSnapshot).toBe(true);
    }
  });

  it("bloqueia campos proibidos", () => {
    for (const forbidden of ["file", "video", "uploadUrl", "signedUrl", "base64", "rawModelResponse", "bucket", "token"]) {
      const result = validateVideoNarrativeRealAnalysisPayload({ ...validPayload, [forbidden]: "x" });
      expect(result.ok).toBe(false);
    }
  });

  it("bloqueia signed URL dentro de string", () => {
    const result = validateVideoNarrativeRealAnalysisPayload({
      ...validPayload,
      creatorGoal: "https://signed.example.test/video.mp4?signature=abc",
    });
    expect(result.ok).toBe(false);
  });

  it("bloqueia sem uploadSessionId ou consentimento", () => {
    expect(validateVideoNarrativeRealAnalysisPayload({ ...validPayload, uploadSessionId: "" }).ok).toBe(false);
    expect(validateVideoNarrativeRealAnalysisPayload({ ...validPayload, consentTextVersion: "" }).ok).toBe(false);
  });

  it("bloqueia objectKey fora do padrão seguro", () => {
    const result = validateVideoNarrativeRealAnalysisPayload({
      ...validPayload,
      temporaryUpload: { ...validPayload.temporaryUpload, objectKey: "bucket/public/video.mp4" },
    });
    expect(result.ok).toBe(false);
  });
});
