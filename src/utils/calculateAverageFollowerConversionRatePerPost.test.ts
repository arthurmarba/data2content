import { Types } from 'mongoose';
import calculateAverageFollowerConversionRatePerPost from './calculateAverageFollowerConversionRatePerPost'; // Ajuste o caminho
import MetricModel, { IMetricStats } from '@/app/models/Metric'; // Ajuste o caminho

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

describe('calculateAverageFollowerConversionRatePerPost', () => {
  const userId = new Types.ObjectId().toString();
  const periodInDays = 30;
  let expectedStartDate: Date;
  let expectedEndDate: Date;

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
    const today = new Date();
    expectedEndDate = new Date(today);
    expectedStartDate = new Date(today);
    expectedStartDate.setDate(today.getDate() - periodInDays);
  });

  const mockPostWithConversionRate = (id: string, follower_conversion_rate: number | null): any => {
    const stats: Partial<IMetricStats> = {};
    if (follower_conversion_rate !== null) {
      stats.follower_conversion_rate = follower_conversion_rate;
    }
    return {
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(userId),
      postDate: new Date(),
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  };

  test('Múltiplos posts com taxa de conversão válida', async () => {
    const posts = [
      mockPostWithConversionRate('post1', 0.02), // 2%
      mockPostWithConversionRate('post2', 0.03), // 3%
      mockPostWithConversionRate('post3', 0.01), // 1%
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

    const result = await calculateAverageFollowerConversionRatePerPost(userId, periodInDays);

    expect(result.numberOfPostsConsideredForRate).toBe(3);
    expect(result.sumFollowerConversionRate).toBeCloseTo(0.06); // 0.02 + 0.03 + 0.01
    // average = (0.06 / 3) * 100 = 0.02 * 100 = 2.0
    expect(result.averageFollowerConversionRatePerPost).toBeCloseTo(2.0);
    expect(result.startDate?.toISOString().substring(0,10)).toEqual(expectedStartDate.toISOString().substring(0,10));
    expect(result.endDate?.toISOString().substring(0,10)).toEqual(expectedEndDate.toISOString().substring(0,10));
  });

  test('Zero posts no período', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve([]) });
    const result = await calculateAverageFollowerConversionRatePerPost(userId, periodInDays);
    expect(result.numberOfPostsConsideredForRate).toBe(0);
    expect(result.sumFollowerConversionRate).toBe(0);
    expect(result.averageFollowerConversionRatePerPost).toBe(0.0);
  });

  test('Alguns posts com taxa de conversão nula ou ausente', async () => {
    const posts = [
      mockPostWithConversionRate('post1', 0.04),       // 4%
      mockPostWithConversionRate('post2', null),       // taxa nula
      mockPostWithConversionRate('post3', 0.02),       // 2%
      { // Post sem campo stats
        _id: new Types.ObjectId('post4'),
        user: new Types.ObjectId(userId),
        postDate: new Date(),
      } as any,
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await calculateAverageFollowerConversionRatePerPost(userId, periodInDays);

    expect(result.numberOfPostsConsideredForRate).toBe(2); // Apenas post1 e post3
    expect(result.sumFollowerConversionRate).toBeCloseTo(0.06); // 0.04 + 0.02
    // average = (0.06 / 2) * 100 = 0.03 * 100 = 3.0
    expect(result.averageFollowerConversionRatePerPost).toBeCloseTo(3.0);
  });

  test('Todos os posts com taxa de conversão nula ou ausente', async () => {
    const posts = [
      mockPostWithConversionRate('post1', null),
      mockPostWithConversionRate('post2', null),
      { _id: new Types.ObjectId('post3'), user: new Types.ObjectId(userId), postDate: new Date() } as any,
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await calculateAverageFollowerConversionRatePerPost(userId, periodInDays);
    expect(result.numberOfPostsConsideredForRate).toBe(0);
    expect(result.sumFollowerConversionRate).toBe(0);
    expect(result.averageFollowerConversionRatePerPost).toBe(0.0);
  });

  test('Erro no Banco de Dados', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.reject(new Error("DB query failed")) });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await calculateAverageFollowerConversionRatePerPost(userId, periodInDays);
    expect(result.numberOfPostsConsideredForRate).toBe(0);
    expect(result.sumFollowerConversionRate).toBe(0);
    expect(result.averageFollowerConversionRatePerPost).toBe(0.0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error calculating average follower conversion rate per post"), expect.any(Error));

    consoleErrorSpy.mockRestore();
  });
});
```
