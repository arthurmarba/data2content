import {
  createBlockedVideoNarrativeGuardResult,
  createPassedVideoNarrativeGuardResult,
  sanitizeVideoNarrativeGuardMessage,
  type VideoNarrativeGuardResult,
} from "./videoNarrativeGuardContracts";
import type { VideoNarrativeInputSourcePhase } from "./videoNarrativeInputSourceGuards";

export type VideoNarrativeConsentRetentionPhase = VideoNarrativeInputSourcePhase;

export interface VideoNarrativeConsentPolicy {
  phase: VideoNarrativeConsentRetentionPhase;
  requiresExplicitConsent: boolean;
  allowAdminBypass: boolean;
  requiresConsentVersion: boolean;
  allowProfileSignalsPersistence: boolean;
}

export interface VideoNarrativeRetentionPolicy {
  phase: VideoNarrativeConsentRetentionPhase;
  requiresExpiresAt: boolean;
  maxRetentionHours: number | null;
  allowPermanentVideoStorage: boolean;
  allowRawTextStorage: boolean;
  allowBase64Storage: boolean;
  allowProfileSignalsPersistence: boolean;
}

export interface VideoNarrativeConsentRetentionInput {
  phase: VideoNarrativeConsentRetentionPhase;
  hasExplicitConsent?: boolean | null;
  consentVersion?: string | null;
  isAdminOrDev?: boolean | null;
  expiresAt?: string | null;
  now?: string | null;
  wantsProfileSignalsPersistence?: boolean | null;
}

export interface VideoNarrativeConsentRetentionIssue {
  code:
    | "consent_missing"
    | "consent_version_missing"
    | "expires_at_missing"
    | "retention_expired"
    | "retention_exceeds_policy"
    | "permanent_video_storage_not_allowed"
    | "raw_text_storage_not_allowed"
    | "base64_storage_not_allowed"
    | "profile_signals_persistence_not_allowed"
    | "invalid_date";
  message: string;
}

export interface VideoNarrativeConsentRetentionGuardResult {
  ok: boolean;
  phase: VideoNarrativeConsentRetentionPhase;
  consentGuardResult: VideoNarrativeGuardResult;
  retentionGuardResult: VideoNarrativeGuardResult;
  issues: VideoNarrativeConsentRetentionIssue[];
  canPersistProfileSignals: boolean;
}

export const VIDEO_NARRATIVE_CONSENT_POLICIES: Record<
  VideoNarrativeConsentRetentionPhase,
  VideoNarrativeConsentPolicy
> = {
  manual_real_test: {
    phase: "manual_real_test",
    requiresExplicitConsent: false,
    allowAdminBypass: true,
    requiresConsentVersion: false,
    allowProfileSignalsPersistence: false,
  },
  internal_endpoint: {
    phase: "internal_endpoint",
    requiresExplicitConsent: false,
    allowAdminBypass: true,
    requiresConsentVersion: false,
    allowProfileSignalsPersistence: false,
  },
  closed_beta: {
    phase: "closed_beta",
    requiresExplicitConsent: true,
    allowAdminBypass: false,
    requiresConsentVersion: true,
    allowProfileSignalsPersistence: false,
  },
  production: {
    phase: "production",
    requiresExplicitConsent: true,
    allowAdminBypass: false,
    requiresConsentVersion: true,
    allowProfileSignalsPersistence: false,
  },
};

export const VIDEO_NARRATIVE_RETENTION_POLICIES: Record<
  VideoNarrativeConsentRetentionPhase,
  VideoNarrativeRetentionPolicy
