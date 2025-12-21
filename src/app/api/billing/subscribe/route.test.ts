/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }), { virtual: true });
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      list: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      cancel: jest.fn(),
    },
    checkout: { sessions: { create: jest.fn() } },
    promotionCodes: { list: jest.fn() },
    coupons: { retrieve: jest.fn() },
    invoices: { retrieve: jest.fn() },
  },
}));
jest.mock("@/utils/rateLimit", () => ({ checkRateLimit: jest.fn() }));
jest.mock("@/utils/stripeHelpers", () => ({ getOrCreateStripeCustomerId: jest.fn() }));
jest.mock("@/app/lib/affiliate", () => ({
  resolveAffiliateCode: jest.fn(() => ({ code: null, source: null })),
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const { connectToDatabase } = require("@/app/lib/mongoose");
const User = require("@/app/models/User");
const { stripe } = require("@/app/lib/stripe");
const { checkRateLimit } = require("@/utils/rateLimit");
const { getOrCreateStripeCustomerId } = require("@/utils/stripeHelpers");
const { POST } = require("./route");

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (User as any).findById as jest.Mock;
const mockStripeList = (stripe as any).subscriptions.list as jest.Mock;
const mockCheckRateLimit = checkRateLimit as jest.Mock;
const mockGetCustomerId = getOrCreateStripeCustomerId as jest.Mock;

const createRequest = (body: any) =>
  new NextRequest("http://localhost/api/billing/subscribe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
  mockCheckRateLimit.mockResolvedValue({ allowed: true });
  mockGetCustomerId.mockResolvedValue("cus_123");
  process.env.STRIPE_PRICE_MONTHLY_BRL = "price_monthly_brl";
  process.env.STRIPE_PRICE_ANNUAL_BRL = "price_annual_brl";
  process.env.STRIPE_PRICE_MONTHLY_USD = "price_monthly_usd";
  process.env.STRIPE_PRICE_ANNUAL_USD = "price_annual_usd";
});

describe("POST /api/billing/subscribe", () => {
  it("blocks when DB says active", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1", email: "u1@test.com" } });
    mockFindById.mockResolvedValue({ _id: "u1", planStatus: "active", stripeCustomerId: "cus_1" });

    const res = await POST(createRequest({ plan: "monthly", currency: "BRL" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SUBSCRIPTION_ACTIVE_USE_CHANGE_PLAN");
    expect(mockStripeList).not.toHaveBeenCalled();
  });

  it("blocks when Stripe has active subscription", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u2", email: "u2@test.com" } });
    mockFindById.mockResolvedValue({ _id: "u2", planStatus: "inactive", stripeCustomerId: "cus_123" });
    mockStripeList.mockResolvedValue({
      data: [{ id: "sub_active", status: "active", items: { data: [] } }],
    });

    const res = await POST(createRequest({ plan: "monthly", currency: "BRL" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("SUBSCRIPTION_ACTIVE");
  });

  it("blocks when Stripe has past_due/unpaid", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u3", email: "u3@test.com" } });
    mockFindById.mockResolvedValue({ _id: "u3", planStatus: "inactive", stripeCustomerId: "cus_123" });
    mockStripeList.mockResolvedValue({
      data: [{ id: "sub_past_due", status: "past_due", items: { data: [] } }],
    });

    const res = await POST(createRequest({ plan: "monthly", currency: "BRL" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("PAYMENT_ISSUE");
  });
});
