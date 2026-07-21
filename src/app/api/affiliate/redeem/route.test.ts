/** @jest-environment node */
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('@/app/models/Redemption', () => ({
  create: jest.fn(),
  findOne: jest.fn(),
  updateOne: jest.fn(),
  exists: jest.fn(),
}));
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
import mongoose from 'mongoose';
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
    jest.spyOn(mongoose, 'startSession').mockResolvedValue({
      withTransaction: async (fn: () => Promise<void>) => fn(),
      endSession: jest.fn(),
    } as any);
    (User as any).findById.mockResolvedValue({
      _id: 'u1',
      affiliateBalances: new Map([['BRL', 2000]]),
      affiliateDebtByCurrency: new Map(),
      paymentInfo: { stripeAccountId: 'acct1' },
      commissionLog: [
        { _id: 'entry1', type: 'commission', status: 'available', currency: 'BRL', amountCents: 1000 },
        { _id: 'entry2', type: 'commission', status: 'available', currency: 'BRL', amountCents: 1000 },
      ],
    });
    (User as any).updateOne.mockResolvedValue({ modifiedCount: 1 });
    (Redemption as any).findOne.mockResolvedValue(null);
    (Redemption as any).create.mockImplementation(async (data: any) => ({ _id: 'red1', ...data }));
    (Redemption as any).updateOne.mockResolvedValue({ modifiedCount: 1 });
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
      commissionLog: [{ _id: 'entry1', type: 'commission', status: 'available', currency: 'BRL', amountCents: 500 }],
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
      commissionLog: [{ _id: 'entry1', type: 'commission', status: 'available', currency: 'BRL', amountCents: 2000 }],
    });
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('has_debt');
  });

  it('blocks transfers when the materialized balance diverges from the ledger', async () => {
    (User as any).findById.mockResolvedValueOnce({
      _id: 'u1',
      affiliateBalances: new Map([['brl', 999999]]),
      affiliateDebtByCurrency: new Map(),
      paymentInfo: { stripeAccountId: 'acct1' },
      commissionLog: [{ _id: 'entry1', type: 'commission', status: 'available', currency: 'brl', amountCents: 2000 }],
    });
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.code).toBe('ledger_out_of_sync');
    expect((stripe as any).transfers.create).not.toHaveBeenCalled();
  });

  it('returns ok true on success', async () => {
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.transferId).toBe('tr_1');
    expect((stripe as any).transfers.create).toHaveBeenCalled();
    const [, opts] = (stripe as any).transfers.create.mock.calls[0];
    expect(opts.idempotencyKey).toMatch(/^redeem:[a-f0-9]{24}$/);
  });

  it('keeps a retryable redemption when the transfer response fails', async () => {
    (stripe as any).transfers.create.mockRejectedValueOnce(new Error('balance_insufficient'));
    const res = await POST(mockRequest());
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.code).toBe('temporarily_unavailable');
    expect((Redemption as any).updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ $set: expect.objectContaining({ reasonCode: 'stripe_retryable' }) }),
    );
  });

  it('restores the reserved balance after a definitive Stripe rejection', async () => {
    (stripe as any).transfers.create.mockRejectedValueOnce({
      type: 'StripeInvalidRequestError',
      statusCode: 400,
      code: 'balance_insufficient',
      message: 'Insufficient balance',
    });

    const res = await POST(mockRequest());
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ code: 'stripe_rejected' });
    const balanceChanges = (User as any).updateOne.mock.calls
      .map((call: any[]) => call[1]?.$inc?.['affiliateBalances.brl'])
      .filter((value: unknown) => value !== undefined);
    expect(balanceChanges).toEqual([-2000, 2000]);
  });

  it('resumes a reserved request with the same Stripe idempotency key', async () => {
    (stripe as any).accounts.retrieve.mockRejectedValueOnce(new Error('connected account was deleted'));
    (User as any).findById.mockResolvedValueOnce({
      _id: 'u1',
      affiliateBalances: new Map([['BRL', 0]]),
      affiliateDebtByCurrency: new Map(),
      paymentInfo: { stripeAccountId: 'acct_new' },
      commissionLog: [
        { _id: 'entry1', type: 'commission', status: 'available', currency: 'BRL', amountCents: 2000 },
      ],
    });
    (Redemption as any).findOne.mockResolvedValueOnce({
      _id: 'red_existing',
      userId: 'u1',
      currency: 'brl',
      amountCents: 2000,
      status: 'requested',
      balanceReservedAt: new Date(),
      idempotencyKey: 'redeem:stable',
      accountId: 'acct_original',
      payoutEntryIds: ['entry1'],
    });

    const res = await POST(mockRequest());
    expect(res.status).toBe(200);
    expect((stripe as any).accounts.retrieve).not.toHaveBeenCalled();
    expect((stripe as any).transfers.create.mock.calls[0][1]).toEqual({
      idempotencyKey: 'redeem:stable',
    });
    expect((User as any).updateOne.mock.calls.some((call: any[]) => call[1]?.$inc)).toBe(false);
  });

  it('returns success when a parallel retry already finalized the same transfer', async () => {
    (Redemption as any).findOne.mockResolvedValueOnce({
      _id: 'red_existing',
      userId: 'u1',
      currency: 'brl',
      amountCents: 2000,
      status: 'requested',
      balanceReservedAt: new Date(),
      idempotencyKey: 'redeem:stable',
      accountId: 'acct1',
      payoutEntryIds: ['entry1', 'entry2'],
    });
    (Redemption as any).updateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    (Redemption as any).exists.mockReturnValue({
      session: jest.fn().mockResolvedValue({ _id: 'red_existing' }),
    });

    const res = await POST(mockRequest());
    expect(res.status).toBe(200);
    expect((User as any).updateOne).not.toHaveBeenCalled();
  });
});
