import { GET } from './route';
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { fetchContentPerformanceByType } from '@/app/lib/dataService/marketAnalysis/segmentService';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

jest.mock('@/app/lib/dataService/marketAnalysis/segmentService', () => ({
  fetchContentPerformanceByType: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;
const mockFetchPerf = fetchContentPerformanceByType as jest.Mock;

const makeRequest = (params: Record<string,string> = {}) => {
  const url = new URL(`http://localhost/api/admin/dashboard/content/performance-by-type?${new URLSearchParams(params)}`);
  return new NextRequest(url);
};

beforeEach(() => jest.clearAllMocks());

describe('GET /api/admin/dashboard/content/performance-by-type', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await GET(makeRequest({ startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-01-02T00:00:00.000Z' }));
    expect(res.status).toBe(401);
  });

  it('returns data when authenticated as admin', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1', role: 'admin' } });
    const performance = [{ _id: 'VIDEO', totalPosts: 5 }];
    mockFetchPerf.mockResolvedValue(performance);

    const res = await GET(makeRequest({ startDate: '2024-01-01T00:00:00.000Z', endDate: '2024-01-02T00:00:00.000Z' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual(performance);
    expect(fetchContentPerformanceByType).toHaveBeenCalledWith({ dateRange: {
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2024-01-02T00:00:00.000Z'),
    }});
  });
});
