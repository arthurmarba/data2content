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
  },
}));
jest.mock('@/server/db/models/User', () => ({
  User: { findOne: jest.fn(), findById: jest.fn() },
}));
jest.mock('@/server/stripe/webhook-helpers', () => ({
  findUserByCustomerId: jest.fn(),
  markEventIfNew: jest.fn(async () => true),
  ensureInvoiceIdempotent: jest.fn(async () => true),
  ensureSubscriptionFirstTime: jest.fn(async () => true),
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

const { User } = require('@/server/db/models/User');
const webhookHelpers = require('@/server/stripe/webhook-helpers');
const { handleStripeEvent } = require('./handle-stripe-event');

function buildBuyer() {
  return {
    _id: 'buyer1',
    email: 'buyer@test.com',
    name: 'Buyer',
    affiliateUsed: 'AFF123',
    commissionLog: [],
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
  });

  test('creates a pending 50% commission only on the first paid invoice of the subscription', async () => {
    const buyer = buildBuyer();
    const owner = buildOwner();

    webhookHelpers.findUserByCustomerId.mockResolvedValue(buyer);
    User.findOne.mockResolvedValue(owner);

    await handleStripeEvent(buildEvent() as any);

    expect(webhookHelpers.ensureInvoiceIdempotent).toHaveBeenCalledWith('in_1', 'owner1');
    expect(webhookHelpers.ensureSubscriptionFirstTime).toHaveBeenCalledWith('sub_1', 'owner1');
    expect(owner.commissionLog).toHaveLength(1);
    expect(owner.commissionLog[0]).toMatchObject({
      type: 'commission',
      status: 'pending',
      invoiceId: 'in_1',
      subscriptionId: 'sub_1',
      amountCents: 4500,
      commissionRateBps: 5000,
      currency: 'brl',
    });
    expect(buyer.affiliateFirstCommissionAt).toBeInstanceOf(Date);
    expect(owner.save).toHaveBeenCalled();
  });

  test('does not create a second commission when the same subscription has already consumed the first invoice rule', async () => {
    const buyer = buildBuyer();
    const owner = buildOwner();

    webhookHelpers.findUserByCustomerId.mockResolvedValue(buyer);
    User.findOne.mockResolvedValue(owner);
    webhookHelpers.ensureSubscriptionFirstTime.mockResolvedValue(false);

    await handleStripeEvent(buildEvent() as any);

    expect(owner.commissionLog).toHaveLength(0);
    expect(owner.save).not.toHaveBeenCalled();
  });
});
