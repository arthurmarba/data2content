import {
  VideoTemporaryStorageObject,
  isTemporaryStorageExpired,
} from "./videoTemporaryStorageTypes";
import { VideoUploadSession } from "./videoUploadSessionContracts";

export type VideoRetentionReason =
  | "expired"
  | "processed"
  | "failed"
  | "aborted"
  | "manual_request"
  | "policy_cleanup"
  | "unknown";

export type VideoRetentionAction =
  | "keep"
  | "delete_temporary_file"
  | "mark_expired"
  | "mark_deleted"
  | "no_action";

export type VideoRetentionDecision = {
  shouldCleanup: boolean;
  action: VideoRetentionAction;
  reason: VideoRetentionReason;
  message: string;
};

export type VideoCleanupJobStatus =
  | "not_started"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export type VideoCleanupJob = {
  id: string;
  storageObjectId: string;
  sessionId: string | null;
  status: VideoCleanupJobStatus;
  action: VideoRetentionAction;
  reason: VideoRetentionReason;
  attempts: number;
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  message: string | null;
};

export type VideoRetentionPolicy = {
  deleteAfterProcessing: boolean;
  deleteFailedUploadsAfterHours: number;
  deleteAbortedUploadsAfterHours: number;
  deleteExpiredObjects: boolean;
  keepArtifactsAfterVideoDeletion: boolean;
  maxCleanupAttempts: number;
};

export type VideoRetentionIssueCode =
  | "missing_storage_object"
  | "missing_cleanup_job_id"
  | "invalid_cleanup_action"
  | "max_attempts_reached"
  | "cleanup_not_required"
  | "invalid_status";

export type VideoRetentionIssue = {
  code: VideoRetentionIssueCode;
  message: string;
};

export type VideoCleanupValidationResult = {
  ok: boolean;
  issues: VideoRetentionIssue[];
};

export const DEFAULT_VIDEO_RETENTION_POLICY: VideoRetentionPolicy = {
  deleteAfterProcessing: true,
  deleteFailedUploadsAfterHours: 24,
  deleteAbortedUploadsAfterHours: 24,
  deleteExpiredObjects: true,
  keepArtifactsAfterVideoDeletion: true,
  maxCleanupAttempts: 3,
};

const VALID_RETENTION_ACTIONS: VideoRetentionAction[] = [
  "keep",
  "delete_temporary_file",
  "mark_expired",
  "mark_deleted",
  "no_action",
];

const VALID_CLEANUP_STATUSES: VideoCleanupJobStatus[] = [
  "not_started",
  "queued",
  "running",
  "completed",
  "failed",
  "skipped",
];

function retentionIssue(code: VideoRetentionIssueCode): VideoRetentionIssue {
  const messages: Record<VideoRetentionIssueCode, string> = {
    missing_storage_object: "Job de limpeza sem arquivo temporário.",
    missing_cleanup_job_id: "Job de limpeza sem identificador.",
    invalid_cleanup_action: "Ação de limpeza não reconhecida.",
    max_attempts_reached: "Limite de tentativas de limpeza atingido.",
    cleanup_not_required: "Limpeza não necessária para este job.",
    invalid_status: "Status de limpeza não reconhecido.",
  };

  return {
    code,
    message: messages[code],
  };
}

function decision(params: {
  shouldCleanup: boolean;
  action: VideoRetentionAction;
  reason: VideoRetentionReason;
  message: string;
}): VideoRetentionDecision {
  return params;
}

function ageIsAtLeastHours(params: { since: string | null; now: string; hours: number }): boolean {
  if (!params.since || params.hours <= 0) return false;

  const since = new Date(params.since);
  const now = new Date(params.now);

  if (Number.isNaN(since.getTime()) || Number.isNaN(now.getTime())) return false;

  return now.getTime() - since.getTime() >= params.hours * 60 * 60 * 1000;
}

