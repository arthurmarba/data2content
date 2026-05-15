import fs from "fs";
import path from "path";

import { createVideoUploadSession, markVideoUploadSessionSigned } from "./videoUploadSessionContracts";
import { VideoUploadDraft } from "./videoUploadTypes";
import {
  VideoProcessingTaskRequest,
  VideoProcessingTaskType,
  createVideoProcessingTaskRequest,
  mergeVideoProcessingTaskResults,
} from "./videoProcessingProviderContracts";
import {
  runVideoProcessingMockProvider,
  runVideoProcessingMockProviderBatch,
} from "./videoProcessingMockProvider";

const oneMb = 1024 * 1024;

const forbiddenUserFacingTerms = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "resposta correta",
];

function draft(overrides: Partial<VideoUploadDraft> = {}): VideoUploadDraft {
  return {
    id: "mock-provider-draft",
    source: "local_file",
    fileName: "video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 20 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "Quero entender se vale postar.",
    createdAt: "2026-05-14T12:00:00.000Z",
    ...overrides,
  };
}

function signedSession(overrides: Partial<VideoUploadDraft> = {}) {
  const session = createVideoUploadSession({
    id: "mock-provider-session",
    draft: draft(overrides),
    userId: "user-1",
    createdAt: "2026-05-14T12:00:00.000Z",
    provider: "local_mock",
  });

  return markVideoUploadSessionSigned({
    session: {
      ...session,
      storageObject: {
        ...session.storageObject,
        storageKey: "temporary/video.mp4",
      },
    },
    signedUploadUrl: "https://signed.example/mock-provider",
    signedUploadUrlExpiresAt: "2026-05-14T12:30:00.000Z",
    updatedAt: "2026-05-14T12:05:00.000Z",
  });
}

function request(taskType: VideoProcessingTaskType, overrides: Partial<VideoProcessingTaskRequest> = {}): VideoProcessingTaskRequest {
  const base = createVideoProcessingTaskRequest({
    id: `task-${taskType}`,
    session: signedSession(),
    taskType,
    createdAt: "2026-05-14T12:10:00.000Z",
  });

  return {
    ...base,
    ...overrides,
    input: {
      ...base.input,
      ...overrides.input,
    },
  };
}

