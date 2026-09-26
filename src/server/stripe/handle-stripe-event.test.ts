/** @jest-environment node */

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/mongoTransient', () => ({
  withMongoTransientRetry: jest.fn(async (fn: any) => fn()),
  getErrorMessage: jest.fn((err: any) => err?.message || String(err)),
}));
jest.mock('@/app/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('@/app/lib/stripe', () => ({
  stripe: {
    subscriptions: { retrieve: jest.fn() },
    invoices: { retrieve: jest.fn() },
    invoicePayments: { list: jest.fn() },
    paymentIntents: { retrieve: jest.fn() },
    charges: { retrieve: jest.fn() },
  },
}));
jest.mock('@/server/db/models/User', () => ({
  User: { findOne: jest.fn(), findById: jest.fn(), updateOne: jest.fn() },
}));
jest.mock('@/server/stripe/webhook-helpers', () => ({
  findUserByCustomerId: jest.fn(),
  markEventIfNew: jest.fn(async () => true),
  ensureInvoiceIdempotent: jest.fn(async () => true),
  ensureSubscriptionFirstTime: jest.fn(async () => true),
  ensureBuyerFirstCommission: jest.fn(async () => true),
  calcCommissionCents: jest.fn(() => 1800),
  addDays: jest.fn(() => new Date('2026-03-15T00:00:00.000Z')),
}));
jest.mock('@/server/affiliate/balance', () => ({ adjustBalance: jest.fn() }));
jest.mock('@/server/affiliate/refund', () => ({ processAffiliateRefund: jest.fn() }));
jest.mock('@/app/lib/emailService', () => ({
  sendProWelcomeEmail: jest.fn(),
  sendPaymentFailureEmail: jest.fn(),
  sendSubscriptionCanceledEmail: jest.fn(),
  sendPaymentReceiptEmail: jest.fn(),
}));
jest.mock('@/app/services/affiliate/calcCommissionCents', () => ({
  getCommissionRateBps: jest.fn(() => 2000),
}));

import { User } from '@/server/db/models/User';
import * as webhookHelpers from '@/server/stripe/webhook-helpers';
import { handleStripeEvent } from './handle-stripe-event';
import { stripe } from '@/app/lib/stripe';
import { processAffiliateRefund } from '@/server/affiliate/refund';

export {};

function buildBuyer() {
  return {
    _id: 'buyer1',
    email: 'buyer@test.com',
    name: 'Buyer',
    affiliateUsed: 'AFF123',
    commissionLog: [],
    affiliateFirstCommissionAt: null as Date | null,
    save: jest.fn(async function save() { return this; }),
  };
}

function buildOwner() {
  return {
    _id: 'owner1',
    affiliateCode: 'AFF123',
    commissionLog: [],
    save: jest.fn(async function save() { return this; }),
  };
}

function buildEvent() {
  return {
    id: 'evt_1',
    type: 'invoice.payment_succeeded',
    created: 1_709_894_400,
    data: {
      object: {
        id: 'in_1',
        object: 'invoice',
        customer: 'cus_1',
        subscription: 'sub_1',
        amount_paid: 9000,
        currency: 'brl',
        billing_reason: 'subscription_cycle',
        lines: { data: [{ period: { start: 1_709_894_400, end: 1_712_572_800 } }] },
        metadata: {},
      },
    },
  };
}

