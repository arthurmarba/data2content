import fs from "fs";
import path from "path";

import { VideoUploadDraft } from "./videoUploadTypes";
import { createVideoUploadSession, markVideoUploadSessionSigned } from "./videoUploadSessionContracts";
import {
  VideoProcessingTaskRequest,
  buildMockVideoProcessingProviderCapabilities,
  createEmptyVideoProcessingTaskResult,
  createVideoProcessingTaskRequest,
  markVideoProcessingTaskCompleted,
  markVideoProcessingTaskFailed,
  mergeVideoProcessingTaskResults,
  validateVideoProcessingTaskRequest,
} from "./videoProcessingProviderContracts";

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
    id: "draft-1",
    source: "local_file",
    fileName: "video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 20 * oneMb,
    durationSeconds: 45,
    creatorQuestion: "Quero entender se vale postar.",
    createdAt: null,
    ...overrides,
  };
}

function signedSession(overrides: Partial<VideoUploadDraft> = {}) {
  const session = createVideoUploadSession({
    id: "session-1",
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
    signedUploadUrl: "https://signed.example/upload",
    signedUploadUrlExpiresAt: "2026-05-14T12:30:00.000Z",
    updatedAt: "2026-05-14T12:05:00.000Z",
  });
}

function request(overrides: Partial<VideoProcessingTaskRequest> = {}): VideoProcessingTaskRequest {
  return {
    ...createVideoProcessingTaskRequest({
      id: "task-1",
      session: signedSession(),
      taskType: "transcription",
      createdAt: "2026-05-14T12:10:00.000Z",
    }),
    ...overrides,
    input: {
      ...createVideoProcessingTaskRequest({
        id: "task-1",
        session: signedSession(),
        taskType: "transcription",
        createdAt: "2026-05-14T12:10:00.000Z",
      }).input,
      ...overrides.input,
    },
  };
}

function issueCodes(target: VideoProcessingTaskRequest, capabilities = buildMockVideoProcessingProviderCapabilities()) {
  return validateVideoProcessingTaskRequest({ request: target, capabilities }).issues.map((issue) => issue.code);
}

