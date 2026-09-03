import {
  buildOpenAiSubscriptionEventId,
  hasOpenAiMeasurementConsent,
  normalizeOpenAiAdsAttemptId,
} from "./openAiAdsEvent";

describe("OpenAI Ads event identifiers", () => {
  it("builds a stable subscription event ID from Stripe attempts", () => {
    expect(buildOpenAiSubscriptionEventId("cs_test_123")).toBe(
      "d2c_subscription_cs_test_123",
    );
    expect(buildOpenAiSubscriptionEventId("sub_123")).toBe(
      "d2c_subscription_sub_123",
    );
  });

  it("rejects values that are not Stripe checkout or subscription IDs", () => {
    expect(normalizeOpenAiAdsAttemptId("https://example.com")).toBeNull();
    expect(buildOpenAiSubscriptionEventId("order_123")).toBeNull();
  });

  it("requires explicit analytics consent", () => {
    expect(hasOpenAiMeasurementConsent("a=1; cookie_consent=granted; b=2")).toBe(true);
    expect(hasOpenAiMeasurementConsent("cookie_consent=denied")).toBe(false);
    expect(hasOpenAiMeasurementConsent("")).toBe(false);
  });
});
