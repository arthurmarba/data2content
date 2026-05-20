import {
  isVideoNarrativeTemporaryUploadCleanupReason,
  validateVideoNarrativeTemporaryUploadCleanupPayload,
} from "./videoNarrativeTemporaryUploadCleanupTypes";

describe("videoNarrativeTemporaryUploadCleanupTypes", () => {
  const validPayload = {
    uploadSessionId: "video-temp-upload-session-abc_123",
    objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
    reason: "analysis_completed",
  };

  it("aceita motivos de cleanup conhecidos", () => {
    expect(isVideoNarrativeTemporaryUploadCleanupReason("analysis_completed")).toBe(true);
    expect(isVideoNarrativeTemporaryUploadCleanupReason("analysis_failed")).toBe(true);
    expect(isVideoNarrativeTemporaryUploadCleanupReason("user_cancelled")).toBe(true);
    expect(isVideoNarrativeTemporaryUploadCleanupReason("expired")).toBe(true);
    expect(isVideoNarrativeTemporaryUploadCleanupReason("other")).toBe(false);
  });

  it("aceita uploadSessionId/objectKey seguro", () => {
    const result = validateVideoNarrativeTemporaryUploadCleanupPayload(validPayload);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.objectKey).toBe(validPayload.objectKey);
    }
  });

  it("aceita payload sem objectKey para mock/contract-first", () => {
    const result = validateVideoNarrativeTemporaryUploadCleanupPayload({
      uploadSessionId: "video-temp-upload-session-abc_123",
      reason: "expired",
    });
    expect(result.ok).toBe(true);
  });

  it("bloqueia uploadUrl/signedUrl/bucket", () => {
    for (const forbidden of ["uploadUrl", "signedUrl", "bucket"]) {
      const result = validateVideoNarrativeTemporaryUploadCleanupPayload({
        ...validPayload,
        [forbidden]: "https://signed.example.test",
      });
      expect(result.ok).toBe(false);
    }
  });

  it("rejeita objectKey fora do prefixo temporário esperado", () => {
    const result = validateVideoNarrativeTemporaryUploadCleanupPayload({
      ...validPayload,
      objectKey: "public/videos/file.mp4",
    });
    expect(result.ok).toBe(false);
  });
});
