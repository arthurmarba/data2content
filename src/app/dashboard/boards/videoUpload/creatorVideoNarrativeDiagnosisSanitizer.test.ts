import { buildCreatorVideoNarrativeDiagnosisFixture } from "./creatorVideoNarrativeDiagnosisFixtures";
import { sanitizeCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisSanitizer";

describe("creatorVideoNarrativeDiagnosisSanitizer", () => {
  it("cria um documento válido de leitura por vídeo", () => {
    const result = sanitizeCreatorVideoNarrativeDiagnosisInput(buildCreatorVideoNarrativeDiagnosisFixture());

    expect(result.schemaVersion).toBe("creator_video_narrative_diagnosis_v1");
    expect(result.videoReading.title).toBe("Rotina que vira prova de autoridade");
    expect(result.profileContribution.type).toBe("commercial_signal");
    expect(result.safetyFlags.containsPersistedVideoReference).toBe(false);
  });

  it("não persiste objectKey, signedUrl, uploadUrl ou localPath em videoMetadata", () => {
    const result = sanitizeCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisFixture({
        videoMetadata: {
          mimeType: "video/mp4",
          sizeBytes: 100,
          objectKey: "temporary/user/video.mp4",
          signedUrl: "https://bucket.s3.amazonaws.com/video.mp4?X-Amz-Signature=abc",
          uploadUrl: "https://upload.example.com/video.mp4?token=abc",
          localPath: "/tmp/video.mp4",
        } as any,
      }),
    );

    expect(result.videoMetadata).toEqual({ mimeType: "video/mp4", sizeBytes: 100 });
    expect(JSON.stringify(result)).not.toContain("objectKey");
    expect(JSON.stringify(result)).not.toContain("signedUrl");
    expect(JSON.stringify(result)).not.toContain("uploadUrl");
    expect(JSON.stringify(result)).not.toContain("localPath");
    expect(result.safetyFlags.sanitized).toBe(true);
  });

  it("redige URLs assinadas e tokens em campos narrativos", () => {
    const result = sanitizeCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisFixture({
        videoReading: {
          ...buildCreatorVideoNarrativeDiagnosisFixture().videoReading,
          summary:
            "Fonte https://bucket.s3.amazonaws.com/path/video.mp4?X-Amz-Signature=abc123 e Bearer abcdefghijklmnopqrstuvwxyz123456.",
        },
      }),
    );

    expect(result.videoReading.summary).toContain("[signed-url-redacted]");
    expect(result.videoReading.summary).toContain("[secret-redacted]");
    expect(result.videoReading.summary).not.toContain("X-Amz-Signature");
    expect(result.videoReading.summary).not.toContain("Bearer abc");
    expect(result.safetyFlags.sanitized).toBe(true);
  });

  it("bloqueia raw model response grande ou explícito", () => {
    expect(() =>
      sanitizeCreatorVideoNarrativeDiagnosisInput({
        ...buildCreatorVideoNarrativeDiagnosisFixture(),
        rawGeminiResponse: { candidates: ["x".repeat(5000)] },
      } as any),
    ).toThrow("campo proibido");

    expect(() =>
      sanitizeCreatorVideoNarrativeDiagnosisInput({
        ...buildCreatorVideoNarrativeDiagnosisFixture(),
        videoReading: {
          ...buildCreatorVideoNarrativeDiagnosisFixture().videoReading,
          summary: "x".repeat(4001),
        },
      }),
    ).toThrow("excede o limite seguro");
  });

  it("bloqueia transcrição longa", () => {
    expect(() =>
      sanitizeCreatorVideoNarrativeDiagnosisInput({
        ...buildCreatorVideoNarrativeDiagnosisFixture(),
        transcript: "fala ".repeat(1000),
      } as any),
    ).toThrow("campo proibido");
  });

  it("exige profileContribution", () => {
    expect(() =>
      sanitizeCreatorVideoNarrativeDiagnosisInput({
        ...buildCreatorVideoNarrativeDiagnosisFixture(),
        profileContribution: undefined,
      } as any),
    ).toThrow("profileContribution é obrigatório");
  });

  it("aceita em videoMetadata apenas os campos seguros", () => {
    const result = sanitizeCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisFixture({
        videoMetadata: {
          mimeType: "video/mp4",
          sizeBytes: 1000,
          durationSeconds: 10,
          originalFileNameSanitized: "video.mp4",
          uploadedAt: new Date("2026-05-20T10:00:00.000Z"),
          analyzedAt: new Date("2026-05-20T10:02:00.000Z"),
          thumbnailUrl: "https://cdn.example.com/thumb.jpg",
          storageProviderPath: "r2://bucket/video.mp4",
        } as any,
      }),
    );

    expect(Object.keys(result.videoMetadata).sort()).toEqual([
      "analyzedAt",
      "durationSeconds",
      "mimeType",
      "originalFileNameSanitized",
      "sizeBytes",
      "uploadedAt",
    ]);
    expect(JSON.stringify(result)).not.toContain("thumbnailUrl");
    expect(JSON.stringify(result)).not.toContain("storageProviderPath");
  });

  it("guardrail: não deixa referência persistida a vídeo, thumbnail, signed URL ou objectKey no documento", () => {
    const result = sanitizeCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisFixture({
        videoMetadata: {
          mimeType: "video/mp4",
          objectKey: "uploads/user/video.mp4",
          thumbnailUrl: "https://cdn.example.com/thumb.jpg",
        } as any,
        strategicRecommendation: {
          ...buildCreatorVideoNarrativeDiagnosisFixture().strategicRecommendation,
          nextExperiment: "Rever o arquivo uploads/user/video.mp4 antes de postar.",
        },
      }),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("uploads/user/video.mp4");
    expect(serialized).not.toContain("thumbnailUrl");
    expect(serialized).not.toContain("objectKey");
    expect(serialized).not.toContain("signedUrl");
    expect(serialized).toContain("[object-key-redacted]");
  });
});
