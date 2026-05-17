import {
  createBlockedVideoNarrativeGuardResult,
  createPassedVideoNarrativeGuardResult,
  sanitizeVideoNarrativeGuardMessage,
  type VideoNarrativeGuardResult,
} from "./videoNarrativeGuardContracts";
import {
  VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST,
  type VideoNarrativeInputSource,
  type VideoNarrativeNormalizedAnalyzePayload,
} from "./videoNarrativePayloadValidation";

export type VideoNarrativeInputSourcePhase =
  | "manual_real_test"
  | "internal_endpoint"
  | "closed_beta"
  | "production";

export interface VideoNarrativeInputSourceGuardPolicy {
  phase: VideoNarrativeInputSourcePhase;
  allowGeminiFileApi: boolean;
  allowInlineBase64: boolean;
  allowTemporaryStorage: boolean;
  allowGcs: boolean;
  allowS3: boolean;
  allowR2: boolean;
  allowPublicUrlRestricted: boolean;
  requireVideoUriForRemoteSources: boolean;
  requireMimeTypeForInline: boolean;
  maxInlineBase64Length: number;
}

export interface VideoNarrativeInputSourceGuardIssue {
  code:
    | "source_not_allowed_for_phase"
    | "missing_video_uri_for_source"
    | "missing_inline_payload"
    | "missing_mime_type_for_inline"
    | "inline_base64_too_large_for_phase"
    | "public_url_not_allowed"
    | "source_payload_mismatch";
  message: string;
}

export interface VideoNarrativeInputSourceGuardResult {
  ok: boolean;
  source: VideoNarrativeInputSource;
  phase: VideoNarrativeInputSourcePhase;
  issues: VideoNarrativeInputSourceGuardIssue[];
  guardResult: VideoNarrativeGuardResult;
}

export const VIDEO_NARRATIVE_INPUT_SOURCE_POLICIES: Record<
  VideoNarrativeInputSourcePhase,
  VideoNarrativeInputSourceGuardPolicy
> = {
  manual_real_test: {
    phase: "manual_real_test",
    allowGeminiFileApi: true,
    allowInlineBase64: true,
    allowTemporaryStorage: false,
    allowGcs: false,
    allowS3: false,
    allowR2: false,
    allowPublicUrlRestricted: false,
    requireVideoUriForRemoteSources: true,
    requireMimeTypeForInline: true,
    maxInlineBase64Length: VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST,
  },
  internal_endpoint: {
    phase: "internal_endpoint",
    allowGeminiFileApi: true,
    allowInlineBase64: true,
    allowTemporaryStorage: true,
    allowGcs: true,
    allowS3: true,
    allowR2: true,
    allowPublicUrlRestricted: false,
    requireVideoUriForRemoteSources: true,
    requireMimeTypeForInline: true,
    maxInlineBase64Length: VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST,
  },
  closed_beta: {
    phase: "closed_beta",
    allowGeminiFileApi: false,
    allowInlineBase64: false,
    allowTemporaryStorage: true,
    allowGcs: true,
    allowS3: true,
    allowR2: true,
    allowPublicUrlRestricted: false,
    requireVideoUriForRemoteSources: true,
    requireMimeTypeForInline: true,
    maxInlineBase64Length: 0,
  },
  production: {
    phase: "production",
    allowGeminiFileApi: false,
    allowInlineBase64: false,
    allowTemporaryStorage: true,
    allowGcs: true,
    allowS3: true,
    allowR2: true,
    allowPublicUrlRestricted: false,
    requireVideoUriForRemoteSources: true,
    requireMimeTypeForInline: true,
    maxInlineBase64Length: 0,
  },
};

const REMOTE_VIDEO_URI_SOURCES: VideoNarrativeInputSource[] = [
  "gemini_file_api",
  "temporary_storage",
  "gcs",
  "s3",
  "r2",
  "public_url_restricted",
];

function sanitizeIssueMessage(message: string): string {
  return sanitizeVideoNarrativeGuardMessage(message);
}

function createInputSourceIssue(
  code: VideoNarrativeInputSourceGuardIssue["code"],
  message: string,
): VideoNarrativeInputSourceGuardIssue {
  return {
    code,
    message: sanitizeIssueMessage(message),
  };
}

export function getVideoNarrativeInputSourcePolicy(
  phase: VideoNarrativeInputSourcePhase,
): VideoNarrativeInputSourceGuardPolicy {
  return VIDEO_NARRATIVE_INPUT_SOURCE_POLICIES[phase];
}

