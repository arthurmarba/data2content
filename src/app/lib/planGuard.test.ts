import { NextRequest } from 'next/server';
import {
  guardPremiumRequest,
  getPlanGuardMetrics,
  resetPlanGuardMetrics,
} from '@/app/lib/planGuard';
import { getToken } from 'next-auth/jwt';
jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));

const mockGetToken = getToken as jest.Mock;

function createRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('guardPremiumRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPlanGuardMetrics();
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
    const req = createRequest('/api/ai/chat');
    const res = await guardPremiumRequest(req);
    expect(res?.status).toBe(403);
    const metrics = getPlanGuardMetrics();
    expect(metrics.blocked).toBe(1);
    expect(metrics.byRoute['/api/ai/chat']).toBe(1);
  });
});

