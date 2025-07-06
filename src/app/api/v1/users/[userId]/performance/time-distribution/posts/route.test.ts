import { GET } from './route';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

jest.mock('@/app/models/Metric', () => ({
  aggregate: jest.fn(),
}));

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

const mockAgg = MetricModel.aggregate as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;

const makeRequest = (userId: string, search = '') => new NextRequest(`http://localhost/api/v1/users/${userId}/performance/time-distribution/posts${search}`);

describe('GET /api/v1/users/[userId]/performance/time-distribution/posts', () => {
  const userId = new Types.ObjectId().toString();
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('returns posts list', async () => {
    mockAgg.mockResolvedValueOnce([{ _id: 'p1', metricValue: 10 }]);

    const res = await GET(makeRequest(userId, '?dayOfWeek=1&timeBlock=6-12&timePeriod=last_30_days'), { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockAgg).toHaveBeenCalled();
    expect(body.posts[0].metricValue).toBe(10);
  });
});
