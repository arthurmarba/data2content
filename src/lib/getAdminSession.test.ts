import { getServerSession } from 'next-auth/next';
import { getAdminSession } from './getAdminSession';

jest.mock('next-auth/next');
const mockGetServerSession = getServerSession as jest.Mock;

describe('getAdminSession', () => {
  afterEach(() => jest.clearAllMocks());

  it('returns session when user is admin', async () => {
    const session = { user: { role: 'admin' } } as any;
    const req = {} as any;
    mockGetServerSession.mockResolvedValue(session);
    const result = await getAdminSession(req);
    expect(result).toBe(session);
    expect(mockGetServerSession).toHaveBeenCalledWith(expect.objectContaining({ req }));
  });

  it('returns null when role is not admin', async () => {
    const req = {} as any;
    mockGetServerSession.mockResolvedValue({ user: { role: 'user' } });
    const result = await getAdminSession(req);
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    const req = {} as any;
    mockGetServerSession.mockRejectedValue(new Error('err'));
    const result = await getAdminSession(req);
    expect(result).toBeNull();
  });
});
