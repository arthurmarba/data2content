import {
  sanitizeVideoNarrativeGuardMessage,
  type VideoNarrativeGuardPipelineSummary,
} from "./videoNarrativeGuardContracts";
import {
  redactVideoNarrativeObservabilityPayload,
  type VideoNarrativeObservabilityEventPayload,
} from "./videoNarrativeObservabilityEvents";
import type {
  VideoNarrativeQuotaGuardResult,
  VideoNarrativeUsageConsumptionDecision,
} from "./videoNarrativeUsageQuotaGuards";
import type { VideoNarrativeAnalysis } from "./videoNarrativeAnalysisTypes";
import type { PostCreationVideoSeed } from "./videoNarrativePostCreationSeed";

export type VideoNarrativeSafeResponseStatus =
  | "ready"
  | "blocked"
  | "failed"
  | "fallback"
  | "insufficient_context"
  | "usage_limited"
  | "disabled";

export interface VideoNarrativeSafeIssue {
  code: string;
  message: string;
  severity: "info" | "warning" | "blocking";
}

export interface VideoNarrativeSafeGuardSummary {
  canCallProvider: boolean;
  canConsumeQuota: boolean;
  blockedBy: string | null;
  results: Array<{
    name: string;
    status: string;
    code: string | null;
    severity: string;
    message: string;
  }>;
}

export interface VideoNarrativeSafeUsageSummary {
  shouldConsumeQuota: boolean;
  reason: string | null;
  quotaGuardOk: boolean | null;
}

export interface VideoNarrativeSafeObservabilitySummary {
  requestId: string | null;
  events: Array<{
    eventName: string;
    status: string;
    source: string;
    createdAt: string;
  }>;
}

export interface VideoNarrativeReadingSaveSummary {
  attempted: boolean;
  ok: boolean;
  diagnosisId: string | null;
  errorCode: string | null;
  message: string | null;
}

export interface VideoNarrativeReadingPersistenceSummary {
  attempted: boolean;
  saved: boolean;
  diagnosisId?: string;
  skippedReason?: string;
  errorCode?: string;
}

export interface VideoNarrativeSynthesisSnapshotWriteSummary {
  attempted: boolean;
  written: boolean;
  skippedReason?: string | null;
  synthesisStatus?: string | null;
  analyzedReadingsCount?: number | null;
  snapshotId?: string | null;
  updatedAt?: string | null;
}

export interface VideoNarrativeE2EBetaAudit {
  realAnalysis: boolean;
  evidenceAnchorsUsed: boolean;
  cleanupAttempted: boolean;
  usageLimitChecked: boolean;
  allowlistGatePassed: boolean;
}

export interface VideoNarrativeSafeResponse {
  ok: boolean;
  status: VideoNarrativeSafeResponseStatus;
  analysis: VideoNarrativeAnalysis | null;
  seed: PostCreationVideoSeed | null;
  primaryAction: string | null;
  issues: VideoNarrativeSafeIssue[];
  hasRawText: boolean;
  guardSummary: VideoNarrativeSafeGuardSummary | null;
  usageSummary: VideoNarrativeSafeUsageSummary | null;
  observabilitySummary: VideoNarrativeSafeObservabilitySummary | null;
  readingSaveSummary?: VideoNarrativeReadingSaveSummary | null;
  videoReadingPersistence?: VideoNarrativeReadingPersistenceSummary | null;
  synthesisSnapshotWrite?: VideoNarrativeSynthesisSnapshotWriteSummary | null;
  e2eBetaAudit?: VideoNarrativeE2EBetaAudit | null;
}

export interface VideoNarrativeSafeResponseInput {
  status?: VideoNarrativeSafeResponseStatus;
  analysis?: VideoNarrativeAnalysis | null;
  seed?: PostCreationVideoSeed | null;
  primaryAction?: string | null;
  issues?: Array<{
    code?: string | null;
    message?: string | null;
    severity?: "info" | "warning" | "blocking" | null;
  }> | null;
  hasRawText?: boolean | null;
  guardSummary?: VideoNarrativeGuardPipelineSummary | null;
  usageDecision?: VideoNarrativeUsageConsumptionDecision | null;
  quotaGuard?: VideoNarrativeQuotaGuardResult | null;
  observabilityEvents?: VideoNarrativeObservabilityEventPayload[] | null;
  readingSaveSummary?: VideoNarrativeReadingSaveSummary | null;
  videoReadingPersistence?: VideoNarrativeReadingPersistenceSummary | null;
  synthesisSnapshotWrite?: VideoNarrativeSynthesisSnapshotWriteSummary | null;
  e2eBetaAudit?: VideoNarrativeE2EBetaAudit | null;
}

const SAFE_RESPONSE_STATUSES: VideoNarrativeSafeResponseStatus[] = [
  "ready",
  "blocked",
  "failed",
  "fallback",
  "insufficient_context",
  "usage_limited",
  "disabled",
];

