/** @jest-environment node */
import { NextRequest } from 'next/server';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/utils/rateLimit', () => ({ checkRateLimit: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn(), updateOne: jest.fn(), findOneAndUpdate: jest.fn() }));
jest.mock('@/app/models/Redemption', () => ({ create: jest.fn() }));
jest.mock('@/app/lib/stripe', () => ({
  accounts: { retrieve: jest.fn() },
  transfers: { create: jest.fn() },
}));
jest.mock('@/utils/getClientIp', () => ({ getClientIp: () => '1.1.1.1' }));

const getServerSession = require('next-auth/next').getServerSession as jest.Mock;
const checkRateLimit = require('@/utils/rateLimit').checkRateLimit as jest.Mock;
const User = require('@/app/models/User');
const Redemption = require('@/app/models/Redemption');
const stripe = require('@/app/lib/stripe');
const { POST } = require('./route');

function mockRequest() {
  return new NextRequest('http://localhost/api/affiliate/redeem', { method: 'POST' });
}

describe('POST /api/affiliate/redeem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.REDEEM_MIN_BRL = '1000';
    getServerSession.mockResolvedValue({ user: { id: 'u1' } });
    checkRateLimit.mockResolvedValue({ allowed: true });
    User.findById.mockResolvedValue({
      _id: 'u1',
      currency: 'brl',
      affiliateBalances: new Map([['brl', 2000]]),
      paymentInfo: { stripeAccountId: 'acct1' },
    });
    User.findOneAndUpdate.mockResolvedValue({});
    User.updateOne.mockResolvedValue({});
    Redemption.create.mockImplementation(async (data: any) => ({ _id: 'red1', ...data }));
    stripe.accounts.retrieve.mockResolvedValue({ default_currency: 'brl', charges_enabled: true, payouts_enabled: true });
    stripe.transfers.create.mockResolvedValue({ id: 'tr_1' });
  });

  it('returns 401 without session', async () => {
    getServerSession.mockResolvedValueOnce(null);
    const res = await POST(mockRequest());
    expect(res.status).toBe(401);
  });

  it('returns 400 if Stripe account not verified', async () => {
    stripe.accounts.retrieve.mockResolvedValueOnce({ charges_enabled: false, payouts_enabled: false });
    const res = await POST(mockRequest());
    expect(res.status).toBe(400);
  });

  it('returns 400 if amount below minimum', async () => {
    User.findById.mockResolvedValueOnce({
      _id: 'u1',
      currency: 'brl',
      affiliateBalances: new Map([['brl', 500]]),
      paymentInfo: { stripeAccountId: 'acct1' },
    });
    const res = await POST(mockRequest());
    expect(res.status).toBe(400);
  });

  it('returns ok true on success', async () => {
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.mode).toBe('auto');
    expect(stripe.transfers.create).toHaveBeenCalled();
    const [, opts] = stripe.transfers.create.mock.calls[0];
    expect(opts.idempotencyKey).toMatch(/redeem_u1_2000_/);
  });

  it('queues when transfer fails', async () => {
    stripe.transfers.create.mockRejectedValueOnce(new Error('balance_insufficient'));
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.mode).toBe('queued');
  });
});

