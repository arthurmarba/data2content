import { NextRequest } from 'next/server';
import { GET } from './route';
import { getAgencySession } from '@/lib/getAgencySession';
import UserModel from '@/app/models/User';

jest.mock('@/lib/getAgencySession', () => ({
  getAgencySession: jest.fn(),
}));

jest.mock('@/app/models/User', () => ({
  find: jest.fn(),
}));

const mockGetAgencySession = getAgencySession as jest.Mock;
const mockFind = (UserModel as any).find as jest.Mock;

const createRequest = () => new NextRequest('http://localhost/api/agency/guests');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/agency/guests', () => {
  it('returns 401 when unauthorized', async () => {
    mockGetAgencySession.mockResolvedValue(null);
    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it('returns guests when authorized', async () => {
    mockGetAgencySession.mockResolvedValue({ user: { agencyId: 'a1' } });
    const lean = jest.fn().mockResolvedValue([
      { _id: '1', name: 'Guest1', email: 'g1@test.com', planStatus: 'pending' },
      { _id: '2', name: null, email: 'g2@test.com', planStatus: 'active' },
    ]);
    const select = jest.fn().mockReturnValue({ lean });
    mockFind.mockReturnValue({ select });

    const res = await GET(createRequest());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.guests).toHaveLength(2);
    expect(body.guests[0]).toEqual({ id: '1', name: 'Guest1', email: 'g1@test.com', planStatus: 'pending' });
    expect(body.guests[1]).toEqual({ id: '2', name: '', email: 'g2@test.com', planStatus: 'active' });
  });
});
