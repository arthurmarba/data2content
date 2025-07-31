import { NextRequest } from 'next/server';
import { PATCH } from './route';
import { getAdminSession } from '@/lib/getAdminSession';
import { connectToDatabase } from '@/app/lib/mongoose';
import UserModel from '@/app/models/User';

jest.mock('@/lib/getAdminSession', () => ({ getAdminSession: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ findById: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { info: jest.fn() } }));

const mockGetAdminSession = getAdminSession as jest.Mock;
const mockFindById = (UserModel as any).findById as jest.Mock;

const createRequest = (userId: string, body: any) =>
  new NextRequest(`http://localhost/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });

beforeEach(() => {
  jest.clearAllMocks();
  (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
});

describe('PATCH /api/admin/users/[userId]/role', () => {
  it('returns 401 when session missing', async () => {
    mockGetAdminSession.mockResolvedValue(null);
    const res = await PATCH(createRequest('1', { role: 'user', planStatus: 'active' }), { params: { userId: '1' } });
    expect(res.status).toBe(401);
  });

  it('returns 400 on invalid body', async () => {
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
    const res = await PATCH(createRequest('1', { role: 'foo', planStatus: 'active' }), { params: { userId: '1' } });
    expect(res.status).toBe(400);
  });

  it('returns 404 when user not found', async () => {
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
    mockFindById.mockResolvedValue(null);
    const res = await PATCH(createRequest('1', { role: 'user', planStatus: 'inactive' }), { params: { userId: '1' } });
    expect(res.status).toBe(404);
  });

  it('updates user and returns success', async () => {
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin', email: 'admin@test.com' } });
    const save = jest.fn();
    const user = { role: 'guest', planStatus: 'active', agency: 'a1', save };
    mockFindById.mockResolvedValue(user);
    const res = await PATCH(createRequest('1', { role: 'user', planStatus: 'inactive' }), { params: { userId: '1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(user.role).toBe('user');
    expect(user.planStatus).toBe('inactive');
    expect(user.agency).toBeNull();
    expect(save).toHaveBeenCalled();
  });
});
