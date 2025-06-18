import { Types } from 'mongoose';
import calculateAverageEngagementPerPost, { AverageEngagementData } from './calculateAverageEngagementPerPost'; // Ajuste o caminho
import MetricModel, { IMetricStats } from '@/app/models/Metric'; // Ajuste o caminho
import { getStartDateFromTimePeriod as getStartDateFromTimePeriodGeneric, formatDateYYYYMMDD, addDays } from "./dateHelpers";


jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

describe('calculateAverageEngagementPerPost', () => {
  const userId = new Types.ObjectId().toString();
  const periodInDays = 30;
  let defaultStartDate: Date;
  let defaultEndDate: Date;

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
    const today = new Date();
    defaultEndDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
    defaultStartDate = getStartDateFromTimePeriodGeneric(today, `last_${periodInDays}_days`);

    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  const mockPost = (id: string, total_interactions: number | null, engagement_rate_on_reach: number | null, postDate?: Date): any => {
    const stats: Partial<IMetricStats> = {};
    if (total_interactions !== null) {
      stats.total_interactions = total_interactions;
    }
    if (engagement_rate_on_reach !== null) {
      stats.engagement_rate_on_reach = engagement_rate_on_reach;
    }
    return {
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(userId),
      postDate: postDate || new Date(),
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  };

  // Testes para o comportamento original (periodInDays como número)
  describe('when using periodInDays (number)', () => {
    test('TC1.2.1: Múltiplos Posts Válidos', async () => {
      const posts = [
        mockPost('post1', 10, 0.1),
        mockPost('post2', 20, 0.2),
        mockPost('post3', 30, 0.3),
      ];
      (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

      const result = await calculateAverageEngagementPerPost(userId, periodInDays);

      expect(result.numberOfPosts).toBe(3);
      expect(result.totalEngagement).toBe(60);
      expect(result.averageEngagementPerPost).toBeCloseTo(20);
      expect(result.sumEngagementRateOnReach).toBeCloseTo(0.6);
      expect(result.averageEngagementRateOnReach).toBeCloseTo(0.2);
      expect(formatDateYYYYMMDD(result.startDateUsed!)).toEqual(formatDateYYYYMMDD(defaultStartDate));
      expect(formatDateYYYYMMDD(result.endDateUsed!)).toEqual(formatDateYYYYMMDD(defaultEndDate));
    });

    test('TC1.2.2: Zero Posts', async () => {
      (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve([]) });
      const result = await calculateAverageEngagementPerPost(userId, periodInDays);
      expect(result.totalEngagement).toBe(0);
      expect(result.numberOfPosts).toBe(0);
      // ... assertions for other fields being 0
      expect(formatDateYYYYMMDD(result.startDateUsed!)).toEqual(formatDateYYYYMMDD(defaultStartDate));
    });
  });

  // Testes para o novo comportamento (periodInDaysOrConfig como objeto de data)
  describe('when using { startDate, endDate } object', () => {
    test('Calcula corretamente com range de datas específico', async () => {
      const customStartDate = new Date(2023, 0, 1); // 1 Jan 2023
      const customEndDate = new Date(2023, 0, 15, 23, 59, 59, 999); // 15 Jan 2023
      customStartDate.setHours(0,0,0,0);


      const posts = [
        mockPost('post1', 100, 0.5, new Date(2023,0,5)),
        mockPost('post2', 50, 0.25, new Date(2023,0,10)),
      ];
      (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

      const result = await calculateAverageEngagementPerPost(userId, { startDate: customStartDate, endDate: customEndDate });

      expect(result.numberOfPosts).toBe(2);
      expect(result.totalEngagement).toBe(150);
      expect(result.averageEngagementPerPost).toBeCloseTo(75);
      expect(result.sumEngagementRateOnReach).toBeCloseTo(0.75);
      expect(result.averageEngagementRateOnReach).toBeCloseTo(0.375);
      expect(formatDateYYYYMMDD(result.startDateUsed!)).toEqual(formatDateYYYYMMDD(customStartDate));
      expect(formatDateYYYYMMDD(result.endDateUsed!)).toEqual(formatDateYYYYMMDD(customEndDate));

      // Verificar se a query ao DB usou as datas corretas
      const mockQueryArgs = (MetricModel.find as jest.Mock).mock.calls[0][0];
      expect(formatDateYYYYMMDD(mockQueryArgs.postDate.$gte)).toEqual(formatDateYYYYMMDD(customStartDate));
      expect(formatDateYYYYMMDD(mockQueryArgs.postDate.$lte)).toEqual(formatDateYYYYMMDD(customEndDate));
    });

    test('Range de datas específico sem posts', async () => {
      const customStartDate = new Date(2023, 0, 1);
      const customEndDate = new Date(2023, 0, 15);
      customStartDate.setHours(0,0,0,0);
      customEndDate.setHours(23,59,59,999);

      (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve([]) });
      const result = await calculateAverageEngagementPerPost(userId, { startDate: customStartDate, endDate: customEndDate });
      expect(result.totalEngagement).toBe(0);
      expect(result.numberOfPosts).toBe(0);
      expect(result.startDateUsed).toEqual(customStartDate);
      expect(result.endDateUsed).toEqual(customEndDate);
    });
  });

  test('Erro no Banco de Dados (com periodInDays)', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.reject(new Error("DB query failed")) });

    const result = await calculateAverageEngagementPerPost(userId, periodInDays);
    expect(result.totalEngagement).toBe(0);
    // ... outros campos numéricos devem ser 0
    expect(result.startDateUsed).not.toBeNull(); // Datas ainda devem ser as efetivas usadas
    expect(result.endDateUsed).not.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  test('Erro no Banco de Dados (com startDate/endDate object)', async () => {
    const customStartDate = new Date(2023, 0, 1);
    const customEndDate = new Date(2023, 0, 15);
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.reject(new Error("DB query failed")) });

    const result = await calculateAverageEngagementPerPost(userId, {startDate: customStartDate, endDate: customEndDate});
    expect(result.totalEngagement).toBe(0);
    expect(result.startDateUsed).toEqual(customStartDate);
    expect(result.endDateUsed).toEqual(customEndDate);
    expect(console.error).toHaveBeenCalled();
  });

});
