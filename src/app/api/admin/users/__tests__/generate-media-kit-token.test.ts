import { NextRequest } from 'next/server';
import { POST as generatePOST } from '../[userId]/generate-media-kit-token/route';
import { POST as revokePOST } from '../[userId]/revoke-media-kit-token/route';
import { getServerSession } from 'next-auth/next';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';
import crypto from 'crypto';

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
  findByIdAndUpdate: jest.fn(),
}));

jest.spyOn(crypto, 'randomBytes').mockReturnValue(Buffer.from('0123456789abcdef'));

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindByIdAndUpdate = (UserModel as any).findByIdAndUpdate as jest.Mock;

const makePostRequest = (userId: string) => new NextRequest(`http://localhost/api/admin/users/${userId}/generate-media-kit-token`, { method: 'POST' });
const makeRevokeRequest = (userId: string) => new NextRequest(`http://localhost/api/admin/users/${userId}/revoke-media-kit-token`, { method: 'POST' });

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
  mockGetServerSession.mockResolvedValue({ user: { role: 'admin' } });
});

describe('generate-media-kit-token POST', () => {
  const userId = '64f9c0d2f1c2e3a5b6d7e8f9';

  test('successfully generates token', async () => {
    mockFindByIdAndUpdate.mockResolvedValue({ _id: userId });

    const res = await generatePOST(makePostRequest(userId), { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.url).toContain(body.token);
    expect(mockFindByIdAndUpdate).toHaveBeenCalled();
  });

  test('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await generatePOST(makePostRequest(userId), { params: { userId } });
    expect(res.status).toBe(401);
  });

  test('returns 429 when rate limit exceeded', async () => {
    mockFindByIdAndUpdate.mockResolvedValue({ _id: userId });
    for (let i = 0; i < 3; i++) {
      await generatePOST(makePostRequest(userId), { params: { userId } });
    }
    const res = await generatePOST(makePostRequest(userId), { params: { userId } });
    expect(res.status).toBe(429);
  });
});

describe('revoke-media-kit-token POST', () => {
  const userId = '64f9c0d2f1c2e3a5b6d7e8f9';

  test('revokes token when authenticated', async () => {
    mockFindByIdAndUpdate.mockResolvedValue({ _id: userId });
    const res = await revokePOST(makeRevokeRequest(userId), { params: { userId } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mockFindByIdAndUpdate).toHaveBeenCalled();
  });

  test('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValueOnce(null);
    const res = await revokePOST(makeRevokeRequest(userId), { params: { userId } });
    expect(res.status).toBe(401);
  });
});
