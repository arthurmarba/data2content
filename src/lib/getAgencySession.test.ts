import { getServerSession } from 'next-auth/next';

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
import { getAgencySession } from './getAgencySession';

jest.mock('next-auth/next');
const mockGetServerSession = getServerSession as jest.Mock;

describe('getAgencySession', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns session when user is agency', async () => {
    const session = { user: { role: 'agency' } } as any;
    const req = { headers: {} } as any;
    mockGetServerSession.mockResolvedValue(session);
    const result = await getAgencySession(req);
    expect(result).toBe(session);
    expect(mockGetServerSession).toHaveBeenCalledWith(expect.objectContaining({ req }));
  });

  it('returns null when role is not agency', async () => {
    const req = {} as any;
    mockGetServerSession.mockResolvedValue({ user: { role: 'user' } });
    const result = await getAgencySession(req);
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    const req = {} as any;
    mockGetServerSession.mockRejectedValue(new Error('err'));
    const result = await getAgencySession(req);
    expect(result).toBeNull();
  });
});
