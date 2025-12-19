/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import AgencyModel from '@/app/models/Agency';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn() }));
jest.mock('@/app/models/Agency', () => ({
  findOne: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    lean: jest.fn(),
  })),
}));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn() } }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }), { virtual: true });

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindUser = (UserModel as any).findById as jest.Mock;
const mockFindAgency = (AgencyModel as any).findOne as jest.Mock;
const mockSelect = jest.fn();
const mockLean = jest.fn();

const createRequest = (body: any) =>
  new NextRequest('http://localhost/api/agency/accept-invite', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
  mockSelect.mockReturnValue({ lean: mockLean });
  mockLean.mockResolvedValue(null);
  mockFindAgency.mockReturnValue({ select: mockSelect });
});

describe('POST /api/agency/accept-invite', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(createRequest({ inviteCode: 'abc' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when agency not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockLean.mockResolvedValueOnce(null);
    const res = await POST(createRequest({ inviteCode: 'abc' }));
    expect(res.status).toBe(404);
  });

  it('returns 403 when agency inactive', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockLean.mockResolvedValueOnce({ _id: 'a1', planStatus: 'inactive' });
    const res = await POST(createRequest({ inviteCode: 'abc' }));
    expect(res.status).toBe(403);
  });

  it('returns 409 when user already linked to another agency', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockLean.mockResolvedValueOnce({ _id: 'a1', planStatus: 'active' });
    const save = jest.fn();
    mockFindUser.mockResolvedValue({ agency: 'other', role: 'user', planStatus: 'inactive', save });
    const res = await POST(createRequest({ inviteCode: 'abc' }));
    expect(res.status).toBe(409);
  });

  it('links user to agency and returns success', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' } });
    mockLean.mockResolvedValueOnce({ _id: 'a1', planStatus: 'active' });
    const save = jest.fn();
    const user = { agency: null, role: 'user', planStatus: 'inactive', save };
    mockFindUser.mockResolvedValue(user);
    const res = await POST(createRequest({ inviteCode: 'abc' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(user.agency).toBe('a1');
    expect(user.role).toBe('guest');
    expect(user.planStatus).toBe('pending');
    expect(save).toHaveBeenCalled();
  });
});