const DANGEROUS_KEYS = [
  "rawText",
  "inlineVideoBase64",
  "base64",
  "video",
  "videoUrl",
  "signedUrl",
  "uploadUrl",
  "objectKey",
  "thumbnailUrl",
  "localPath",
  "storageProviderPath",
  "rawTranscript",
  "rawModelResponse",
  "rawGeminiResponse",
  "apiKey",
  "GEMINI_API_KEY",
  "GOOGLE_GENAI_API_KEY",
];

const SIGNED_URL_PATTERN = /\bhttps?:\/\/\S*(?:\?|&)(?:token|signature|sig|X-Amz-Signature|Expires)=\S*/gi;
const API_KEY_PATTERN = /(?:AIza[0-9A-Za-z_-]{8,}|\b(?:GEMINI_API_KEY|GOOGLE_GENAI_API_KEY)=\S+)/;
const BASE64_PATTERN = /\b[A-Za-z0-9+/]{120,}={0,2}\b/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createIssue(params: {
  code: string;
  message: string;
  severity?: "info" | "warning" | "blocking";
}): VideoNarrativeSafeIssue {
  return {
    code: sanitizeVideoNarrativeSafeResponseText(params.code),
    message: sanitizeVideoNarrativeSafeResponseText(params.message),
    severity: params.severity ?? "warning",
  };
}

function normalizeIssue(issue: {
  code?: string | null;
  message?: string | null;
  severity?: "info" | "warning" | "blocking" | null;
}): VideoNarrativeSafeIssue {
  return createIssue({
    code: issue.code?.trim() || "safe_response_issue",
    message: issue.message?.trim() || "Resposta avaliada.",
    severity: issue.severity ?? "warning",
  });
}

function hasBlockingIssue(issues: VideoNarrativeSafeIssue[]): boolean {
  return issues.some((issue) => issue.severity === "blocking");
}

function inferStatus(input: VideoNarrativeSafeResponseInput, issues: VideoNarrativeSafeIssue[]): VideoNarrativeSafeResponseStatus {
  if (input.status) {
    return input.status;
  }

  if (input.guardSummary?.blockedBy) {
    return "blocked";
  }

  if (input.analysis || input.seed) {
    return "ready";
  }

  if (hasBlockingIssue(issues)) {
    return "failed";
  }

  return "failed";
}

function sanitizeDeep<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeVideoNarrativeSafeResponseText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeep(item)) as T;
  }

  if (isRecord(value)) {
    const sanitized: Record<string, unknown> = {};

    Object.entries(value).forEach(([key, nestedValue]) => {
      sanitized[key] = DANGEROUS_KEYS.includes(key) ? "[redigido]" : sanitizeDeep(nestedValue);
    });

    return sanitized as T;
  }

  return value;
}

function buildGuardSummary(
  guardSummary: VideoNarrativeGuardPipelineSummary | null | undefined,
): VideoNarrativeSafeGuardSummary | null {
  if (!guardSummary) {
    return null;
  }

  return {
    canCallProvider: guardSummary.canCallProvider,
    canConsumeQuota: guardSummary.canConsumeQuota,
    blockedBy: guardSummary.blockedBy?.name ?? null,
    results: guardSummary.results.map((result) => ({
      name: result.name,
      status: result.status,
      code: result.code,
      severity: result.severity,
      message: sanitizeVideoNarrativeSafeResponseText(result.message),
    })),
  };
}

function buildUsageSummary(params: {
  usageDecision?: VideoNarrativeUsageConsumptionDecision | null;
  quotaGuard?: VideoNarrativeQuotaGuardResult | null;
}): VideoNarrativeSafeUsageSummary | null {
  if (!params.usageDecision && !params.quotaGuard) {
    return null;
  }

  return {
    shouldConsumeQuota: params.usageDecision?.shouldConsumeQuota ?? false,
    reason: params.usageDecision?.reason ?? null,
    quotaGuardOk: params.quotaGuard?.ok ?? null,
  };
}

function buildObservabilitySummary(
  events: VideoNarrativeObservabilityEventPayload[] | null | undefined,
): VideoNarrativeSafeObservabilitySummary | null {
  if (!events || events.length === 0) {
    return null;
  }

  const redactedEvents = events.map(redactVideoNarrativeObservabilityPayload);

  return {
    requestId: redactedEvents[0]?.requestId ?? null,
    events: redactedEvents.map((event) => ({
      eventName: sanitizeVideoNarrativeSafeResponseText(event.eventName),
      status: sanitizeVideoNarrativeSafeResponseText(event.status),
      source: sanitizeVideoNarrativeSafeResponseText(event.source),
      createdAt: sanitizeVideoNarrativeSafeResponseText(event.createdAt),
    })),
  };
}

