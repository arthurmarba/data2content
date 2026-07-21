/** @jest-environment node */
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn() }));
jest.mock('@/app/lib/stripe', () => ({
  stripe: { accounts: { create: jest.fn() } },
}));
jest.mock('@/utils/rateLimit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn() } }));

import { getServerSession } from 'next-auth/next';
import User from '@/app/models/User';
import { stripe } from '@/app/lib/stripe';
import { POST } from './route';

describe('POST /api/affiliate/connect/create', () => {
  it('uses a stable Stripe idempotency key when provisioning the account', async () => {
    process.env.STRIPE_CONNECT_MODE = 'express';
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'user_1' } });
    const user = {
      _id: 'user_1',
      email: 'affiliate@example.com',
      paymentInfo: {},
      save: jest.fn(),
    };
    (User.findById as jest.Mock).mockResolvedValue(user);
    (stripe.accounts.create as jest.Mock).mockResolvedValue({ id: 'acct_1' });

    const response = await POST(new Request('http://localhost/api/affiliate/connect/create', {
      method: 'POST',
    }) as any);

    expect(response.status).toBe(200);
    expect(stripe.accounts.create).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { userId: 'user_1' } }),
      { idempotencyKey: 'affiliate-connect-account:user_1' },
    );
    expect(user.paymentInfo).toMatchObject({ stripeAccountId: 'acct_1' });
  });
});