describe('handleStripeEvent affiliate commissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (webhookHelpers.ensureInvoiceIdempotent as any).mockResolvedValue(true);
    (webhookHelpers.ensureSubscriptionFirstTime as any).mockResolvedValue(true);
    (webhookHelpers.ensureBuyerFirstCommission as any).mockResolvedValue(true);
    (User as any).updateOne.mockResolvedValue({ modifiedCount: 1, matchedCount: 1 });
    (stripe as any).invoicePayments.list.mockResolvedValue({ data: [], has_more: false });
  });

  test('creates a pending 20% commission only on the first paid invoice of the indicated creator', async () => {
    const buyer = buildBuyer();
    const owner = buildOwner();

    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(buyer);
    (User as any).findOne.mockResolvedValue(owner);

    await handleStripeEvent(buildEvent() as any);

    expect(webhookHelpers.ensureInvoiceIdempotent).toHaveBeenCalledWith('in_1', 'owner1');
    expect(webhookHelpers.ensureSubscriptionFirstTime).toHaveBeenCalledWith('sub_1', 'owner1');
    expect(webhookHelpers.ensureBuyerFirstCommission).toHaveBeenCalledWith('buyer1', 'owner1', 'in_1');
    const commission = (User as any).updateOne.mock.calls[0][1].$push.commissionLog;
    expect(commission).toMatchObject({
      type: 'commission',
      status: 'pending',
      invoiceId: 'in_1',
      subscriptionId: 'sub_1',
      amountCents: 1800,
      commissionRateBps: 2000,
      currency: 'brl',
    });
    expect(buyer.affiliateFirstCommissionAt).toBeInstanceOf(Date);
    expect((User as any).updateOne).toHaveBeenCalledTimes(1);
  });

  test('does not create a second commission when the creator has already consumed the first invoice rule', async () => {
    const buyer = buildBuyer();
    const owner = buildOwner();

    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(buyer);
    (User as any).findOne.mockResolvedValue(owner);
    (webhookHelpers.ensureBuyerFirstCommission as any).mockResolvedValue(false);

    await handleStripeEvent(buildEvent() as any);

    expect((User as any).updateOne).not.toHaveBeenCalled();
  });

  test('extracts the Stripe Basil subscription from parent details', async () => {
    const buyer = buildBuyer();
    const owner = buildOwner();
    const event = buildEvent();
    (event.data.object as any).subscription = null;
    (event.data.object as any).parent = {
      subscription_details: { subscription: 'sub_basil_1' },
    };

    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(buyer);
    (User as any).findOne.mockResolvedValue(owner);

    await handleStripeEvent(event as any);

    expect(webhookHelpers.ensureSubscriptionFirstTime).toHaveBeenCalledWith('sub_basil_1', 'owner1');
    const commission = (User as any).updateOne.mock.calls[0][1].$push.commissionLog;
    expect(commission).toMatchObject({ subscriptionId: 'sub_basil_1' });
  });

  test('does not commission a renewal when the buyer already has a first commission timestamp', async () => {
    const buyer = buildBuyer();
    buyer.affiliateFirstCommissionAt = new Date('2026-01-01T00:00:00.000Z');
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(buyer);
    (User as any).findOne.mockResolvedValue(buildOwner());

    await handleStripeEvent(buildEvent() as any);

    expect(webhookHelpers.ensureInvoiceIdempotent).not.toHaveBeenCalled();
  });

  test('resolves the Basil invoice through invoice payments on charge.refunded', async () => {
    (stripe as any).invoicePayments.list
      .mockResolvedValueOnce({
        data: [{ id: 'inpay_1', status: 'paid', invoice: 'in_basil_1' }],
        has_more: false,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'inpay_1',
          status: 'paid',
          invoice: 'in_basil_1',
          payment: { type: 'payment_intent', payment_intent: 'pi_1' },
        }],
        has_more: false,
      });

    await handleStripeEvent({
      id: 'evt_refund_1',
      type: 'charge.refunded',
      created: 1_709_894_500,
      data: {
        object: {
          id: 'ch_1',
          object: 'charge',
          payment_intent: 'pi_1',
          amount_refunded: 1200,
        },
      },
    } as any);

    expect((stripe as any).invoicePayments.list).toHaveBeenCalledWith({
      payment: { type: 'payment_intent', payment_intent: 'pi_1' },
      limit: 2,
    });
    expect(processAffiliateRefund).toHaveBeenCalledWith(
      'in_basil_1',
      1200,
      expect.objectContaining({ id: 'ch_1' }),
    );
  });

  test('sums refunds across multiple Basil payments for the same invoice', async () => {
    (stripe as any).invoicePayments.list
      .mockResolvedValueOnce({
        data: [{ id: 'inpay_2', status: 'paid', invoice: 'in_multi' }],
        has_more: false,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 'inpay_1', payment: { type: 'payment_intent', payment_intent: 'pi_1' } },
          { id: 'inpay_2', payment: { type: 'payment_intent', payment_intent: 'pi_2' } },
        ],
        has_more: false,
      });
    (stripe as any).paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_1',
      latest_charge: { id: 'ch_1', amount_refunded: 1000 },
    });

    await handleStripeEvent({
      id: 'evt_refund_multi',
      type: 'charge.refunded',
      created: 1_709_894_500,
      data: {
        object: {
          id: 'ch_2',
          object: 'charge',
          payment_intent: 'pi_2',
          amount_refunded: 1000,
        },
      },
    } as any);

    expect(processAffiliateRefund).toHaveBeenCalledWith(
      'in_multi',
      2000,
      expect.objectContaining({ id: 'ch_2' }),
    );
  });
});

