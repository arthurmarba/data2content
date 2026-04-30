/** @jest-environment node */
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('@/app/models/Redemption', () => ({ create: jest.fn(), updateOne: jest.fn() }));
jest.mock('@/app/lib/stripe', () => ({
  stripe: {
    accounts: { retrieve: jest.fn() },
    transfers: { create: jest.fn() },
  },
}));

import { getServerSession } from 'next-auth/next';
import User from '@/app/models/User';
import Redemption from '@/app/models/Redemption';
import { stripe } from '@/app/lib/stripe';
import { POST } from './route';

export {};

function mockRequest(body: any = { currency: 'BRL', amountCents: null, clientToken: 'tok1' }) {
  return new Request('http://localhost/api/affiliate/redeem', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  }) as any;
}

describe('POST /api/affiliate/redeem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AFFILIATE_MIN_REDEEM_BRL = '1000';
    (getServerSession as any).mockResolvedValue({ user: { id: 'u1' } });
    (User as any).findById.mockResolvedValue({
      _id: 'u1',
      affiliateBalances: new Map([['BRL', 2000]]),
      affiliateDebtByCurrency: new Map(),
      paymentInfo: { stripeAccountId: 'acct1' },
      commissionLog: [
        { _id: 'entry1', status: 'available', currency: 'BRL', amountCents: 1000 },
        { _id: 'entry2', status: 'available', currency: 'BRL', amountCents: 1000 },
      ],
    });
    (User as any).updateOne.mockResolvedValue({ modifiedCount: 1 });
    (Redemption as any).create.mockImplementation(async (data: any) => ({ _id: 'red1', ...data }));
    (Redemption as any).updateOne.mockResolvedValue({});
    (stripe as any).accounts.retrieve.mockResolvedValue({ payouts_enabled: true, default_currency: 'BRL' });
    (stripe as any).transfers.create.mockResolvedValue({ id: 'tr_1' });
  });

  it('returns 401 without session', async () => {
    (getServerSession as any).mockResolvedValueOnce(null);
    const res = await POST(mockRequest());
    expect(res.status).toBe(401);
  });

  it('returns needs_onboarding if Stripe payouts disabled', async () => {
    (stripe as any).accounts.retrieve.mockResolvedValueOnce({ payouts_enabled: false });
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('needs_onboarding');
  });

  it('returns below_min when amount below minimum', async () => {
    (User as any).findById.mockResolvedValueOnce({
      _id: 'u1',
      affiliateBalances: new Map([['BRL', 500]]),
      affiliateDebtByCurrency: new Map(),
      paymentInfo: { stripeAccountId: 'acct1' },
      commissionLog: [{ _id: 'entry1', status: 'available', currency: 'BRL', amountCents: 500 }],
    });
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('below_min');
  });

  it('blocks when user has debt', async () => {
    (User as any).findById.mockResolvedValueOnce({
      _id: 'u1',
      affiliateBalances: new Map([['BRL', 2000]]),
      affiliateDebtByCurrency: new Map([['BRL', 500]]),
      paymentInfo: { stripeAccountId: 'acct1' },
      commissionLog: [{ _id: 'entry1', status: 'available', currency: 'BRL', amountCents: 2000 }],
    });
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('has_debt');
  });

  it('returns ok true on success', async () => {
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.transferId).toBe('tr_1');
    expect((stripe as any).transfers.create).toHaveBeenCalled();
    const [, opts] = (stripe as any).transfers.create.mock.calls[0];
    expect(opts.idempotencyKey).toBe('redeem:u1:BRL:2000:tok1');
  });

  it('returns stripe_error when transfer fails', async () => {
    (stripe as any).transfers.create.mockRejectedValueOnce(new Error('balance_insufficient'));
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('stripe_error');
  });
});
