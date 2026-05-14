export type VideoUploadStatus =
  | "draft"
  | "selected"
  | "validated"
  | "rejected"
  | "upload_pending"
  | "uploaded"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

export type VideoUploadSource = "local_file" | "future_url" | "future_instagram_media";

export const SUPPORTED_VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export type VideoMimeType = (typeof SUPPORTED_VIDEO_MIME_TYPES)[number];

export type VideoUploadValidationErrorCode =
  | "file_required"
  | "unsupported_type"
  | "file_too_large"
  | "duration_too_long"
  | "duration_required"
  | "empty_creator_question"
  | "unsafe_filename";

export type VideoUploadLimits = {
  maxDurationSeconds: number;
  maxFileSizeMb: number;
  acceptedMimeTypes: VideoMimeType[];
  requireCreatorQuestion: boolean;
};

export type VideoUploadDraft = {
  id: string;
  source: VideoUploadSource;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  creatorQuestion: string | null;
  createdAt?: string | null;
};

export type VideoUploadValidationError = {
  code: VideoUploadValidationErrorCode;
  message: string;
};

export type VideoUploadValidationResult = {
  ok: boolean;
  errors: VideoUploadValidationError[];
  normalizedDraft: VideoUploadDraft;
};

export type VideoUploadNarrativeSourceBridge = {
  sourceType: "video_upload_future";
  creatorQuestion: string;
  transcript: null;
  visualDescription: null;
  metadata: {
    title: string | null;
    durationSeconds: number | null;
    platform: "unknown";
    format: "short_video" | "long_video" | "unknown";
    campaignContext: null;
  };
};

export const DEFAULT_VIDEO_UPLOAD_LIMITS: VideoUploadLimits = {
  maxDurationSeconds: 60,
  maxFileSizeMb: 100,
  acceptedMimeTypes: [...SUPPORTED_VIDEO_MIME_TYPES],
  requireCreatorQuestion: true,
};

const BYTES_PER_MB = 1024 * 1024;

function normalizeOptionalText(value: string | null): string | null {
  const normalized = value?.trim() || "";
  return normalized || null;
}

function normalizeMimeType(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase() || "";
  return normalized || null;
}

function hasUnsafeFileName(value: string | null): boolean {
  if (!value) return false;
  return /\.\.\/|\.\.\\|[<>|]/.test(value);
}

function validationError(code: VideoUploadValidationErrorCode): VideoUploadValidationError {
  const messages: Record<VideoUploadValidationErrorCode, string> = {
    file_required: "Envie um arquivo de vídeo.",
    unsupported_type: "Formato de vídeo ainda não suportado.",
    file_too_large: "O vídeo ultrapassa o limite de tamanho desta etapa.",
    duration_required: "Informe a duração do vídeo para validar o envio.",
    duration_too_long: "O vídeo ultrapassa o limite de duração desta etapa.",
    empty_creator_question: "Explique em uma frase o que você quer descobrir com esse vídeo.",
    unsafe_filename: "O nome do arquivo contém caracteres não permitidos.",
  };

  return {
    code,
    message: messages[code],
  };
}

export function isSupportedVideoMimeType(value: string): value is VideoMimeType {
  return SUPPORTED_VIDEO_MIME_TYPES.includes(value.trim().toLowerCase() as VideoMimeType);
}

export function createEmptyVideoUploadDraft(params: {
  id: string;
  source?: VideoUploadSource;
  createdAt?: string | null;
}): VideoUploadDraft {
  return {
    id: params.id,
    source: params.source || "local_file",
    fileName: null,
    mimeType: null,
    sizeBytes: null,
    durationSeconds: null,
    creatorQuestion: null,
    createdAt: params.createdAt ?? null,
  };
}

export function validateVideoUploadDraft(
  draft: VideoUploadDraft,
  limits: VideoUploadLimits = DEFAULT_VIDEO_UPLOAD_LIMITS
): VideoUploadValidationResult {
  const normalizedDraft: VideoUploadDraft = {
    ...draft,
    fileName: normalizeOptionalText(draft.fileName),
    mimeType: normalizeMimeType(draft.mimeType),
    creatorQuestion: normalizeOptionalText(draft.creatorQuestion),
  };
  const errors: VideoUploadValidationError[] = [];

  if (!normalizedDraft.fileName || !normalizedDraft.mimeType || normalizedDraft.sizeBytes === null) {
    errors.push(validationError("file_required"));
  }

  if (normalizedDraft.mimeType && !limits.acceptedMimeTypes.includes(normalizedDraft.mimeType as VideoMimeType)) {
    errors.push(validationError("unsupported_type"));
  }

  if (typeof normalizedDraft.sizeBytes === "number" && normalizedDraft.sizeBytes > limits.maxFileSizeMb * BYTES_PER_MB) {
    errors.push(validationError("file_too_large"));
  }

  if (normalizedDraft.durationSeconds === null) {
    errors.push(validationError("duration_required"));
  } else if (normalizedDraft.durationSeconds > limits.maxDurationSeconds) {
    errors.push(validationError("duration_too_long"));
  }

  if (limits.requireCreatorQuestion && !normalizedDraft.creatorQuestion) {
    errors.push(validationError("empty_creator_question"));
  }

  if (hasUnsafeFileName(normalizedDraft.fileName)) {
    errors.push(validationError("unsafe_filename"));
  }

  return {
    ok: errors.length === 0,
    errors,
    normalizedDraft,
  };
}

export function buildNarrativeSourceBridgeFromVideoUpload(
  draft: VideoUploadDraft,
  limits: VideoUploadLimits = DEFAULT_VIDEO_UPLOAD_LIMITS
): VideoUploadNarrativeSourceBridge | null {
  const validation = validateVideoUploadDraft(draft, limits);
  if (!validation.ok) return null;

  const { normalizedDraft } = validation;
  const durationSeconds = normalizedDraft.durationSeconds;

  return {
    sourceType: "video_upload_future",
    creatorQuestion: normalizedDraft.creatorQuestion || "",
    transcript: null,
    visualDescription: null,
    metadata: {
      title: normalizedDraft.fileName,
      durationSeconds,
      platform: "unknown",
      format:
        durationSeconds === null
          ? "unknown"
          : durationSeconds <= 90
            ? "short_video"
            : "long_video",
      campaignContext: null,
    },
  };
}
