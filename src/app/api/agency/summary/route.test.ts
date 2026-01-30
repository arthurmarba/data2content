import { NextRequest } from 'next/server';
import { GET } from './route';
import { getAgencySession } from '@/lib/getAgencySession';
import AgencyModel from '@/app/models/Agency';

jest.mock('@/lib/getAgencySession', () => ({
  getAgencySession: jest.fn(),
}));

jest.mock('@/app/models/Agency', () => ({
  findById: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

const mockGetAgencySession = getAgencySession as jest.Mock;
const mockFindById = (AgencyModel as any).findById as jest.Mock;

const createRequest = () => new NextRequest('http://localhost/api/agency/summary');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/agency/summary', () => {
  it('returns 401 when session is missing', async () => {
    mockGetAgencySession.mockResolvedValue(null);
    const res = await GET(createRequest());
    expect(res.status).toBe(401);
  });

  it('returns 403 when plan is inactive', async () => {
    mockGetAgencySession.mockResolvedValue({ user: { agencyId: '1' } });
    const lean = jest.fn().mockResolvedValue({ name: 'Test', inviteCode: 'abc', planStatus: 'inactive' });
    const select = jest.fn().mockReturnValue({ lean });
    mockFindById.mockReturnValue({ select });

    const res = await GET(createRequest());
    const body = await res.json();
    expect(res.status).toBe(403);
    expect(body.error).toBe('Plano do parceiro inativo. Assine para acessar o link de convite.');
  });

  it('returns name and inviteCode when authorized and active', async () => {
    mockGetAgencySession.mockResolvedValue({ user: { agencyId: '1' } });
    const lean = jest.fn().mockResolvedValue({ name: 'Test', inviteCode: 'abc', planStatus: 'active' });
    const select = jest.fn().mockReturnValue({ lean });
    mockFindById.mockReturnValue({ select });

    const res = await GET(createRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ name: 'Test', inviteCode: 'abc' });
  });
});
