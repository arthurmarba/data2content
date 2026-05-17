import {
  createBlockedVideoNarrativeGuardResult,
  createPassedVideoNarrativeGuardResult,
  sanitizeVideoNarrativeGuardMessage,
  type VideoNarrativeGuardBlockCode,
  type VideoNarrativeGuardResult,
} from "./videoNarrativeGuardContracts";

export type VideoNarrativeInputSource =
  | "gemini_file_api"
  | "inline_base64"
  | "temporary_storage"
  | "gcs"
  | "s3"
  | "r2"
  | "public_url_restricted";

export type VideoNarrativePayloadMimeType = "video/mp4" | "video/quicktime" | "video/webm";

export interface VideoNarrativeAnalyzePayload {
  id?: unknown;
  creatorQuestion?: unknown;
  videoUri?: unknown;
  inlineVideoBase64?: unknown;
  mimeType?: unknown;
  source?: unknown;
  creatorContext?: unknown;
}

export interface VideoNarrativeCreatorContextPayload {
  handle?: string | null;
  niche?: string | null;
  knownNarratives?: string[];
}

export interface VideoNarrativeNormalizedAnalyzePayload {
  id: string;
  creatorQuestion: string | null;
  videoUri: string | null;
  inlineVideoBase64: string | null;
  mimeType: VideoNarrativePayloadMimeType | null;
  source: VideoNarrativeInputSource;
  creatorContext: VideoNarrativeCreatorContextPayload | null;
}

export interface VideoNarrativePayloadValidationIssue {
  code:
    | "missing_payload"
    | "invalid_id"
    | "invalid_creator_question"
    | "missing_video_input"
    | "conflicting_video_input"
    | "invalid_video_uri"
    | "invalid_inline_base64"
    | "inline_base64_too_large"
    | "invalid_mime_type"
    | "missing_mime_type"
    | "invalid_source"
    | "source_not_allowed"
    | "invalid_creator_context"
    | "creator_context_too_large";
  message: string;
  guardCode: VideoNarrativeGuardBlockCode;
}

export interface VideoNarrativePayloadValidationResult {
  ok: boolean;
  normalized: VideoNarrativeNormalizedAnalyzePayload | null;
  issues: VideoNarrativePayloadValidationIssue[];
  guardResult: VideoNarrativeGuardResult;
}

export const VIDEO_NARRATIVE_ALLOWED_SOURCES: VideoNarrativeInputSource[] = [
  "gemini_file_api",
  "inline_base64",
  "temporary_storage",
  "gcs",
  "s3",
  "r2",
  "public_url_restricted",
];

export const VIDEO_NARRATIVE_ALLOWED_MIME_TYPES: VideoNarrativePayloadMimeType[] = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
];

export const VIDEO_NARRATIVE_MAX_CREATOR_QUESTION_LENGTH = 500;
export const VIDEO_NARRATIVE_MAX_ID_LENGTH = 120;
export const VIDEO_NARRATIVE_MAX_KNOWN_NARRATIVES = 10;
export const VIDEO_NARRATIVE_MAX_KNOWN_NARRATIVE_LENGTH = 160;
export const VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST = 1_500_000;

const DEFAULT_VIDEO_NARRATIVE_ID = "manual-video-narrative-run";
const URI_SOURCES: VideoNarrativeInputSource[] = [
  "gemini_file_api",
  "temporary_storage",
  "gcs",
  "s3",
  "r2",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stripControlCharacters(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, "");
}

function trimAndSanitize(value: string): string {
  const stripped = stripControlCharacters(value).trim();
  return stripped ? sanitizeVideoNarrativePayloadText(stripped).trim() : "";
}

function createIssue(
  code: VideoNarrativePayloadValidationIssue["code"],
  message: string,
  guardCode: VideoNarrativeGuardBlockCode = "invalid_payload",
): VideoNarrativePayloadValidationIssue {
  return {
    code,
    message: trimAndSanitize(message),
    guardCode,
  };
}

function normalizeOptionalText(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const sanitized = trimAndSanitize(value);
  return sanitized.length > 0 ? sanitized : null;
}

