import { track } from "@/lib/track";
import type { NarrativeMapAccessState, NarrativeMapPostCheckoutIntent } from "./narrativeMapAccessState";

export type MobileNarrativeTelemetryEventName =
  | "mobile_profile_viewed"
  | "mobile_status_action_clicked"
  | "mobile_new_reading_started"
  | "mobile_upload_gate_checked"
  | "mobile_upload_gate_blocked"
  | "mobile_upload_session_requested"
  | "mobile_upload_session_created"
  | "mobile_video_upload_completed"
  | "mobile_analysis_submitted"
  | "mobile_analysis_succeeded"
  | "mobile_analysis_failed"
  | "mobile_reading_saved"
  | "mobile_synthesis_snapshot_write_attempted"
  | "mobile_synthesis_snapshot_write_succeeded"
  | "mobile_synthesis_snapshot_write_failed"
  | "mobile_paywall_opened"
  | "mobile_post_checkout_intent_seen"
  | "mobile_post_checkout_intent_consumed"
  | "mobile_instagram_connect_clicked"
  | "mobile_mediakit_action_clicked"
  | "mobile_community_action_clicked"
  | "mobile_quota_reached_seen";

export type MobileNarrativeAnalysisMode = "mock" | "real_gated";
export type MobileNarrativeGateResult = "allowed" | "blocked";

export type MobileNarrativeTelemetryPayload = {
  eventName?: MobileNarrativeTelemetryEventName;
  timestamp?: string;
  route?: string;
  accessState?: NarrativeMapAccessState;
  isPro?: boolean;
  instagramConnected?: boolean;
  quotaUsedThisMonth?: number;
  quotaLimit?: number;
  quotaRemaining?: number;
  selectedGoalOption?: "authority" | "authority_build" | "retention" | "format_test" | "sponsored_content";
  actionLabel?: string;
  actionType?: string;
  paywallContext?: string;
  postCheckoutIntent?: NarrativeMapPostCheckoutIntent;
  gateResult?: MobileNarrativeGateResult;
  safeErrorCode?: string;
  analysisMode?: MobileNarrativeAnalysisMode;
  allowlistGatePassed?: boolean;
  readingSaved?: boolean;
  synthesisWritten?: boolean;
};

export type MobileNarrativeTelemetryProvider = (
  eventName: MobileNarrativeTelemetryEventName,
  payload: MobileNarrativeTelemetryPayload,
) => void;

const ACCESS_STATES: NarrativeMapAccessState[] = [
  "free_unused",
  "free_preview_used",
  "pro_needs_instagram",
  "pro_instagram_connected",
  "pro_quota_reached",
  "payment_pending",
  "payment_action_needed",
  "admin",
];

const GOAL_OPTIONS: Array<NonNullable<MobileNarrativeTelemetryPayload["selectedGoalOption"]>> = [
  "authority",
  "authority_build",
  "retention",
  "format_test",
  "sponsored_content",
];

const FORBIDDEN_KEY_PATTERN =
  /(creatorGoal|quickAnswers|prompt|raw|gemini|modelResponse|response|transcript|video|objectKey|signedUrl|uploadUrl|thumbnailUrl|localPath|storageProviderPath|filename|fileName|headers|token|secret|email|creatorName|diagnosis|snapshot)/i;

function safeNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.trunc(value));
}

function safeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function safeShortString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return undefined;
  return normalized.slice(0, 80);
}

function isSafeRoute(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && value.length <= 160;
}

function safeAccessState(value: unknown): NarrativeMapAccessState | undefined {
  return ACCESS_STATES.includes(value as NarrativeMapAccessState) ? (value as NarrativeMapAccessState) : undefined;
}

function safeGoalOption(value: unknown): MobileNarrativeTelemetryPayload["selectedGoalOption"] | undefined {
  return GOAL_OPTIONS.includes(value as NonNullable<MobileNarrativeTelemetryPayload["selectedGoalOption"]>)
    ? (value as NonNullable<MobileNarrativeTelemetryPayload["selectedGoalOption"]>)
    : undefined;
}

function safePostCheckoutIntent(value: unknown): NarrativeMapPostCheckoutIntent | undefined {
  return value === "connect_instagram" || value === "join_community" ? value : undefined;
}

