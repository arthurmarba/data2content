import { GET } from './route';
import { fetchReachPerFollowerCreators } from '@/app/lib/dataService/marketAnalysisService';
import { NextRequest } from 'next/server';
import { DatabaseError } from '@/app/lib/errors';
import { ICreatorMetricRankItem } from '@/app/lib/dataService/marketAnalysisService';

jest.mock('@/app/lib/dataService/marketAnalysisService', () => ({
  ...jest.requireActual('@/app/lib/dataService/marketAnalysisService'),
  fetchReachPerFollowerCreators: jest.fn(),
}));

function mockNextRequest(queryParams: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/admin/dashboard/rankings/creators/reach-per-follower');
  Object.entries(queryParams).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });
  return new NextRequest(url.toString());
}

const sampleRankingData: ICreatorMetricRankItem[] = [
  { creatorId: 'u1' as any, creatorName: 'C1', metricValue: 3.5, profilePictureUrl: 'url' },
];

describe('API Route: /api/admin/dashboard/rankings/creators/reach-per-follower', () => {
  beforeEach(() => {
    (fetchReachPerFollowerCreators as jest.Mock).mockClear();
  });

  it('returns 200 with ranking data', async () => {
    (fetchReachPerFollowerCreators as jest.Mock).mockResolvedValueOnce(sampleRankingData);
    const request = mockNextRequest({ startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-31T23:59:59.999Z' });
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual(sampleRankingData);
  });

  it('returns 500 on service error', async () => {
    (fetchReachPerFollowerCreators as jest.Mock).mockRejectedValueOnce(new DatabaseError('fail'));
    const request = mockNextRequest({ startDate: '2023-01-01T00:00:00.000Z', endDate: '2023-01-31T23:59:59.999Z' });
    const response = await GET(request);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe('fail');
  });
});
