import { GET } from './route';
import aggregateCreatorsByRegion from '@/utils/aggregateCreatorsByRegion';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));

jest.mock('@/utils/aggregateCreatorsByRegion', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockAgg = aggregateCreatorsByRegion as jest.Mock;
const mockSession = getServerSession as jest.Mock;

function makeReq(params: string = ''): NextRequest {
  const url = `http://localhost/api/admin/creators/region-summary${params}`;
  return new NextRequest(url);
}

describe('GET /api/admin/creators/region-summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSession.mockResolvedValue({ user: { role: 'admin' } });
  });

  it('returns aggregated data', async () => {
    mockAgg.mockResolvedValueOnce([{ state: 'SP', count: 2, gender: {}, age: {}, cities: {} }]);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.states[0].state).toBe('SP');
  });

  it('validates query params', async () => {
    const res = await GET(makeReq('?minAge=abc'));
    expect(res.status).toBe(400);
  });
});
