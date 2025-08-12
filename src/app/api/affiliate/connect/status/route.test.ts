import fetch, { Request, Response, Headers } from 'node-fetch';
(global as any).fetch = fetch;
(global as any).Request = Request;
(global as any).Response = Response as any;
(global as any).Headers = Headers;
(global as any).Response.json = (data: any, init?: any) =>
  new Response(JSON.stringify(data), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });

const { GET } = require('./route');
const { NextRequest } = require('next/server');
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import stripe from '@/app/lib/stripe';
import { checkRateLimit } from '@/utils/rateLimit';
import { getClientIp } from '@/utils/getClientIp';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/app/models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('@/app/lib/stripe', () => ({
  accounts: {
    retrieve: jest.fn(),
  },
}));

jest.mock('@/utils/rateLimit', () => ({
  checkRateLimit: jest.fn(),
}));

jest.mock('@/utils/getClientIp', () => ({
  getClientIp: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = User.findById as jest.Mock;
const mockRetrieve = (stripe.accounts.retrieve as unknown) as jest.Mock;
const mockRate = checkRateLimit as jest.Mock;
const mockIp = getClientIp as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
  mockRate.mockResolvedValue({ allowed: true });
  mockIp.mockReturnValue('127.0.0.1');
});

describe('GET /api/affiliate/connect/status', () => {
  it('returns destCurrency from Stripe account', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user1' } });
    const mockUser = {
      paymentInfo: { stripeAccountId: 'acct_123', stripeAccountStatus: 'pending' },
      save: jest.fn().mockResolvedValue(undefined),
    } as any;
    mockFindById.mockResolvedValue(mockUser);
    mockRetrieve.mockResolvedValue({
      details_submitted: true,
      charges_enabled: true,
      payouts_enabled: true,
      default_currency: 'BRL',
    });

    const req = new NextRequest('http://localhost/api/affiliate/connect/status');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.destCurrency).toBe('brl');
    expect(body.stripeAccountId).toBe('acct_123');
    expect(body.stripeAccountStatus).toBe('verified');
    expect(body.needsOnboarding).toBe(false);
    expect(mockUser.paymentInfo.stripeAccountDefaultCurrency).toBe('brl');
    expect(mockUser.save).toHaveBeenCalled();
  });
});