export function isVideoNarrativeInputSourceAllowedForPhase(params: {
  source: VideoNarrativeInputSource;
  phase: VideoNarrativeInputSourcePhase;
}): boolean {
  const policy = getVideoNarrativeInputSourcePolicy(params.phase);

  switch (params.source) {
    case "gemini_file_api":
      return policy.allowGeminiFileApi;
    case "inline_base64":
      return policy.allowInlineBase64;
    case "temporary_storage":
      return policy.allowTemporaryStorage;
    case "gcs":
      return policy.allowGcs;
    case "s3":
      return policy.allowS3;
    case "r2":
      return policy.allowR2;
    case "public_url_restricted":
      return policy.allowPublicUrlRestricted;
  }
}

export function requiresVideoNarrativeVideoUri(source: VideoNarrativeInputSource): boolean {
  return REMOTE_VIDEO_URI_SOURCES.includes(source);
}

export function requiresVideoNarrativeInlinePayload(source: VideoNarrativeInputSource): boolean {
  return source === "inline_base64";
}

export function requiresVideoNarrativeMimeTypeForSource(source: VideoNarrativeInputSource): boolean {
  return source === "inline_base64";
}

export function buildVideoNarrativeInputSourceGuardResult(params: {
  ok: boolean;
  source: VideoNarrativeInputSource;
  phase: VideoNarrativeInputSourcePhase;
  issues?: VideoNarrativeInputSourceGuardResult["issues"];
}): VideoNarrativeInputSourceGuardResult {
  const issues = params.issues ?? [];

  return {
    ok: params.ok,
    source: params.source,
    phase: params.phase,
    issues,
    guardResult: params.ok
      ? createPassedVideoNarrativeGuardResult("input_source")
      : createBlockedVideoNarrativeGuardResult({
          name: "input_source",
          code: "invalid_source",
          message: "Origem do vídeo não validada.",
        }),
  };
}

export function validateVideoNarrativeInputSourceForPhase(params: {
  payload: VideoNarrativeNormalizedAnalyzePayload;
  phase: VideoNarrativeInputSourcePhase;
}): VideoNarrativeInputSourceGuardResult {
  const { payload, phase } = params;
  const policy = getVideoNarrativeInputSourcePolicy(phase);
  const issues: VideoNarrativeInputSourceGuardIssue[] = [];

  if (!isVideoNarrativeInputSourceAllowedForPhase({ source: payload.source, phase })) {
    issues.push(
      createInputSourceIssue(
        "source_not_allowed_for_phase",
        "Origem do vídeo não habilitada para esta fase.",
      ),
    );
  }

  if (payload.source === "public_url_restricted") {
    issues.push(
      createInputSourceIssue("public_url_not_allowed", "URL pública restrita não habilitada."),
    );
  }

  if (
    policy.requireVideoUriForRemoteSources &&
    requiresVideoNarrativeVideoUri(payload.source) &&
    !payload.videoUri
  ) {
    issues.push(createInputSourceIssue("missing_video_uri_for_source", "URI do vídeo não informada."));
  }

  if (requiresVideoNarrativeInlinePayload(payload.source) && !payload.inlineVideoBase64) {
    issues.push(createInputSourceIssue("missing_inline_payload", "Vídeo inline não informado."));
  }

  if (
    policy.requireMimeTypeForInline &&
    requiresVideoNarrativeMimeTypeForSource(payload.source) &&
    !payload.mimeType
  ) {
    issues.push(createInputSourceIssue("missing_mime_type_for_inline", "Formato do vídeo não informado."));
  }

  if (
    payload.source === "inline_base64" &&
    payload.inlineVideoBase64 &&
    payload.inlineVideoBase64.length > policy.maxInlineBase64Length
  ) {
    issues.push(
      createInputSourceIssue(
        "inline_base64_too_large_for_phase",
        "Vídeo inline acima do limite desta fase.",
      ),
    );
  }

  if (requiresVideoNarrativeVideoUri(payload.source) && payload.inlineVideoBase64) {
    issues.push(
      createInputSourceIssue(
        "source_payload_mismatch",
        "Origem remota não deve receber payload inline.",
      ),
    );
  }

  if (payload.source === "inline_base64" && payload.videoUri) {
    issues.push(
      createInputSourceIssue(
        "source_payload_mismatch",
        "Origem inline não deve receber URI de vídeo.",
      ),
    );
  }

  return buildVideoNarrativeInputSourceGuardResult({
    ok: issues.length === 0,
    source: payload.source,
    phase,
    issues,
  });
}
