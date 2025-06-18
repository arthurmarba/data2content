import { GET } from './route';
import getAverageEngagementByGrouping from '@/utils/getAverageEngagementByGrouping';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

jest.mock('@/utils/getAverageEngagementByGrouping', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockGetAverage = getAverageEngagementByGrouping as jest.Mock;

const createRequest = (userId: string, search: string = ''): NextRequest => {
  const url = `http://localhost/api/v1/users/${userId}/performance/average-engagement${search}`;
  return new NextRequest(url);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/users/[userId]/performance/average-engagement', () => {
  const userId = new Types.ObjectId().toString();

  it('calls helper with provided parameters', async () => {
    mockGetAverage.mockResolvedValueOnce([]);
    const req = createRequest(
      userId,
      '?timePeriod=last_7_days&engagementMetricField=stats.views&groupBy=context'
    );
    const res = await GET(req, { params: { userId } });
    expect(mockGetAverage).toHaveBeenCalledWith(
      userId,
      'last_7_days',
      'stats.views',
      'context'
    );
    expect(res.status).toBe(200);
  });

  it('handles groupBy proposal', async () => {
    mockGetAverage.mockResolvedValueOnce([]);
    const req = createRequest(userId, '?groupBy=proposal');
    const res = await GET(req, { params: { userId } });
    expect(mockGetAverage).toHaveBeenCalledWith(
      userId,
      'last_90_days',
      'stats.total_interactions',
      'proposal'
    );
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid groupBy', async () => {
    const req = createRequest(userId, '?groupBy=invalid');
    const res = await GET(req, { params: { userId } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('groupBy inválido');
    expect(mockGetAverage).not.toHaveBeenCalled();
  });
});
