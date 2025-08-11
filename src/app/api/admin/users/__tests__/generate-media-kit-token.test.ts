import { POST } from '../[userId]/generate-media-kit-token/route';
import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/getAdminSession';
import { checkRateLimit } from '@/utils/rateLimit';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getServerSession } from 'next-auth/next';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn(),
}));
jest.mock('@/utils/rateLimit', () => ({
  checkRateLimit: jest.fn(),
}));
jest.mock('@/app/models/User', () => ({
  findByIdAndUpdate: jest.fn(),
}));
jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

const mockGetAdminSession = getAdminSession as jest.Mock;
const mockCheckRateLimit = checkRateLimit as jest.Mock;
const mockFindByIdAndUpdate = UserModel.findByIdAndUpdate as jest.Mock;

function createRequest(userId: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/users/${userId}/generate-media-kit-token`, {
    method: 'POST',
    headers: { 'x-real-ip': '127.0.0.1' },
  });
}

describe('POST /api/admin/users/[userId]/generate-media-kit-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 4 });
    mockFindByIdAndUpdate.mockResolvedValue({ _id: '1', mediaKitSlug: 'slug' });
  });

  it('returns 200 and slug on success', async () => {
    const res = await POST(createRequest('1'), { params: { userId: '1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.slug).toBeDefined();
  });

  it('returns 401 when session is invalid', async () => {
    mockGetAdminSession.mockResolvedValueOnce(null);
    const res = await POST(createRequest('1'), { params: { userId: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 429 when rate limit exceeded', async () => {
    mockCheckRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });
    const res = await POST(createRequest('1'), { params: { userId: '1' } });
    expect(res.status).toBe(429);
  });
});
