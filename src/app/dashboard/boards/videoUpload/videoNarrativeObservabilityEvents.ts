import { sanitizeVideoNarrativeGuardMessage } from "./videoNarrativeGuardContracts";
import type { VideoNarrativeInputSource } from "./videoNarrativePayloadValidation";
import type { VideoNarrativeInputSourcePhase } from "./videoNarrativeInputSourceGuards";
import type { VideoNarrativeUsageConsumptionDecision } from "./videoNarrativeUsageQuotaGuards";

export type VideoNarrativeObservabilityEventName =
  | "video_narrative_analysis_requested"
  | "video_narrative_analysis_started"
  | "video_narrative_analysis_completed"
  | "video_narrative_analysis_failed"
  | "video_narrative_analysis_fallback_used"
  | "video_narrative_seed_created"
  | "video_narrative_usage_consumed"
  | "video_narrative_usage_not_consumed"
  | "video_narrative_limit_reached";

export type VideoNarrativeObservabilityStatus =
  | "requested"
  | "started"
  | "completed"
  | "failed"
  | "blocked"
  | "fallback"
  | "consumed"
  | "not_consumed";

export type VideoNarrativeObservabilitySource = VideoNarrativeInputSourcePhase;

export interface VideoNarrativeObservabilityEventPayload {
  requestId: string;
  eventName: VideoNarrativeObservabilityEventName;
  status: VideoNarrativeObservabilityStatus;
  source: VideoNarrativeObservabilitySource;
  createdAt: string;
  userId?: string | null;
  accountId?: string | null;
  model?: string | null;
  providerStatus?: string | null;
  inputSource?: VideoNarrativeInputSource | string | null;
  mimeType?: string | null;
  durationBucket?: string | null;
  sizeBucket?: string | null;
  latencyMs?: number | null;
  hasRawText?: boolean | null;
  fallbackUsed?: boolean | null;
  schemaParseOk?: boolean | null;
  quotaConsumed?: boolean | null;
  usageReason?: VideoNarrativeUsageConsumptionDecision["reason"] | string | null;
  guardBlockedBy?: string | null;
  primaryAction?: string | null;
  hasUsefulSeed?: boolean | null;
  issuesCount?: number | null;
  estimatedCost?: number | null;
  costCurrency?: string | null;
}

export interface VideoNarrativeObservabilityEventBuildInput {
  requestId?: string | null;
  eventName: VideoNarrativeObservabilityEventName;
  status: VideoNarrativeObservabilityStatus;
  source: VideoNarrativeObservabilitySource;
  createdAt?: string | null;
  userId?: string | null;
  accountId?: string | null;
  model?: string | null;
  providerStatus?: string | null;
  inputSource?: VideoNarrativeInputSource | string | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
  latencyMs?: number | null;
  hasRawText?: boolean | null;
  fallbackUsed?: boolean | null;
  schemaParseOk?: boolean | null;
  quotaConsumed?: boolean | null;
  usageReason?: VideoNarrativeUsageConsumptionDecision["reason"] | string | null;
  guardBlockedBy?: string | null;
  primaryAction?: string | null;
  hasUsefulSeed?: boolean | null;
  issuesCount?: number | null;
  estimatedCost?: number | null;
  costCurrency?: string | null;
}

export interface VideoNarrativeObservabilityValidationIssue {
  code:
    | "missing_request_id"
    | "invalid_event_name"
    | "invalid_status"
    | "invalid_source"
    | "invalid_created_at"
    | "unsafe_payload"
    | "invalid_latency"
    | "invalid_cost";
  message: string;
}

export interface VideoNarrativeObservabilityValidationResult {
  ok: boolean;
  event: VideoNarrativeObservabilityEventPayload | null;
  issues: VideoNarrativeObservabilityValidationIssue[];
}

export const VIDEO_NARRATIVE_OBSERVABILITY_EVENT_NAMES: VideoNarrativeObservabilityEventName[] = [
  "video_narrative_analysis_requested",
  "video_narrative_analysis_started",
  "video_narrative_analysis_completed",
  "video_narrative_analysis_failed",
  "video_narrative_analysis_fallback_used",
  "video_narrative_seed_created",
  "video_narrative_usage_consumed",
  "video_narrative_usage_not_consumed",
  "video_narrative_limit_reached",
];

