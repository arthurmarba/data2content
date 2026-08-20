/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }), { virtual: true });
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({ findById: jest.fn() }));
jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
    },
  },
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const { connectToDatabase } = require("@/app/lib/mongoose");
const User = require("@/app/models/User");
const { stripe } = require("@/app/lib/stripe");
const { POST } = require("./route");

const createRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/billing/cancel", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  jest.clearAllMocks();
  getServerSession.mockResolvedValue({ user: { id: "u1" } });
  connectToDatabase.mockResolvedValue(undefined);
});

describe("POST /api/billing/cancel", () => {
  it("rejects cancellation without a useful justification before touching Stripe", async () => {
    const response = await POST(createRequest({ reasons: ["Outro"], comment: "ok" }));

    expect(response.status).toBe(422);
    expect(stripe.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(User.findById).not.toHaveBeenCalled();
  });

  it("stores the full reason in Stripe metadata and native cancellation details", async () => {
    const user = {
      _id: "u1",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      save: jest.fn(),
    };
    User.findById.mockResolvedValue(user);
    stripe.subscriptions.retrieve.mockResolvedValue({
      id: "sub_1",
      status: "active",
      items: { data: [{ price: { id: "price_1", currency: "brl", recurring: { interval: "month" } } }] },
    });
    stripe.subscriptions.update.mockResolvedValue({
      id: "sub_1",
      status: "active",
      cancel_at_period_end: true,
      current_period_end: 1_800_000_000,
      items: { data: [{ price: { id: "price_1", currency: "brl", recurring: { interval: "month" } } }] },
    });

    const response = await POST(
      createRequest({
        reasons: ["Preço muito alto", "Não uso o suficiente"],
        comment: "O valor ficou acima do meu orçamento atual.",
      }),
    );

    expect(response.status).toBe(200);
    expect(stripe.subscriptions.update).toHaveBeenCalledWith("sub_1", {
      cancel_at_period_end: true,
      metadata: {
        cancellation_reasons: "Preço muito alto, Não uso o suficiente",
        cancellation_comment: "O valor ficou acima do meu orçamento atual.",
        cancellation_source: "d2c_billing",
      },
      cancellation_details: {
        feedback: "too_expensive",
        comment: "O valor ficou acima do meu orçamento atual.",
      },
    });
    expect(user.save).toHaveBeenCalled();
  });
});
