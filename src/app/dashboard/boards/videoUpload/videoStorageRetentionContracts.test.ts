import fs from "fs";
import path from "path";

import {
  VideoTemporaryStorageObject,
  createEmptyVideoTemporaryStorageObject,
  markTemporaryStorageUploaded,
} from "./videoTemporaryStorageTypes";
import { VideoUploadSession, createVideoUploadSession } from "./videoUploadSessionContracts";
import {
  DEFAULT_VIDEO_RETENTION_POLICY,
  VideoCleanupJob,
  createVideoCleanupJob,
  decideVideoRetentionAction,
  markVideoCleanupJobCompleted,
  markVideoCleanupJobFailed,
  markVideoCleanupJobQueued,
  markVideoCleanupJobRunning,
  shouldRetryVideoCleanupJob,
  validateVideoCleanupJob,
} from "./videoStorageRetentionContracts";

const oneMb = 1024 * 1024;
const now = "2026-05-14T12:00:00.000Z";

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

function storageObject(overrides: Partial<VideoTemporaryStorageObject> = {}): VideoTemporaryStorageObject {
  return {
    ...createEmptyVideoTemporaryStorageObject({
      id: "storage-1",
      draftId: "draft-1",
      provider: "local_mock",
    }),
    ...overrides,
    metadata: {
      ...overrides.metadata,
    },
  };
}

function uploadedStorage(overrides: Partial<VideoTemporaryStorageObject> = {}): VideoTemporaryStorageObject {
  return {
    ...markTemporaryStorageUploaded({
      object: storageObject(),
      storageKey: "temporary/video.mp4",
      uploadedAt: "2026-05-14T10:00:00.000Z",
      retentionHours: 24,
    }),
    ...overrides,
  };
}

function session(overrides: Partial<VideoUploadSession> = {}): VideoUploadSession {
  return {
    ...createVideoUploadSession({
      id: "session-1",
      draft: {
        id: "draft-1",
        source: "local_file",
        fileName: "video.mp4",
        mimeType: "video/mp4",
        sizeBytes: 10 * oneMb,
        durationSeconds: 45,
        creatorQuestion: "Quero saber se vale postar.",
        createdAt: null,
      },
      userId: "user-1",
      createdAt: "2026-05-14T09:00:00.000Z",
      provider: "local_mock",
    }),
    ...overrides,
  };
}

function cleanupJob(overrides: Partial<VideoCleanupJob> = {}): VideoCleanupJob {
  return {
    ...createVideoCleanupJob({
      id: "cleanup-1",
      storageObject: uploadedStorage(),
      sessionId: "session-1",
      decision: decideVideoRetentionAction({
        storageObject: uploadedStorage({ status: "processing_locked" }),
        session: session({ status: "uploaded" }),
        now,
      }),
      createdAt: now,
    }),
    ...overrides,
  };
}

function issueCodes(job: VideoCleanupJob) {
  return validateVideoCleanupJob({ job }).issues.map((issue) => issue.code);
}