export const VIDEO_NARRATIVE_OBSERVABILITY_STATUSES: VideoNarrativeObservabilityStatus[] = [
  "requested",
  "started",
  "completed",
  "failed",
  "blocked",
  "fallback",
  "consumed",
  "not_consumed",
];

export const VIDEO_NARRATIVE_OBSERVABILITY_SOURCES: VideoNarrativeObservabilitySource[] = [
  "manual_real_test",
  "internal_endpoint",
  "closed_beta",
  "production",
];

const UNSAFE_PAYLOAD_KEYS = [
  "rawText",
  "inlineVideoBase64",
  "base64",
  "video",
  "videoUrl",
  "signedUrl",
  "apiKey",
  "GEMINI_API_KEY",
  "GOOGLE_GENAI_API_KEY",
];

const SIGNED_URL_PATTERN = /\bhttps?:\/\/\S*(?:\?|&)(?:token|signature|sig|X-Amz-Signature|Expires)=\S*/gi;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createIssue(
  code: VideoNarrativeObservabilityValidationIssue["code"],
  message: string,
): VideoNarrativeObservabilityValidationIssue {
  return {
    code,
    message: sanitizeVideoNarrativeObservabilityText(message),
  };
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const sanitized = sanitizeVideoNarrativeObservabilityText(value).trim();
  return sanitized.length > 0 ? sanitized : null;
}

function isValidIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function hasUnsafePayloadKey(value: Record<string, unknown>): boolean {
  return UNSAFE_PAYLOAD_KEYS.some((key) => Object.prototype.hasOwnProperty.call(value, key));
}

export function createVideoNarrativeRequestId(prefix?: string): string {
  const safePrefix = prefix ? sanitizeVideoNarrativeObservabilityText(prefix).trim() : "";
  return safePrefix ? `${safePrefix}-video-narrative-request` : "video-narrative-request";
}

export function bucketVideoNarrativeDuration(durationSeconds?: number | null): string | null {
  if (typeof durationSeconds !== "number" || !Number.isFinite(durationSeconds) || durationSeconds < 0) {
    return null;
  }

  if (durationSeconds <= 15) {
    return "0-15s";
  }

  if (durationSeconds <= 30) {
    return "16-30s";
  }

  if (durationSeconds <= 60) {
    return "31-60s";
  }

  if (durationSeconds <= 120) {
    return "61-120s";
  }

  return "over-120s";
}

export function bucketVideoNarrativeSize(sizeBytes?: number | null): string | null {
  if (typeof sizeBytes !== "number" || !Number.isFinite(sizeBytes) || sizeBytes < 0) {
    return null;
  }

  const mb = 1024 * 1024;

  if (sizeBytes <= 10 * mb) {
    return "0-10mb";
  }

  if (sizeBytes <= 50 * mb) {
    return "10-50mb";
  }

  if (sizeBytes <= 100 * mb) {
    return "50-100mb";
  }

  return "over-100mb";
}

export function sanitizeVideoNarrativeObservabilityText(value: string): string {
  const withoutSignedUrls = value.replace(SIGNED_URL_PATTERN, "[redigido]");
  return sanitizeVideoNarrativeGuardMessage(withoutSignedUrls);
}

export function isVideoNarrativeObservabilityEventName(
  value: unknown,
): value is VideoNarrativeObservabilityEventName {
  return (
    typeof value === "string" &&
    VIDEO_NARRATIVE_OBSERVABILITY_EVENT_NAMES.includes(value as VideoNarrativeObservabilityEventName)
  );
}

export function isVideoNarrativeObservabilityStatus(
  value: unknown,
): value is VideoNarrativeObservabilityStatus {
  return (
    typeof value === "string" &&
    VIDEO_NARRATIVE_OBSERVABILITY_STATUSES.includes(value as VideoNarrativeObservabilityStatus)
  );
}

export function isVideoNarrativeObservabilitySource(
  value: unknown,
): value is VideoNarrativeObservabilitySource {
  return (
    typeof value === "string" &&
    VIDEO_NARRATIVE_OBSERVABILITY_SOURCES.includes(value as VideoNarrativeObservabilitySource)
  );
}

