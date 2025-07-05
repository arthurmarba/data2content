import aggregatePlatformPerformanceHighlights from '../aggregatePlatformPerformanceHighlights';
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

describe('aggregatePlatformPerformanceHighlights', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined);
  });

  it('aggregates and formats highlights', async () => {
    mockAgg.mockResolvedValueOnce([
      {
        byFormat: [
          { _id: 'VIDEO', avg: 10, count: 2 },
          { _id: 'IMAGE', avg: 2, count: 1 },
        ],
        byContext: [
          { _id: 'FEED', avg: 5, count: 3 },
        ],
      },
    ]);

    const res = await aggregatePlatformPerformanceHighlights(30, 'stats.total_interactions');
    expect(mockConnect).toHaveBeenCalled();
    expect(mockAgg).toHaveBeenCalled();
    expect(res.topFormat).toEqual({ name: 'VIDEO', average: 10, count: 2 });
    expect(res.lowFormat).toEqual({ name: 'IMAGE', average: 2, count: 1 });
    expect(res.topContext).toEqual({ name: 'FEED', average: 5, count: 3 });
  });

  it('joins array ids into comma separated strings', async () => {
    mockAgg.mockResolvedValueOnce([
      {
        byFormat: [
          { _id: ['VIDEO', 'LIVE'], avg: 8, count: 4 },
          { _id: ['IMAGE'], avg: 2, count: 1 },
        ],
        byContext: [
          { _id: ['FEED', 'STORIES'], avg: 7, count: 5 },
        ],
      },
    ]);

    const res = await aggregatePlatformPerformanceHighlights(30, 'stats.total_interactions');
    expect(res.topFormat?.name).toBe('VIDEO,LIVE');
    expect(res.lowFormat?.name).toBe('IMAGE');
    expect(res.topContext?.name).toBe('FEED,STORIES');
  });

  it('handles empty aggregation', async () => {
    mockAgg.mockResolvedValueOnce([{}]);
    const res = await aggregatePlatformPerformanceHighlights(30, 'stats.total_interactions');
    expect(res).toEqual({ topFormat: null, lowFormat: null, topContext: null });
  });
});