> = {
  manual_real_test: {
    phase: "manual_real_test",
    requiresExpiresAt: false,
    maxRetentionHours: null,
    allowPermanentVideoStorage: false,
    allowRawTextStorage: false,
    allowBase64Storage: false,
    allowProfileSignalsPersistence: false,
  },
  internal_endpoint: {
    phase: "internal_endpoint",
    requiresExpiresAt: true,
    maxRetentionHours: 72,
    allowPermanentVideoStorage: false,
    allowRawTextStorage: false,
    allowBase64Storage: false,
    allowProfileSignalsPersistence: false,
  },
  closed_beta: {
    phase: "closed_beta",
    requiresExpiresAt: true,
    maxRetentionHours: 72,
    allowPermanentVideoStorage: false,
    allowRawTextStorage: false,
    allowBase64Storage: false,
    allowProfileSignalsPersistence: false,
  },
  production: {
    phase: "production",
    requiresExpiresAt: true,
    maxRetentionHours: 72,
    allowPermanentVideoStorage: false,
    allowRawTextStorage: false,
    allowBase64Storage: false,
    allowProfileSignalsPersistence: false,
  },
};

function createIssue(
  code: VideoNarrativeConsentRetentionIssue["code"],
  message: string,
): VideoNarrativeConsentRetentionIssue {
  return {
    code,
    message: sanitizeVideoNarrativeConsentRetentionMessage(message),
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

function hasConsentByPolicy(input: VideoNarrativeConsentRetentionInput): boolean {
  const policy = getVideoNarrativeConsentPolicy(input.phase);
  if (!policy.requiresExplicitConsent) {
    return true;
  }

  if (policy.allowAdminBypass && input.isAdminOrDev === true) {
    return true;
  }

  return input.hasExplicitConsent === true;
}

export function sanitizeVideoNarrativeConsentRetentionMessage(message: string): string {
  return sanitizeVideoNarrativeGuardMessage(message);
}

export function getVideoNarrativeConsentPolicy(
  phase: VideoNarrativeConsentRetentionPhase,
): VideoNarrativeConsentPolicy {
  return VIDEO_NARRATIVE_CONSENT_POLICIES[phase];
}

export function getVideoNarrativeRetentionPolicy(
  phase: VideoNarrativeConsentRetentionPhase,
): VideoNarrativeRetentionPolicy {
  return VIDEO_NARRATIVE_RETENTION_POLICIES[phase];
}

export function requiresVideoNarrativeExplicitConsent(
  phase: VideoNarrativeConsentRetentionPhase,
): boolean {
  return getVideoNarrativeConsentPolicy(phase).requiresExplicitConsent;
}

export function canVideoNarrativeAdminBypassConsent(
  phase: VideoNarrativeConsentRetentionPhase,
): boolean {
  return getVideoNarrativeConsentPolicy(phase).allowAdminBypass;
}

export function requiresVideoNarrativeExpiresAt(
  phase: VideoNarrativeConsentRetentionPhase,
): boolean {
  return getVideoNarrativeRetentionPolicy(phase).requiresExpiresAt;
}

export function isVideoNarrativeRetentionExpired(params: {
  expiresAt: string | null | undefined;
  now?: string | null;
}): boolean {
  const expiresAt = parseDate(params.expiresAt);
  const now = resolveNow(params.now);

  if (expiresAt === null || now === null) {
    return false;
  }

  return expiresAt <= now;
}

export function isVideoNarrativeRetentionWithinPolicy(params: {
  expiresAt: string | null | undefined;
  now?: string | null;
  maxRetentionHours: number | null;
}): boolean {
  if (params.maxRetentionHours === null) {
    return true;
  }

  const expiresAt = parseDate(params.expiresAt);
  const now = resolveNow(params.now);

  if (expiresAt === null || now === null) {
    return false;
  }

  const maxRetentionMs = params.maxRetentionHours * 60 * 60 * 1000;
  return expiresAt - now <= maxRetentionMs;
}

export function buildVideoNarrativeConsentGuardResult(params: {
  ok: boolean;
  issues?: VideoNarrativeConsentRetentionIssue[];
}): VideoNarrativeGuardResult {
  return params.ok
    ? createPassedVideoNarrativeGuardResult("consent")
    : createBlockedVideoNarrativeGuardResult({
        name: "consent",
        code: "consent_missing",
        message: params.issues?.[0]?.message ?? "Consentimento não validado.",
      });
}

export function buildVideoNarrativeRetentionGuardResult(params: {
  ok: boolean;
  issues?: VideoNarrativeConsentRetentionIssue[];
}): VideoNarrativeGuardResult {
  return params.ok
    ? createPassedVideoNarrativeGuardResult("retention")
    : createBlockedVideoNarrativeGuardResult({
        name: "retention",
        code: "retention_expired",
        message: params.issues?.[0]?.message ?? "Retenção não validada.",
      });
}

export function validateVideoNarrativeConsentRetentionForPhase(
  input: VideoNarrativeConsentRetentionInput,
): VideoNarrativeConsentRetentionGuardResult {
  const consentPolicy = getVideoNarrativeConsentPolicy(input.phase);
  const retentionPolicy = getVideoNarrativeRetentionPolicy(input.phase);
  const consentIssues: VideoNarrativeConsentRetentionIssue[] = [];
  const retentionIssues: VideoNarrativeConsentRetentionIssue[] = [];
  const profileIssues: VideoNarrativeConsentRetentionIssue[] = [];

  if (!hasConsentByPolicy(input)) {
    consentIssues.push(createIssue("consent_missing", "Consentimento não informado."));
  }

  if (
    consentPolicy.requiresConsentVersion &&
    (!input.consentVersion || input.consentVersion.trim().length === 0)
  ) {
    consentIssues.push(createIssue("consent_version_missing", "Versão do consentimento não informada."));
  }

  const hasExpiresAt = Boolean(input.expiresAt);
  const parsedExpiresAt = parseDate(input.expiresAt);
  const parsedNow = input.now ? parseDate(input.now) : resolveNow(input.now);

  if (retentionPolicy.requiresExpiresAt && !hasExpiresAt) {
    retentionIssues.push(createIssue("expires_at_missing", "Expiração não informada."));
  }

  if (hasExpiresAt && parsedExpiresAt === null) {
    retentionIssues.push(createIssue("invalid_date", "Data de expiração não validada."));
  }

  if (input.now && parsedNow === null) {
    retentionIssues.push(createIssue("invalid_date", "Data de referência não validada."));
  }

  if (parsedExpiresAt !== null && parsedNow !== null && parsedExpiresAt <= parsedNow) {
    retentionIssues.push(createIssue("retention_expired", "Arquivo temporário expirado."));
  }

  if (
    parsedExpiresAt !== null &&
    parsedNow !== null &&
    !isVideoNarrativeRetentionWithinPolicy({
      expiresAt: input.expiresAt,
      now: input.now,
      maxRetentionHours: retentionPolicy.maxRetentionHours,
    })
  ) {
    retentionIssues.push(createIssue("retention_exceeds_policy", "Retenção acima do limite da fase."));
  }

  if (input.wantsProfileSignalsPersistence === true && !consentPolicy.allowProfileSignalsPersistence) {
    profileIssues.push(
      createIssue(
        "profile_signals_persistence_not_allowed",
        "Persistência de sinais narrativos não habilitada.",
      ),
    );
  }

  const consentOk = consentIssues.length === 0;
  const retentionOk = retentionIssues.length === 0;
  const issues = [...consentIssues, ...retentionIssues, ...profileIssues];
  const canPersistProfileSignals =
    input.wantsProfileSignalsPersistence === true &&
    consentPolicy.allowProfileSignalsPersistence &&
    retentionPolicy.allowProfileSignalsPersistence &&
    consentOk &&
    retentionOk;

  return {
    ok: consentOk && retentionOk && profileIssues.length === 0,
    phase: input.phase,
    consentGuardResult: buildVideoNarrativeConsentGuardResult({
      ok: consentOk,
      issues: consentIssues,
    }),
    retentionGuardResult: buildVideoNarrativeRetentionGuardResult({
      ok: retentionOk,
      issues: retentionIssues,
    }),
    issues,
    canPersistProfileSignals,
  };
}