export function redactVideoNarrativeObservabilityPayload(
  event: VideoNarrativeObservabilityEventPayload,
): VideoNarrativeObservabilityEventPayload {
  return {
    ...event,
    requestId: sanitizeVideoNarrativeObservabilityText(event.requestId),
    createdAt: sanitizeVideoNarrativeObservabilityText(event.createdAt),
    userId: normalizeOptionalText(event.userId),
    accountId: normalizeOptionalText(event.accountId),
    model: normalizeOptionalText(event.model),
    providerStatus: normalizeOptionalText(event.providerStatus),
    inputSource: normalizeOptionalText(event.inputSource),
    mimeType: normalizeOptionalText(event.mimeType),
    durationBucket: normalizeOptionalText(event.durationBucket),
    sizeBucket: normalizeOptionalText(event.sizeBucket),
    usageReason: normalizeOptionalText(event.usageReason),
    guardBlockedBy: normalizeOptionalText(event.guardBlockedBy),
    primaryAction: normalizeOptionalText(event.primaryAction),
    costCurrency: normalizeOptionalText(event.costCurrency),
  };
}

export function buildVideoNarrativeObservabilityEvent(
  input: VideoNarrativeObservabilityEventBuildInput,
): VideoNarrativeObservabilityValidationResult {
  const requestId = normalizeOptionalText(input.requestId) ?? createVideoNarrativeRequestId();
  const createdAt = normalizeOptionalText(input.createdAt) ?? new Date(0).toISOString();
  const issues: VideoNarrativeObservabilityValidationIssue[] = [];

  if (!requestId) {
    issues.push(createIssue("missing_request_id", "RequestId não informado."));
  }

  if (!isVideoNarrativeObservabilityEventName(input.eventName)) {
    issues.push(createIssue("invalid_event_name", "Evento não validado."));
  }

  if (!isVideoNarrativeObservabilityStatus(input.status)) {
    issues.push(createIssue("invalid_status", "Status não validado."));
  }

  if (!isVideoNarrativeObservabilitySource(input.source)) {
    issues.push(createIssue("invalid_source", "Origem não validada."));
  }

  if (!isValidIsoDate(createdAt)) {
    issues.push(createIssue("invalid_created_at", "Data do evento não validada."));
  }

  if (typeof input.latencyMs === "number" && input.latencyMs < 0) {
    issues.push(createIssue("invalid_latency", "Latência não validada."));
  }

  if (typeof input.estimatedCost === "number" && input.estimatedCost < 0) {
    issues.push(createIssue("invalid_cost", "Custo não validado."));
  }

  if (typeof input.issuesCount === "number" && input.issuesCount < 0) {
    issues.push(createIssue("unsafe_payload", "Quantidade de issues não validada."));
  }

  const event: VideoNarrativeObservabilityEventPayload = redactVideoNarrativeObservabilityPayload({
    requestId,
    eventName: input.eventName,
    status: input.status,
    source: input.source,
    createdAt,
    userId: input.userId,
    accountId: input.accountId,
    model: input.model,
    providerStatus: input.providerStatus,
    inputSource: input.inputSource,
    mimeType: input.mimeType,
    durationBucket: bucketVideoNarrativeDuration(input.durationSeconds),
    sizeBucket: bucketVideoNarrativeSize(input.sizeBytes),
    latencyMs: input.latencyMs ?? null,
    hasRawText: input.hasRawText ?? null,
    fallbackUsed: input.fallbackUsed ?? null,
    schemaParseOk: input.schemaParseOk ?? null,
    quotaConsumed: input.quotaConsumed ?? null,
    usageReason: input.usageReason,
    guardBlockedBy: input.guardBlockedBy,
    primaryAction: input.primaryAction,
    hasUsefulSeed: input.hasUsefulSeed ?? null,
    issuesCount: typeof input.issuesCount === "number" && input.issuesCount >= 0 ? input.issuesCount : null,
    estimatedCost: input.estimatedCost ?? null,
    costCurrency: input.costCurrency,
  });

  const validation = validateVideoNarrativeObservabilityEvent(event);
  const allIssues = [...issues, ...validation.issues];

  return {
    ok: allIssues.length === 0,
    event: allIssues.length === 0 ? event : null,
    issues: allIssues,
  };
}

