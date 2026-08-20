/** @jest-environment node */

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({ findById: jest.fn() }));
jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    subscriptions: { retrieve: jest.fn() },
    billingPortal: {
      configurations: { list: jest.fn(), retrieve: jest.fn() },
      sessions: { create: jest.fn() },
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

const user = {
  _id: "u1",
  stripeCustomerId: "cus_1",
  stripeSubscriptionId: "sub_1",
  planStatus: "active",
};

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.STRIPE_BILLING_PORTAL_CONFIG_ID;
  getServerSession.mockResolvedValue({ user: { id: "u1" } });
  connectToDatabase.mockResolvedValue(undefined);
  User.findById.mockReturnValue({ lean: jest.fn().mockResolvedValue(user) });
});

describe("POST /api/billing/portal", () => {
  it("fails closed when the Stripe Portal permits cancellation", async () => {
    stripe.billingPortal.configurations.list.mockResolvedValue({
      data: [{
        id: "bpc_default",
        is_default: true,
        features: { subscription_cancel: { enabled: true } },
      }],
    });

    const response = await POST();

    expect(response.status).toBe(503);
    expect(stripe.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it("opens the portal with an explicit safe configuration", async () => {
    stripe.billingPortal.configurations.list.mockResolvedValue({
      data: [{
        id: "bpc_default",
        is_default: true,
        features: { subscription_cancel: { enabled: false } },
      }],
    });
    stripe.billingPortal.sessions.create.mockResolvedValue({ url: "https://billing.stripe.test/session" });

    const response = await POST();

    expect(response.status).toBe(200);
    expect(stripe.billingPortal.sessions.create).toHaveBeenCalledWith({
      customer: "cus_1",
      return_url: "http://localhost:3000/dashboard/billing",
      configuration: "bpc_default",
    });
  });
});
