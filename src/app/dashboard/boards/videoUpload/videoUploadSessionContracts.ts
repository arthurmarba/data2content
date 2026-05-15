import {
  DEFAULT_VIDEO_UPLOAD_LIMITS,
  VideoUploadDraft,
  validateVideoUploadDraft,
} from "./videoUploadTypes";
import {
  DEFAULT_VIDEO_TEMPORARY_STORAGE_POLICY,
  VideoTemporaryStorageObject,
  VideoTemporaryStoragePolicy,
  VideoTemporaryStorageProvider,
  createEmptyVideoTemporaryStorageObject,
  isTemporaryStorageExpired,
  markTemporaryStorageUploaded,
} from "./videoTemporaryStorageTypes";

export type VideoUploadSessionStatus =
  | "created"
  | "signed_url_ready"
  | "uploading"
  | "uploaded"
  | "aborted"
  | "expired"
  | "failed";

export type VideoUploadSession = {
  id: string;
  draftId: string;
  userId: string | null;
  status: VideoUploadSessionStatus;
  draftSnapshot: VideoUploadDraft;
  storageObject: VideoTemporaryStorageObject;
  signedUploadUrl: string | null;
  signedUploadUrlExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
};

export type VideoUploadSessionIssueCode =
  | "missing_session_id"
  | "missing_draft_id"
  | "missing_user_id"
  | "invalid_draft"
  | "missing_storage_object"
  | "missing_signed_upload_url"
  | "signed_upload_url_expired"
  | "session_expired"
  | "invalid_status";

export type VideoUploadSessionIssue = {
  code: VideoUploadSessionIssueCode;
  message: string;
};

export type VideoUploadSessionValidationResult = {
  ok: boolean;
  issues: VideoUploadSessionIssue[];
};

export type VideoUploadProviderKind = "temporary_storage" | "direct_to_provider_future";

export type VideoUploadProviderCapabilities = {
  provider: VideoTemporaryStorageProvider;
  kind: VideoUploadProviderKind;
  supportsSignedUploadUrl: boolean;
  supportsDelete: boolean;
  supportsMetadata: boolean;
  maxUploadSizeMb: number | null;
};

export type VideoUploadProviderRequest = {
  sessionId: string;
  draft: VideoUploadDraft;
  policy: VideoTemporaryStoragePolicy;
};

export type VideoUploadProviderPreparedResult = {
  ok: boolean;
  storageObject: VideoTemporaryStorageObject | null;
  signedUploadUrl: string | null;
  signedUploadUrlExpiresAt: string | null;
  issues: VideoUploadSessionIssue[];
};

const VALID_VIDEO_UPLOAD_SESSION_STATUSES: VideoUploadSessionStatus[] = [
  "created",
  "signed_url_ready",
  "uploading",
  "uploaded",
  "aborted",
  "expired",
  "failed",
];

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function sessionIssue(code: VideoUploadSessionIssueCode): VideoUploadSessionIssue {
  const messages: Record<VideoUploadSessionIssueCode, string> = {
    missing_session_id: "Sessão sem identificador.",
    missing_draft_id: "Sessão sem vínculo com draft.",
    missing_user_id: "Sessão sem vínculo com usuário.",
    invalid_draft: "Draft de vídeo não validado para upload.",
    missing_storage_object: "Sessão sem objeto temporário.",
    missing_signed_upload_url: "URL temporária de envio ausente.",
    signed_upload_url_expired: "URL temporária de envio expirada.",
    session_expired: "Sessão de upload expirada.",
    invalid_status: "Status de sessão não reconhecido.",
  };

  return {
    code,
    message: messages[code],
  };
}

function isExpiredAt(params: { now: string; expiresAt: string | null }): boolean {
  if (!params.expiresAt) return false;

  const now = new Date(params.now);
  const expiresAt = new Date(params.expiresAt);

  if (!isValidDate(now) || !isValidDate(expiresAt)) return false;

  return now.getTime() >= expiresAt.getTime();
}

export function createVideoUploadSession(params: {
  id: string;
  draft: VideoUploadDraft;
  userId?: string | null;
  createdAt: string;
  expiresAt?: string | null;
  provider?: VideoTemporaryStorageProvider;
}): VideoUploadSession {
  const validation = validateVideoUploadDraft(params.draft);
  const draftSnapshot = validation.normalizedDraft;

  return {
    id: params.id,
    draftId: draftSnapshot.id,
    userId: params.userId ?? null,
    status: "created",
    draftSnapshot,
    storageObject: createEmptyVideoTemporaryStorageObject({
      id: `${params.id}-storage`,
      draftId: draftSnapshot.id,
      provider: params.provider || DEFAULT_VIDEO_TEMPORARY_STORAGE_POLICY.provider,
    }),
    signedUploadUrl: null,
    signedUploadUrlExpiresAt: null,
    createdAt: params.createdAt,
    updatedAt: params.createdAt,
    expiresAt: params.expiresAt ?? null,
  };
}

