import {
  createBlockedVideoNarrativeGuardResult,
  createPassedVideoNarrativeGuardResult,
  sanitizeVideoNarrativeGuardMessage,
  type VideoNarrativeGuardResult,
} from "./videoNarrativeGuardContracts";

export type VideoNarrativeUsagePhase =
  | "manual_real_test"
  | "internal_endpoint"
  | "closed_beta"
  | "production";

export interface VideoNarrativeUsagePolicy {
  phase: VideoNarrativeUsagePhase;
  monthlyLimit: number | null;
  dailyLimit: number | null;
  allowAdminBypass: boolean;
  allowRetryWithoutConsumption: boolean;
  consumeOnUsefulPartialAnalysis: boolean;
  consumeOnProviderFailure: boolean;
  consumeOnFallbackOnly: boolean;
  cooldownMinutesAfterRepeatedFailures: number | null;
}

export interface VideoNarrativeUsageState {
  usedThisMonth?: number | null;
  usedToday?: number | null;
  repeatedFailureCount?: number | null;
  cooldownUntil?: string | null;
  now?: string | null;
  isAdminOrDev?: boolean | null;
}

export interface VideoNarrativeUsageDecisionInput {
  phase: VideoNarrativeUsagePhase;
  usageState?: VideoNarrativeUsageState | null;
  providerWasCalled?: boolean | null;
  providerReturnedUsefulAnalysis?: boolean | null;
  providerReturnedUsefulPartialAnalysis?: boolean | null;
  usedFallbackOnly?: boolean | null;
  failedBeforeProvider?: boolean | null;
  payloadWasInvalid?: boolean | null;
  consentWasMissing?: boolean | null;
  retentionWasExpired?: boolean | null;
  userRequestedManualRetry?: boolean | null;
}

export interface VideoNarrativeUsageIssue {
  code:
    | "usage_limited"
    | "quota_exceeded"
    | "daily_limit_exceeded"
    | "cooldown_active"
    | "usage_state_invalid"
    | "usage_not_consumed"
    | "provider_not_called"
    | "failed_before_provider"
    | "payload_invalid"
    | "consent_missing"
    | "retention_expired";
  message: string;
}

export interface VideoNarrativeQuotaGuardResult {
  ok: boolean;
  phase: VideoNarrativeUsagePhase;
  issues: VideoNarrativeUsageIssue[];
  guardResult: VideoNarrativeGuardResult;
  canAttemptAnalysis: boolean;
}

export interface VideoNarrativeUsageConsumptionDecision {
  shouldConsumeQuota: boolean;
  reason:
    | "useful_analysis"
    | "useful_partial_analysis"
    | "manual_retry"
    | "admin_bypass"
    | "provider_not_called"
    | "failed_before_provider"
    | "payload_invalid"
    | "consent_missing"
    | "retention_expired"
    | "provider_failure"
    | "fallback_only"
    | "quota_blocked"
    | "cooldown_active";
  issues: VideoNarrativeUsageIssue[];
  guardResult: VideoNarrativeGuardResult;
}

export const VIDEO_NARRATIVE_USAGE_POLICIES: Record<
  VideoNarrativeUsagePhase,
  VideoNarrativeUsagePolicy
> = {
  manual_real_test: {
    phase: "manual_real_test",
    monthlyLimit: null,
    dailyLimit: null,
    allowAdminBypass: true,
    allowRetryWithoutConsumption: true,
    consumeOnUsefulPartialAnalysis: false,
    consumeOnProviderFailure: false,
    consumeOnFallbackOnly: false,
    cooldownMinutesAfterRepeatedFailures: null,
  },
  internal_endpoint: {
    phase: "internal_endpoint",
    monthlyLimit: null,
    dailyLimit: 20,
    allowAdminBypass: true,
    allowRetryWithoutConsumption: true,
    consumeOnUsefulPartialAnalysis: true,
    consumeOnProviderFailure: false,
    consumeOnFallbackOnly: false,
    cooldownMinutesAfterRepeatedFailures: 15,
  },
  closed_beta: {
    phase: "closed_beta",
    monthlyLimit: 5,
    dailyLimit: 3,
    allowAdminBypass: false,
    allowRetryWithoutConsumption: false,
    consumeOnUsefulPartialAnalysis: true,
    consumeOnProviderFailure: false,
    consumeOnFallbackOnly: false,
    cooldownMinutesAfterRepeatedFailures: 30,
  },
  production: {
    phase: "production",
    monthlyLimit: 5,
    dailyLimit: 3,
    allowAdminBypass: false,
    allowRetryWithoutConsumption: false,
    consumeOnUsefulPartialAnalysis: true,
    consumeOnProviderFailure: false,
    consumeOnFallbackOnly: false,
    cooldownMinutesAfterRepeatedFailures: 30,
  },
};

