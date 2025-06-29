import { DELETE } from '../[userId]/media-kit-token/route';
import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/getAdminSession';
import UserModel from '@/app/models/User';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getServerSession } from 'next-auth/next';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn(),
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
const mockFindByIdAndUpdate = UserModel.findByIdAndUpdate as jest.Mock;

function createRequest(userId: string): NextRequest {
  return new NextRequest(`http://localhost/api/admin/users/${userId}/media-kit-token`, { method: 'DELETE' });
}

describe('DELETE /api/admin/users/[userId]/media-kit-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
    mockFindByIdAndUpdate.mockResolvedValue({ _id: '1' });
  });

  it('returns 200 on success', async () => {
    const res = await DELETE(createRequest('1'), { params: { userId: '1' } });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 401 when not authorized', async () => {
    mockGetAdminSession.mockResolvedValueOnce(null);
    const res = await DELETE(createRequest('1'), { params: { userId: '1' } });
    expect(res.status).toBe(401);
  });
});
