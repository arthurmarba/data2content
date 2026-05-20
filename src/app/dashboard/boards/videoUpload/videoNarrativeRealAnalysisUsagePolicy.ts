import { hasPlanPremiumAccess } from "@/utils/planStatus";
import {
  evaluateVideoNarrativeGeminiAllowlist,
  type VideoNarrativeGeminiAllowlistUser,
} from "./videoNarrativeGeminiAllowlist";

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>;

export type VideoNarrativeRealAnalysisUsageTier =
  | "anonymous"
  | "free"
  | "premium"
  | "admin_dev"
  | "allowlist";

export type VideoNarrativeRealAnalysisUsageIssueCode =
  | "beta_limits_disabled"
  | "beta_access_required"
  | "usage_limit_reached"
  | "daily_limit_reached"
  | "monthly_limit_reached"
  | "usage_cooldown_active";

export type VideoNarrativeRealAnalysisUsagePolicy = {
  tier: VideoNarrativeRealAnalysisUsageTier;
  dailyLimit: number;
  monthlyLimit: number;
  maxFileSizeBytes: number;
  cooldownSeconds: number;
  allowRealAnalysis: boolean;
  reason?: VideoNarrativeRealAnalysisUsageIssueCode;
};

export type VideoNarrativeRealAnalysisUsageState = {
  dailyCount?: number | null;
  monthlyCount?: number | null;
  lastAttemptAt?: Date | string | null;
};

export type VideoNarrativeRealAnalysisUsageDecision =
  | { ok: true; policy: VideoNarrativeRealAnalysisUsagePolicy; tier: VideoNarrativeRealAnalysisUsageTier }
  | {
      ok: false;
      policy: VideoNarrativeRealAnalysisUsagePolicy;
      tier: VideoNarrativeRealAnalysisUsageTier;
      code: VideoNarrativeRealAnalysisUsageIssueCode;
      message: string;
    };

const DEFAULT_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;

function parseBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function normalizeCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0;
}

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isAdminOrDev(user?: VideoNarrativeGeminiAllowlistUser | null): boolean {
  return Boolean(user?.isAdmin || user?.isDev || user?.role === "admin" || user?.role === "dev");
}

function resolveMaxFileSizeBytes(env: EnvLike): number {
  const maxMb = Number.parseInt(env.VIDEO_NARRATIVE_TEMP_UPLOAD_MAX_MB ?? "", 10);
  return Number.isFinite(maxMb) && maxMb > 0 ? maxMb * 1024 * 1024 : DEFAULT_MAX_FILE_SIZE_BYTES;
}

export function resolveVideoNarrativeRealAnalysisUsageTier(params: {
  user?: (VideoNarrativeGeminiAllowlistUser & { planStatus?: string | null }) | null;
  env?: EnvLike;
}): VideoNarrativeRealAnalysisUsageTier {
  const user = params.user;
  if (!user?.id) return "anonymous";
  if (isAdminOrDev(user)) return "admin_dev";

  const allowlist = evaluateVideoNarrativeGeminiAllowlist({ user, env: params.env });
  if (allowlist.ok) return "allowlist";

  return hasPlanPremiumAccess(user.planStatus) ? "premium" : "free";
}

export function getVideoNarrativeRealAnalysisUsagePolicy(params: {
  tier: VideoNarrativeRealAnalysisUsageTier;
  env?: EnvLike;
}): VideoNarrativeRealAnalysisUsagePolicy {
  const env = params.env ?? process.env;
  const betaLimitsEnabled = parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED);
  const maxFileSizeBytes = resolveMaxFileSizeBytes(env);

  if (!betaLimitsEnabled) {
    return {
      tier: params.tier,
      dailyLimit: 0,
      monthlyLimit: 0,
      maxFileSizeBytes,
      cooldownSeconds: 60,
      allowRealAnalysis: false,
      reason: "beta_limits_disabled",
    };
  }

  switch (params.tier) {
    case "admin_dev":
      return {
        tier: params.tier,
        dailyLimit: 20,
        monthlyLimit: 100,
        maxFileSizeBytes,
        cooldownSeconds: 15,
        allowRealAnalysis: true,
      };
    case "allowlist":
      return {
        tier: params.tier,
        dailyLimit: 5,
        monthlyLimit: 20,
        maxFileSizeBytes,
        cooldownSeconds: 60,
        allowRealAnalysis: true,
      };
    case "premium":
      return {
        tier: params.tier,
        dailyLimit: parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA) ? 3 : 0,
        monthlyLimit: parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA) ? 10 : 0,
        maxFileSizeBytes,
        cooldownSeconds: 60,
        allowRealAnalysis: parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA),
        reason: parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_PREMIUM_BETA)
          ? undefined
          : "beta_access_required",
      };
    case "free":
      return {
        tier: params.tier,
        dailyLimit: parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_FREE_BETA) ? 1 : 0,
        monthlyLimit: parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_FREE_BETA) ? 3 : 0,
        maxFileSizeBytes,
        cooldownSeconds: 120,
        allowRealAnalysis: parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_FREE_BETA),
        reason: parseBoolean(env.VIDEO_NARRATIVE_REAL_ANALYSIS_ALLOW_FREE_BETA) ? undefined : "beta_access_required",
      };
    case "anonymous":
      return {
        tier: params.tier,
        dailyLimit: 0,
        monthlyLimit: 0,
        maxFileSizeBytes,
        cooldownSeconds: 120,
        allowRealAnalysis: false,
        reason: "beta_access_required",
      };
  }
}

export function evaluateVideoNarrativeRealAnalysisUsagePolicy(params: {
  user?: (VideoNarrativeGeminiAllowlistUser & { planStatus?: string | null }) | null;
  usage?: VideoNarrativeRealAnalysisUsageState | null;
  env?: EnvLike;
  now?: Date;
}): VideoNarrativeRealAnalysisUsageDecision {
  const env = params.env ?? process.env;
  const now = params.now ?? new Date();
  const tier = resolveVideoNarrativeRealAnalysisUsageTier({ user: params.user, env });
  const policy = getVideoNarrativeRealAnalysisUsagePolicy({ tier, env });
  const usage = params.usage ?? {};

  if (!policy.allowRealAnalysis) {
    const code = policy.reason ?? "beta_access_required";
    return { ok: false, policy, tier, code, message: code };
  }

  if (normalizeCount(usage.dailyCount) >= policy.dailyLimit) {
    return { ok: false, policy, tier, code: "daily_limit_reached", message: "daily_limit_reached" };
  }

  if (normalizeCount(usage.monthlyCount) >= policy.monthlyLimit) {
    return { ok: false, policy, tier, code: "monthly_limit_reached", message: "monthly_limit_reached" };
  }

  const lastAttemptAt = toDate(usage.lastAttemptAt);
  if (lastAttemptAt && policy.cooldownSeconds > 0) {
    const elapsedSeconds = Math.floor((now.getTime() - lastAttemptAt.getTime()) / 1000);
    if (elapsedSeconds >= 0 && elapsedSeconds < policy.cooldownSeconds) {
      return {
        ok: false,
        policy,
        tier,
        code: "usage_cooldown_active",
        message: "usage_cooldown_active",
      };
    }
  }

  return { ok: true, policy, tier };
}
