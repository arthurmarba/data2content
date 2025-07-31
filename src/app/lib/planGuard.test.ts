import { NextRequest } from 'next/server';
import { guardPremiumRequest } from '@/app/lib/planGuard';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/app/lib/logger';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({ logger: { warn: jest.fn() } }));

const mockGetToken = getToken as jest.Mock;
const mockWarn = logger.warn as jest.Mock;

function createRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('guardPremiumRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows when plan is active', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'active' });
    const res = await guardPremiumRequest(createRequest('/api/ai/chat'));
    expect(res).toBeNull();
    expect(mockWarn).not.toHaveBeenCalled();
  });

  it('blocks and logs when plan is not active', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
    const req = createRequest('/api/ai/chat');
    const res = await guardPremiumRequest(req);
    expect(res?.status).toBe(403);
    expect(mockWarn).toHaveBeenCalledWith(
      '[planGuard] Blocked request for user u1 with status inactive on /api/ai/chat'
    );
  });
});

