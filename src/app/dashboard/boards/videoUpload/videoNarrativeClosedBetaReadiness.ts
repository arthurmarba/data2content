import {
  evaluateVideoNarrativeGeminiAllowlist,
  type VideoNarrativeGeminiAllowlistUser,
} from "./videoNarrativeGeminiAllowlist";
import { performVideoNarrativeRealRuntimeEnvAudit } from "./videoNarrativeRealRuntimeEnvAudit";
import {
  evaluateVideoNarrativeRealAnalysisUsagePolicy,
  type VideoNarrativeRealAnalysisUsageState,
} from "./videoNarrativeRealAnalysisUsagePolicy";

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type VideoNarrativeClosedBetaReadinessState =
  | "beta_ready"
  | "beta_disabled"
  | "user_not_allowlisted"
  | "usage_limit_reached"
  | "env_not_ready"
  | "storage_not_ready"
  | "gemini_not_ready"
  | "rollback_enabled"
  | "unknown";

export type VideoNarrativeClosedBetaReadinessIssueCode =
  | VideoNarrativeClosedBetaReadinessState
  | "gemini_allowlist_not_ready"
  | "signed_upload_allowlist_not_ready"
  | "beta_limits_not_ready"
  | "real_upload_not_ready"
  | "real_analysis_not_ready";

export type VideoNarrativeClosedBetaReadinessResult = {
  state: VideoNarrativeClosedBetaReadinessState;
  betaAccessAllowed: boolean;
  realAnalysisReady: boolean;
  userIsAllowlisted: boolean;
  userUsageWithinLimit: boolean;
  envReady: boolean;
  storageReady: boolean;
  geminiReady: boolean;
  rollbackActive: boolean;
  safeUserMessage: string;
  issueCodes: VideoNarrativeClosedBetaReadinessIssueCode[];
};

const SAFE_MESSAGES: Record<VideoNarrativeClosedBetaReadinessState, string> = {
  beta_ready: "Beta fechado pronto para este usuário.",
  beta_disabled: "A análise real de vídeo ainda não está disponível nesta fase.",
  user_not_allowlisted: "A análise real de vídeo está em beta fechado para poucos creators.",
  usage_limit_reached: "Você atingiu o limite de análises reais do beta por hoje.",
  env_not_ready: "A análise real de vídeo ainda precisa de configuração de ambiente.",
  storage_not_ready: "O upload temporário ainda não está pronto para análise real.",
  gemini_not_ready: "A análise real está temporariamente indisponível.",
  rollback_enabled: "A análise real de vídeo foi pausada temporariamente.",
  unknown: "Não foi possível confirmar a prontidão do beta agora.",
};

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function hasIssue(issues: Array<{ code: string }>, codes: string[]): boolean {
  return issues.some((issue) => codes.includes(issue.code));
}

function isAdminOrDev(user?: VideoNarrativeGeminiAllowlistUser | null): boolean {
  return Boolean(user?.isAdmin || user?.isDev || user?.role === "admin" || user?.role === "dev");
}

export function evaluateVideoNarrativeClosedBetaReadiness(params: {
  user?: (VideoNarrativeGeminiAllowlistUser & { planStatus?: string | null }) | null;
  usage?: VideoNarrativeRealAnalysisUsageState | null;
  env?: EnvLike;
  now?: Date;
}): VideoNarrativeClosedBetaReadinessResult {
  const env = params.env ?? process.env;
  const envAudit = performVideoNarrativeRealRuntimeEnvAudit(env);
  const allowlist = evaluateVideoNarrativeGeminiAllowlist({
    user: params.user ?? {},
    env,
  });
  const usageDecision = evaluateVideoNarrativeRealAnalysisUsagePolicy({
    user: params.user,
    usage: params.usage,
    env,
    now: params.now,
  });

  const rollbackActive =
    !parseBoolean(env.NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED) ||
    parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_ROLLBACK_ENABLED);
  const storageReady = envAudit.flags.storageCredentialsPresent && !hasIssue(envAudit.issues, [
    "storage_provider_missing",
    "storage_credentials_missing",
  ]);
  const geminiReady =
    envAudit.flags.geminiApiKeyPresent &&
    envAudit.flags.geminiProviderEnabled &&
    !hasIssue(envAudit.issues, ["gemini_api_key_missing", "gemini_provider_disabled"]);
  const userIsAllowlisted = allowlist.ok;
  const userUsageWithinLimit = usageDecision.ok;
  const envReady = envAudit.ok;
  const betaAccessAllowed = userIsAllowlisted && userUsageWithinLimit;
  const realAnalysisReady =
    betaAccessAllowed &&
    envReady &&
    storageReady &&
    geminiReady &&
    !rollbackActive;

  let state: VideoNarrativeClosedBetaReadinessState = "unknown";
  const issueCodes: VideoNarrativeClosedBetaReadinessIssueCode[] = [];

  if (rollbackActive) {
    state = "rollback_enabled";
    issueCodes.push("rollback_enabled");
  } else if (!envAudit.flags.realAnalysisEnabled) {
    state = "beta_disabled";
    issueCodes.push("real_analysis_not_ready");
  } else if (!envAudit.flags.betaLimitsEnabled) {
    state = "beta_disabled";
    issueCodes.push("beta_limits_not_ready");
  } else if (!geminiReady) {
    state = "gemini_not_ready";
    issueCodes.push("gemini_not_ready");
  } else if (!storageReady || !envAudit.flags.realUploadEnabled || !envAudit.flags.signedUploadAllowlistEnabled) {
    state = "storage_not_ready";
    issueCodes.push("storage_not_ready");
    if (!envAudit.flags.realUploadEnabled) issueCodes.push("real_upload_not_ready");
    if (!envAudit.flags.signedUploadAllowlistEnabled) issueCodes.push("signed_upload_allowlist_not_ready");
  } else if (!envAudit.flags.allowlistConfigured) {
    state = "env_not_ready";
    issueCodes.push("gemini_allowlist_not_ready");
  } else if (!userIsAllowlisted) {
    state = "user_not_allowlisted";
    issueCodes.push("user_not_allowlisted");
  } else if (!userUsageWithinLimit) {
    state = "usage_limit_reached";
    issueCodes.push("usage_limit_reached");
  } else if (realAnalysisReady || isAdminOrDev(params.user)) {
    state = "beta_ready";
  }

  if (!envReady && state === "unknown") {
    state = "env_not_ready";
    issueCodes.push("env_not_ready");
  }

  return {
    state,
    betaAccessAllowed,
    realAnalysisReady,
    userIsAllowlisted,
    userUsageWithinLimit,
    envReady,
    storageReady,
    geminiReady,
    rollbackActive,
    safeUserMessage: SAFE_MESSAGES[state],
    issueCodes,
  };
}
