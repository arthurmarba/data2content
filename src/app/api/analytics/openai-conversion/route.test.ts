/** @jest-environment node */

import { NextRequest } from "next/server";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { retrieve: jest.fn() } },
    subscriptions: { retrieve: jest.fn() },
  },
}));
jest.mock("@/app/lib/analytics/openAiConversions", () => ({
  sendOpenAiSubscriptionConversion: jest.fn(),
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { warn: jest.fn() },
}));

const { getServerSession } = require("next-auth/next") as { getServerSession: jest.Mock };
const { stripe } = require("@/app/lib/stripe") as {
  stripe: {
    checkout: { sessions: { retrieve: jest.Mock } };
    subscriptions: { retrieve: jest.Mock };
  };
};
const { sendOpenAiSubscriptionConversion } = require(
  "@/app/lib/analytics/openAiConversions"
) as { sendOpenAiSubscriptionConversion: jest.Mock };
const { POST } = require("./route") as typeof import("./route");

function request(body: Record<string, unknown>, consent = "granted") {
  return new NextRequest("https://data2content.ai/api/analytics/openai-conversion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: `cookie_consent=${consent}; __obref=browser-ref; __oppref=click-ref`,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/analytics/openai-conversion", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({
      user: { id: "user-1", email: "user@example.com" },
    });
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      client_reference_id: "user-1",
      metadata: { userId: "user-1" },
      status: "complete",
      payment_status: "paid",
      subscription: "sub_test_123",
    });
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_test_123",
      status: "active",
      metadata: { userId: "user-1" },
    });
    sendOpenAiSubscriptionConversion.mockResolvedValue({
      delivered: false,
      reason: "not_configured",
    });
  });

  it("does nothing without explicit measurement consent", async () => {
    const response = await POST(request({ attemptId: "cs_test_123" }, "denied"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      delivered: false,
      reason: "consent_required",
    });
    expect(getServerSession).not.toHaveBeenCalled();
    expect(sendOpenAiSubscriptionConversion).not.toHaveBeenCalled();
  });

  it("verifies ownership and prepares the same event ID used by the browser pixel", async () => {
    const response = await POST(request({
      attemptId: "cs_test_123",
      planId: "d2c_pro_annual",
    }));

    expect(response.status).toBe(200);
    expect(sendOpenAiSubscriptionConversion).toHaveBeenCalledWith(expect.objectContaining({
      eventId: "d2c_subscription_cs_test_123",
      planId: "d2c_pro_annual",
      email: "user@example.com",
      externalId: "user-1",
      obref: "browser-ref",
      oppref: "click-ref",
      sourceUrl: "https://data2content.ai/billing/success",
    }));
  });

  it("rejects a checkout that belongs to another account", async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      client_reference_id: "user-2",
      metadata: { userId: "user-2" },
    });

    const response = await POST(request({ attemptId: "cs_test_123" }));

    expect(response.status).toBe(403);
    expect(sendOpenAiSubscriptionConversion).not.toHaveBeenCalled();
  });

  it("does not send a conversion before Checkout is complete", async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      client_reference_id: "user-1",
      metadata: { userId: "user-1" },
      status: "open",
      payment_status: "unpaid",
      subscription: null,
    });

    const response = await POST(request({ attemptId: "cs_test_123" }));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      ok: true,
      delivered: false,
      reason: "subscription_not_confirmed",
    });
    expect(sendOpenAiSubscriptionConversion).not.toHaveBeenCalled();
  });

  it("does not send a conversion for an inactive subscription", async () => {
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_test_123",
      status: "incomplete",
      metadata: { userId: "user-1" },
    });

    const response = await POST(request({ attemptId: "cs_test_123" }));

    expect(response.status).toBe(409);
    expect(sendOpenAiSubscriptionConversion).not.toHaveBeenCalled();
  });
});
