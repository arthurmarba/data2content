import { NextRequest } from 'next/server';
import { GET } from './route';
import { getAdminSession } from '@/lib/getAdminSession';
import { planGuardMetrics, resetPlanGuardMetrics } from '@/app/lib/planGuard';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn(),
}));

const mockGetAdminSession = getAdminSession as jest.Mock;

const createRequest = () => new NextRequest('http://localhost/api/admin/plan-guard/metrics');

describe('GET /api/admin/plan-guard/metrics', () => {
  beforeEach(() => {
    resetPlanGuardMetrics();
    mockGetAdminSession.mockReset();
  });

  it('returns 401 when session missing', async () => {
    mockGetAdminSession.mockResolvedValue(null);
    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it('returns metrics when authorized', async () => {
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
    planGuardMetrics.blocked = 2;
    planGuardMetrics.byRoute['/api/ai/chat'] = 2;
    const res = await GET(createRequest());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ blocked: 2, byRoute: { '/api/ai/chat': 2 } });
  });
});
