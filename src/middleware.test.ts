import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { getToken } from 'next-auth/jwt';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));

const mockGetToken = getToken as jest.Mock;

function createRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('middleware plan guard', () => {
  it('allows access when plan is active', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'active' });
    const res = await middleware(createRequest('/api/ai/chat'));
    expect(res.status).toBe(200);
  });

  it('blocks access when plan is inactive', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
    const res = await middleware(createRequest('/api/whatsapp/sendTips'));
    expect(res.status).toBe(403);
  });
});
