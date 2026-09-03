/** @jest-environment node */

import {
  hashOpenAiEmail,
  hashOpenAiExternalId,
  sendOpenAiSubscriptionConversion,
} from "./openAiConversions";

describe("OpenAI Conversions API client", () => {
  const originalPixelId = process.env.OPENAI_ADS_PIXEL_ID;
  const originalPublicPixelId = process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID;
  const originalApiKey = process.env.OPENAI_ADS_CONVERSIONS_API_KEY;
  const originalValidateOnly = process.env.OPENAI_ADS_CAPI_VALIDATE_ONLY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.OPENAI_ADS_PIXEL_ID = originalPixelId;
    process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID = originalPublicPixelId;
    process.env.OPENAI_ADS_CONVERSIONS_API_KEY = originalApiKey;
    process.env.OPENAI_ADS_CAPI_VALIDATE_ONLY = originalValidateOnly;
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it("normalizes and hashes identifiers exactly once", () => {
    expect(hashOpenAiEmail(" User@Example.COM ")).toBe(
      "b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514",
    );
    expect(hashOpenAiExternalId(" Customer-123 ")).toBe(
      hashOpenAiExternalId("Customer-123"),
    );
  });

  it("stays disabled when credentials have not been configured", async () => {
    delete process.env.OPENAI_ADS_PIXEL_ID;
    delete process.env.NEXT_PUBLIC_OPENAI_ADS_PIXEL_ID;
    delete process.env.OPENAI_ADS_CONVERSIONS_API_KEY;
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;

    await expect(sendOpenAiSubscriptionConversion({
      eventId: "d2c_subscription_cs_test_123",
      timestampMs: 1_773_892_800_000,
      sourceUrl: "https://data2content.ai/billing/success",
      planId: "d2c_pro_monthly",
    })).resolves.toEqual({ delivered: false, reason: "not_configured" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a consent-approved, deduplicated subscription event", async () => {
    process.env.OPENAI_ADS_PIXEL_ID = "pixel-123";
    process.env.OPENAI_ADS_CONVERSIONS_API_KEY = "secret-key";
    process.env.OPENAI_ADS_CAPI_VALIDATE_ONLY = "1";
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as typeof fetch;

    await expect(sendOpenAiSubscriptionConversion({
      eventId: "d2c_subscription_cs_test_123",
      timestampMs: 1_773_892_800_000,
      sourceUrl: "https://data2content.ai/billing/success",
      planId: "d2c_pro_monthly",
      email: " User@Example.COM ",
      externalId: "user-123",
      obref: "browser-ref",
      oppref: "click-ref",
    })).resolves.toEqual({ delivered: true, status: 200, validateOnly: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://bzr.openai.com/v1/events?pid=pixel-123");
    expect(init.headers).toMatchObject({ Authorization: "Bearer secret-key" });
    expect(JSON.parse(String(init.body))).toMatchObject({
      validate_only: true,
      integration_source: "data2content",
      events: [{
        id: "d2c_subscription_cs_test_123",
        type: "subscription_created",
        oppref: "click-ref",
        action_source: "web",
        user: {
          obref: "browser-ref",
          emails_sha256: ["b4c9a289323b21a01c3e940f150eb9b8c542587f1abfd8f0e1cc1ffc5e475514"],
          external_ids_sha256: [hashOpenAiExternalId("user-123")],
        },
        data: { type: "plan_enrollment", plan_id: "d2c_pro_monthly" },
      }],
    });
  });
});