function createIssue(code: VideoNarrativeUsageIssue["code"], message: string): VideoNarrativeUsageIssue {
  return {
    code,
    message: sanitizeVideoNarrativeUsageMessage(message),
  };
}

function parseDate(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveNow(now?: string | null): number | null {
  if (now) {
    return parseDate(now);
  }

  return Date.now();
}

function normalizeUsageCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function hasInvalidUsageCount(value: number | null | undefined): boolean {
  return value !== undefined && value !== null && (!Number.isFinite(value) || value < 0);
}

function buildConsumptionIssueForReason(
  reason: VideoNarrativeUsageConsumptionDecision["reason"],
): VideoNarrativeUsageIssue | null {
  switch (reason) {
    case "provider_not_called":
      return createIssue("provider_not_called", "Provider não chamado.");
    case "failed_before_provider":
      return createIssue("failed_before_provider", "Falha antes do provider.");
    case "payload_invalid":
      return createIssue("payload_invalid", "Payload não validado.");
    case "consent_missing":
      return createIssue("consent_missing", "Consentimento ausente.");
    case "retention_expired":
      return createIssue("retention_expired", "Retenção expirada.");
    case "provider_failure":
    case "fallback_only":
    case "manual_retry":
    case "admin_bypass":
      return createIssue("usage_not_consumed", "Uso não consumido.");
    case "quota_blocked":
      return createIssue("quota_exceeded", "Quota indisponível.");
    case "cooldown_active":
      return createIssue("cooldown_active", "Cooldown ativo.");
    case "useful_analysis":
    case "useful_partial_analysis":
      return null;
  }
}

export function sanitizeVideoNarrativeUsageMessage(message: string): string {
  return sanitizeVideoNarrativeGuardMessage(message);
}

export function getVideoNarrativeUsagePolicy(
  phase: VideoNarrativeUsagePhase,
): VideoNarrativeUsagePolicy {
  return VIDEO_NARRATIVE_USAGE_POLICIES[phase];
}

export function isVideoNarrativeCooldownActive(params: {
  cooldownUntil?: string | null;
  now?: string | null;
}): boolean {
  const cooldownUntil = parseDate(params.cooldownUntil);
  const now = resolveNow(params.now);

  if (cooldownUntil === null || now === null) {
    return false;
  }

  return cooldownUntil > now;
}

export function buildVideoNarrativeUsageQuotaGuardResult(params: {
  ok: boolean;
  phase: VideoNarrativeUsagePhase;
  issues?: VideoNarrativeUsageIssue[];
}): VideoNarrativeQuotaGuardResult {
  const issues = params.issues ?? [];
  const blockingIssue = issues.find((issue) =>
    ["quota_exceeded", "daily_limit_exceeded", "cooldown_active", "usage_limited"].includes(issue.code),
  );

  return {
    ok: params.ok,
    phase: params.phase,
    issues,
    canAttemptAnalysis: params.ok,
    guardResult: params.ok
      ? createPassedVideoNarrativeGuardResult("usage_quota")
      : createBlockedVideoNarrativeGuardResult({
          name: "usage_quota",
          code: blockingIssue?.code === "cooldown_active" ? "cooldown_active" : "usage_limited",
          message: blockingIssue?.message ?? "Uso não disponível.",
        }),
  };
}

export function validateVideoNarrativeUsageQuotaForPhase(params: {
  phase: VideoNarrativeUsagePhase;
  usageState?: VideoNarrativeUsageState | null;
}): VideoNarrativeQuotaGuardResult {
  const policy = getVideoNarrativeUsagePolicy(params.phase);
  const usageState = params.usageState ?? {};
  const issues: VideoNarrativeUsageIssue[] = [];

  if (
    hasInvalidUsageCount(usageState.usedThisMonth) ||
    hasInvalidUsageCount(usageState.usedToday) ||
    hasInvalidUsageCount(usageState.repeatedFailureCount)
  ) {
    issues.push(createIssue("usage_state_invalid", "Estado de uso não validado."));
  }

  if (usageState.cooldownUntil && parseDate(usageState.cooldownUntil) === null) {
    issues.push(createIssue("usage_state_invalid", "Cooldown não validado."));
  }

  if (usageState.now && parseDate(usageState.now) === null) {
    issues.push(createIssue("usage_state_invalid", "Data de referência não validada."));
  }

  const canBypassLimits = policy.allowAdminBypass && usageState.isAdminOrDev === true;

  if (!canBypassLimits && isVideoNarrativeCooldownActive({
    cooldownUntil: usageState.cooldownUntil,
    now: usageState.now,
  })) {
    issues.push(createIssue("cooldown_active", "Cooldown ativo."));
  }

  if (
    !canBypassLimits &&
    policy.monthlyLimit !== null &&
    normalizeUsageCount(usageState.usedThisMonth) >= policy.monthlyLimit
  ) {
    issues.push(createIssue("quota_exceeded", "Limite mensal atingido."));
  }

  if (
    !canBypassLimits &&
    policy.dailyLimit !== null &&
    normalizeUsageCount(usageState.usedToday) >= policy.dailyLimit
  ) {
    issues.push(createIssue("daily_limit_exceeded", "Limite diário atingido."));
  }

  const hasBlockingIssue = issues.some((issue) =>
    ["quota_exceeded", "daily_limit_exceeded", "cooldown_active", "usage_limited"].includes(issue.code),
  );

  return buildVideoNarrativeUsageQuotaGuardResult({
    ok: !hasBlockingIssue,
    phase: params.phase,
    issues,
  });
}

export function buildVideoNarrativeUsageConsumptionGuardResult(params: {
  shouldConsumeQuota: boolean;
  reason: VideoNarrativeUsageConsumptionDecision["reason"];
  issues?: VideoNarrativeUsageIssue[];
}): VideoNarrativeGuardResult {
  const shouldBlock = params.reason === "quota_blocked" || params.reason === "cooldown_active";

  return shouldBlock
    ? createBlockedVideoNarrativeGuardResult({
        name: "usage_consumption",
        code: params.reason === "cooldown_active" ? "cooldown_active" : "quota_exceeded",
        message: params.issues?.[0]?.message ?? "Consumo de uso bloqueado.",
      })
    : createPassedVideoNarrativeGuardResult("usage_consumption");
}

export function decideVideoNarrativeUsageConsumption(
  input: VideoNarrativeUsageDecisionInput,
): VideoNarrativeUsageConsumptionDecision {
  const policy = getVideoNarrativeUsagePolicy(input.phase);
  const quotaGuard = validateVideoNarrativeUsageQuotaForPhase({
    phase: input.phase,
    usageState: input.usageState,
  });
  const usageState = input.usageState ?? {};

  let reason: VideoNarrativeUsageConsumptionDecision["reason"];
  let shouldConsumeQuota = false;

  if (!quotaGuard.canAttemptAnalysis) {
    reason = quotaGuard.issues.some((issue) => issue.code === "cooldown_active")
      ? "cooldown_active"
      : "quota_blocked";
  } else if (input.failedBeforeProvider) {
    reason = "failed_before_provider";
  } else if (input.payloadWasInvalid) {
    reason = "payload_invalid";
  } else if (input.consentWasMissing) {
    reason = "consent_missing";
  } else if (input.retentionWasExpired) {
    reason = "retention_expired";
  } else if (input.providerWasCalled !== true) {
    reason = "provider_not_called";
  } else if (policy.allowAdminBypass && usageState.isAdminOrDev === true) {
    reason = "admin_bypass";
  } else if (input.userRequestedManualRetry && policy.allowRetryWithoutConsumption) {
    reason = "manual_retry";
  } else if (input.userRequestedManualRetry && input.providerReturnedUsefulAnalysis) {
    reason = "manual_retry";
    shouldConsumeQuota = true;
  } else if (input.providerReturnedUsefulAnalysis) {
    reason = "useful_analysis";
    shouldConsumeQuota = true;
  } else if (input.providerReturnedUsefulPartialAnalysis && policy.consumeOnUsefulPartialAnalysis) {
    reason = "useful_partial_analysis";
    shouldConsumeQuota = true;
  } else if (input.usedFallbackOnly) {
    reason = "fallback_only";
    shouldConsumeQuota = policy.consumeOnFallbackOnly;
  } else {
    reason = "provider_failure";
    shouldConsumeQuota = policy.consumeOnProviderFailure;
  }

  const reasonIssue = buildConsumptionIssueForReason(reason);
  const issues = [...quotaGuard.issues, ...(reasonIssue ? [reasonIssue] : [])];

  return {
    shouldConsumeQuota,
    reason,
    issues,
    guardResult: buildVideoNarrativeUsageConsumptionGuardResult({
      shouldConsumeQuota,
      reason,
      issues,
    }),
  };
}
