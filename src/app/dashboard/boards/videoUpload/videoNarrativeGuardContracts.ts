export type VideoNarrativeGuardName =
  | "method"
  | "session"
  | "admin_dev"
  | "feature_flag"
  | "content_type"
  | "payload_size"
  | "payload_schema"
  | "input_source"
  | "mime_duration_size"
  | "consent"
  | "retention"
  | "usage_quota"
  | "observability_start"
  | "provider"
  | "parse_fallback"
  | "seed_generation"
  | "usage_consumption"
  | "observability_completion"
  | "safe_response";

export type VideoNarrativeGuardStatus = "passed" | "blocked" | "skipped";

export type VideoNarrativeGuardBlockCode =
  | "method_not_allowed"
  | "unauthorized"
  | "forbidden"
  | "disabled"
  | "invalid_content_type"
  | "payload_too_large"
  | "invalid_payload"
  | "invalid_source"
  | "invalid_mime_type"
  | "invalid_duration"
  | "invalid_size"
  | "consent_missing"
  | "retention_expired"
  | "usage_limited"
  | "quota_exceeded"
  | "cooldown_active"
  | "observability_unavailable"
  | "provider_unavailable"
  | "parse_failed"
  | "seed_unavailable"
  | "usage_not_consumed"
  | "unsafe_response";

export type VideoNarrativeGuardSeverity = "info" | "warning" | "blocking";

export interface VideoNarrativeGuardResult {
  name: VideoNarrativeGuardName;
  status: VideoNarrativeGuardStatus;
  code: VideoNarrativeGuardBlockCode | null;
  severity: VideoNarrativeGuardSeverity;
  message: string;
  shouldCallProvider: boolean;
  shouldConsumeQuota: boolean;
}

export interface VideoNarrativeGuardPipelineSummary {
  canCallProvider: boolean;
  canConsumeQuota: boolean;
  blockedBy: VideoNarrativeGuardResult | null;
  results: VideoNarrativeGuardResult[];
}

export const VIDEO_NARRATIVE_GUARD_ORDER: VideoNarrativeGuardName[] = [
  "method",
  "session",
  "admin_dev",
  "feature_flag",
  "content_type",
  "payload_size",
  "payload_schema",
  "input_source",
  "mime_duration_size",
  "consent",
  "retention",
  "usage_quota",
  "observability_start",
  "provider",
  "parse_fallback",
  "seed_generation",
  "usage_consumption",
  "observability_completion",
  "safe_response",
];

const PROVIDER_GUARD_INDEX = VIDEO_NARRATIVE_GUARD_ORDER.indexOf("provider");
const QUOTA_DECISION_GUARDS: VideoNarrativeGuardName[] = [
  "provider",
  "parse_fallback",
  "seed_generation",
  "usage_consumption",
  "safe_response",
];

const SAFE_DEFAULT_MESSAGES: Record<VideoNarrativeGuardName, string> = {
  method: "Método validado.",
  session: "Sessão validada.",
  admin_dev: "Acesso interno validado.",
  feature_flag: "Flag server-side validada.",
  content_type: "Content-type validado.",
  payload_size: "Tamanho do payload validado.",
  payload_schema: "Payload validado.",
  input_source: "Origem do vídeo validada.",
  mime_duration_size: "Formato, duração e tamanho validados.",
  consent: "Consentimento validado.",
  retention: "Retenção validada.",
  usage_quota: "Uso e quota validados.",
  observability_start: "Observabilidade inicial validada.",
  provider: "Provider validado.",
  parse_fallback: "Parse e fallback validados.",
  seed_generation: "Seed validado.",
  usage_consumption: "Consumo de quota validado.",
  observability_completion: "Observabilidade final validada.",
  safe_response: "Resposta segura validada.",
};

const BLOCKED_TERMS = [
  "viralizar garantido",
  "treinado permanentemente",
  "resposta correta",
  "garantido",
  "certeza",
  "comprovado",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "gabarito",
  "venceu",
  "perdeu",
];

function getGuardOrderIndex(name: VideoNarrativeGuardName): number {
  return VIDEO_NARRATIVE_GUARD_ORDER.indexOf(name);
}