export function sanitizeMobileNarrativeTelemetryPayload(
  payload: Record<string, unknown> | MobileNarrativeTelemetryPayload | null | undefined,
): MobileNarrativeTelemetryPayload {
  const source = payload && typeof payload === "object" ? payload : {};
  const result: MobileNarrativeTelemetryPayload = {};

  for (const key of Object.keys(source)) {
    if (FORBIDDEN_KEY_PATTERN.test(key)) continue;
  }

  if (isSafeRoute(source.route)) result.route = source.route;
  const accessState = safeAccessState(source.accessState);
  if (accessState) result.accessState = accessState;

  const isPro = safeBoolean(source.isPro);
  if (isPro !== undefined) result.isPro = isPro;
  const instagramConnected = safeBoolean(source.instagramConnected);
  if (instagramConnected !== undefined) result.instagramConnected = instagramConnected;

  const quotaUsedThisMonth = safeNumber(source.quotaUsedThisMonth);
  if (quotaUsedThisMonth !== undefined) result.quotaUsedThisMonth = quotaUsedThisMonth;
  const quotaLimit = safeNumber(source.quotaLimit);
  if (quotaLimit !== undefined) result.quotaLimit = quotaLimit;
  const quotaRemaining = safeNumber(source.quotaRemaining);
  if (quotaRemaining !== undefined) result.quotaRemaining = quotaRemaining;

  const selectedGoalOption = safeGoalOption(source.selectedGoalOption);
  if (selectedGoalOption) result.selectedGoalOption = selectedGoalOption;

  const actionLabel = safeShortString(source.actionLabel);
  if (actionLabel) result.actionLabel = actionLabel;
  const actionType = safeShortString(source.actionType);
  if (actionType) result.actionType = actionType;
  const paywallContext = safeShortString(source.paywallContext);
  if (paywallContext) result.paywallContext = paywallContext;

  const postCheckoutIntent = safePostCheckoutIntent(source.postCheckoutIntent);
  if (postCheckoutIntent) result.postCheckoutIntent = postCheckoutIntent;

  if (source.gateResult === "allowed" || source.gateResult === "blocked") {
    result.gateResult = source.gateResult;
  }
  const safeErrorCode = safeShortString(source.safeErrorCode);
  if (safeErrorCode) result.safeErrorCode = safeErrorCode.replace(/gemini/gi, "provider");
  if (source.analysisMode === "mock" || source.analysisMode === "real_gated") {
    result.analysisMode = source.analysisMode;
  }

  const allowlistGatePassed = safeBoolean(source.allowlistGatePassed);
  if (allowlistGatePassed !== undefined) result.allowlistGatePassed = allowlistGatePassed;
  const readingSaved = safeBoolean(source.readingSaved);
  if (readingSaved !== undefined) result.readingSaved = readingSaved;
  const synthesisWritten = safeBoolean(source.synthesisWritten);
  if (synthesisWritten !== undefined) result.synthesisWritten = synthesisWritten;

  return {
    eventName: safeShortString(source.eventName) as MobileNarrativeTelemetryEventName | undefined,
    timestamp: typeof source.timestamp === "string" ? source.timestamp : new Date().toISOString(),
    ...result,
  };
}

export function getSafeMobileNarrativeErrorCode(error: unknown, fallback = "unknown_error"): string {
  if (error && typeof error === "object") {
    const candidate = (error as { code?: unknown; status?: unknown; safeErrorCode?: unknown }).safeErrorCode
      ?? (error as { code?: unknown }).code
      ?? (error as { status?: unknown }).status;
    const safe = safeShortString(candidate);
    if (safe) return safe.replace(/gemini/gi, "provider");
  }
  return fallback;
}

export const noopMobileNarrativeTelemetryProvider: MobileNarrativeTelemetryProvider = () => {
  /* noop */
};

export function trackMobileNarrativeEvent(
  eventName: MobileNarrativeTelemetryEventName,
  payload?: MobileNarrativeTelemetryPayload | Record<string, unknown> | null,
  provider: MobileNarrativeTelemetryProvider = (name, eventPayload) => {
    track(name, eventPayload as any);
  },
) {
  const sanitized = sanitizeMobileNarrativeTelemetryPayload({
    ...(payload ?? {}),
    eventName,
  });
  provider(eventName, sanitized);
}

export function buildMobileNarrativeTelemetryContext(params: {
  route?: string;
  accessState?: NarrativeMapAccessState;
  isPro?: boolean;
  instagramConnected?: boolean;
  quotaUsedThisMonth?: number;
  quotaLimit?: number;
}) {
  const quotaUsedThisMonth = safeNumber(params.quotaUsedThisMonth) ?? 0;
  const quotaLimit = safeNumber(params.quotaLimit) ?? 0;
  return sanitizeMobileNarrativeTelemetryPayload({
    route: params.route,
    accessState: params.accessState,
    isPro: params.isPro,
    instagramConnected: params.instagramConnected,
    quotaUsedThisMonth,
    quotaLimit,
    quotaRemaining: Math.max(0, quotaLimit - quotaUsedThisMonth),
  });
}
