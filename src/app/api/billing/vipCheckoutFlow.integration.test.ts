/** @jest-environment node */

/**
 * O fluxo d2cVIP de ponta a ponta: rota de assinatura → Stripe → webhook.
 *
 * Os testes unitários de cada lado passavam mesmo quando os dois discordavam do
 * contrato entre eles — foi assim que o `pending` gravado antes do pagamento
 * trancou usuários de verdade fora da compra. Aqui os dois módulos operam sobre
 * o MESMO documento de usuário, que é o que a produção faz.
 */

import { NextRequest } from "next/server";

const sharedStripe = {
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
  invoicePayments: { list: jest.fn() },
  paymentIntents: { retrieve: jest.fn() },
  charges: { retrieve: jest.fn() },
};

jest.mock("@/app/lib/stripe", () => ({ stripe: sharedStripe }));
jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined }) }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }), { virtual: true });
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/lib/mongoTransient", () => ({
  withMongoTransientRetry: jest.fn(async (fn: any) => fn()),
  getErrorMessage: jest.fn((err: any) => err?.message || String(err)),
  isTransientMongoError: jest.fn(() => false),
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/app/models/User", () => ({ findById: jest.fn(), findOne: jest.fn() }));
jest.mock("@/server/db/models/User", () => ({
  User: { findOne: jest.fn(), findById: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("@/server/stripe/webhook-helpers", () => ({
  findUserByCustomerId: jest.fn(),
  markEventIfNew: jest.fn(async () => true),
  ensureInvoiceIdempotent: jest.fn(async () => true),
  ensureSubscriptionFirstTime: jest.fn(async () => true),
  ensureBuyerFirstCommission: jest.fn(async () => true),
  calcCommissionCents: jest.fn(() => 0),
  addDays: jest.fn(() => new Date()),
}));
jest.mock("@/utils/rateLimit", () => ({ checkRateLimit: jest.fn(async () => ({ allowed: true })) }));
jest.mock("@/utils/stripeHelpers", () => ({
  getOrCreateStripeCustomerId: jest.fn(async () => "cus_vip"),
  isStripeResourceMissingError: jest.fn(() => false),
  persistStaleStripeBillingPatch: jest.fn(),
}));
jest.mock("@/app/lib/affiliate", () => ({
  resolveAffiliateCode: jest.fn(() => ({ code: null, source: null })),
}));
jest.mock("@/server/db/models/AffiliateIndexes", () => ({
  AffiliateBuyerCommissionIndex: { exists: jest.fn().mockResolvedValue(false) },
}));
jest.mock("@/server/affiliate/balance", () => ({ adjustBalance: jest.fn() }));
jest.mock("@/server/affiliate/refund", () => ({ processAffiliateRefund: jest.fn() }));
jest.mock("@/app/lib/emailService", () => ({
  sendProWelcomeEmail: jest.fn(),
  sendPaymentFailureEmail: jest.fn(),
  sendSubscriptionCanceledEmail: jest.fn(),
  sendPaymentReceiptEmail: jest.fn(),
}));
jest.mock("@/app/services/affiliate/calcCommissionCents", () => ({
  getCommissionRateBps: jest.fn(() => 0),
}));

const { getServerSession } = require("next-auth/next");
const AppUser = require("@/app/models/User");
const webhookHelpers = require("@/server/stripe/webhook-helpers");
const { POST: subscribe } = require("@/app/api/billing/subscribe/route");
const { handleStripeEvent } = require("@/server/stripe/handle-stripe-event");

const USER_ID = "6a74d470e2e3cf79a3095415";
const PERIOD_END = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

/** Um documento só, compartilhado pelos dois módulos — como em produção. */
function buildUser() {
  return {
    _id: USER_ID,
    email: "vip@test.com",
    name: "Ana",
    planStatus: "inactive",
    stripeCustomerId: "cus_vip",
    stripeSubscriptionId: null,
    pendingCheckoutSessionId: null,
    pendingCheckoutExpiresAt: null,
    commissionLog: [],
    save: jest.fn(async function save(this: any) { return this; }),
  };
}

function subscribeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/billing/subscribe", {
    method: "POST",
    body: JSON.stringify({ plan: "monthly", currency: "BRL", promotionCode: "d2cVIP", ...body }),
    headers: { "content-type": "application/json" },
  });
}

function activeSubscription() {
  return {
    id: "sub_vip",
    status: "active",
    cancel_at_period_end: false,
    items: {
      data: [
        {
          current_period_end: PERIOD_END,
          price: { id: "price_monthly_brl", currency: "brl", recurring: { interval: "month" } },
        },
      ],
    },
  };
}

let user: ReturnType<typeof buildUser>;

beforeEach(() => {
  jest.clearAllMocks();
  user = buildUser();

  (getServerSession as jest.Mock).mockResolvedValue({
    user: { id: USER_ID, email: "vip@test.com" },
  });
  (AppUser.findById as jest.Mock).mockResolvedValue(user);
  (webhookHelpers.findUserByCustomerId as jest.Mock).mockResolvedValue(user);
  (webhookHelpers.markEventIfNew as jest.Mock).mockResolvedValue(true);

  sharedStripe.subscriptions.list.mockResolvedValue({ data: [] });
  sharedStripe.subscriptions.retrieve.mockResolvedValue(activeSubscription());
  sharedStripe.invoices.list.mockResolvedValue({ data: [] });
  sharedStripe.promotionCodes.list.mockResolvedValue({
    data: [
      {
        id: "promo_d2cvip",
        code: "d2cVIP",
        active: true,
        times_redeemed: 6,
        restrictions: { first_time_transaction: true },
      },
    ],
  });
  sharedStripe.checkout.sessions.create.mockResolvedValue({
    id: "cs_first",
    url: "https://checkout.stripe.com/first",
    expires_at: Math.floor(Date.now() / 1000) + 86_400,
  });

  delete process.env.D2C_VIP_MAX_REDEMPTIONS;
  delete process.env.D2C_VIP_EXPIRES_AT;
  process.env.STRIPE_PRICE_MONTHLY_BRL = "price_monthly_brl";
  process.env.STRIPE_PRICE_ANNUAL_BRL = "price_annual_brl";
});

describe("fluxo d2cVIP de ponta a ponta", () => {
  it("assina, não trava o usuário antes do pagamento, e ativa pelo webhook", async () => {
    const res = await subscribe(subscribeRequest({}));
    expect(res.status).toBe(200);
    expect((await res.json()).checkoutUrl).toBe("https://checkout.stripe.com/first");

    // Antes do pagamento: nada de acesso, mas também nada de bloqueio.
    expect(user.planStatus).toBe("inactive");
    expect(user.pendingCheckoutSessionId).toBe("cs_first");

    await handleStripeEvent({
      id: "evt_created",
      type: "customer.subscription.created",
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: "sub_vip", customer: "cus_vip" } },
    } as any);

    expect(user.planStatus).toBe("active");
    expect(user.stripeSubscriptionId).toBe("sub_vip");
    // O checkout pendente tem que morrer aqui, senão sobra lixo no documento.
    expect(user.pendingCheckoutSessionId).toBeNull();
  });

  it("abandona o checkout, é liberado pelo webhook, e consegue assinar de novo", async () => {
    await subscribe(subscribeRequest({}));
    expect(user.pendingCheckoutSessionId).toBe("cs_first");

    await handleStripeEvent({
      id: "evt_expired",
      type: "checkout.session.expired",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: { id: "cs_first", mode: "subscription", customer: "cus_vip", client_reference_id: USER_ID },
      },
    } as any);

    expect(user.planStatus).toBe("inactive");
    expect(user.pendingCheckoutSessionId).toBeNull();

    sharedStripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_second",
      url: "https://checkout.stripe.com/second",
    });

    const retry = await subscribe(subscribeRequest({}));
    expect(retry.status).toBe(200);
    expect(user.pendingCheckoutSessionId).toBe("cs_second");
  });

  it("abandona o checkout e consegue assinar de novo mesmo se o webhook nunca chegar", async () => {
    await subscribe(subscribeRequest({}));

    // Simula o estado antigo: pendente, sem assinatura para retomar.
    user.planStatus = "pending";
    user.stripeSubscriptionId = null;

    sharedStripe.checkout.sessions.create.mockResolvedValue({
      id: "cs_selfheal",
      url: "https://checkout.stripe.com/selfheal",
    });

    const retry = await subscribe(subscribeRequest({}));

    expect(retry.status).toBe(200);
    expect(user.pendingCheckoutSessionId).toBe("cs_selfheal");
  });

  it("não derruba quem já está ativo quando uma sessão velha expira", async () => {
    user.planStatus = "active";
    user.stripeSubscriptionId = "sub_vip";
    user.pendingCheckoutSessionId = null;

    await handleStripeEvent({
      id: "evt_expired_late",
      type: "checkout.session.expired",
      created: Math.floor(Date.now() / 1000),
      data: {
        object: { id: "cs_velha", mode: "subscription", customer: "cus_vip", client_reference_id: USER_ID },
      },
    } as any);

    expect(user.planStatus).toBe("active");
    expect(user.stripeSubscriptionId).toBe("sub_vip");
  });

  it("recusa ex-assinante em português, sem chegar ao Stripe", async () => {
    sharedStripe.invoices.list.mockResolvedValue({ data: [{ amount_paid: 9700 }] });

    const res = await subscribe(subscribeRequest({}));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.code).toBe("PROMOTION_NOT_ELIGIBLE");
    expect(body.message).toContain("primeira assinatura");
    expect(sharedStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("recusa o cupom no plano anual antes de criar qualquer coisa", async () => {
    const res = await subscribe(subscribeRequest({ plan: "annual" }));

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("PROMOTION_NOT_AVAILABLE_FOR_PLAN");
    expect(sharedStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });

  it("fecha a campanha quando o teto é atingido, sem afetar quem já assinou", async () => {
    process.env.D2C_VIP_MAX_REDEMPTIONS = "6";

    const res = await subscribe(subscribeRequest({}));

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("PROMOTION_CAMPAIGN_CLOSED");
    expect(user.planStatus).toBe("inactive");
    expect(sharedStripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
