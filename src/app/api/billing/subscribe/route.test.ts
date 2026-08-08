/** @jest-environment node */
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
    invoices: { retrieve: jest.fn(), list: jest.fn() },
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
jest.mock("@/server/db/models/AffiliateIndexes", () => ({
  AffiliateBuyerCommissionIndex: { exists: jest.fn().mockResolvedValue(false) },
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
  (stripe as any).invoices.list.mockResolvedValue({ data: [] });
  delete process.env.D2C_VIP_MAX_REDEMPTIONS;
  delete process.env.D2C_VIP_EXPIRES_AT;
  process.env.STRIPE_PRICE_MONTHLY_BRL = "price_monthly_brl";
  process.env.STRIPE_PRICE_ANNUAL_BRL = "price_annual_brl";
  process.env.STRIPE_PRICE_MONTHLY_USD = "price_monthly_usd";
  process.env.STRIPE_PRICE_ANNUAL_USD = "price_annual_usd";
});

describe("POST /api/billing/subscribe", () => {
  it("rejects d2cVIP on the annual plan before creating Stripe resources", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "vip-annual", email: "vip-annual@test.com" } });

    const res = await POST(createRequest({
      plan: "annual",
      currency: "BRL",
      promotionCode: "d2cVIP",
    }));

    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ code: "PROMOTION_NOT_AVAILABLE_FOR_PLAN" });
    expect(mockConnect).not.toHaveBeenCalled();
    expect(mockStripeCreate).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("creates a monthly d2cVIP Checkout that collects the card before the free month", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "vip-monthly", email: "vip-monthly@test.com" } });
    const save = jest.fn();
    const buyer = {
      _id: "vip-monthly",
      planStatus: "inactive",
      stripeCustomerId: "cus_123",
      save,
    };
    mockFindById.mockResolvedValue(buyer);
    mockStripeList.mockResolvedValue({ data: [] });
    stripe.promotionCodes.list.mockResolvedValue({
      data: [
        {
          id: "promo_d2cvip",
          code: "d2cVIP",
          active: true,
          restrictions: { first_time_transaction: true },
        },
      ],
    });
    stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_d2cvip",
      url: "https://checkout.stripe.com/d2cvip",
      expires_at: 1_800_000_000,
    });

    const res = await POST(createRequest({
      plan: "monthly",
      currency: "BRL",
      promotionCode: "d2cVIP",
      successUrl: "http://localhost/billing/success",
      cancelUrl: "http://localhost/dashboard/billing",
    }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.checkoutUrl).toBe("https://checkout.stripe.com/d2cvip");
    expect(body.promotionCode).toBe("d2cVIP");
    expect(mockStripeCreate).not.toHaveBeenCalled();
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: "subscription",
        customer: "cus_123",
        line_items: [{ price: "price_monthly_brl", quantity: 1 }],
        payment_method_collection: "always",
        discounts: [{ promotion_code: "promo_d2cvip" }],
        subscription_data: {
          metadata: expect.objectContaining({
            userId: "vip-monthly",
            plan: "monthly",
            promotionCode: "D2CVIP",
          }),
        },
      }),
      expect.any(Object),
    );
    // O status só avança quando o webhook confirmar: marcar "pending" aqui
    // trancava quem fechasse a aba do Stripe sem concluir o checkout.
    expect((buyer as any).planStatus).toBe("inactive");
    expect((buyer as any).pendingCheckoutSessionId).toBe("cs_d2cvip");
    expect((buyer as any).pendingCheckoutExpiresAt).toEqual(new Date(1_800_000_000 * 1000));
    expect((buyer as any).planType).toBe("monthly");
    expect(save).toHaveBeenCalled();
  });

  it("lets an abandoned hosted checkout retry instead of blocking on stale pending", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u-retry", email: "u-retry@test.com" } });
    const save = jest.fn();
    const buyer = {
      _id: "u-retry",
      planStatus: "pending",
      stripeSubscriptionId: null,
      stripeCustomerId: "cus_123",
      pendingCheckoutSessionId: "cs_abandoned",
      save,
    };
    mockFindById.mockResolvedValue(buyer);
    mockStripeList.mockResolvedValue({ data: [] });
    stripe.promotionCodes.list.mockResolvedValue({
      data: [{ id: "promo_d2cvip", code: "d2cVIP", active: true, restrictions: {} }],
    });
    stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_new",
      url: "https://checkout.stripe.com/new",
    });

    const res = await POST(createRequest({
      plan: "monthly",
      currency: "BRL",
      promotionCode: "d2cVIP",
    }));

    expect(res.status).toBe(200);
    expect((await res.json()).checkoutUrl).toBe("https://checkout.stripe.com/new");
    expect((buyer as any).pendingCheckoutSessionId).toBe("cs_new");
  });

  it("still blocks a pending checkout that has a real subscription to resume", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u-resume", email: "u-resume@test.com" } });
    mockFindById.mockResolvedValue({
      _id: "u-resume",
      planStatus: "pending",
      stripeSubscriptionId: "sub_pending",
      stripeCustomerId: "cus_123",
      save: jest.fn(),
    });

    const res = await POST(createRequest({ plan: "monthly", currency: "BRL" }));

    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: "BILLING_BLOCKED_PENDING_OR_INCOMPLETE" });
  });

  it("rejects d2cVIP in Portuguese when the customer already paid before", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u-old", email: "u-old@test.com" } });
    mockFindById.mockResolvedValue({
      _id: "u-old",
      planStatus: "inactive",
      stripeCustomerId: "cus_123",
      save: jest.fn(),
    });
    mockStripeList.mockResolvedValue({ data: [] });
    stripe.promotionCodes.list.mockResolvedValue({
      data: [
        {
          id: "promo_d2cvip",
          code: "d2cVIP",
          active: true,
          restrictions: { first_time_transaction: true },
        },
      ],
    });
    // Fatura de R$ 0 do próprio VIP não conta; uma cobrança real conta.
    (stripe as any).invoices.list.mockResolvedValue({
      data: [{ amount_paid: 0 }, { amount_paid: 9700 }],
    });

    const res = await POST(createRequest({
      plan: "monthly",
      currency: "BRL",
      promotionCode: "d2cVIP",
    }));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("PROMOTION_NOT_ELIGIBLE");
    expect(body.message).toContain("primeira assinatura");
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("keeps a zero-amount invoice from disqualifying the coupon", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u-zero", email: "u-zero@test.com" } });
    mockFindById.mockResolvedValue({
      _id: "u-zero",
      planStatus: "inactive",
      stripeCustomerId: "cus_123",
      save: jest.fn(),
    });
    mockStripeList.mockResolvedValue({ data: [] });
    stripe.promotionCodes.list.mockResolvedValue({
      data: [
        {
          id: "promo_d2cvip",
          code: "d2cVIP",
          active: true,
          restrictions: { first_time_transaction: true },
        },
      ],
    });
    (stripe as any).invoices.list.mockResolvedValue({ data: [{ amount_paid: 0 }] });
    stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_zero",
      url: "https://checkout.stripe.com/zero",
    });

    const res = await POST(createRequest({
      plan: "monthly",
      currency: "BRL",
      promotionCode: "d2cVIP",
    }));

    expect(res.status).toBe(200);
  });

  it("translates a Stripe coupon restriction error instead of leaking it raw", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u-raw", email: "u-raw@test.com" } });
    mockFindById.mockResolvedValue({
      _id: "u-raw",
      planStatus: "inactive",
      stripeCustomerId: "cus_123",
      save: jest.fn(),
    });
    mockStripeList.mockResolvedValue({ data: [] });
    stripe.promotionCodes.list.mockResolvedValue({
      data: [{ id: "promo_d2cvip", code: "d2cVIP", active: true, restrictions: {} }],
    });
    stripe.checkout.sessions.create.mockRejectedValue(
      Object.assign(new Error("This promotion code cannot be redeemed."), {
        type: "StripeInvalidRequestError",
        param: "discounts[0][promotion_code]",
      }),
    );

    const res = await POST(createRequest({
      plan: "monthly",
      currency: "BRL",
      promotionCode: "d2cVIP",
    }));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("PROMOTION_NOT_ELIGIBLE");
    expect(body.message).not.toContain("cannot be redeemed");
  });

  it("closes the coupon once the campaign cap is reached", async () => {
    process.env.D2C_VIP_MAX_REDEMPTIONS = "6";
    mockGetServerSession.mockResolvedValue({ user: { id: "u-cap", email: "u-cap@test.com" } });
    mockFindById.mockResolvedValue({
      _id: "u-cap",
      planStatus: "inactive",
      stripeCustomerId: "cus_123",
      save: jest.fn(),
    });
    mockStripeList.mockResolvedValue({ data: [] });
    stripe.promotionCodes.list.mockResolvedValue({
      data: [{ id: "promo_d2cvip", code: "d2cVIP", active: true, times_redeemed: 6, restrictions: {} }],
    });

    const res = await POST(createRequest({
      plan: "monthly",
      currency: "BRL",
      promotionCode: "d2cVIP",
    }));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("PROMOTION_CAMPAIGN_CLOSED");
    expect(body.message).toContain("limite de usos");
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("keeps the coupon open while the cap has room", async () => {
    process.env.D2C_VIP_MAX_REDEMPTIONS = "100";
    mockGetServerSession.mockResolvedValue({ user: { id: "u-room", email: "u-room@test.com" } });
    mockFindById.mockResolvedValue({
      _id: "u-room",
      planStatus: "inactive",
      stripeCustomerId: "cus_123",
      save: jest.fn(),
    });
    mockStripeList.mockResolvedValue({ data: [] });
    stripe.promotionCodes.list.mockResolvedValue({
      data: [{ id: "promo_d2cvip", code: "d2cVIP", active: true, times_redeemed: 6, restrictions: {} }],
    });
    stripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_room",
      url: "https://checkout.stripe.com/room",
    });

    const res = await POST(createRequest({
      plan: "monthly",
      currency: "BRL",
      promotionCode: "d2cVIP",
    }));

    expect(res.status).toBe(200);
  });

  it("closes the coupon after the campaign deadline", async () => {
    process.env.D2C_VIP_EXPIRES_AT = "2020-01-01T00:00:00Z";
    mockGetServerSession.mockResolvedValue({ user: { id: "u-exp", email: "u-exp@test.com" } });
    mockFindById.mockResolvedValue({
      _id: "u-exp",
      planStatus: "inactive",
      stripeCustomerId: "cus_123",
      save: jest.fn(),
    });
    mockStripeList.mockResolvedValue({ data: [] });
    stripe.promotionCodes.list.mockResolvedValue({
      data: [{ id: "promo_d2cvip", code: "d2cVIP", active: true, times_redeemed: 0, restrictions: {} }],
    });

    const res = await POST(createRequest({
      plan: "monthly",
      currency: "BRL",
      promotionCode: "d2cVIP",
    }));

    expect(res.status).toBe(422);
    expect((await res.json()).message).toContain("expirou");
  });

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

  it("attributes the affiliate without attaching a discount", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u4", email: "u4@test.com" } });
    const save = jest.fn();
    const buyer = {
      _id: "u4",
      planStatus: "inactive",
      stripeCustomerId: "cus_123",
      save,
    };
    mockFindById.mockResolvedValue(buyer);
    (User as any).findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "owner1", affiliateCode: "AFF123" }),
      }),
    });
    mockStripeList.mockResolvedValue({ data: [] });
    mockStripeCreate.mockResolvedValue({
      id: "sub_affiliate",
      status: "incomplete",
      latest_invoice: { payment_intent: { client_secret: "cs_affiliate" } },
      items: { data: [{ price: { id: "price_monthly_brl" } }] },
    });

    const res = await POST(createRequest({ plan: "monthly", currency: "BRL", affiliateCode: "AFF123" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.affiliateApplied).toBe(true);
    expect((buyer as any).affiliateUsed).toBe("AFF123");
    expect(save).toHaveBeenCalled();
    expect(mockStripeCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          affiliateCode: "AFF123",
          affiliate_user_id: "owner1",
        }),
      }),
      expect.any(Object),
    );
    expect(mockStripeCreate.mock.calls[0][0]).not.toHaveProperty("discounts");
    expect(stripe.coupons.retrieve).not.toHaveBeenCalled();
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