describe('handleStripeEvent checkout.session.expired', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (webhookHelpers.markEventIfNew as any).mockResolvedValue(true);
  });

  function buildExpiredEvent(sessionId = 'cs_abandoned') {
    return {
      id: 'evt_expired',
      type: 'checkout.session.expired',
      created: 1_709_894_400,
      data: {
        object: {
          id: sessionId,
          object: 'checkout.session',
          mode: 'subscription',
          customer: 'cus_1',
          client_reference_id: 'buyer1',
        },
      },
    } as any;
  }

  test('frees a user left pending by an abandoned checkout', async () => {
    const buyer = {
      _id: 'buyer1',
      planStatus: 'pending',
      stripeSubscriptionId: null,
      pendingCheckoutSessionId: 'cs_abandoned',
      pendingCheckoutExpiresAt: new Date(),
      save: jest.fn(async function save() { return this; }),
    };
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(buyer);

    await handleStripeEvent(buildExpiredEvent());

    expect(buyer.planStatus).toBe('inactive');
    expect(buyer.pendingCheckoutSessionId).toBeNull();
    expect(buyer.pendingCheckoutExpiresAt).toBeNull();
    expect(buyer.save).toHaveBeenCalled();
  });

  test('never downgrades an active subscription', async () => {
    const buyer = {
      _id: 'buyer1',
      planStatus: 'active',
      stripeSubscriptionId: 'sub_live',
      pendingCheckoutSessionId: 'cs_abandoned',
      save: jest.fn(async function save() { return this; }),
    };
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(buyer);

    await handleStripeEvent(buildExpiredEvent());

    expect(buyer.planStatus).toBe('active');
    expect(buyer.stripeSubscriptionId).toBe('sub_live');
    expect(buyer.pendingCheckoutSessionId).toBeNull();
  });

  test('ignores an old session expiring after a newer checkout started', async () => {
    const buyer = {
      _id: 'buyer1',
      planStatus: 'pending',
      stripeSubscriptionId: null,
      pendingCheckoutSessionId: 'cs_current',
      save: jest.fn(async function save() { return this; }),
    };
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(buyer);

    await handleStripeEvent(buildExpiredEvent('cs_stale'));

    expect(buyer.pendingCheckoutSessionId).toBe('cs_current');
    expect(buyer.planStatus).toBe('pending');
    expect(buyer.save).not.toHaveBeenCalled();
  });
});

