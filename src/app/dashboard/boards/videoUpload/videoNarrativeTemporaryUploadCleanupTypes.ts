export type VideoNarrativeTemporaryUploadCleanupReason =
  | "analysis_completed"
  | "analysis_failed"
  | "user_cancelled"
  | "expired";

export type VideoNarrativeTemporaryUploadCleanupPayload = {
  uploadSessionId: string;
  objectKey?: string;
  reason: VideoNarrativeTemporaryUploadCleanupReason;
};

export type VideoNarrativeTemporaryUploadCleanupStatus =
  | "cleanup_queued"
  | "cleanup_not_configured"
  | "cleanup_rejected";

export type VideoNarrativeTemporaryUploadCleanupResult = {
  ok: boolean;
  status: VideoNarrativeTemporaryUploadCleanupStatus;
  message?: string;
};

const VALID_REASONS = new Set<VideoNarrativeTemporaryUploadCleanupReason>([
  "analysis_completed",
  "analysis_failed",
  "user_cancelled",
  "expired",
]);

const SESSION_ID_PATTERN = /^video-temp-upload-session-[a-zA-Z0-9_-]+$/;
const OBJECT_KEY_PATTERN = /^temporary\/video-narrative\/[a-f0-9]{16}\/video-temp-upload-session-[a-zA-Z0-9_-]+\.(mp4|mov|webm)$/;

export function isVideoNarrativeTemporaryUploadCleanupReason(
  value: unknown,
): value is VideoNarrativeTemporaryUploadCleanupReason {
  return typeof value === "string" && VALID_REASONS.has(value as VideoNarrativeTemporaryUploadCleanupReason);
}

export function validateVideoNarrativeTemporaryUploadCleanupPayload(
  input: unknown,
): { ok: true; payload: VideoNarrativeTemporaryUploadCleanupPayload } | { ok: false; message: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, message: "Payload inválido." };
  }

  const body = input as Record<string, unknown>;
  for (const forbidden of ["uploadUrl", "signedUrl", "url", "bucket", "publicBucket", "storageSecret"]) {
    if (forbidden in body) {
      return { ok: false, message: `Regra de segurança: o campo '${forbidden}' não é permitido nesta rota.` };
    }
  }

  if (typeof body.uploadSessionId !== "string" || !SESSION_ID_PATTERN.test(body.uploadSessionId)) {
    return { ok: false, message: "uploadSessionId inválido." };
  }

  if (!isVideoNarrativeTemporaryUploadCleanupReason(body.reason)) {
    return { ok: false, message: "Motivo de cleanup inválido." };
  }

  if (body.objectKey !== undefined) {
    if (typeof body.objectKey !== "string" || !OBJECT_KEY_PATTERN.test(body.objectKey)) {
      return { ok: false, message: "objectKey inválido." };
    }
  }

  return {
    ok: true,
    payload: {
      uploadSessionId: body.uploadSessionId,
      objectKey: typeof body.objectKey === "string" ? body.objectKey : undefined,
      reason: body.reason,
    },
  };
}
