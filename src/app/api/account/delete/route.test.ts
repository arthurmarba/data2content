import 'next/dist/server/node-polyfill-fetch';
import { DELETE } from './route';
import { getServerSession } from 'next-auth';
import { connectToDatabase } from '@/app/lib/mongoose';
import User from '@/app/models/User';

jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn(), deleteOne: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

const mockGetServerSession = getServerSession as jest.Mock;
const mockFindById = (User as any).findById as jest.Mock;
const mockDeleteOne = (User as any).deleteOne as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
});

describe('DELETE /api/account/delete', () => {
  it('returns 401 when unauthenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindById.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(404);
  });

  it('returns 409 when subscription active', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindById.mockResolvedValue({ _id: 'u1', planStatus: 'active' });
    const res = await DELETE();
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: 'ERR_ACTIVE_SUBSCRIPTION', message: 'Cancele sua assinatura antes de excluir a conta.' });
  });

  it('deletes user when permitted', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockFindById.mockResolvedValue({ _id: 'u1', planStatus: 'inactive', affiliateBalances: {} });
    mockDeleteOne.mockResolvedValue({});
    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(mockDeleteOne).toHaveBeenCalledWith({ _id: 'u1' });
  });
});