function findUnsafePayload(value: unknown, issues: VideoNarrativeSafeIssue[]): void {
  if (typeof value === "string") {
    if (API_KEY_PATTERN.test(value)) {
      issues.push(createIssue({
        code: "unsafe_response",
        message: "Resposta contém credencial.",
        severity: "blocking",
      }));
    }

    if (BASE64_PATTERN.test(value)) {
      issues.push(createIssue({
        code: "unsafe_response",
        message: "Resposta contém base64.",
        severity: "blocking",
      }));
    }

    if (SIGNED_URL_PATTERN.test(value)) {
      issues.push(createIssue({
        code: "unsafe_response",
        message: "Resposta contém URL assinada.",
        severity: "blocking",
      }));
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => findUnsafePayload(item, issues));
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  Object.entries(value).forEach(([key, nestedValue]) => {
    if (DANGEROUS_KEYS.includes(key)) {
      issues.push(createIssue({
        code: "unsafe_response",
        message: `Campo sensível não permitido: ${key}.`,
        severity: "blocking",
      }));
    }

    findUnsafePayload(nestedValue, issues);
  });
}

export function sanitizeVideoNarrativeSafeResponseText(value: string): string {
  const withoutSignedUrls = value.replace(SIGNED_URL_PATTERN, "[redigido]");
  return sanitizeVideoNarrativeGuardMessage(withoutSignedUrls);
}

export function redactVideoNarrativeSafeResponse(
  response: VideoNarrativeSafeResponse,
): VideoNarrativeSafeResponse {
  return sanitizeDeep(response);
}

export function buildVideoNarrativeSafeResponse(
  input: VideoNarrativeSafeResponseInput,
): VideoNarrativeSafeResponse {
  const issues = (input.issues ?? []).map(normalizeIssue);
  const status = inferStatus(input, issues);
  const response: VideoNarrativeSafeResponse = {
    ok: (status === "ready" || status === "fallback") && !hasBlockingIssue(issues),
    status,
    analysis: input.analysis ? sanitizeDeep(input.analysis) : null,
    seed: input.seed ? sanitizeDeep(input.seed) : null,
    primaryAction: input.primaryAction ? sanitizeVideoNarrativeSafeResponseText(input.primaryAction) : null,
    issues,
    hasRawText: input.hasRawText === true,
    guardSummary: buildGuardSummary(input.guardSummary),
    usageSummary: buildUsageSummary({
      usageDecision: input.usageDecision,
      quotaGuard: input.quotaGuard,
    }),
    observabilitySummary: buildObservabilitySummary(input.observabilityEvents),
    readingSaveSummary: input.readingSaveSummary ? sanitizeDeep(input.readingSaveSummary) : null,
    videoReadingPersistence: input.videoReadingPersistence ? sanitizeDeep(input.videoReadingPersistence) : null,
    synthesisSnapshotWrite: input.synthesisSnapshotWrite ? sanitizeDeep(input.synthesisSnapshotWrite) : null,
    e2eBetaAudit: input.e2eBetaAudit ? sanitizeDeep(input.e2eBetaAudit) : null,
  };

  return redactVideoNarrativeSafeResponse(response);
}

export function buildBlockedVideoNarrativeSafeResponse(params: {
  status?: VideoNarrativeSafeResponseStatus;
  issues: VideoNarrativeSafeIssue[];
  guardSummary?: VideoNarrativeGuardPipelineSummary | null;
  observabilityEvents?: VideoNarrativeObservabilityEventPayload[] | null;
}): VideoNarrativeSafeResponse {
  return buildVideoNarrativeSafeResponse({
    status: params.status ?? "blocked",
    issues: params.issues,
    guardSummary: params.guardSummary,
    observabilityEvents: params.observabilityEvents,
  });
}

export function validateVideoNarrativeSafeResponse(response: unknown): {
  ok: boolean;
  issues: VideoNarrativeSafeIssue[];
} {
  const issues: VideoNarrativeSafeIssue[] = [];

  if (!isRecord(response)) {
    return {
      ok: false,
      issues: [
        createIssue({
          code: "invalid_response",
          message: "Resposta não validada.",
          severity: "blocking",
        }),
      ],
    };
  }

  if (!SAFE_RESPONSE_STATUSES.includes(response.status as VideoNarrativeSafeResponseStatus)) {
    issues.push(createIssue({
      code: "invalid_status",
      message: "Status não validado.",
      severity: "blocking",
    }));
  }

  if (Array.isArray(response.issues)) {
    response.issues.forEach((issue) => {
      if (!isRecord(issue) || typeof issue.code !== "string" || typeof issue.message !== "string") {
        issues.push(createIssue({
          code: "invalid_issue",
          message: "Issue não validada.",
          severity: "blocking",
        }));
      }
    });
  } else {
    issues.push(createIssue({
      code: "invalid_issue",
      message: "Issues não validadas.",
      severity: "blocking",
    }));
  }

  findUnsafePayload(response, issues);

  return {
    ok: issues.length === 0,
    issues,
  };
}
