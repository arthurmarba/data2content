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
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';
import stripe from '@/app/lib/stripe';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn() }));
jest.mock('@/app/lib/stripe', () => ({ accounts: { retrieve: jest.fn() } }));

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = User.findById as jest.Mock;
const mockRetrieve = (stripe.accounts.retrieve as unknown) as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});

describe('GET /api/affiliate/connect/status', () => {
  it('returns status info', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'user1' } });
    mockFindById.mockResolvedValue({ paymentInfo: { stripeAccountId: 'acct_123' } });
    mockRetrieve.mockResolvedValue({
      payouts_enabled: true,
      default_currency: 'brl',
      country: 'BR',
      requirements: { currently_due: [] },
      future_requirements: { currently_due: [] },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.defaultCurrency).toBe('BRL');
    expect(body.payoutsEnabled).toBe(true);
    expect(body.needsOnboarding).toBe(false);
  });
});
