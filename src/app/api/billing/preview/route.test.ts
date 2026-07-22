/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findOne: jest.fn(), findById: jest.fn() }));
jest.mock('@/server/db/models/AffiliateIndexes', () => ({
  AffiliateBuyerCommissionIndex: { exists: jest.fn() },
}));
jest.mock('@/app/lib/stripe', () => ({
  stripe: {
    coupons: { retrieve: jest.fn() },
    invoices: { createPreview: jest.fn() },
    prices: { retrieve: jest.fn() },
  },
}));
jest.mock('@/utils/stripeHelpers', () => ({ getOrCreateStripeCustomerId: jest.fn() }));

const getServerSession = require('next-auth/next').getServerSession as jest.Mock;
const User = require('@/app/models/User');
const { stripe } = require('@/app/lib/stripe');
const { getOrCreateStripeCustomerId } = require('@/utils/stripeHelpers');
const { AffiliateBuyerCommissionIndex } = require('@/server/db/models/AffiliateIndexes');
const { POST } = require('./route');

const createRequest = (body: any) =>
  new NextRequest('http://localhost/api/billing/preview', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

describe('POST /api/billing/preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'u1', affiliateUsed: null } });
    getOrCreateStripeCustomerId.mockResolvedValue('cus_123');
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ affiliateUsed: null, affiliateFirstCommissionAt: null }),
      }),
    });
    AffiliateBuyerCommissionIndex.exists.mockResolvedValue(false);
    process.env.STRIPE_PRICE_MONTHLY_BRL = 'price_monthly_brl';
  });

  test('registers the affiliate without discounting the subscription', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'owner1', affiliateCode: 'AFF123' }),
      }),
    });
    stripe.invoices.createPreview.mockResolvedValue({
      currency: 'brl',
      subtotal: 10000,
      total_discount_amounts: [],
      tax: 0,
      total: 10000,
    });
    stripe.prices.retrieve.mockResolvedValue({ unit_amount: 10000 });

    const res = await POST(createRequest({ plan: 'monthly', currency: 'BRL', affiliateCode: 'AFF123' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.affiliateApplied).toBe(true);
    expect(body.discountsTotal).toBe(0);
    expect(body.total).toBe(10000);
    expect(stripe.invoices.createPreview).toHaveBeenCalledWith({
      customer: 'cus_123',
      subscription_details: { items: [{ price: 'price_monthly_brl', quantity: 1 }] },
    });
    expect(stripe.coupons.retrieve).not.toHaveBeenCalled();
  });

  test('does not offer the first-purchase coupon after a commission was consumed', async () => {
    User.findById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          affiliateUsed: 'AFF123',
          affiliateFirstCommissionAt: new Date('2026-01-01T00:00:00.000Z'),
        }),
      }),
    });

    const res = await POST(createRequest({ plan: 'monthly', currency: 'BRL', affiliateCode: 'OTHER' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ code: 'AFFILIATE_BENEFIT_ALREADY_USED' });
    expect(stripe.invoices.createPreview).not.toHaveBeenCalled();
  });
});