describe('handleStripeEvent zero-amount invoices', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (webhookHelpers.markEventIfNew as any).mockResolvedValue(true);
    (webhookHelpers.ensureInvoiceIdempotent as any).mockResolvedValue(true);
    (stripe as any).invoicePayments.list.mockResolvedValue({ data: [], has_more: false });
  });

  /**
   * O fallback só é alcançado quando o retrieve da assinatura falha — que é
   * exatamente a janela em que o status errado fica gravado.
   */
  function buildZeroInvoiceEvent({ subtotal }: { subtotal: number }) {
    return {
      id: `evt_zero_${subtotal}`,
      type: 'invoice.payment_succeeded',
      created: 1_709_894_400,
      data: {
        object: {
          id: 'in_zero',
          object: 'invoice',
          customer: 'cus_1',
          subscription: 'sub_zero',
          amount_paid: 0,
          subtotal,
          total: 0,
          currency: 'brl',
          billing_reason: 'subscription_create',
          lines: { data: [{ period: { start: 1_709_894_400, end: 1_712_572_800 } }] },
          metadata: {},
        },
      },
    } as any;
  }

  test('keeps the d2cVIP subscriber active when the coupon zeroed a full-price invoice', async () => {
    const buyer = {
      _id: 'buyer1',
      email: 'vip@test.com',
      commissionLog: [],
      save: jest.fn(async function save() { return this; }),
    };
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(buyer);
    (stripe as any).subscriptions.retrieve.mockRejectedValue(new Error('stripe indisponível'));

    await handleStripeEvent(buildZeroInvoiceEvent({ subtotal: 9700 }));

    // "trial" não concede acesso neste produto: gravar isso trancaria fora do
    // produto alguém que acabou de assinar.
    expect((buyer as any).planStatus).toBe('active');
  });

  test('still treats a genuine trial invoice as a trial', async () => {
    const buyer = {
      _id: 'buyer1',
      email: 'trial@test.com',
      commissionLog: [],
      save: jest.fn(async function save() { return this; }),
    };
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(buyer);
    (stripe as any).subscriptions.retrieve.mockRejectedValue(new Error('stripe indisponível'));

    await handleStripeEvent(buildZeroInvoiceEvent({ subtotal: 0 }));

    expect((buyer as any).planStatus).toBe('trial');
  });
});