describe("videoStorageRetentionContracts", () => {
  it("uses safe default retention policy values", () => {
    expect(DEFAULT_VIDEO_RETENTION_POLICY).toEqual({
      deleteAfterProcessing: true,
      deleteFailedUploadsAfterHours: 24,
      deleteAbortedUploadsAfterHours: 24,
      deleteExpiredObjects: true,
      keepArtifactsAfterVideoDeletion: true,
      maxCleanupAttempts: 3,
    });
  });

  it("returns no_action when there is no storage object", () => {
    expect(decideVideoRetentionAction({ storageObject: null, now })).toEqual({
      shouldCleanup: false,
      action: "no_action",
      reason: "unknown",
      message: "Nenhum arquivo temporário para avaliar.",
    });
  });

  it("returns no_action when the storage object is already deleted", () => {
    expect(decideVideoRetentionAction({ storageObject: storageObject({ status: "deleted" }), now })).toEqual({
      shouldCleanup: false,
      action: "no_action",
      reason: "policy_cleanup",
      message: "Arquivo temporário já marcado como removido.",
    });
  });

  it("decides to delete expired temporary files", () => {
    const result = decideVideoRetentionAction({
      storageObject: uploadedStorage({ expiresAt: "2026-05-14T11:59:00.000Z" }),
      now,
    });

    expect(result).toEqual({
      shouldCleanup: true,
      action: "delete_temporary_file",
      reason: "expired",
      message: "Arquivo temporário expirado e elegível para remoção.",
    });
  });

  it("keeps expired temporary files when policy disables expired cleanup", () => {
    const result = decideVideoRetentionAction({
      storageObject: uploadedStorage({ expiresAt: "2026-05-14T11:59:00.000Z" }),
      policy: {
        ...DEFAULT_VIDEO_RETENTION_POLICY,
        deleteExpiredObjects: false,
      },
      now,
    });

    expect(result.action).toBe("keep");
    expect(result.shouldCleanup).toBe(false);
  });

  it("decides to delete old aborted upload files", () => {
    const result = decideVideoRetentionAction({
      storageObject: uploadedStorage(),
      session: session({ status: "aborted", updatedAt: "2026-05-13T11:59:00.000Z" }),
      now,
    });

    expect(result).toMatchObject({
      shouldCleanup: true,
      action: "delete_temporary_file",
      reason: "aborted",
    });
  });

  it("keeps recent aborted upload files", () => {
    const result = decideVideoRetentionAction({
      storageObject: uploadedStorage(),
      session: session({ status: "aborted", updatedAt: "2026-05-14T11:30:00.000Z" }),
      now,
    });

    expect(result.action).toBe("keep");
    expect(result.shouldCleanup).toBe(false);
  });

  it("decides to delete processed temporary files with the safe processing rule", () => {
    const result = decideVideoRetentionAction({
      storageObject: uploadedStorage({ status: "processing_locked" }),
      session: session({ status: "uploaded" }),
      now,
    });

    expect(result).toEqual({
      shouldCleanup: true,
      action: "delete_temporary_file",
      reason: "processed",
      message: "Arquivo temporário elegível para remoção após processamento.",
    });
  });

  it("keeps the temporary file when no cleanup rule applies", () => {
    const result = decideVideoRetentionAction({
      storageObject: storageObject({ status: "upload_pending" }),
      session: session({ status: "created" }),
      now,
    });

    expect(result).toEqual({
      shouldCleanup: false,
      action: "keep",
      reason: "policy_cleanup",
      message: "Arquivo temporário mantido pela política atual.",
    });
  });

  it("creates a not_started cleanup job with default attempts", () => {
    const decision = decideVideoRetentionAction({
      storageObject: uploadedStorage({ expiresAt: "2026-05-14T11:59:00.000Z" }),
      now,
    });
    const job = createVideoCleanupJob({
      id: "cleanup-1",
      storageObject: uploadedStorage(),
      sessionId: "session-1",
      decision,
      createdAt: now,
    });

    expect(job).toEqual({
      id: "cleanup-1",
      storageObjectId: "storage-1",
      sessionId: "session-1",
      status: "not_started",
      action: "delete_temporary_file",
      reason: "expired",
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      message: "Arquivo temporário expirado e elegível para remoção.",
    });
  });

  it("marks cleanup jobs as queued", () => {
    expect(markVideoCleanupJobQueued({ job: cleanupJob(), updatedAt: "2026-05-14T12:05:00.000Z" })).toMatchObject({
      status: "queued",
      updatedAt: "2026-05-14T12:05:00.000Z",
    });
  });

  it("marks cleanup jobs as running and increments attempts", () => {
    expect(markVideoCleanupJobRunning({ job: cleanupJob({ attempts: 1 }), updatedAt: "2026-05-14T12:05:00.000Z" })).toMatchObject({
      status: "running",
      attempts: 2,
      updatedAt: "2026-05-14T12:05:00.000Z",
    });
  });

  it("marks cleanup jobs as completed", () => {
    expect(
      markVideoCleanupJobCompleted({
        job: cleanupJob(),
        completedAt: "2026-05-14T12:10:00.000Z",
        message: "Arquivo temporário marcado como removido.",
      }),
    ).toMatchObject({
      status: "completed",
      updatedAt: "2026-05-14T12:10:00.000Z",
      completedAt: "2026-05-14T12:10:00.000Z",
      message: "Arquivo temporário marcado como removido.",
    });
  });

  it("marks cleanup jobs as failed", () => {
    expect(
      markVideoCleanupJobFailed({
        job: cleanupJob(),
        updatedAt: "2026-05-14T12:10:00.000Z",
        message: "Limpeza será tentada novamente.",
      }),
    ).toMatchObject({
      status: "failed",
      updatedAt: "2026-05-14T12:10:00.000Z",
      message: "Limpeza será tentada novamente.",
    });
  });

  it("allows retry when a failed cleanup job still has attempts left", () => {
    expect(shouldRetryVideoCleanupJob(cleanupJob({ status: "failed", attempts: 1, maxAttempts: 3 }))).toBe(true);
  });

  it("does not allow retry when attempts reached the limit", () => {
    expect(shouldRetryVideoCleanupJob(cleanupJob({ status: "failed", attempts: 3, maxAttempts: 3 }))).toBe(false);
  });

  it("validates a cleanup job", () => {
    expect(validateVideoCleanupJob({ job: cleanupJob() })).toEqual({
      ok: true,
      issues: [],
    });
  });

  it("rejects cleanup jobs without an id", () => {
    expect(issueCodes(cleanupJob({ id: "" }))).toContain("missing_cleanup_job_id");
  });

  it("rejects cleanup jobs without a storage object id", () => {
    expect(issueCodes(cleanupJob({ storageObjectId: "" }))).toContain("missing_storage_object");
  });

  it("rejects unknown cleanup actions", () => {
    const job = {
      ...cleanupJob(),
      action: "unexpected",
    } as unknown as VideoCleanupJob;

    expect(issueCodes(job)).toContain("invalid_cleanup_action");
  });

  it("rejects unknown cleanup statuses", () => {
    const job = {
      ...cleanupJob(),
      status: "unexpected",
    } as unknown as VideoCleanupJob;

    expect(issueCodes(job)).toContain("invalid_status");
  });

  it("rejects queued or running jobs when cleanup is not required", () => {
    expect(issueCodes(cleanupJob({ action: "no_action", status: "queued" }))).toContain("cleanup_not_required");
    expect(issueCodes(cleanupJob({ action: "no_action", status: "running" }))).toContain("cleanup_not_required");
  });

  it("keeps retention and cleanup messages safe", () => {
    const decisions = [
      decideVideoRetentionAction({ storageObject: null, now }),
      decideVideoRetentionAction({ storageObject: storageObject({ status: "deleted" }), now }),
      decideVideoRetentionAction({ storageObject: uploadedStorage({ expiresAt: "2026-05-14T11:59:00.000Z" }), now }),
      decideVideoRetentionAction({ storageObject: storageObject(), now }),
    ];
    const invalidJob = {
      ...cleanupJob({
        id: "",
        storageObjectId: "",
        action: "unexpected",
        status: "unexpected",
      }),
    } as unknown as VideoCleanupJob;
    const messages = [
      ...decisions.map((item) => item.message),
      ...validateVideoCleanupJob({ job: invalidJob }).issues.map((issue) => issue.message),
    ].join(" ").toLowerCase();

    for (const term of forbiddenUserFacingTerms) {
      expect(messages).not.toContain(term);
    }
    expect(messages).not.toContain("erro");
  });

  it("does not import UI, real cleanup, providers, ffmpeg, or product integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "videoStorageRetentionContracts.ts"), "utf8");

    expect(source).toContain("./videoTemporaryStorageTypes");
    expect(source).toContain("./videoUploadSessionContracts");
    expect(source).not.toContain("React");
    expect(source).not.toContain("BoardShell");
    expect(source).not.toContain("PostCreationFunnelBoardShell");
    expect(source).not.toContain("OpenAI");
    expect(source).not.toContain("fetch");
    expect(source).not.toContain("Prisma");
    expect(source).not.toContain("banco");
    expect(source).not.toContain("components/");
    expect(source).not.toContain("hooks/");
    expect(source).not.toContain("endpoint");
    expect(source).not.toContain("upload service real");
    expect(source).not.toContain("storage provider SDK");
    expect(source).not.toContain("ffmpeg");
  });
});
