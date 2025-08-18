import { middleware } from '../../../middleware';
import { getToken } from 'next-auth/jwt';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn() } }));

const mockGetToken = getToken as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (DbUser as any).findById as jest.Mock;

function makeRequest(path: string) {
  return { nextUrl: { pathname: path } } as any;
}

describe('plan guard for whatsapp routes', () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
    mockConnect.mockResolvedValue(null);
    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ planStatus: 'inactive' }),
      }),
    });
  });

  it.each([
    '/api/whatsapp/generateCode',
    '/api/whatsapp/sendTips',
    '/api/whatsapp/verify',
    '/api/whatsapp/weeklyReport',
  ])('blocks inactive plan for %s', async (path) => {
    const res = await middleware(makeRequest(path));
    expect(res.status).toBe(403);
  });

  it('allows when DB has active plan', async () => {
    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ planStatus: 'active' }),
      }),
    });
    const res = await middleware(makeRequest('/api/whatsapp/generateCode'));
    expect(res.status).toBe(200);
  });
});