function normalizeInlineBase64(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = stripControlCharacters(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function sanitizeVideoNarrativePayloadText(value: string): string {
  return sanitizeVideoNarrativeGuardMessage(stripControlCharacters(value));
}

export function isAllowedVideoNarrativeInputSource(value: unknown): value is VideoNarrativeInputSource {
  return (
    typeof value === "string" &&
    VIDEO_NARRATIVE_ALLOWED_SOURCES.includes(value as VideoNarrativeInputSource)
  );
}

export function isAllowedVideoNarrativeMimeType(value: unknown): value is VideoNarrativePayloadMimeType {
  return (
    typeof value === "string" &&
    VIDEO_NARRATIVE_ALLOWED_MIME_TYPES.includes(value as VideoNarrativePayloadMimeType)
  );
}

export function normalizeVideoNarrativeCreatorQuestion(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const stripped = stripControlCharacters(value).trim();
  if (!stripped || stripped.length > VIDEO_NARRATIVE_MAX_CREATOR_QUESTION_LENGTH) {
    return null;
  }

  return trimAndSanitize(stripped);
}

export function normalizeVideoNarrativeId(value: unknown): string | null {
  if (value === undefined || value === null) {
    return DEFAULT_VIDEO_NARRATIVE_ID;
  }

  if (typeof value !== "string") {
    return null;
  }

  const stripped = stripControlCharacters(value).trim();
  if (!stripped) {
    return DEFAULT_VIDEO_NARRATIVE_ID;
  }

  if (stripped.length > VIDEO_NARRATIVE_MAX_ID_LENGTH) {
    return null;
  }

  return trimAndSanitize(stripped);
}

export function normalizeVideoNarrativeCreatorContext(
  value: unknown,
): VideoNarrativeCreatorContextPayload | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const handle = normalizeOptionalText(value.handle);
  const niche = normalizeOptionalText(value.niche);
  const knownNarratives = Array.isArray(value.knownNarratives)
    ? value.knownNarratives
        .filter((item): item is string => typeof item === "string")
        .map((item) =>
          trimAndSanitize(item.slice(0, VIDEO_NARRATIVE_MAX_KNOWN_NARRATIVE_LENGTH)),
        )
        .filter(Boolean)
    : undefined;

  const context: VideoNarrativeCreatorContextPayload = {
    handle,
    niche,
  };

  if (knownNarratives) {
    context.knownNarratives = knownNarratives.slice(0, VIDEO_NARRATIVE_MAX_KNOWN_NARRATIVES);
  }

  return context;
}

export function validateVideoNarrativeAnalyzePayload(
  payload: unknown,
): VideoNarrativePayloadValidationResult {
  const issues: VideoNarrativePayloadValidationIssue[] = [];

  if (!isRecord(payload)) {
    issues.push(createIssue("missing_payload", "Payload não validado."));

    return {
      ok: false,
      normalized: null,
      issues,
      guardResult: createBlockedVideoNarrativeGuardResult({
        name: "payload_schema",
        code: "invalid_payload",
        message: "Payload não validado.",
      }),
    };
  }

  const id = normalizeVideoNarrativeId(payload.id);
  if (id === null) {
    issues.push(createIssue("invalid_id", "Identificador não validado."));
  }

  const creatorQuestion =
    payload.creatorQuestion === undefined || payload.creatorQuestion === null
      ? null
      : normalizeVideoNarrativeCreatorQuestion(payload.creatorQuestion);
  if (
    payload.creatorQuestion !== undefined &&
    payload.creatorQuestion !== null &&
    (typeof payload.creatorQuestion !== "string" ||
      stripControlCharacters(payload.creatorQuestion).trim().length >
        VIDEO_NARRATIVE_MAX_CREATOR_QUESTION_LENGTH)
  ) {
    issues.push(createIssue("invalid_creator_question", "Pergunta do criador não validada."));
  }

  const source = isAllowedVideoNarrativeInputSource(payload.source) ? payload.source : null;
  if (!source) {
    issues.push(createIssue("invalid_source", "Origem do vídeo não validada.", "invalid_source"));
  } else if (source === "public_url_restricted") {
    issues.push(createIssue("source_not_allowed", "Origem pública restrita não habilitada.", "invalid_source"));
  }

  const videoUri = normalizeOptionalText(payload.videoUri);
  const inlineVideoBase64 = normalizeInlineBase64(payload.inlineVideoBase64);

  if (payload.videoUri !== undefined && payload.videoUri !== null && !videoUri) {
    issues.push(createIssue("invalid_video_uri", "URI do vídeo não validada."));
  }

  if (payload.inlineVideoBase64 !== undefined && payload.inlineVideoBase64 !== null && !inlineVideoBase64) {
    issues.push(createIssue("invalid_inline_base64", "Vídeo inline não validado."));
  }

  if (inlineVideoBase64 && inlineVideoBase64.length > VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST) {
    issues.push(createIssue("inline_base64_too_large", "Vídeo inline acima do limite.", "payload_too_large"));
  }

  if (!videoUri && !inlineVideoBase64) {
    issues.push(createIssue("missing_video_input", "Vídeo não informado."));
  }

  if (videoUri && inlineVideoBase64) {
    issues.push(createIssue("conflicting_video_input", "Informe apenas uma origem de vídeo."));
  }

  let mimeType: VideoNarrativePayloadMimeType | null = null;
  if (inlineVideoBase64 && payload.mimeType === undefined) {
    issues.push(createIssue("missing_mime_type", "Formato de vídeo não informado.", "invalid_mime_type"));
  } else if (payload.mimeType !== undefined && payload.mimeType !== null) {
    if (isAllowedVideoNarrativeMimeType(payload.mimeType)) {
      mimeType = payload.mimeType;
    } else {
      issues.push(createIssue("invalid_mime_type", "Formato de vídeo não aceito.", "invalid_mime_type"));
    }
  }

  if (source === "inline_base64" && !inlineVideoBase64) {
    issues.push(createIssue("missing_video_input", "Vídeo inline não informado."));
  }

  if (source && URI_SOURCES.includes(source) && !videoUri) {
    issues.push(createIssue("missing_video_input", "URI do vídeo não informada."));
  }

  if (inlineVideoBase64 && source && source !== "inline_base64") {
    issues.push(createIssue("invalid_source", "Origem do vídeo não combina com o payload.", "invalid_source"));
  }

  if (videoUri && source === "inline_base64") {
    issues.push(createIssue("invalid_source", "Origem do vídeo não combina com o payload.", "invalid_source"));
  }

  let creatorContext: VideoNarrativeCreatorContextPayload | null = null;
  if (payload.creatorContext !== undefined && payload.creatorContext !== null) {
    if (!isRecord(payload.creatorContext)) {
      issues.push(createIssue("invalid_creator_context", "Contexto do criador não validado."));
    } else {
      const rawContext = payload.creatorContext;
      const hasInvalidTextField =
        (rawContext.handle !== undefined && rawContext.handle !== null && typeof rawContext.handle !== "string") ||
        (rawContext.niche !== undefined && rawContext.niche !== null && typeof rawContext.niche !== "string");
      const hasInvalidNarratives =
        rawContext.knownNarratives !== undefined && !Array.isArray(rawContext.knownNarratives);

      if (hasInvalidTextField || hasInvalidNarratives) {
        issues.push(createIssue("invalid_creator_context", "Contexto do criador não validado."));
      }

      if (
        Array.isArray(rawContext.knownNarratives) &&
        rawContext.knownNarratives.length > VIDEO_NARRATIVE_MAX_KNOWN_NARRATIVES
      ) {
        issues.push(createIssue("creator_context_too_large", "Contexto do criador acima do limite."));
      }

      creatorContext = normalizeVideoNarrativeCreatorContext(rawContext);
    }
  }

  const ok = issues.length === 0;

  return {
    ok,
    normalized:
      ok && id && source
        ? {
            id,
            creatorQuestion,
            videoUri,
            inlineVideoBase64,
            mimeType,
            source,
            creatorContext,
          }
        : null,
    issues,
    guardResult: ok
      ? createPassedVideoNarrativeGuardResult("payload_schema")
      : createBlockedVideoNarrativeGuardResult({
          name: "payload_schema",
          code: "invalid_payload",
          message: "Payload não validado.",
        }),
  };
}