describe("videoProcessingMockProvider", () => {
  it("returns completed transcription artifacts for skincare_routine", () => {
    const result = runVideoProcessingMockProvider({
      request: request("transcription"),
      options: { scenario: "skincare_routine", completedAt: "2026-05-14T12:20:00.000Z" },
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts.transcript?.fullText).toBe(
      "Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.",
    );
    expect(result.artifacts.transcript?.provider).toBe("manual");
  });

  it("returns visual summary artifacts for backstage_process", () => {
    const result = runVideoProcessingMockProvider({
      request: request("visual_summary"),
      options: { scenario: "backstage_process" },
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts.visualSummary).toBe("Pessoa em reunião mostrando bastidores de trabalho e processo de criação.");
  });

  it("returns frames for brand_ocr frame extraction", () => {
    const result = runVideoProcessingMockProvider({
      request: request("frame_extraction"),
      options: { scenario: "brand_ocr" },
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts.frames).toHaveLength(3);
    expect(result.artifacts.frames?.[0]?.description).toContain("skincare");
  });

  it("returns OCR for brand_ocr", () => {
    const result = runVideoProcessingMockProvider({
      request: request("ocr"),
      options: { scenario: "brand_ocr" },
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts.ocr?.map((item) => item.text)).toEqual(["Rotina da manhã", "Autocuidado real"]);
  });

  it("returns opening density signal for hook_improvement", () => {
    const result = runVideoProcessingMockProvider({
      request: request("technical_signals"),
      options: { scenario: "hook_improvement" },
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts.technicalSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "opening_density",
          value: "baixo nos primeiros segundos",
        }),
      ]),
    );
  });

  it("returns completed empty artifacts for empty scenario", () => {
    const result = runVideoProcessingMockProvider({
      request: request("visual_summary"),
      options: { scenario: "empty" },
    });

    expect(result).toMatchObject({
      status: "completed",
      artifacts: {},
      message: "Processamento simulado concluído.",
    });
  });

  it("returns failed result for failure scenario", () => {
    const result = runVideoProcessingMockProvider({
      request: request("transcription"),
      options: { scenario: "failure" },
    });

    expect(result.status).toBe("failed");
    expect(result.message).toBe("Processamento simulado indisponível para esta tarefa.");
  });

  it("allows failTasks to force a specific task failure", () => {
    const result = runVideoProcessingMockProvider({
      request: request("ocr"),
      options: { scenario: "brand_ocr", failTasks: ["ocr"] },
    });

    expect(result.status).toBe("failed");
    expect(result.message).toBe("Processamento simulado indisponível para esta tarefa.");
  });

  it("returns failed result for invalid request without throwing", () => {
    const result = runVideoProcessingMockProvider({
      request: request("transcription", {
        id: "",
        sessionId: "",
        storageObjectId: "",
        input: {
          storageObjectId: "",
          signedUrl: null,
        },
      }),
      options: { scenario: "skincare_routine" },
    });

    expect(result.status).toBe("failed");
    expect(result.message).toContain("Tarefa sem identificador.");
    expect(result.message).toContain("URL temporária necessária para este processamento.");
  });

  it("processes a batch of requests in order", () => {
    const requests = [request("transcription"), request("visual_summary"), request("ocr")];
    const results = runVideoProcessingMockProviderBatch({
      requests,
      options: { scenario: "skincare_routine" },
    });

    expect(results.map((result) => result.taskType)).toEqual(["transcription", "visual_summary", "ocr"]);
  });

  it("uses provided completedAt instead of runtime time", () => {
    const result = runVideoProcessingMockProvider({
      request: request("transcription"),
      options: {
        scenario: "skincare_routine",
        completedAt: "2026-05-14T13:00:00.000Z",
      },
    });

    expect(result.completedAt).toBe("2026-05-14T13:00:00.000Z");
  });

  it("merges mock provider outputs into useful processing artifacts", () => {
    const results = runVideoProcessingMockProviderBatch({
      requests: [request("transcription"), request("frame_extraction"), request("ocr")],
      options: { scenario: "skincare_routine" },
    });
    const artifacts = mergeVideoProcessingTaskResults(results);

    expect(artifacts.status).toBe("completed");
    expect(artifacts.transcript.fullText).toBe("Mostro minha rotina de skincare pela manhã e falo sobre autocuidado.");
    expect(artifacts.frames).toHaveLength(3);
    expect(artifacts.ocr).toHaveLength(2);
  });

  it("supports a pipeline smoke with transcript and visual summary results", () => {
    const results = runVideoProcessingMockProviderBatch({
      requests: [request("transcription"), request("visual_summary")],
      options: { scenario: "backstage_process" },
    });
    const artifacts = mergeVideoProcessingTaskResults(results);

    expect(artifacts.transcript.fullText).toBe("Mostro os bastidores de uma reunião e explico meu processo de criação.");
    expect(artifacts.visualSummary).toBe("Pessoa em reunião mostrando bastidores de trabalho e processo de criação.");
  });

  it("keeps result messages, artifacts, and notes language safe", () => {
    const results = [
      runVideoProcessingMockProvider({
        request: request("transcription"),
        options: { scenario: "skincare_routine" },
      }),
      runVideoProcessingMockProvider({
        request: request("ocr"),
        options: { scenario: "failure" },
      }),
    ];
    const artifacts = mergeVideoProcessingTaskResults(results);
    const text = JSON.stringify({
      messages: results.map((result) => result.message),
      artifacts,
      processingNotes: artifacts.processingNotes,
    }).toLowerCase();

    for (const term of forbiddenUserFacingTerms) {
      expect(text).not.toContain(term);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import UI, services, real providers, SDKs, fetch, ffmpeg, or product integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoProcessingMockProvider.ts"), "utf8");
    const imports = source
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .join("\n");

    expect(imports).not.toContain("React");
    expect(imports).not.toContain("BoardShell");
    expect(imports).not.toContain("PostCreationFunnelBoardShell");
    expect(imports).not.toContain("OpenAI");
    expect(imports).not.toContain("fetch");
    expect(imports).not.toContain("Prisma");
    expect(imports).not.toContain("banco");
    expect(imports).not.toContain("components/");
    expect(imports).not.toContain("hooks/");
    expect(imports).not.toContain("endpoint");
    expect(imports).not.toContain("upload service real");
    expect(imports).not.toContain("storage provider SDK");
    expect(imports).not.toContain("S3");
    expect(imports).not.toContain("Blob");
    expect(imports).not.toContain("R2");
    expect(imports).not.toContain("GCS");
    expect(imports).not.toContain("ffmpeg");
    expect(imports).not.toContain("Whisper SDK");
    expect(imports).not.toContain("OCR SDK");
  });
});
