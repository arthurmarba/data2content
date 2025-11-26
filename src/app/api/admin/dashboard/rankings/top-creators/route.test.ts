import { GET } from './route';
import { NextRequest } from 'next/server';
import { fetchTopCreators, fetchTopCreatorsWithScore } from '@/app/lib/dataService/marketAnalysis/profilesService';
import { DatabaseError } from '@/app/lib/errors';

jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/app/lib/dataService/marketAnalysis/profilesService', () => ({
  fetchTopCreators: jest.fn(),
  fetchTopCreatorsWithScore: jest.fn(),
}));

function mockRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/admin/dashboard/rankings/top-creators');
  Object.entries(params).forEach(([k, v]) => url.searchParams.append(k, v));
  return new NextRequest(url.toString());
}

const sampleData = [
  {
    creatorId: '1',
    creatorName: 'Alice',
    metricValue: 100,
    totalInteractions: 200,
    postCount: 10,
    profilePictureUrl: 'https://example.com/alice.jpg',
  },
];
const sampleScoreData = [
  { creatorId: '1', creatorName: 'Alice', score: 90 },
];

describe('API Route: top-creators', () => {
  beforeEach(() => {
    (fetchTopCreators as jest.Mock).mockReset();
    (fetchTopCreatorsWithScore as jest.Mock).mockReset();
  });

  it('returns ranking data with valid query', async () => {
    (fetchTopCreators as jest.Mock).mockResolvedValueOnce(sampleData);
    const req = mockRequest({ context: 'tech', metric: 'shares', days: '30', limit: '1' });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(sampleData);
    expect(fetchTopCreators).toHaveBeenCalledWith({
      context: 'tech',
      metricToSortBy: 'shares',
      days: 30,
      limit: 1,
      offset: 0,
    });
  });

  it('returns 400 on invalid metric', async () => {
    const req = mockRequest({ metric: 'invalid' });
    const res = await GET(req);
    expect(res.status).toBe(400);
    expect(fetchTopCreators).not.toHaveBeenCalled();
  });

  it('returns composite ranking when composite=true', async () => {
    (fetchTopCreatorsWithScore as jest.Mock).mockResolvedValueOnce(sampleScoreData);
    const req = mockRequest({ composite: 'true', days: '30', limit: '1' });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual(sampleScoreData);
    expect(fetchTopCreatorsWithScore).toHaveBeenCalledWith({
      context: 'geral',
      days: 30,
      limit: 1,
      offset: 0,
    });
    expect(fetchTopCreators).not.toHaveBeenCalled();
  });

  it('handles empty data for composite ranking', async () => {
    (fetchTopCreatorsWithScore as jest.Mock).mockResolvedValueOnce([]);
    const req = mockRequest({ composite: 'true' });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it('handles DatabaseError with 500', async () => {
    (fetchTopCreators as jest.Mock).mockRejectedValueOnce(new DatabaseError('fail'));
    const req = mockRequest({ metric: 'shares', days: '30', limit: '1' });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('fail');
  });
});
