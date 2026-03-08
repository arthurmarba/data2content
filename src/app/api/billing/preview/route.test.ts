/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findOne: jest.fn() }));
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
    process.env.STRIPE_PRICE_MONTHLY_BRL = 'price_monthly_brl';
    process.env.STRIPE_COUPON_AFFILIATE10_ONCE_BRL = 'coupon_aff_brl';
  });

  test('rejects affiliate coupon that is not compliant with 10% once rule', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'owner1', affiliateCode: 'AFF123' }),
      }),
    });
    stripe.coupons.retrieve.mockResolvedValue({
      id: 'coupon_bad',
      object: 'coupon',
      duration: 'forever',
      percent_off: 10,
    });

    const res = await POST(createRequest({ plan: 'monthly', currency: 'BRL', affiliateCode: 'AFF123' }));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.code).toBe('COUPON_NOT_COMPLIANT');
  });

  test('returns affiliateApplied when coupon is compliant', async () => {
    User.findOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: 'owner1', affiliateCode: 'AFF123' }),
      }),
    });
    stripe.coupons.retrieve.mockResolvedValue({
      id: 'coupon_ok',
      object: 'coupon',
      duration: 'once',
      percent_off: 10,
    });
    stripe.invoices.createPreview.mockResolvedValue({
      currency: 'brl',
      subtotal: 10000,
      total_discount_amounts: [{ amount: 1000 }],
      tax: 0,
      total: 9000,
    });
    stripe.prices.retrieve.mockResolvedValue({ unit_amount: 10000 });

    const res = await POST(createRequest({ plan: 'monthly', currency: 'BRL', affiliateCode: 'AFF123' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.affiliateApplied).toBe(true);
    expect(body.discountsTotal).toBe(1000);
    expect(body.total).toBe(9000);
  });
});
