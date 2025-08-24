import { GET } from './route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { fetchPlatformSummary } from '@/app/lib/dataService/marketAnalysis/dashboardService';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

jest.mock('@/app/lib/dataService/marketAnalysis/dashboardService', () => ({
  fetchPlatformSummary: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;
const mockFetchSummary = fetchPlatformSummary as jest.Mock;

const makeRequest = (params: Record<string, string> = {}) => {
  const url = new URL(`http://localhost/api/admin/dashboard/platform-summary?${new URLSearchParams(params)}`);
  return new NextRequest(url);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/admin/dashboard/platform-summary', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns summary data when authenticated as admin', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    const data = { totalCreators: 10 };
    mockFetchSummary.mockResolvedValue(data);

    const res = await GET(makeRequest({ startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-01-31T00:00:00.000Z' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(body).toEqual(data);
    expect(fetchPlatformSummary).toHaveBeenCalledWith({ dateRange: {
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2024-01-31T00:00:00.000Z'),
    }});
  });
});
