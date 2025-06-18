import { GET } from './route';
import UserModel from '@/app/models/User';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { NextRequest } from 'next/server';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/models/User', () => ({
  find: jest.fn(),
}));

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockUserFind = UserModel.find as jest.Mock;
const mockMetricFind = MetricModel.find as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;

const createRequest = (params = '') => new NextRequest(`http://localhost/api/v1/platform/performance/average-engagement${params}`);

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});

describe('GET /api/v1/platform/performance/average-engagement', () => {
  it('aggregates engagement metrics for active users', async () => {
    const users = [{ _id: 'u1' }, { _id: 'u2' }];
    const userLean = jest.fn().mockResolvedValue(users);
    const userSelect = jest.fn().mockReturnValue({ lean: userLean });
    mockUserFind.mockReturnValue({ select: userSelect });

    const posts = [
      { format: 'REEL', context: 'c1', stats: { total_interactions: 100 } },
      { format: 'REEL', context: 'c2', stats: { total_interactions: 50 } },
      { format: 'IMAGE', context: 'c1', stats: { total_interactions: 200 } },
    ];
    const metricLean = jest.fn().mockResolvedValue(posts);
    mockMetricFind.mockReturnValue({ lean: metricLean });

    const res = await GET(createRequest('?timePeriod=last_7_days&engagementMetricField=stats.total_interactions&groupBy=format'));
    const body = await res.json();

    expect(mockUserFind).toHaveBeenCalledWith({ planStatus: 'active' });
    expect(mockMetricFind).toHaveBeenCalled();
    expect(body.chartData.length).toBe(2);
    expect(body.chartData[0].name).toBe('IMAGE');
    expect(body.chartData[0].value).toBe(200);
    expect(body.chartData[0].postsCount).toBe(1);
  });

  it('aggregates engagement metrics by proposal', async () => {
    const users = [{ _id: 'u1' }];
    const userLean = jest.fn().mockResolvedValue(users);
    const userSelect = jest.fn().mockReturnValue({ lean: userLean });
    mockUserFind.mockReturnValue({ select: userSelect });

    const posts = [
      { proposal: 'Review', stats: { total_interactions: 100 } },
      { proposal: 'Review', stats: { total_interactions: 50 } },
      { proposal: 'News', stats: { total_interactions: 200 } },
    ];
    const metricLean = jest.fn().mockResolvedValue(posts);
    mockMetricFind.mockReturnValue({ lean: metricLean });

    const res = await GET(createRequest('?groupBy=proposal'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.groupBy).toBe('proposal');
    expect(body.chartData.length).toBe(2);
  });

  it('returns 400 for invalid groupBy', async () => {
    const res = await GET(createRequest('?groupBy=invalid'));
    expect(res.status).toBe(400);
  });
});
