import aggregatePlatformDayPerformance from '../aggregatePlatformDayPerformance';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';

jest.mock('@/app/models/Metric', () => ({
  aggregate: jest.fn(),
}));

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

const mockAgg = MetricModel.aggregate as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;

describe('aggregatePlatformDayPerformance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('aggregates and sorts day buckets', async () => {
    mockAgg.mockResolvedValueOnce([
      { _id: 2, avg: 15, count: 4 },
      { _id: 5, avg: 10, count: 2 },
      { _id: 1, avg: 5, count: 3 },
    ]);

    const res = await aggregatePlatformDayPerformance(30, 'stats.total_interactions', {});
    expect(mockConnect).toHaveBeenCalled();
    expect(mockAgg).toHaveBeenCalled();
    expect(res.buckets.length).toBe(3);
    expect(res.bestDays[0].average).toBe(15);
    expect(res.worstDays[0].average).toBe(5);
  });

  it('handles empty aggregation', async () => {
    mockAgg.mockResolvedValueOnce([]);
    const res = await aggregatePlatformDayPerformance(30, 'stats.total_interactions', {});
    expect(res.buckets).toEqual([]);
    expect(res.bestDays).toEqual([]);
  });

  it('passes filters to aggregation', async () => {
    mockAgg.mockResolvedValueOnce([]);
    await aggregatePlatformDayPerformance(7, 'stats.total_interactions', { format: 'reel', context: 'tech' });
    const pipeline = mockAgg.mock.calls[0][0];
    expect(pipeline[0].$match.format).toBe('reel');
    expect(pipeline[0].$match.context).toBe('tech');
  });
});
