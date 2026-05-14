export type VideoTemporaryStorageProvider =
  | "future_s3"
  | "future_vercel_blob"
  | "future_cloudflare_r2"
  | "future_gcs"
  | "local_mock"
  | "unknown";

export type VideoTemporaryStorageStatus =
  | "not_requested"
  | "upload_url_requested"
  | "upload_pending"
  | "uploaded"
  | "processing_locked"
  | "expired"
  | "deleted"
  | "failed";

export type VideoTemporaryStorageVisibility = "private" | "signed_url_only";

export type VideoTemporaryStoragePolicy = {
  provider: VideoTemporaryStorageProvider;
  maxRetentionHours: number;
  deleteAfterProcessing: boolean;
  visibility: VideoTemporaryStorageVisibility;
  allowPublicAccess: boolean;
};

export type VideoTemporaryStorageObject = {
  id: string;
  draftId: string;
  provider: VideoTemporaryStorageProvider;
  status: VideoTemporaryStorageStatus;
  storageKey: string | null;
  originalFileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  uploadedAt: string | null;
  expiresAt: string | null;
  deletedAt: string | null;
  publicUrl: null;
  signedUrl: string | null;
  metadata: {
    durationSeconds?: number | null;
    checksum?: string | null;
  };
};

export type VideoTemporaryStorageValidationIssueCode =
  | "missing_storage_key"
  | "missing_expiration"
  | "public_access_not_allowed"
  | "expired_object"
  | "missing_draft_id"
  | "invalid_status";

export type VideoTemporaryStorageValidationIssue = {
  code: VideoTemporaryStorageValidationIssueCode;
  message: string;
};

export type VideoTemporaryStorageValidationResult = {
  ok: boolean;
  issues: VideoTemporaryStorageValidationIssue[];
};

export const DEFAULT_VIDEO_TEMPORARY_STORAGE_POLICY: VideoTemporaryStoragePolicy = {
  provider: "unknown",
  maxRetentionHours: 24,
  deleteAfterProcessing: true,
  visibility: "signed_url_only",
  allowPublicAccess: false,
};

const VALID_TEMPORARY_STORAGE_STATUSES: VideoTemporaryStorageStatus[] = [
  "not_requested",
  "upload_url_requested",
  "upload_pending",
  "uploaded",
  "processing_locked",
  "expired",
  "deleted",
  "failed",
];

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function validationIssue(code: VideoTemporaryStorageValidationIssueCode): VideoTemporaryStorageValidationIssue {
  const messages: Record<VideoTemporaryStorageValidationIssueCode, string> = {
    missing_storage_key: "Arquivo temporário sem chave de armazenamento.",
    missing_expiration: "Arquivo temporário sem data de expiração.",
    public_access_not_allowed: "Acesso público não permitido para este arquivo.",
    expired_object: "Arquivo temporário expirado.",
    missing_draft_id: "Objeto sem vínculo com draft.",
    invalid_status: "Status de armazenamento não reconhecido.",
  };

  return {
    code,
    message: messages[code],
  };
}

export function createEmptyVideoTemporaryStorageObject(params: {
  id: string;
  draftId: string;
  provider?: VideoTemporaryStorageProvider;
}): VideoTemporaryStorageObject {
  return {
    id: params.id,
    draftId: params.draftId,
    provider: params.provider || "unknown",
    status: "not_requested",
    storageKey: null,
    originalFileName: null,
    mimeType: null,
    sizeBytes: null,
    uploadedAt: null,
    expiresAt: null,
    deletedAt: null,
    publicUrl: null,
    signedUrl: null,
    metadata: {},
  };
}

export function calculateTemporaryStorageExpiration(params: {
  uploadedAt: string;
  retentionHours?: number;
}): string | null {
  const uploadedAt = new Date(params.uploadedAt);
  const retentionHours = params.retentionHours ?? DEFAULT_VIDEO_TEMPORARY_STORAGE_POLICY.maxRetentionHours;

  if (!isValidDate(uploadedAt) || typeof retentionHours !== "number" || retentionHours <= 0) {
    return null;
  }

  return new Date(uploadedAt.getTime() + retentionHours * 60 * 60 * 1000).toISOString();
}

export function isTemporaryStorageExpired(params: {
  now: string;
  expiresAt: string | null;
}): boolean {
  if (!params.expiresAt) return false;

  const now = new Date(params.now);
  const expiresAt = new Date(params.expiresAt);

  if (!isValidDate(now) || !isValidDate(expiresAt)) return false;

  return now.getTime() >= expiresAt.getTime();
}

export function markTemporaryStorageUploaded(params: {
  object: VideoTemporaryStorageObject;
  storageKey: string;
  uploadedAt: string;
  retentionHours?: number;
  signedUrl?: string | null;
  metadata?: VideoTemporaryStorageObject["metadata"];
}): VideoTemporaryStorageObject {
  return {
    ...params.object,
    status: "uploaded",
    storageKey: params.storageKey,
    uploadedAt: params.uploadedAt,
    expiresAt: calculateTemporaryStorageExpiration({
      uploadedAt: params.uploadedAt,
      retentionHours: params.retentionHours,
    }),
    signedUrl: params.signedUrl ?? params.object.signedUrl,
    metadata: {
      ...params.object.metadata,
      ...params.metadata,
    },
  };
}

export function markTemporaryStorageDeleted(params: {
  object: VideoTemporaryStorageObject;
  deletedAt: string;
}): VideoTemporaryStorageObject {
  return {
    ...params.object,
    status: "deleted",
    deletedAt: params.deletedAt,
    publicUrl: null,
    signedUrl: null,
  };
}

export function validateTemporaryStorageObject(params: {
  object: VideoTemporaryStorageObject;
  policy?: VideoTemporaryStoragePolicy;
  now?: string;
}): VideoTemporaryStorageValidationResult {
  const policy = params.policy || DEFAULT_VIDEO_TEMPORARY_STORAGE_POLICY;
  const object = params.object;
  const issues: VideoTemporaryStorageValidationIssue[] = [];

  if (!object.draftId.trim()) {
    issues.push(validationIssue("missing_draft_id"));
  }

  if (!VALID_TEMPORARY_STORAGE_STATUSES.includes(object.status)) {
    issues.push(validationIssue("invalid_status"));
  }

  if ((object.status === "uploaded" || object.status === "processing_locked") && !object.storageKey) {
    issues.push(validationIssue("missing_storage_key"));
  }

  if ((object.status === "uploaded" || object.status === "processing_locked") && !object.expiresAt) {
    issues.push(validationIssue("missing_expiration"));
  }

  if (object.publicUrl !== null && !policy.allowPublicAccess) {
    issues.push(validationIssue("public_access_not_allowed"));
  }

  if (
    object.expiresAt &&
    isTemporaryStorageExpired({
      now: params.now || new Date().toISOString(),
      expiresAt: object.expiresAt,
    })
  ) {
    issues.push(validationIssue("expired_object"));
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
