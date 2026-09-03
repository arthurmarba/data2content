import type { PaywallContext, PostCheckoutIntent } from "@/types/paywall";

export const CHECKOUT_JOURNEY_METADATA_KEYS = {
  context: "d2c_context",
  source: "d2c_source",
  returnTo: "d2c_return_to",
  postCheckoutIntent: "d2c_post_checkout",
} as const;

const ALLOWED_CONTEXTS = new Set<PaywallContext>([
  "default",
  "reply_email",
  "ai_analysis",
  "calculator",
  "narrative_map",
  "mentoria",
  "media_kit",
  "publis",
  "planning",
  "whatsapp",
  "instagram_report",
  "community",
  "recorded_meetings",
  "onboarding",
  "chatgpt_intelligence",
]);

export type CheckoutJourney = {
  context: PaywallContext | null;
  source: string | null;
  returnTo: string | null;
  postCheckoutIntent: PostCheckoutIntent | null;
};

export function sanitizeCheckoutReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    !normalized.startsWith("/")
    || normalized.startsWith("//")
    || normalized.length > 400
  ) {
    return null;
  }
  return normalized;
}

export function normalizeCheckoutJourney(value: unknown): CheckoutJourney {
  const raw = value && typeof value === "object"
    ? value as Record<string, unknown>
    : {};
  const context = typeof raw.context === "string" && ALLOWED_CONTEXTS.has(raw.context as PaywallContext)
    ? raw.context as PaywallContext
    : null;
  const source = typeof raw.source === "string"
    ? raw.source.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 80) || null
    : null;
  const postCheckoutIntent = raw.postCheckoutIntent === "connect_instagram"
    || raw.postCheckoutIntent === "join_community"
    || raw.postCheckoutIntent === "watch_recorded_meeting"
    ? raw.postCheckoutIntent
    : null;

  return {
    context,
    source,
    returnTo: sanitizeCheckoutReturnTo(raw.returnTo),
    postCheckoutIntent,
  };
}

export function checkoutJourneyToMetadata(journey: CheckoutJourney): Record<string, string> {
  return {
    ...(journey.context ? { [CHECKOUT_JOURNEY_METADATA_KEYS.context]: journey.context } : {}),
    ...(journey.source ? { [CHECKOUT_JOURNEY_METADATA_KEYS.source]: journey.source } : {}),
    ...(journey.returnTo ? { [CHECKOUT_JOURNEY_METADATA_KEYS.returnTo]: journey.returnTo } : {}),
    ...(journey.postCheckoutIntent
      ? { [CHECKOUT_JOURNEY_METADATA_KEYS.postCheckoutIntent]: journey.postCheckoutIntent }
      : {}),
  };
}

export function checkoutJourneyFromMetadata(
  metadata: Record<string, string | null | undefined> | null | undefined,
): CheckoutJourney {
  return normalizeCheckoutJourney({
    context: metadata?.[CHECKOUT_JOURNEY_METADATA_KEYS.context],
    source: metadata?.[CHECKOUT_JOURNEY_METADATA_KEYS.source],
    returnTo: metadata?.[CHECKOUT_JOURNEY_METADATA_KEYS.returnTo],
    postCheckoutIntent: metadata?.[CHECKOUT_JOURNEY_METADATA_KEYS.postCheckoutIntent],
  });
}
