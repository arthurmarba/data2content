import { readFileSync } from "fs";
import path from "path";
import { mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisMapper";
import { sanitizeCreatorVideoNarrativeDiagnosisInput } from "./creatorVideoNarrativeDiagnosisSanitizer";
import {
  buildSavedDiagnosisDocumentFixture,
  buildSaveOrchestratorParams,
} from "./creatorVideoNarrativeDiagnosisSaveOrchestratorFixtures";
import {
  saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis,
} from "./creatorVideoNarrativeDiagnosisSaveOrchestrator";

describe("creatorVideoNarrativeDiagnosisSaveOrchestrator", () => {
  it("chama mapper e service com dados validos", async () => {
    const params = buildSaveOrchestratorParams();
    const mappedInput = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput({
      userId: params.userId,
      source: params.source,
      creatorGoal: params.creatorGoal ?? "",
      selectedGoalOption: params.selectedGoalOption ?? "",
      safeVideoMetadata: params.safeVideoMetadata as any,
      strategicDiagnosis: params.strategicDiagnosis,
      evolvingDiagnosis: params.evolvingDiagnosis,
      presentation: params.presentation,
      seed: params.seed,
      analyzedAt: params.analyzedAt,
      createdAt: params.createdAt,
    });
    const mapToDiagnosisInput = jest.fn(() => mappedInput);
    const createDiagnosis = jest.fn(async (input) => buildSavedDiagnosisDocumentFixture(input));

    const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(params, {
      mapToDiagnosisInput,
      createDiagnosis,
    });

    expect(result.ok).toBe(true);
    expect(mapToDiagnosisInput).toHaveBeenCalledWith(expect.objectContaining({
      userId: params.userId,
      source: "mock",
      selectedGoalOption: "authority",
    }));
    expect(createDiagnosis).toHaveBeenCalledWith(expect.objectContaining({
      diagnosisId: "video-narrative-diagnosis-analysis-1",
      profileContribution: expect.any(Object),
    }));
  });

  it("salva uma leitura por video e retorna diagnosisId", async () => {
    const createDiagnosis = jest.fn(async () => buildSavedDiagnosisDocumentFixture());

    const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
      buildSaveOrchestratorParams(),
      { createDiagnosis },
    );

    expect(result).toEqual({
      ok: true,
      diagnosisId: "video-narrative-diagnosis-analysis-1",
      documentId: "665f0f2c8a0b7d1f2c3a4b5d",
      profileContribution: {
        type: "opens_new_hypothesis",
        confidence: "low",
        weight: "low",
        profileImpactPreview: "Cria uma primeira pista para acompanhar nas proximas analises.",
      },
    });
  });

  it("exige profileContribution", async () => {
    const mapToDiagnosisInput = jest.fn(() => {
      const mapped = mapVideoNarrativeDiagnosisToCreatorVideoNarrativeDiagnosisInput({
        ...buildSaveOrchestratorParams(),
        creatorGoal: "goal",
        selectedGoalOption: "authority",
      } as any);
      return { ...mapped, profileContribution: undefined } as any;
    });
    const createDiagnosis = jest.fn();

    const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
      buildSaveOrchestratorParams(),
      { mapToDiagnosisInput, createDiagnosis },
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "missing_profile_contribution",
      message: "A leitura do video precisa de uma contribuicao para o Perfil antes de ser salva.",
    });
    expect(createDiagnosis).not.toHaveBeenCalled();
  });

  it("nao atualiza CreatorStrategicProfileSnapshot", async () => {
    const source = readFileSync(path.join(__dirname, "creatorVideoNarrativeDiagnosisSaveOrchestrator.ts"), "utf8");

    expect(source).not.toContain("CreatorStrategicProfileSnapshot");
    expect(source).not.toContain("upsertStrategicProfileSnapshot");
    expect(source).not.toContain("findOneAndUpdate");
  });

  it("nao importa endpoint real ou mock", () => {
    const source = readFileSync(path.join(__dirname, "creatorVideoNarrativeDiagnosisSaveOrchestrator.ts"), "utf8");

    expect(source).not.toMatch(/analyze-real\/route|analyze\/route|videoNarrativeEndpointMockMode|api\/dashboard\/mobile-strategic-profile/);
  });

  it("nao importa Gemini SDK, storage SDK ou client components", () => {
    const source = readFileSync(path.join(__dirname, "creatorVideoNarrativeDiagnosisSaveOrchestrator.ts"), "utf8");

    expect(source).not.toMatch(/@google\/genai|@aws-sdk|from ["']mongoose["']|["']use client["']/);
  });

  it("nao propaga objectKey, signedUrl, uploadUrl, thumbnailUrl, localPath ou storageProviderPath", async () => {
    const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
      buildSaveOrchestratorParams({
        safeVideoMetadata: {
          mimeType: "video/mp4",
          objectKey: "uploads/user/video.mp4",
          signedUrl: "https://bucket.s3.amazonaws.com/video.mp4?X-Amz-Signature=abc",
          uploadUrl: "https://upload.example.com/video.mp4?token=abc",
          thumbnailUrl: "https://cdn.example.com/thumb.jpg",
          localPath: "/tmp/video.mp4",
          storageProviderPath: "r2://bucket/video.mp4",
        } as any,
      }),
      {
        createDiagnosis: jest.fn(async (input) => buildSavedDiagnosisDocumentFixture(input)),
      },
    );

    const serialized = JSON.stringify(result);
    expect(result.ok).toBe(true);
    expect(serialized).not.toContain("objectKey");
    expect(serialized).not.toContain("signedUrl");
    expect(serialized).not.toContain("uploadUrl");
    expect(serialized).not.toContain("thumbnailUrl");
    expect(serialized).not.toContain("localPath");
    expect(serialized).not.toContain("storageProviderPath");
    expect(serialized).not.toContain("X-Amz-Signature");
  });

  it("retorna erro seguro quando mapper falha", async () => {
    const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
      buildSaveOrchestratorParams(),
      {
        mapToDiagnosisInput: jest.fn(() => {
          throw new Error("rawGeminiResponse com stack e secret sk-proj-abc");
        }),
        createDiagnosis: jest.fn(),
      },
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "invalid_video_reading_input",
      message: "Nao foi possivel preparar a leitura documentada deste video.",
    });
    expect(JSON.stringify(result)).not.toContain("sk-proj");
    expect(JSON.stringify(result)).not.toContain("stack");
  });

  it("retorna erro seguro quando service falha", async () => {
    const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
      buildSaveOrchestratorParams(),
      {
        createDiagnosis: jest.fn(async () => {
          throw new Error("Mongo stack with signedUrl https://bucket/video.mp4?signature=abc");
        }),
      },
    );

    expect(result).toEqual({
      ok: false,
      errorCode: "diagnosis_persistence_failed",
      message: "Nao foi possivel salvar a leitura documentada deste video agora.",
    });
    expect(JSON.stringify(result)).not.toContain("signature");
    expect(JSON.stringify(result)).not.toContain("Mongo");
  });

  it("passa pelo sanitizer do MM74/MM75 antes de chamar o service", async () => {
    const createDiagnosis = jest.fn(async (input) => {
      expect(() => sanitizeCreatorVideoNarrativeDiagnosisInput(input)).not.toThrow();
      expect(JSON.stringify(input)).not.toContain("uploads/user/video.mp4");
      return buildSavedDiagnosisDocumentFixture(input);
    });

    const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
      buildSaveOrchestratorParams({
        strategicDiagnosis: {
          ...buildSaveOrchestratorParams().strategicDiagnosis,
          mainNarrative: "Video com data:video/mp4;base64," + "A".repeat(1400) + " e uploads/user/video.mp4",
        },
      }),
      { createDiagnosis },
    );

    expect(result.ok).toBe(true);
    expect(createDiagnosis).toHaveBeenCalled();
  });

  it("mantem source como mock/real/manual/migration sem executar logica especifica de endpoint", async () => {
    const createDiagnosis = jest.fn(async (input) => buildSavedDiagnosisDocumentFixture(input));

    for (const source of ["mock", "real", "manual", "migration"] as const) {
      const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
        buildSaveOrchestratorParams({ source }),
        { createDiagnosis },
      );
      expect(result.ok).toBe(true);
    }

    expect(createDiagnosis).toHaveBeenCalledTimes(4);
  });

  it("retorno seguro nao contem diagnostico bruto nem raw response", async () => {
    const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
      buildSaveOrchestratorParams(),
      { createDiagnosis: jest.fn(async () => buildSavedDiagnosisDocumentFixture()) },
    );

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("videoReading");
    expect(serialized).not.toContain("speechReading");
    expect(serialized).not.toContain("commercialReading");
    expect(serialized).not.toContain("rawGeminiResponse");
    expect(serialized).not.toContain("rawModelResponse");
  });

  it("integra fixture MM75 com service in-memory sem banco real", async () => {
    const saved: unknown[] = [];
    const createDiagnosis = jest.fn(async (input) => {
      saved.push(input);
      return buildSavedDiagnosisDocumentFixture(input);
    });

    const result = await saveCreatorVideoNarrativeDiagnosisFromStructuredAnalysis(
      buildSaveOrchestratorParams(),
      { createDiagnosis },
    );

    expect(result.ok).toBe(true);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toEqual(expect.objectContaining({
      schemaVersion: "creator_video_narrative_diagnosis_v1",
      profileContribution: expect.any(Object),
    }));
  });
});
