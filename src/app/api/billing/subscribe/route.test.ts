/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("next/headers", () => ({
  cookies: () => ({ get: () => undefined }),
}));
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
jest.mock("@/utils/stripeHelpers", () => ({
  getOrCreateStripeCustomerId: jest.fn(),
  isStripeResourceMissingError: jest.fn(),
  persistStaleStripeBillingPatch: jest.fn(),
}));
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
const {
  getOrCreateStripeCustomerId,
  isStripeResourceMissingError,
  persistStaleStripeBillingPatch,
} = require("@/utils/stripeHelpers");
const { POST } = require("./route");

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (User as any).findById as jest.Mock;
const mockStripeList = (stripe as any).subscriptions.list as jest.Mock;
const mockStripeCreate = (stripe as any).subscriptions.create as jest.Mock;
const mockStripeCouponRetrieve = (stripe as any).coupons.retrieve as jest.Mock;
const mockCheckRateLimit = checkRateLimit as jest.Mock;
const mockGetCustomerId = getOrCreateStripeCustomerId as jest.Mock;
const mockIsStripeResourceMissingError = isStripeResourceMissingError as jest.Mock;
const mockPersistStaleStripeBillingPatch = persistStaleStripeBillingPatch as jest.Mock;

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
  mockIsStripeResourceMissingError.mockReturnValue(false);
  mockPersistStaleStripeBillingPatch.mockResolvedValue(undefined);
  process.env.STRIPE_PRICE_MONTHLY_BRL = "price_monthly_brl";
  process.env.STRIPE_PRICE_ANNUAL_BRL = "price_annual_brl";
  process.env.STRIPE_PRICE_MONTHLY_USD = "price_monthly_usd";
  process.env.STRIPE_PRICE_ANNUAL_USD = "price_annual_usd";
  process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL = "coupon_aff_brl";
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

  it("blocks when affiliate coupon is not compliant with 10% once", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u4", email: "u4@test.com" } });
    const save = jest.fn();
    mockFindById.mockResolvedValue({
      _id: "u4",
      planStatus: "inactive",
      stripeCustomerId: "cus_123",
      save,
    });
    (User as any).findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "owner1", affiliateCode: "AFF123" }),
      }),
    });
    mockStripeList.mockResolvedValue({ data: [] });
    mockStripeCouponRetrieve.mockResolvedValue({
      id: "coupon_bad",
      object: "coupon",
      duration: "forever",
      percent_off: 10,
    });

    const res = await POST(createRequest({ plan: "monthly", currency: "BRL", affiliateCode: "AFF123" }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe("AFFILIATE_COUPON_INVALID");
    expect(mockStripeCreate).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it("recreates a stale Stripe customer when list returns resource_missing", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u5", email: "u5@test.com" } });
    const save = jest.fn();
    mockFindById.mockResolvedValue({
      _id: "u5",
      planStatus: "inactive",
      stripeCustomerId: "cus_stale",
      save,
    });
    const missingCustomerError = {
      code: "resource_missing",
      param: "customer",
      type: "StripeInvalidRequestError",
      message: "No such customer",
    };
    mockGetCustomerId.mockResolvedValueOnce("cus_stale").mockResolvedValueOnce("cus_new");
    mockIsStripeResourceMissingError.mockImplementation(
      (error: unknown, resource?: string) => error === missingCustomerError && resource === "customer"
    );
    mockStripeList.mockRejectedValueOnce(missingCustomerError).mockResolvedValueOnce({ data: [] });
    mockStripeCreate.mockResolvedValue({
      id: "sub_123",
      status: "incomplete",
      latest_invoice: {
        payment_intent: {
          client_secret: "cs_test_123",
        },
      },
      items: { data: [{ price: { id: "price_monthly_brl", recurring: { interval: "month" } } }] },
    });

    const res = await POST(createRequest({ plan: "monthly", currency: "BRL" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.subscriptionId).toBe("sub_123");
    expect(mockPersistStaleStripeBillingPatch).toHaveBeenCalledTimes(1);
    expect(mockGetCustomerId).toHaveBeenCalledTimes(2);
    expect(mockStripeList).toHaveBeenCalledTimes(2);
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_new" }),
      expect.any(Object)
    );
    expect(save).toHaveBeenCalled();
  });
});
