import { getServerSession } from 'next-auth/next';
import { getAgencySession } from './getAgencySession';

jest.mock('next-auth/next');
const mockGetServerSession = getServerSession as jest.Mock;

describe('getAgencySession', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns session when user is agency', async () => {
    const session = { user: { role: 'agency' } } as any;
    mockGetServerSession.mockResolvedValue(session);
    const result = await getAgencySession({} as any);
    expect(result).toBe(session);
  });

  it('returns null when role is not agency', async () => {
    mockGetServerSession.mockResolvedValue({ user: { role: 'user' } });
    const result = await getAgencySession({} as any);
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    mockGetServerSession.mockRejectedValue(new Error('err'));
    const result = await getAgencySession({} as any);
    expect(result).toBeNull();
  });
});