export function markVideoUploadSessionSigned(params: {
  session: VideoUploadSession;
  signedUploadUrl: string;
  signedUploadUrlExpiresAt: string;
  updatedAt: string;
}): VideoUploadSession {
  return {
    ...params.session,
    status: "signed_url_ready",
    signedUploadUrl: params.signedUploadUrl,
    signedUploadUrlExpiresAt: params.signedUploadUrlExpiresAt,
    updatedAt: params.updatedAt,
  };
}

export function markVideoUploadSessionUploading(params: {
  session: VideoUploadSession;
  updatedAt: string;
}): VideoUploadSession {
  return {
    ...params.session,
    status: "uploading",
    updatedAt: params.updatedAt,
  };
}

export function markVideoUploadSessionUploaded(params: {
  session: VideoUploadSession;
  storageKey: string;
  uploadedAt: string;
  updatedAt: string;
  retentionHours?: number;
}): VideoUploadSession {
  return {
    ...params.session,
    status: "uploaded",
    storageObject: markTemporaryStorageUploaded({
      object: params.session.storageObject,
      storageKey: params.storageKey,
      uploadedAt: params.uploadedAt,
      retentionHours: params.retentionHours,
      signedUrl: null,
      metadata: {
        durationSeconds: params.session.draftSnapshot.durationSeconds,
      },
    }),
    signedUploadUrl: null,
    signedUploadUrlExpiresAt: null,
    updatedAt: params.updatedAt,
  };
}

export function markVideoUploadSessionAborted(params: {
  session: VideoUploadSession;
  updatedAt: string;
}): VideoUploadSession {
  return {
    ...params.session,
    status: "aborted",
    signedUploadUrl: null,
    signedUploadUrlExpiresAt: null,
    updatedAt: params.updatedAt,
  };
}

export function isVideoUploadSessionExpired(params: {
  session: VideoUploadSession;
  now: string;
}): boolean {
  if (isExpiredAt({ now: params.now, expiresAt: params.session.expiresAt })) {
    return true;
  }

  if (
    (params.session.status === "signed_url_ready" || params.session.status === "uploading") &&
    isExpiredAt({
      now: params.now,
      expiresAt: params.session.signedUploadUrlExpiresAt,
    })
  ) {
    return true;
  }

  return false;
}

export function validateVideoUploadSession(params: {
  session: VideoUploadSession;
  now?: string;
  requireUserId?: boolean;
}): VideoUploadSessionValidationResult {
  const session = params.session;
  const now = params.now || new Date().toISOString();
  const issues: VideoUploadSessionIssue[] = [];

  if (!session.id.trim()) {
    issues.push(sessionIssue("missing_session_id"));
  }

  if (!session.draftId.trim()) {
    issues.push(sessionIssue("missing_draft_id"));
  }

  if (params.requireUserId && !session.userId?.trim()) {
    issues.push(sessionIssue("missing_user_id"));
  }

  if (!validateVideoUploadDraft(session.draftSnapshot).ok) {
    issues.push(sessionIssue("invalid_draft"));
  }

  if (!session.storageObject) {
    issues.push(sessionIssue("missing_storage_object"));
  }

  if (!VALID_VIDEO_UPLOAD_SESSION_STATUSES.includes(session.status)) {
    issues.push(sessionIssue("invalid_status"));
  }

  if ((session.status === "signed_url_ready" || session.status === "uploading") && !session.signedUploadUrl) {
    issues.push(sessionIssue("missing_signed_upload_url"));
  }

  if (
    (session.status === "signed_url_ready" || session.status === "uploading") &&
    isTemporaryStorageExpired({
      now,
      expiresAt: session.signedUploadUrlExpiresAt,
    })
  ) {
    issues.push(sessionIssue("signed_upload_url_expired"));
  }

  if (isTemporaryStorageExpired({ now, expiresAt: session.expiresAt })) {
    issues.push(sessionIssue("session_expired"));
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function buildMockProviderCapabilities(
  params: Partial<VideoUploadProviderCapabilities> = {},
): VideoUploadProviderCapabilities {
  return {
    provider: "local_mock",
    kind: "temporary_storage",
    supportsSignedUploadUrl: true,
    supportsDelete: true,
    supportsMetadata: true,
    maxUploadSizeMb: DEFAULT_VIDEO_UPLOAD_LIMITS.maxFileSizeMb,
    ...params,
  };
}

export function buildMockPreparedUploadResult(params: {
  session: VideoUploadSession;
  signedUploadUrl?: string;
  signedUploadUrlExpiresAt?: string;
  storageKey?: string | null;
}): VideoUploadProviderPreparedResult {
  const storageObject: VideoTemporaryStorageObject = {
    ...params.session.storageObject,
    status: "upload_url_requested",
    storageKey: params.storageKey ?? params.session.storageObject.storageKey,
  };
  const issues = params.signedUploadUrl ? [] : [sessionIssue("missing_signed_upload_url")];

  return {
    ok: issues.length === 0,
    storageObject,
    signedUploadUrl: params.signedUploadUrl ?? null,
    signedUploadUrlExpiresAt: params.signedUploadUrlExpiresAt ?? null,
    issues,
  };
}