describe('handleStripeEvent — banco fora de sincronia com a assinatura', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (webhookHelpers.markEventIfNew as any).mockResolvedValue(true);
    (stripe as any).invoicePayments.list.mockResolvedValue({ data: [], has_more: false });
  });

  function buildUser(overrides: Record<string, unknown>) {
    return {
      _id: 'user1',
      email: null,
      affiliateUsed: null,
      commissionLog: [],
      save: jest.fn(async function save() { return this; }),
      ...overrides,
    } as any;
  }

  function mockSubscriptions(subs: Record<string, any>) {
    (stripe as any).subscriptions.retrieve.mockImplementation(async (id: string) => {
      if (subs[id]) return subs[id];
      throw Object.assign(new Error(`No such subscription: '${id}'`), {
        code: 'resource_missing',
        param: 'id',
        type: 'StripeInvalidRequestError',
      });
    });
  }

  function paymentFailedEvent(subscription: string) {
    return {
      id: 'evt_failed_final',
      type: 'invoice.payment_failed',
      created: 1_780_000_001,
      data: {
        object: {
          id: 'in_final',
          object: 'invoice',
          customer: 'cus_1',
          status: 'open',
          amount_due: 7990,
          currency: 'brl',
          parent: { subscription_details: { subscription } },
          lines: { data: [] },
        },
      },
    } as any;
  }

  function liveSubscription(id: string, created: number) {
    return {
      id,
      customer: 'cus_1',
      status: 'active',
      created,
      cancel_at_period_end: false,
      latest_invoice: null,
      items: {
        data: [{
          price: { id: 'price_monthly', currency: 'brl', recurring: { interval: 'month' } },
          current_period_end: 1_790_000_000,
        }],
      },
    };
  }

  test('a última falha de cobrança chegando depois do cancelamento não reabre "atrasado"', async () => {
    const user = buildUser({ planStatus: 'canceled', stripeSubscriptionId: 'sub_1' });
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(user);
    mockSubscriptions({ sub_1: { id: 'sub_1', status: 'canceled', created: 100 } });

    await handleStripeEvent(paymentFailedEvent('sub_1'));

    expect(user.planStatus).toBe('canceled');
    expect(user.lastPaymentError).toMatchObject({ paymentId: 'in_final', status: 'failed' });
    expect(user.save).toHaveBeenCalled();
  });

  test('falha numa renovação ainda em cobrança continua marcando "atrasado"', async () => {
    const user = buildUser({ planStatus: 'active', stripeSubscriptionId: 'sub_1' });
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(user);
    mockSubscriptions({ sub_1: { id: 'sub_1', status: 'past_due', created: 100 } });

    await handleStripeEvent(paymentFailedEvent('sub_1'));

    expect(user.planStatus).toBe('past_due');
  });

  test('sem conseguir ler a assinatura, mantém o comportamento antigo', async () => {
    const user = buildUser({ planStatus: 'active', stripeSubscriptionId: 'sub_1' });
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(user);
    (stripe as any).subscriptions.retrieve.mockRejectedValue(new Error('stripe indisponível'));

    await handleStripeEvent(paymentFailedEvent('sub_1'));

    expect(user.planStatus).toBe('past_due');
  });

  test('cancelamento da assinatura verdadeira chega mesmo com o id da fantasma gravado', async () => {
    const user = buildUser({ planStatus: 'past_due', stripeSubscriptionId: 'sub_fantasma', planInterval: 'month' });
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(user);
    mockSubscriptions({ sub_fantasma: { id: 'sub_fantasma', status: 'incomplete_expired', created: 100 } });

    await handleStripeEvent({
      id: 'evt_deleted',
      type: 'customer.subscription.deleted',
      created: 1_780_000_003,
      data: {
        object: { id: 'sub_real', customer: 'cus_1', status: 'canceled', created: 118, ended_at: 1_780_000_000 },
      },
    } as any);

    expect(user.planStatus).toBe('canceled');
    expect(user.stripeSubscriptionId).toBe('sub_real');
    expect(user.planExpiresAt).toEqual(new Date(1_780_000_000 * 1000));
    expect(user.planInterval).toBeUndefined();
  });

  test('cancelamento de uma assinatura velha não derruba quem paga outra viva', async () => {
    const user = buildUser({ planStatus: 'active', stripeSubscriptionId: 'sub_viva' });
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(user);
    mockSubscriptions({ sub_viva: { id: 'sub_viva', status: 'active', created: 200 } });

    await handleStripeEvent({
      id: 'evt_deleted_old',
      type: 'customer.subscription.deleted',
      created: 1_780_000_003,
      data: {
        object: { id: 'sub_velha', customer: 'cus_1', status: 'incomplete_expired', created: 100, ended_at: 101 },
      },
    } as any);

    expect(user.planStatus).toBe('active');
    expect(user.stripeSubscriptionId).toBe('sub_viva');
    expect(user.save).not.toHaveBeenCalled();
  });

  test('atualização da assinatura paga corrige o id da fantasma mesmo com o banco "ativo"', async () => {
    const user = buildUser({ planStatus: 'active', stripeSubscriptionId: 'sub_fantasma' });
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(user);
    mockSubscriptions({
      sub_fantasma: { id: 'sub_fantasma', status: 'incomplete_expired', created: 100 },
      sub_real: liveSubscription('sub_real', 118),
    });

    await handleStripeEvent({
      id: 'evt_updated',
      type: 'customer.subscription.updated',
      created: 1_780_000_003,
      data: { object: liveSubscription('sub_real', 118) },
    } as any);

    expect(user.stripeSubscriptionId).toBe('sub_real');
    expect(user.planStatus).toBe('active');
    expect(user.planExpiresAt).toEqual(new Date(1_790_000_000 * 1000));
  });

  test('renovação paga da assinatura verdadeira também corrige o id', async () => {
    const user = buildUser({ planStatus: 'active', stripeSubscriptionId: 'sub_fantasma' });
    (webhookHelpers.findUserByCustomerId as any).mockResolvedValue(user);
    mockSubscriptions({
      sub_fantasma: { id: 'sub_fantasma', status: 'incomplete_expired', created: 100 },
      sub_real: liveSubscription('sub_real', 118),
    });

    await handleStripeEvent({
      id: 'evt_paid',
      type: 'invoice.payment_succeeded',
      created: 1_780_000_003,
      data: {
        object: {
          id: 'in_cycle',
          object: 'invoice',
          customer: 'cus_1',
          amount_paid: 7990,
          currency: 'brl',
          billing_reason: 'subscription_cycle',
          parent: { subscription_details: { subscription: 'sub_real' } },
          lines: { data: [{ period: { start: 1_787_000_000, end: 1_790_000_000 } }] },
          metadata: {},
        },
      },
    } as any);

    expect(user.stripeSubscriptionId).toBe('sub_real');
    expect(user.planExpiresAt).toEqual(new Date(1_790_000_000 * 1000));
  });
});
