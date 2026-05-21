import { readFileSync } from "fs";
import path from "path";
import { sanitizeCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisSanitizer";
import { mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisMapper";
import {
  buildCreatorVideoNarrativeDiagnosisMapperParams,
  buildMapperEvolvingDiagnosisFixture,
  buildMapperStrategicDiagnosisFixture,
} from "./creatorVideoNarrativeDiagnosisMapperFixtures";

describe("creatorVideoNarrativeDiagnosisMapper", () => {
  it("cria um CreatorVideoNarrativeDiagnosisInput valido a partir das camadas estruturadas", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams(),
    );

    expect(result.schemaVersion).toBe("creator_video_narrative_diagnosis_v1");
    expect(result.userId).toBe("665f0f2c8a0b7d1f2c3a4b5c");
    expect(result.diagnosisId).toBe("video-narrative-diagnosis-analysis-1");
    expect(result.videoReading.title).toContain("humor cotidiano");
    expect(result.speechReading.suggestedOpening).toContain("reuniao");
    expect(result.productionReading.summary).toContain("producao");
    expect(result.strategicRecommendation.mainAdjustment.toLowerCase()).toContain("fechar");
  });

  it("nao aceita raw Gemini response ou raw model output", () => {
    expect(() =>
      mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput({
        ...buildCreatorVideoNarrativeDiagnosisMapperParams(),
        rawGeminiResponse: { candidates: [{ content: "nao deve entrar" }] },
      } as any),
    ).toThrow("raw model output");
  });

  it("nao propaga objectKey, signedUrl, uploadUrl, thumbnailUrl, localPath ou storageProviderPath", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams({
        safeVideoMetadata: {
          mimeType: "video/mp4",
          sizeBytes: 100,
          objectKey: "uploads/user/video.mp4",
          signedUrl: "https://bucket.s3.amazonaws.com/video.mp4?X-Amz-Signature=abc",
          uploadUrl: "https://upload.example.com/video.mp4?token=abc",
          thumbnailUrl: "https://cdn.example.com/thumb.jpg",
          localPath: "/tmp/video.mp4",
          storageProviderPath: "r2://bucket/video.mp4",
        } as any,
      }),
    );

    const serialized = JSON.stringify(result);
    expect(result.videoMetadata).toEqual({
      mimeType: "video/mp4",
      sizeBytes: 100,
      analyzedAt: new Date("2026-05-20T10:00:00.000Z"),
    });
    expect(serialized).not.toContain("objectKey");
    expect(serialized).not.toContain("signedUrl");
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("thumbnailUrl");
    expect(serialized).not.toContain("localPath");
    expect(serialized).not.toContain("storageProviderPath");
  });

  it("preenche profileContribution obrigatoriamente", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams(),
    );

    expect(result.profileContribution).toEqual(
      expect.objectContaining({
        type: expect.any(String),
        confidence: expect.any(String),
        weight: expect.any(String),
        reason: expect.any(String),
        profileImpactPreview: expect.any(String),
      }),
    );
  });

  it("classifica primeira leitura como hipotese ou needs_more_samples, nunca como padrao definitivo", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams({
        evolvingDiagnosis: buildMapperEvolvingDiagnosisFixture({
          currentLevel: {
            id: "first_reading",
            label: "Primeira leitura",
            description: "Primeira leitura estrategica.",
            position: 1,
          },
          recurringPatterns: [],
          profileImpact: {
            ...buildMapperEvolvingDiagnosisFixture().profileImpact,
            usefulSignalsCount: 1,
            recurringSignalsCount: 0,
            recurringPatternsCount: 0,
          },
        }),
      }),
    );

    expect(["opens_new_hypothesis", "needs_more_samples"]).toContain(result.profileContribution.type);
    expect(result.profileContribution.type).not.toBe("confirms_existing_pattern");
    expect(result.profileContribution.confidence).toBe("low");
    expect(result.profileContribution.weight).toBe("low");
  });

  it("classifica padrao recorrente como confirms_existing_pattern apenas quando ha recorrencia compativel", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams({
        evolvingDiagnosis: buildMapperEvolvingDiagnosisFixture({
          currentLevel: {
            id: "narrative_in_formation",
            label: "Narrativa em formacao",
            description: "Mapa ja conecta sinais recorrentes.",
            position: 3,
          },
          recurringPatterns: ["sinal recorrente: humor cotidiano com identificacao rapida"],
          profileImpact: {
            ...buildMapperEvolvingDiagnosisFixture().profileImpact,
            usefulSignalsCount: 5,
            recurringSignalsCount: 2,
            recurringPatternsCount: 1,
          },
        }),
      }),
    );

    expect(result.profileContribution.type).toBe("confirms_existing_pattern");
    expect(result.profileContribution.confidence).toBe("high");
    expect(result.profileContribution.weight).toBe("high");
  });

  it("classifica oportunidade comercial como commercial_signal sem prometer match real", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams({
        evolvingDiagnosis: buildMapperEvolvingDiagnosisFixture({
          currentLevel: {
            id: "initial_patterns",
            label: "Padroes iniciais",
            description: "Primeiros padroes aparecem.",
            position: 2,
          },
          profileImpact: {
            ...buildMapperEvolvingDiagnosisFixture().profileImpact,
            usefulSignalsCount: 4,
            recurringSignalsCount: 1,
          },
          recurringPatterns: ["sinal recorrente: formato de cena curta"],
        }),
      }),
    );

    expect(result.profileContribution.type).toBe("commercial_signal");
    const serialized = JSON.stringify(result).toLowerCase();
    expect(serialized).not.toContain("match real");
    expect(serialized).not.toContain("publi garantida");
    expect(serialized).not.toContain("marca garantida");
  });

  it("cria rememberedAs seguro sem depender de thumbnail ou arquivo salvo", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams({
        safeVideoMetadata: {
          originalFileNameSanitized: "nome-sensivel-do-arquivo.mp4",
          thumbnailUrl: "https://cdn.example.com/thumb.jpg",
        } as any,
      }),
    );

    expect(result.videoReading.rememberedAs).toContain("Video sobre");
    expect(result.videoReading.rememberedAs).not.toContain("thumb");
    expect(result.videoReading.rememberedAs).not.toContain("nome-sensivel");
  });

  it("passa pelo sanitizer do MM74", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams(),
    );

    expect(() => sanitizeCreatorVideoNarrativeDiagnosisInput(result)).not.toThrow();
  });

  it("mapeia creatorGoal para creatorIntentAnchor", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams({
        creatorGoal: "Quero entender se a piada de reunião reforça meu humor cotidiano.",
      }),
    );

    expect(result.evidenceAnchors?.creatorIntentAnchor).toEqual(expect.objectContaining({
      source: "creator_goal",
      statedGoal: "Quero entender se a piada de reunião reforça meu humor cotidiano.",
    }));
  });

  it("mapeia suggestedHook como ai_suggested e nao inventa creator_spoken", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams({
        strategicDiagnosis: buildMapperStrategicDiagnosisFixture({
          suggestedHook: "Quando a reunião era para ser rapidinha...",
        }),
      }),
    );

    expect(result.evidenceAnchors?.speechQuotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          quote: "Quando a reunião era para ser rapidinha...",
          source: "ai_suggested",
        }),
      ]),
    );
    expect(result.evidenceAnchors?.speechQuotes.some((anchor) => anchor.source === "creator_spoken")).toBe(false);
  });

  it("mapeia rememberedAs como sceneAnchor seguro", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams(),
    );

    expect(result.evidenceAnchors?.sceneAnchors[0]).toEqual(expect.objectContaining({
      source: "derived_scene",
      chapterHint: "pattern",
    }));
    expect(result.evidenceAnchors?.sceneAnchors[0].description).toContain("Video sobre");
  });

  it("nao importa Mongoose, storage SDK, Gemini SDK ou codigo client-side", () => {
    const mapperPath = path.join(__dirname, "creatorVideoNarrativeDiagnosisMapper.ts");
    const source = readFileSync(mapperPath, "utf8");

    expect(source).not.toMatch(/from ["']mongoose["']|@google\/genai|@aws-sdk|["']use client["']/);
  });

  it("nao importa nem atualiza CreatorStrategicProfileSnapshot", () => {
    const mapperPath = path.join(__dirname, "creatorVideoNarrativeDiagnosisMapper.ts");
    const source = readFileSync(mapperPath, "utf8");

    expect(source).not.toContain("CreatorStrategicProfileSnapshot");
    expect(source).not.toContain("upsertStrategicProfileSnapshot");
    expect(source).not.toContain("findOneAndUpdate");
  });

  it("sanitiza input com signed URL, objectKey, base64 grande ou texto de raw response", () => {
    const result = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput(
      buildCreatorVideoNarrativeDiagnosisMapperParams({
        safeVideoMetadata: {
          objectKey: "uploads/user/video.mp4",
          signedUrl: "https://bucket.s3.amazonaws.com/video.mp4?X-Amz-Signature=abc",
        } as any,
        strategicDiagnosis: buildMapperStrategicDiagnosisFixture({
          mainNarrative:
            "raw response trouxe data:video/mp4;base64," + "A".repeat(1400) + " e uploads/user/video.mp4",
          strategicReading: "Nao usar https://bucket.s3.amazonaws.com/video.mp4?X-Amz-Signature=abc no documento.",
        }),
      }),
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("X-Amz-Signature");
    expect(serialized).not.toContain("uploads/user/video.mp4");
    expect(serialized).not.toContain("data:video/mp4;base64");
    expect(serialized).toContain("[base64-redacted]");
    expect(serialized).toContain("[object-key-redacted]");
  });
});
