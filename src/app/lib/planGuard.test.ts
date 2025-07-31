import { guardPremiumRequest } from './planGuard';
import { getToken } from 'next-auth/jwt';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));

const mockGetToken = getToken as jest.Mock;

describe('guardPremiumRequest', () => {
  it('allows request when plan status is active', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'active' });
    const res = await guardPremiumRequest({} as any);
    expect(res).toBeNull();
  });

  it('blocks request when plan status is not active', async () => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
    const res = await guardPremiumRequest({} as any);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(403);
    const data = await res?.json();
    expect(data?.error).toBeDefined();
  });
});
