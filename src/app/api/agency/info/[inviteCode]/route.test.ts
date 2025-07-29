import { NextRequest } from 'next/server';
import { GET } from './route';
import { connectToDatabase } from '@/app/lib/mongoose';
import AgencyModel from '@/app/models/Agency';

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/app/models/Agency', () => ({
  findOne: jest.fn(),
}));

const mockConnect = connectToDatabase as jest.Mock;
const mockFindOne = (AgencyModel as any).findOne as jest.Mock;

const createRequest = (code: string) => new NextRequest(`http://localhost/api/agency/info/${code}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});

describe('GET /api/agency/info/[inviteCode]', () => {
  it('returns 404 when agency is missing or inactive', async () => {
    const lean = jest.fn().mockResolvedValue(null);
    const select = jest.fn().mockReturnValue({ lean });
    mockFindOne.mockReturnValue({ select });

    const res = await GET(createRequest('abc'), { params: { inviteCode: 'abc' } });
    expect(res.status).toBe(404);
  });

  it('returns name when invite code is valid and active', async () => {
    const lean = jest.fn().mockResolvedValue({ name: 'Agency', planStatus: 'active' });
    const select = jest.fn().mockReturnValue({ lean });
    mockFindOne.mockReturnValue({ select });

    const res = await GET(createRequest('xyz'), { params: { inviteCode: 'xyz' } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ name: 'Agency' });
  });
});
