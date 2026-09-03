/** @jest-environment node */

import { NextRequest } from "next/server";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    checkout: { sessions: { retrieve: jest.fn() } },
    subscriptions: { retrieve: jest.fn() },
  },
}));

const { getServerSession } = require("next-auth/next") as { getServerSession: jest.Mock };
const { stripe } = require("@/app/lib/stripe") as {
  stripe: {
    checkout: { sessions: { retrieve: jest.Mock } };
    subscriptions: { retrieve: jest.Mock };
  };
};
const { GET } = require("./route") as typeof import("./route");

describe("GET /api/billing/checkout-context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: "user-1" } });
  });

  it("recupera o fluxo ChatGPT de uma sessão pertencente ao usuário", async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      client_reference_id: "user-1",
      metadata: {
        userId: "user-1",
        d2c_context: "chatgpt_intelligence",
        d2c_source: "chatgpt_profile_upgrade",
        d2c_return_to: "/dashboard/profile?source=chatgpt",
        d2c_post_checkout: "connect_instagram",
      },
    });

    const response = await GET(new NextRequest(
      "http://localhost/api/billing/checkout-context?attempt_id=cs_test_123",
    ));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      journey: {
        context: "chatgpt_intelligence",
        source: "chatgpt_profile_upgrade",
        returnTo: "/dashboard/profile?source=chatgpt",
        postCheckoutIntent: "connect_instagram",
      },
    });
  });

  it("não revela metadados de outra conta", async () => {
    stripe.checkout.sessions.retrieve.mockResolvedValue({
      client_reference_id: "user-2",
      metadata: { userId: "user-2" },
    });

    const response = await GET(new NextRequest(
      "http://localhost/api/billing/checkout-context?attempt_id=cs_test_123",
    ));

    expect(response.status).toBe(403);
  });
});
