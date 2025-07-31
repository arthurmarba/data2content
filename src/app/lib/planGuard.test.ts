import { NextRequest } from 'next/server';
import {
  guardPremiumRequest,
  getPlanGuardMetrics,
  resetPlanGuardMetrics,
} from '@/app/lib/planGuard';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/app/lib/logger';
import { sendAlert } from '@/app/lib/alerts';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('@/app/lib/alerts', () => ({ sendAlert: jest.fn() }));

const mockGetToken = getToken as jest.Mock;
const mockWarn = logger.warn as jest.Mock;
const mockSendAlert = sendAlert as jest.Mock;

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
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockSendAlert).not.toHaveBeenCalled();
  });

  it('blocks, logs and alerts when plan is not active', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
    const req = createRequest('/api/ai/chat');
    const res = await guardPremiumRequest(req);
    expect(res?.status).toBe(403);
    expect(mockWarn).toHaveBeenCalledWith({
      userId: 'u1',
      status: 'inactive',
      path: '/api/ai/chat',
    });
    expect(mockSendAlert).toHaveBeenCalledWith(
      '[planGuard] Blocked request for user u1 with status inactive on /api/ai/chat'
    );
    const metrics = getPlanGuardMetrics();
    expect(metrics.blocked).toBe(1);
    expect(metrics.byRoute['/api/ai/chat']).toBe(1);
  });
});

