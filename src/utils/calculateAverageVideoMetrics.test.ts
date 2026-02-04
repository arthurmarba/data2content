import calculateAverageVideoMetrics from './calculateAverageVideoMetrics';
import MetricModel from '@/app/models/Metric';

jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

jest.mock('@/app/models/Metric', () => ({
  aggregate: jest.fn(),
}));

const mockAggregate = MetricModel.aggregate as jest.Mock;
const testUserId = '507f1f77bcf86cd799439011';

describe('calculateAverageVideoMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes averages from aggregation result', async () => {
    mockAggregate.mockResolvedValueOnce([
      {
        totalVideoPosts: 2,
        sumWatchTime: 200,
        countValidWatchTime: 2,
        sumRetention: 1.2,
        countValidRetention: 2,
        sumViews: 1000,
        countValidViews: 2,
        sumLikes: 50,
        countValidLikes: 2,
        sumComments: 10,
        countValidComments: 2,
        sumShares: 6,
        countValidShares: 2,
        sumSaves: 4,
        countValidSaves: 2,
      },
    ]);

    const result = await calculateAverageVideoMetrics(testUserId, 30);
    expect(result.numberOfVideoPosts).toBe(2);
    expect(result.averageViews).toBeCloseTo(500);
    expect(result.averageLikes).toBeCloseTo(25);
    expect(result.averageComments).toBeCloseTo(5);
    expect(result.averageShares).toBeCloseTo(3);
    expect(result.averageSaves).toBeCloseTo(2);
  });

  it('returns defaults when aggregation returns nothing', async () => {
    mockAggregate.mockResolvedValueOnce([]);
    const result = await calculateAverageVideoMetrics(testUserId, 30);
    expect(result.numberOfVideoPosts).toBe(0);
    expect(result.averageViews).toBe(0);
    expect(result.averageLikes).toBe(0);
    expect(result.averageComments).toBe(0);
    expect(result.averageShares).toBe(0);
    expect(result.averageSaves).toBe(0);
  });
});
