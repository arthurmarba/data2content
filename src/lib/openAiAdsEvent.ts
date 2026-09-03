const STRIPE_ATTEMPT_ID_PATTERN = /^(cs_|sub_)[A-Za-z0-9_]+$/;

export function normalizeOpenAiAdsAttemptId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return STRIPE_ATTEMPT_ID_PATTERN.test(normalized) ? normalized : null;
}

export function buildOpenAiSubscriptionEventId(attemptId: unknown): string | null {
  const normalized = normalizeOpenAiAdsAttemptId(attemptId);
  return normalized ? `d2c_subscription_${normalized}` : null;
}

export function hasOpenAiMeasurementConsent(cookieValue: string): boolean {
  return cookieValue
    .split(";")
    .map((item) => item.trim())
    .includes("cookie_consent=granted");
}
