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
  calcCommissionCents: jest.fn(() => 4500),
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
  getCommissionRateBps: jest.fn(() => 5000),
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

  test('creates a pending 50% commission only on the first paid invoice of the indicated creator', async () => {
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
      amountCents: 4500,
      commissionRateBps: 5000,
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
