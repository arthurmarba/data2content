import aggregatePlatformTimePerformance from '../aggregatePlatformTimePerformance';
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

describe('aggregatePlatformTimePerformance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('aggregates and sorts time buckets', async () => {
    mockAgg.mockResolvedValueOnce([
      { _id: { dayOfWeek: 2, timeBlock: '12-18' }, avg: 15, count: 4 },
      { _id: { dayOfWeek: 5, timeBlock: '18-24' }, avg: 10, count: 2 },
      { _id: { dayOfWeek: 1, timeBlock: '6-12' }, avg: 5, count: 3 },
    ]);

    const res = await aggregatePlatformTimePerformance(30, 'stats.total_interactions', {});
    expect(mockConnect).toHaveBeenCalled();
    expect(mockAgg).toHaveBeenCalled();
    expect(res.buckets.length).toBe(3);
    expect(res.bestSlots[0].average).toBe(15);
    expect(res.worstSlots[0].average).toBe(5);
  });

  it('handles empty aggregation', async () => {
    mockAgg.mockResolvedValueOnce([]);
    const res = await aggregatePlatformTimePerformance(30, 'stats.total_interactions', {});
    expect(res.buckets).toEqual([]);
    expect(res.bestSlots).toEqual([]);
  });

  it('passes filters to aggregation', async () => {
    mockAgg.mockResolvedValueOnce([]);
    await aggregatePlatformTimePerformance(7, 'stats.total_interactions', { format: 'reel', context: 'tech' });
    const pipeline = mockAgg.mock.calls[0][0];
    expect(pipeline[0].$match.format).toBe('reel');
    expect(pipeline[0].$match.context).toBe('tech');
  });
});