export function validateVideoNarrativeObservabilityEvent(
  event: unknown,
): VideoNarrativeObservabilityValidationResult {
  if (!isRecord(event)) {
    return {
      ok: false,
      event: null,
      issues: [createIssue("unsafe_payload", "Evento não validado.")],
    };
  }

  const issues: VideoNarrativeObservabilityValidationIssue[] = [];

  if (hasUnsafePayloadKey(event)) {
    issues.push(createIssue("unsafe_payload", "Payload contém campo sensível."));
  }

  if (typeof event.requestId !== "string" || event.requestId.trim().length === 0) {
    issues.push(createIssue("missing_request_id", "RequestId não informado."));
  }

  if (!isVideoNarrativeObservabilityEventName(event.eventName)) {
    issues.push(createIssue("invalid_event_name", "Evento não validado."));
  }

  if (!isVideoNarrativeObservabilityStatus(event.status)) {
    issues.push(createIssue("invalid_status", "Status não validado."));
  }

  if (!isVideoNarrativeObservabilitySource(event.source)) {
    issues.push(createIssue("invalid_source", "Origem não validada."));
  }

  if (typeof event.createdAt !== "string" || !isValidIsoDate(event.createdAt)) {
    issues.push(createIssue("invalid_created_at", "Data do evento não validada."));
  }

  if (typeof event.latencyMs === "number" && event.latencyMs < 0) {
    issues.push(createIssue("invalid_latency", "Latência não validada."));
  }

  if (typeof event.estimatedCost === "number" && event.estimatedCost < 0) {
    issues.push(createIssue("invalid_cost", "Custo não validado."));
  }

  if (issues.length > 0) {
    return {
      ok: false,
      event: null,
      issues,
    };
  }

  const validEvent: VideoNarrativeObservabilityEventPayload = {
    requestId: event.requestId as string,
    eventName: event.eventName as VideoNarrativeObservabilityEventName,
    status: event.status as VideoNarrativeObservabilityStatus,
    source: event.source as VideoNarrativeObservabilitySource,
    createdAt: event.createdAt as string,
    userId: typeof event.userId === "string" ? event.userId : null,
    accountId: typeof event.accountId === "string" ? event.accountId : null,
    model: typeof event.model === "string" ? event.model : null,
    providerStatus: typeof event.providerStatus === "string" ? event.providerStatus : null,
    inputSource: typeof event.inputSource === "string" ? event.inputSource : null,
    mimeType: typeof event.mimeType === "string" ? event.mimeType : null,
    durationBucket: typeof event.durationBucket === "string" ? event.durationBucket : null,
    sizeBucket: typeof event.sizeBucket === "string" ? event.sizeBucket : null,
    latencyMs: typeof event.latencyMs === "number" ? event.latencyMs : null,
    hasRawText: typeof event.hasRawText === "boolean" ? event.hasRawText : null,
    fallbackUsed: typeof event.fallbackUsed === "boolean" ? event.fallbackUsed : null,
    schemaParseOk: typeof event.schemaParseOk === "boolean" ? event.schemaParseOk : null,
    quotaConsumed: typeof event.quotaConsumed === "boolean" ? event.quotaConsumed : null,
    usageReason: typeof event.usageReason === "string" ? event.usageReason : null,
    guardBlockedBy: typeof event.guardBlockedBy === "string" ? event.guardBlockedBy : null,
    primaryAction: typeof event.primaryAction === "string" ? event.primaryAction : null,
    hasUsefulSeed: typeof event.hasUsefulSeed === "boolean" ? event.hasUsefulSeed : null,
    issuesCount: typeof event.issuesCount === "number" ? event.issuesCount : null,
    estimatedCost: typeof event.estimatedCost === "number" ? event.estimatedCost : null,
    costCurrency: typeof event.costCurrency === "string" ? event.costCurrency : null,
  };

  return {
    ok: true,
    event: redactVideoNarrativeObservabilityPayload(validEvent),
    issues: [],
  };
}
