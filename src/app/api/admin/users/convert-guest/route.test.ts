import { NextRequest } from 'next/server';
import { POST } from './route';
import { getAdminSession } from '@/lib/getAdminSession';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn(),
}));

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/app/models/User', () => ({
  findById: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { info: jest.fn() },
}));

const mockGetAdminSession = getAdminSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (UserModel as any).findById as jest.Mock;

const createRequest = (body: any) =>
  new NextRequest('http://localhost/api/admin/users/convert-guest', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});

describe('POST /api/admin/users/convert-guest', () => {
  it('returns 401 when session is missing', async () => {
    mockGetAdminSession.mockResolvedValue(null);
    const res = await POST(createRequest({ userId: '1', planStatus: 'active' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
    const res = await POST(createRequest({ userId: '1', planStatus: 'foo' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
    mockFindById.mockResolvedValue(null);
    const res = await POST(createRequest({ userId: '1', planStatus: 'active' }));
    expect(res.status).toBe(404);
  });

  it('updates user and returns success', async () => {
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
    const save = jest.fn();
    const user = { role: 'guest', agency: 'a1', planStatus: 'pending', save };
    mockFindById.mockResolvedValue(user);
    const res = await POST(createRequest({ userId: '1', planStatus: 'active' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(user.role).toBe('user');
    expect(user.agency).toBeNull();
    expect(user.planStatus).toBe('active');
    expect(save).toHaveBeenCalled();
  });
});