export function decideVideoRetentionAction(params: {
  storageObject: VideoTemporaryStorageObject | null;
  session?: VideoUploadSession | null;
  policy?: VideoRetentionPolicy;
  now: string;
}): VideoRetentionDecision {
  const policy = params.policy || DEFAULT_VIDEO_RETENTION_POLICY;
  const storageObject = params.storageObject;
  const session = params.session || null;

  if (!storageObject) {
    return decision({
      shouldCleanup: false,
      action: "no_action",
      reason: "unknown",
      message: "Nenhum arquivo temporário para avaliar.",
    });
  }

  if (storageObject.status === "deleted") {
    return decision({
      shouldCleanup: false,
      action: "no_action",
      reason: "policy_cleanup",
      message: "Arquivo temporário já marcado como removido.",
    });
  }

  if (
    policy.deleteExpiredObjects &&
    isTemporaryStorageExpired({
      now: params.now,
      expiresAt: storageObject.expiresAt,
    })
  ) {
    return decision({
      shouldCleanup: true,
      action: "delete_temporary_file",
      reason: "expired",
      message: "Arquivo temporário expirado e elegível para remoção.",
    });
  }

  if (
    policy.deleteAfterProcessing &&
    session?.status === "uploaded" &&
    (storageObject.status === "processing_locked" || storageObject.status === "uploaded")
  ) {
    return decision({
      shouldCleanup: true,
      action: "delete_temporary_file",
      reason: "processed",
      message: "Arquivo temporário elegível para remoção após processamento.",
    });
  }

  if (
    session?.status === "aborted" &&
    ageIsAtLeastHours({
      since: session.updatedAt,
      now: params.now,
      hours: policy.deleteAbortedUploadsAfterHours,
    })
  ) {
    return decision({
      shouldCleanup: true,
      action: "delete_temporary_file",
      reason: "aborted",
      message: "Upload interrompido elegível para remoção.",
    });
  }

  if (
    session?.status === "failed" &&
    ageIsAtLeastHours({
      since: session.updatedAt,
      now: params.now,
      hours: policy.deleteFailedUploadsAfterHours,
    })
  ) {
    return decision({
      shouldCleanup: true,
      action: "delete_temporary_file",
      reason: "failed",
      message: "Upload interrompido elegível para remoção.",
    });
  }

  return decision({
    shouldCleanup: false,
    action: "keep",
    reason: "policy_cleanup",
    message: "Arquivo temporário mantido pela política atual.",
  });
}

export function createVideoCleanupJob(params: {
  id: string;
  storageObject: VideoTemporaryStorageObject;
  sessionId?: string | null;
  decision: VideoRetentionDecision;
  createdAt: string;
  maxAttempts?: number;
}): VideoCleanupJob {
  return {
    id: params.id,
    storageObjectId: params.storageObject.id,
    sessionId: params.sessionId ?? null,
    status: "not_started",
    action: params.decision.action,
    reason: params.decision.reason,
    attempts: 0,
    maxAttempts: params.maxAttempts ?? DEFAULT_VIDEO_RETENTION_POLICY.maxCleanupAttempts,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
    completedAt: null,
    message: params.decision.message,
  };
}

export function markVideoCleanupJobQueued(params: {
  job: VideoCleanupJob;
  updatedAt: string;
}): VideoCleanupJob {
  return {
    ...params.job,
    status: "queued",
    updatedAt: params.updatedAt,
  };
}

export function markVideoCleanupJobRunning(params: {
  job: VideoCleanupJob;
  updatedAt: string;
}): VideoCleanupJob {
  return {
    ...params.job,
    status: "running",
    attempts: params.job.attempts + 1,
    updatedAt: params.updatedAt,
  };
}

export function markVideoCleanupJobCompleted(params: {
  job: VideoCleanupJob;
  completedAt: string;
  message?: string | null;
}): VideoCleanupJob {
  return {
    ...params.job,
    status: "completed",
    updatedAt: params.completedAt,
    completedAt: params.completedAt,
    message: params.message ?? params.job.message,
  };
}

export function markVideoCleanupJobFailed(params: {
  job: VideoCleanupJob;
  updatedAt: string;
  message?: string | null;
}): VideoCleanupJob {
  return {
    ...params.job,
    status: "failed",
    updatedAt: params.updatedAt,
    message: params.message ?? params.job.message,
  };
}

export function shouldRetryVideoCleanupJob(job: VideoCleanupJob): boolean {
  return job.status === "failed" && job.attempts < job.maxAttempts;
}

export function validateVideoCleanupJob(params: {
  job: VideoCleanupJob;
}): VideoCleanupValidationResult {
  const job = params.job;
  const issues: VideoRetentionIssue[] = [];

  if (!job.id.trim()) {
    issues.push(retentionIssue("missing_cleanup_job_id"));
  }

  if (!job.storageObjectId.trim()) {
    issues.push(retentionIssue("missing_storage_object"));
  }

  if (!VALID_RETENTION_ACTIONS.includes(job.action)) {
    issues.push(retentionIssue("invalid_cleanup_action"));
  }

  if (!VALID_CLEANUP_STATUSES.includes(job.status)) {
    issues.push(retentionIssue("invalid_status"));
  }

  if (job.status === "failed" && job.attempts >= job.maxAttempts) {
    issues.push(retentionIssue("max_attempts_reached"));
  }

  if ((job.status === "queued" || job.status === "running") && job.action === "no_action") {
    issues.push(retentionIssue("cleanup_not_required"));
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
