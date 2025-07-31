import { NextRequest } from 'next/server';
import { middleware } from '../../../middleware';
import { getToken } from 'next-auth/jwt';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));

const mockGetToken = getToken as jest.Mock;

function makeRequest(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe('plan guard for ai routes', () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
  });

  it.each([
    '/api/ai/chat',
    '/api/ai/dynamicCards',
    '/api/ai/insights',
  ])('blocks inactive plan for %s', async (path) => {
    const res = await middleware(makeRequest(path));
    expect(res.status).toBe(403);
  });
});

