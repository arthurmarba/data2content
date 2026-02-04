import { Types } from 'mongoose';
import getMonthlyEngagementStackedBarChartData from './getMonthlyEngagementStackedBarChartData'; // Ajuste
import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric'; // Ajuste
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';
import { getStartDateFromTimePeriod } from '@/utils/dateHelpers';

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));
jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));
jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

// Helper para formatar data como YYYY-MM (copiado da implementação)
function formatDateYYYYMM(date: Date): string {
  return date.toISOString().substring(0, 7);
}
// Helper para criar datas para mocks (ajustado para ser mais flexível com meses)
function createDateForMonthlyTest(year: number, month: number, day: number = 15): Date {
  // Mês em JavaScript é 0-indexado (0 para Janeiro, 11 para Dezembro)
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
function countMonthsInclusive(start: Date, end: Date): number {
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const endCursor = new Date(end.getFullYear(), end.getMonth(), 1);
  let count = 0;
  while (cursor <= endCursor) {
    count += 1;
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return count;
}


describe('getMonthlyEngagementStackedBarChartData', () => {
  const userId = new Types.ObjectId().toString();
  let baseTestDate: Date; // Usado para calcular inícios de período de forma consistente

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
    baseTestDate = new Date(2023, 10, 15, 12, 0, 0, 0); // 15 Nov 2023
    jest.useFakeTimers();
    jest.setSystemTime(baseTestDate);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  const mockMetric = (
    id: string,
    postDate: Date,
    likes: number | null,
    comments: number | null,
    shares: number | null
  ): Partial<IMetric> => {
    const resolvedId = Types.ObjectId.isValid(id) ? id : new Types.ObjectId().toString();
    const stats: Partial<IMetricStats> = {};
    if (likes !== null) stats.likes = likes;
    if (comments !== null) stats.comments = comments;
    if (shares !== null) stats.shares = shares;
    return {
      _id: new Types.ObjectId(resolvedId),
      user: new Types.ObjectId(userId),
      postDate: postDate,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  };

  test('Agregação correta para múltiplos posts em múltiplos meses', async () => {
    const timePeriod = "last_3_months";
    // Mês atual (M2), Mês anterior (M1), Mês retrasado (M0)
    const M2_date = baseTestDate; // Mês atual
    const M1_date = addMonths(new Date(M2_date), -1);
    const M0_date = addMonths(new Date(M2_date), -2);

    const posts = [
      // Mês Retrasado (M0)
      mockMetric('p1', createDateForMonthlyTest(M0_date.getFullYear(), M0_date.getMonth() + 1, 5), 10, 1, 1),
      mockMetric('p2', createDateForMonthlyTest(M0_date.getFullYear(), M0_date.getMonth() + 1, 10), 15, 2, 0),
      // Mês Anterior (M1)
      mockMetric('p3', createDateForMonthlyTest(M1_date.getFullYear(), M1_date.getMonth() + 1, 5), 20, 3, 2),
      // Mês Atual (M2)
      mockMetric('p4', createDateForMonthlyTest(M2_date.getFullYear(), M2_date.getMonth() + 1, 1), 30, 5, 3),
      mockMetric('p5', createDateForMonthlyTest(M2_date.getFullYear(), M2_date.getMonth() + 1, 10), 5, 0, 0),
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: () => Promise.resolve(posts) });

    const result = await getMonthlyEngagementStackedBarChartData(userId, timePeriod);
    const startDate = getStartDateFromTimePeriod(baseTestDate, 'last_90_days');
    expect(result.chartData.length).toBe(countMonthsInclusive(startDate, baseTestDate));

    const M0_key = formatDateYYYYMM(M0_date);
    const M1_key = formatDateYYYYMM(M1_date);
    const M2_key = formatDateYYYYMM(M2_date);

    const dataM0 = result.chartData.find(d => d.month === M0_key);
    expect(dataM0).toEqual({ month: M0_key, likes: 25, comments: 3, shares: 1, total: 29 });

    const dataM1 = result.chartData.find(d => d.month === M1_key);
    expect(dataM1).toEqual({ month: M1_key, likes: 20, comments: 3, shares: 2, total: 25 });

    const dataM2 = result.chartData.find(d => d.month === M2_key);
    expect(dataM2).toEqual({ month: M2_key, likes: 35, comments: 5, shares: 3, total: 43 });

    expect(result.insightSummary).toContain("Total de 97 interações"); // 29 + 25 + 43
  });

  test('Omitir meses sem posts dentro do período', async () => {
    const timePeriod = "last_3_months";
    const M2_date = baseTestDate; // Mês atual
    const M0_date = addMonths(new Date(M2_date), -2); // Mês retrasado
    // Nenhum post no Mês Anterior (M1)

    const posts = [
      mockMetric('p1', createDateForMonthlyTest(M0_date.getFullYear(), M0_date.getMonth() + 1, 5), 10, 1, 1),
      mockMetric('p2', createDateForMonthlyTest(M2_date.getFullYear(), M2_date.getMonth() + 1, 1), 30, 5, 3),
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: () => Promise.resolve(posts) });

    const result = await getMonthlyEngagementStackedBarChartData(userId, timePeriod);
    const startDate = getStartDateFromTimePeriod(baseTestDate, 'last_90_days');
    expect(result.chartData.length).toBe(countMonthsInclusive(startDate, baseTestDate));
    expect(result.chartData.find(d => d.month === formatDateYYYYMM(M0_date))).toBeDefined();
    expect(result.chartData.find(d => d.month === formatDateYYYYMM(M2_date))).toBeDefined();
    const gapMonth = result.chartData.find(d => d.month === formatDateYYYYMM(addMonths(M2_date, -1)));
    expect(gapMonth).toBeDefined();
    expect(gapMonth?.total).toBe(0);
  });

  test('Nenhum post no período completo', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: () => Promise.resolve([]) });
    const result = await getMonthlyEngagementStackedBarChartData(userId, "last_6_months");
    expect(result.chartData.length).toBe(0);
    expect(result.insightSummary).toBe("Nenhum dado de engajamento encontrado para o período.");
  });

  test('Posts com algumas interações nulas ou stats ausente', async () => {
    const timePeriod = "last_3_months";
    const M0_date = addMonths(new Date(baseTestDate), -2);
    const posts = [
      mockMetric('p1', createDateForMonthlyTest(M0_date.getFullYear(), M0_date.getMonth() + 1, 5), 10, null, 1), // comments null
      mockMetric('p2', createDateForMonthlyTest(M0_date.getFullYear(), M0_date.getMonth() + 1, 10), 15, 2, null), // shares null
      { // stats ausente
        _id: new Types.ObjectId(),
        user: new Types.ObjectId(userId),
        postDate: createDateForMonthlyTest(M0_date.getFullYear(), M0_date.getMonth() + 1, 12),
      } as any,
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: () => Promise.resolve(posts) });
    const result = await getMonthlyEngagementStackedBarChartData(userId, timePeriod);

    const startDate = getStartDateFromTimePeriod(baseTestDate, 'last_90_days');
    expect(result.chartData.length).toBe(countMonthsInclusive(startDate, baseTestDate));
    const dataM0 = result.chartData.find(d => d.month === formatDateYYYYMM(M0_date));
    expect(dataM0?.likes).toBe(25); // 10 + 15
    expect(dataM0?.comments).toBe(2); // 0 + 2
    expect(dataM0?.shares).toBe(1); // 1 + 0
    expect(dataM0?.total).toBe(28); // 25 + 2 + 1
  });

  test('Erro no DB', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        lean: () => Promise.reject(new Error("DB Find Error"))
    });
    const result = await getMonthlyEngagementStackedBarChartData(userId, "last_3_months");
    expect(result.chartData).toEqual([]);
    expect(result.insightSummary).toBe("Nenhum dado de engajamento encontrado para o período.");
    expect((logger as any).error).toHaveBeenCalled();
  });
});
