import { GET } from './route';
import { fetchAvgEngagementPerPostCreators } from '@/app/lib/dataService/marketAnalysisService';
import { NextRequest } from 'next/server';
import { DatabaseError } from '@/app/lib/errors';
import { ICreatorMetricRankItem } from '@/app/lib/dataService/marketAnalysisService';
import { getServerSession } from 'next-auth/next';

jest.mock('@/app/lib/dataService/marketAnalysisService', () => ({
  ...jest.requireActual('@/app/lib/dataService/marketAnalysisService'),
  fetchAvgEngagementPerPostCreators: jest.fn(),
}));
jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;

function mockNextRequest(queryParams: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/admin/dashboard/rankings/creators/avg-engagement-per-post');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return new NextRequest(url.toString());
}

const sampleRankingData: ICreatorMetricRankItem[] = [
  { creatorId: 'user1' as any, creatorName: 'Creator One', metricValue: 10, profilePictureUrl: 'url1' },
];

describe('API Route: /api/admin/dashboard/rankings/creators/avg-engagement-per-post', () => {
  beforeEach(() => {
    (fetchAvgEngagementPerPostCreators as jest.Mock).mockClear();
    mockGetServerSession.mockResolvedValue({ user: { role: 'admin', name: 'Admin' } });
  });

  it('returns 200 with ranking data', async () => {
    (fetchAvgEngagementPerPostCreators as jest.Mock).mockResolvedValueOnce(sampleRankingData);

    const request = mockNextRequest({
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2023-01-31T23:59:59.999Z',
      limit: '5',
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(sampleRankingData);
  });

  it('returns 500 on service error', async () => {
    (fetchAvgEngagementPerPostCreators as jest.Mock).mockRejectedValueOnce(new DatabaseError('fail'));
    const request = mockNextRequest({
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2023-01-31T23:59:59.999Z',
    });
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe('fail');
  });
});