function getResultForGuard(
  results: VideoNarrativeGuardResult[],
  name: VideoNarrativeGuardName,
): VideoNarrativeGuardResult | undefined {
  return results.find((result) => result.name === name);
}

export function sanitizeVideoNarrativeGuardMessage(message: string): string {
  let sanitized = message;

  sanitized = sanitized.replace(/AIza[0-9A-Za-z_-]{8,}/g, "[redigido]");
  sanitized = sanitized.replace(/\b(?:GEMINI_API_KEY|GOOGLE_GENAI_API_KEY)=\S+/g, "[redigido]");
  sanitized = sanitized.replace(/\b[A-Za-z0-9+/]{120,}={0,2}\b/g, "[redigido]");

  BLOCKED_TERMS.forEach((term) => {
    sanitized = sanitized.replace(new RegExp(term.replace(/\s+/g, "\\s+"), "gi"), "[redigido]");
  });

  return sanitized.trim() || "Guard avaliado.";
}

export function createPassedVideoNarrativeGuardResult(
  name: VideoNarrativeGuardName,
): VideoNarrativeGuardResult {
  return {
    name,
    status: "passed",
    code: null,
    severity: "info",
    message: sanitizeVideoNarrativeGuardMessage(SAFE_DEFAULT_MESSAGES[name]),
    shouldCallProvider: true,
    shouldConsumeQuota: false,
  };
}

export function createBlockedVideoNarrativeGuardResult(params: {
  name: VideoNarrativeGuardName;
  code: VideoNarrativeGuardBlockCode;
  message: string;
  severity?: VideoNarrativeGuardSeverity;
}): VideoNarrativeGuardResult {
  return {
    name: params.name,
    status: "blocked",
    code: params.code,
    severity: params.severity ?? "blocking",
    message: sanitizeVideoNarrativeGuardMessage(params.message),
    shouldCallProvider: false,
    shouldConsumeQuota: false,
  };
}

export function createSkippedVideoNarrativeGuardResult(params: {
  name: VideoNarrativeGuardName;
  message?: string;
}): VideoNarrativeGuardResult {
  return {
    name: params.name,
    status: "skipped",
    code: null,
    severity: "info",
    message: sanitizeVideoNarrativeGuardMessage(params.message ?? "Guard não executado."),
    shouldCallProvider: false,
    shouldConsumeQuota: false,
  };
}

export function isVideoNarrativeGuardBlocking(result: VideoNarrativeGuardResult): boolean {
  return result.status === "blocked" && result.severity === "blocking";
}

export function summarizeVideoNarrativeGuardResults(
  results: VideoNarrativeGuardResult[],
): VideoNarrativeGuardPipelineSummary {
  const blockingResults = results.filter(isVideoNarrativeGuardBlocking);
  const blockedBy =
    blockingResults.sort((left, right) => getGuardOrderIndex(left.name) - getGuardOrderIndex(right.name))[0] ??
    null;

  const hasBlockingBeforeProvider = blockingResults.some(
    (result) => getGuardOrderIndex(result.name) < PROVIDER_GUARD_INDEX,
  );

  const canCallProvider = !hasBlockingBeforeProvider;
  const quotaRelevantBlocked = blockingResults.some((result) =>
    QUOTA_DECISION_GUARDS.includes(result.name),
  );
  const usageConsumption = getResultForGuard(results, "usage_consumption");
  const safeResponse = getResultForGuard(results, "safe_response");
  const provider = getResultForGuard(results, "provider");

  const canConsumeQuota =
    canCallProvider &&
    provider?.status === "passed" &&
    usageConsumption?.status === "passed" &&
    safeResponse?.status === "passed" &&
    !quotaRelevantBlocked;

  return {
    canCallProvider,
    canConsumeQuota,
    blockedBy,
    results,
  };
}

export function shouldVideoNarrativeGuardAllowProviderCall(
  results: VideoNarrativeGuardResult[],
): boolean {
  return summarizeVideoNarrativeGuardResults(results).canCallProvider;
}

export function shouldVideoNarrativeGuardAllowQuotaConsumption(
  results: VideoNarrativeGuardResult[],
): boolean {
  return summarizeVideoNarrativeGuardResults(results).canConsumeQuota;
}