describe("videoProcessingProviderContracts", () => {
  it("builds mock provider capabilities with safe defaults", () => {
    expect(buildMockVideoProcessingProviderCapabilities()).toEqual({
      provider: "local_mock",
      supportedTasks: ["transcription", "frame_extraction", "ocr", "visual_summary", "technical_signals"],
      requiresSignedUrl: true,
      supportsBatch: false,
      maxDurationSeconds: 90,
      maxFileSizeMb: 100,
    });
  });

  it("creates a task request from a session with storage object and signed URL", () => {
    expect(request()).toMatchObject({
      id: "task-1",
      sessionId: "session-1",
      storageObjectId: "session-1-storage",
      taskType: "transcription",
      provider: "local_mock",
      createdAt: "2026-05-14T12:10:00.000Z",
      input: {
        storageObjectId: "session-1-storage",
        storageKey: "temporary/video.mp4",
        signedUrl: "https://signed.example/upload",
      },
    });
  });

  it("preserves mimeType, durationSeconds, and sizeBytes in the input", () => {
    expect(request().input).toMatchObject({
      mimeType: "video/mp4",
      durationSeconds: 45,
      sizeBytes: 20 * oneMb,
    });
  });

  it("validates a supported task request", () => {
    expect(validateVideoProcessingTaskRequest({ request: request() })).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("rejects requests without a task id", () => {
    expect(issueCodes(request({ id: " " }))).toContain("missing_task_id");
  });

  it("rejects requests without a session id", () => {
    expect(issueCodes(request({ sessionId: " " }))).toContain("missing_session_id");
  });

  it("rejects requests without a storage object id", () => {
    expect(issueCodes(request({ storageObjectId: " " }))).toContain("missing_storage_object");
  });

  it("rejects missing signed URL when the provider requires it", () => {
    expect(issueCodes(request({ input: { signedUrl: null } }))).toContain("missing_signed_url");
  });

  it("allows missing signed URL when the provider does not require it", () => {
    expect(
      validateVideoProcessingTaskRequest({
        request: request({ input: { signedUrl: null } }),
        capabilities: buildMockVideoProcessingProviderCapabilities({ requiresSignedUrl: false }),
      }).ok,
    ).toBe(true);
  });

  it("rejects unsupported task types", () => {
    expect(
      issueCodes(
        request({ taskType: "multimodal_summary" }),
        buildMockVideoProcessingProviderCapabilities({ supportedTasks: ["transcription"] }),
      ),
    ).toContain("unsupported_task");
  });

  it("rejects videos above the duration limit", () => {
    expect(issueCodes(request({ input: { durationSeconds: 120 } }))).toContain("duration_too_long");
  });

  it("rejects videos above the file size limit", () => {
    expect(issueCodes(request({ input: { sizeBytes: 101 * oneMb } }))).toContain("file_too_large");
  });

  it("creates an empty task result", () => {
    expect(createEmptyVideoProcessingTaskResult({ request: request() })).toEqual({
      taskId: "task-1",
      taskType: "transcription",
      provider: "local_mock",
      status: "not_started",
      artifacts: {},
      message: null,
      completedAt: null,
    });
  });

  it("marks a task result as completed with artifacts", () => {
    const result = markVideoProcessingTaskCompleted({
      result: createEmptyVideoProcessingTaskResult({ request: request() }),
      artifacts: {
        transcript: {
          fullText: "Texto transcrito.",
          language: "pt-BR",
          provider: "manual",
          segments: [],
        },
      },
      completedAt: "2026-05-14T12:20:00.000Z",
      message: "Transcrição concluída.",
    });

    expect(result.status).toBe("completed");
    expect(result.artifacts.transcript?.fullText).toBe("Texto transcrito.");
    expect(result.completedAt).toBe("2026-05-14T12:20:00.000Z");
  });

  it("marks a task result as failed with message", () => {
    const result = markVideoProcessingTaskFailed({
      result: createEmptyVideoProcessingTaskResult({ request: request() }),
      message: "Provider indisponível para esta solicitação.",
      completedAt: "2026-05-14T12:20:00.000Z",
    });

    expect(result.status).toBe("failed");
    expect(result.message).toBe("Provider indisponível para esta solicitação.");
    expect(result.completedAt).toBe("2026-05-14T12:20:00.000Z");
  });

  it("merges transcript segments from completed task results", () => {
    const first = markVideoProcessingTaskCompleted({
      result: createEmptyVideoProcessingTaskResult({ request: request() }),
      artifacts: {
        transcript: {
          fullText: "Texto principal.",
          language: "pt-BR",
          provider: "manual",
          segments: [{ startSeconds: 0, endSeconds: 2, text: "Começo", confidence: 0.9 }],
        },
      },
      completedAt: "2026-05-14T12:20:00.000Z",
    });
    const second = markVideoProcessingTaskCompleted({
      result: createEmptyVideoProcessingTaskResult({ request: request({ id: "task-2" }) }),
      artifacts: {
        transcript: {
          fullText: null,
          language: "pt-BR",
          provider: "manual",
          segments: [{ startSeconds: 3, endSeconds: 5, text: "Fim", confidence: 0.85 }],
        },
      },
      completedAt: "2026-05-14T12:21:00.000Z",
    });

    const merged = mergeVideoProcessingTaskResults([first, second]);

    expect(merged.status).toBe("completed");
    expect(merged.transcript.fullText).toBe("Texto principal.");
    expect(merged.transcript.segments).toHaveLength(2);
  });

  it("merges frames, OCR, and technical signals", () => {
    const result = markVideoProcessingTaskCompleted({
      result: createEmptyVideoProcessingTaskResult({ request: request() }),
      artifacts: {
        frames: [{ id: "frame-1", timestampSeconds: 1, label: "opening", description: "Abertura", imageStorageKey: null }],
        ocr: [{ timestampSeconds: 2, text: "Texto na tela", confidence: 0.8 }],
        technicalSignals: [{ type: "duration", value: "45 segundos", confidence: 1 }],
      },
      completedAt: "2026-05-14T12:20:00.000Z",
    });

    const merged = mergeVideoProcessingTaskResults([result]);

    expect(merged.frames).toHaveLength(1);
    expect(merged.ocr).toHaveLength(1);
    expect(merged.technicalSignals).toHaveLength(1);
  });

  it("uses the first non-empty visual summary", () => {
    const first = markVideoProcessingTaskCompleted({
      result: createEmptyVideoProcessingTaskResult({ request: request() }),
      artifacts: { visualSummary: " " },
      completedAt: "2026-05-14T12:20:00.000Z",
    });
    const second = markVideoProcessingTaskCompleted({
      result: createEmptyVideoProcessingTaskResult({ request: request({ id: "task-2" }) }),
      artifacts: { visualSummary: "Pessoa mostrando bastidor de criação." },
      completedAt: "2026-05-14T12:21:00.000Z",
    });

    expect(mergeVideoProcessingTaskResults([first, second]).visualSummary).toBe("Pessoa mostrando bastidor de criação.");
  });

  it("returns pending empty artifacts when there are no results", () => {
    expect(mergeVideoProcessingTaskResults([])).toMatchObject({
      status: "pending",
      frames: [],
      ocr: [],
      technicalSignals: [],
      visualSummary: null,
      processingNotes: [],
    });
  });

  it("returns failed artifacts when all results fail", () => {
    const failed = markVideoProcessingTaskFailed({
      result: createEmptyVideoProcessingTaskResult({ request: request() }),
      message: "Provider indisponível para esta solicitação.",
      completedAt: "2026-05-14T12:20:00.000Z",
    });

    const merged = mergeVideoProcessingTaskResults([failed]);

    expect(merged.status).toBe("failed");
    expect(merged.processingNotes).toEqual(["Provider indisponível para esta solicitação."]);
  });

  it("keeps provider issue and result language safe", () => {
    const invalidRequest = request({
      id: "",
      sessionId: "",
      storageObjectId: "",
      input: {
        storageObjectId: "",
        signedUrl: null,
        durationSeconds: 120,
        sizeBytes: 101 * oneMb,
      },
      taskType: "multimodal_summary",
    });
    const failed = markVideoProcessingTaskFailed({
      result: createEmptyVideoProcessingTaskResult({ request: request() }),
      message: "Provider indisponível para esta solicitação.",
      completedAt: "2026-05-14T12:20:00.000Z",
    });
    const text = JSON.stringify({
      issues: validateVideoProcessingTaskRequest({ request: invalidRequest }).issues.map((issue) => issue.message),
      resultMessage: failed.message,
      notes: mergeVideoProcessingTaskResults([failed]).processingNotes,
    }).toLowerCase();

    for (const term of forbiddenUserFacingTerms) {
      expect(text).not.toContain(term);
    }
    expect(text).not.toContain("erro");
  });

  it("does not import UI, real providers, SDKs, ffmpeg, or product integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoProcessingProviderContracts.ts"), "utf8");
    const imports = source
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .join("\n");

    expect(source).toContain("./videoProcessingArtifacts");
    expect(source).toContain("./videoUploadSessionContracts");
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
    expect(imports).not.toContain("ffmpeg");
    expect(source).not.toContain("upload service real");
    expect(source).not.toContain("storage provider SDK");
    expect(source).not.toContain("Whisper SDK");
    expect(source).not.toContain("OCR SDK");
  });
});
