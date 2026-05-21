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

  it("aceita speechQuote curta e diferencia source creator_spoken de ai_suggested", () => {
    const result = sanitizeCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisFixture({
        evidenceAnchors: {
          speechQuotes: [
            {
              quote: "rapidinho",
              source: "creator_spoken",
              quoteRole: "hook",
              whyItMatters: "A palavra cria promessa pequena para a cena.",
              chapterHint: "pattern",
            },
            {
              quote: "Quando a reunião era para ser rápida...",
              source: "ai_suggested",
              quoteRole: "promise",
              whyItMatters: "E sugestao de frase, nao fala real.",
              chapterHint: "movement",
            },
          ],
          sceneAnchors: [],
          creatorIntentAnchor: null,
          profilePatternAnchors: [],
          instagramAnchors: [],
        },
      }),
    );

    expect(result.evidenceAnchors?.speechQuotes[0]).toEqual(expect.objectContaining({
      quote: "rapidinho",
      source: "creator_spoken",
    }));
    expect(result.evidenceAnchors?.speechQuotes[1].source).toBe("ai_suggested");
  });

  it("trunca quote longa, remove URLs e limita quantidade de anchors", () => {
    const result = sanitizeCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisFixture({
        evidenceAnchors: {
          speechQuotes: Array.from({ length: 6 }, (_, index) => ({
            quote: `${"frase longa ".repeat(30)} https://example.com/video.mp4?token=abc ${index}`,
            source: "ai_suggested",
            quoteRole: "example",
            whyItMatters: "Remove URL e limita frase.",
            chapterHint: "movement",
          })),
          sceneAnchors: Array.from({ length: 6 }, (_, index) => ({
            description: `Cena segura ${index}`,
            source: "derived_scene",
            momentRole: "opening",
            whyItMatters: "Limita cenas.",
            chapterHint: "pattern",
          })),
          creatorIntentAnchor: null,
          profilePatternAnchors: [],
          instagramAnchors: [],
        },
      }),
    );

    expect(result.evidenceAnchors?.speechQuotes).toHaveLength(4);
    expect(result.evidenceAnchors?.sceneAnchors).toHaveLength(4);
    expect(result.evidenceAnchors?.speechQuotes[0].quote.length).toBeLessThanOrEqual(180);
    expect(JSON.stringify(result)).not.toContain("https://example.com");
  });

  it("aceita sceneAnchor model_observed seguro", () => {
    const result = sanitizeCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisFixture({
        evidenceAnchors: {
          speechQuotes: [],
          sceneAnchors: [
            {
              description: "A abertura demora a mostrar o conflito principal.",
              source: "model_observed",
              momentRole: "opening",
              whyItMatters: "Mostra onde a tensão atrasa.",
              chapterHint: "tension",
            },
          ],
          creatorIntentAnchor: null,
          profilePatternAnchors: [],
          instagramAnchors: [],
        },
      }),
    );

    expect(result.evidenceAnchors?.sceneAnchors[0]).toEqual(expect.objectContaining({
      source: "model_observed",
      momentRole: "opening",
    }));
  });

  it("bloqueia base64 grande e transcrição longa dentro de anchors", () => {
    expect(() =>
      sanitizeCreatorVideoNarrativeDiagnosisInput(
        buildCreatorVideoNarrativeDiagnosisFixture({
          evidenceAnchors: {
            speechQuotes: [
              {
                quote: "data:video/mp4;base64," + "A".repeat(1500),
                source: "creator_spoken",
                quoteRole: "hook",
                whyItMatters: "nao deve persistir",
                chapterHint: "pattern",
              },
            ],
            sceneAnchors: [],
            creatorIntentAnchor: null,
            profilePatternAnchors: [],
            instagramAnchors: [],
          },
        }),
      ),
    ).toThrow("base64 grande");

    expect(() =>
      sanitizeCreatorVideoNarrativeDiagnosisInput(
        buildCreatorVideoNarrativeDiagnosisFixture({
          evidenceAnchors: {
            speechQuotes: [],
            sceneAnchors: [
              {
                description: Array.from({ length: 12 }, (_, index) => `00:${String(index).padStart(2, "0")} fala`).join("\n"),
                source: "derived_scene",
                momentRole: "opening",
                whyItMatters: "nao deve persistir",
                chapterHint: "pattern",
              },
            ],
            creatorIntentAnchor: null,
            profilePatternAnchors: [],
            instagramAnchors: [],
          },
        }),
      ),
    ).toThrow("transcrição longa");
  });
});
