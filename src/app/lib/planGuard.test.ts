import {
  guardPremiumRequest,
  getPlanGuardMetrics,
  resetPlanGuardMetrics,
} from '@/app/lib/planGuard';
import { getToken } from 'next-auth/jwt';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn() } }));

const mockGetToken = getToken as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (DbUser as any).findById as jest.Mock;

function createRequest(path: string) {
  return { nextUrl: { pathname: path } } as any;
}

describe('guardPremiumRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPlanGuardMetrics();
    mockConnect.mockResolvedValue(null);
  });

  it('allows when plan is active', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'active' });
    const res = await guardPremiumRequest(createRequest('/api/ai/chat'));
    expect(res).toBeNull();
  });

  it('allows when plan is non_renewing', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'non_renewing' });
    const res = await guardPremiumRequest(createRequest('/api/ai/chat'));
    expect(res).toBeNull();
  });

  it('blocks when plan is not active', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ planStatus: 'inactive' }),
      }),
    });
    const req = createRequest('/api/ai/chat');
    const res = await guardPremiumRequest(req);
    expect(res?.status).toBe(403);
    const metrics = getPlanGuardMetrics();
    expect(metrics.blocked).toBe(1);
    expect(metrics.byRoute['/api/ai/chat']).toBe(1);
  });

  it('allows if DB shows active plan despite inactive token', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ planStatus: 'active' }),
      }),
    });
    const res = await guardPremiumRequest(createRequest('/api/ai/chat'));
    expect(res).toBeNull();
  });
});

