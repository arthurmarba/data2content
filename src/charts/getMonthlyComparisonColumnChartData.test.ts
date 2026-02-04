import { Types } from 'mongoose';
import getMonthlyComparisonColumnChartData from './getMonthlyComparisonColumnChartData'; // Ajuste
import MetricModel, { IMetric, IMetricStats } from '@/app/models/Metric'; // Ajuste
import { getNestedValue } from '@/utils/dataAccessHelpers'; // Ajuste
import { logger } from '@/app/lib/logger';
import { connectToDatabase } from '@/app/lib/mongoose';

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

jest.mock('@/utils/dataAccessHelpers', () => ({
  getNestedValue: jest.fn(),
}));
jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn() },
}));
jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));

// Helper para formatar data como YYYY-MM (copiado da implementação)
function formatDateYYYYMM(date: Date): string {
  return date.toISOString().substring(0, 7);
}
function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== date.getDate()) {
    d.setDate(0);
  }
  return d;
}


describe('getMonthlyComparisonColumnChartData', () => {
  const userId = new Types.ObjectId().toString();
  let baseTestDate: Date; // Data base para os testes

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
    (getNestedValue as jest.Mock).mockReset();
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
    baseTestDate = new Date(2023, 10, 15, 12, 0, 0, 0); // 15 de Novembro de 2023
    (getNestedValue as jest.Mock).mockImplementation((obj: any, path: string) =>
      path.split('.').reduce((acc: any, key: string) => acc?.[key], obj)
    );
  });

  const mockMetricPost = (id: string, postDate: Date, interactions?: number): Partial<IMetric> => {
    const resolvedId = Types.ObjectId.isValid(id) ? id : new Types.ObjectId().toString();
    const stats: Partial<IMetricStats> = {};
    if (interactions !== undefined) {
      stats.total_interactions = interactions;
    }
    return {
      _id: new Types.ObjectId(resolvedId),
      user: new Types.ObjectId(userId),
      postDate: postDate,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  };

  test('Calcula "totalPosts" corretamente', async () => {
    // M1 (Nov 2023): 3 posts
    // M0 (Out 2023): 2 posts
    // M-1 (Set 2023): 1 post
    const M1_date = baseTestDate;
    const M0_date = addMonths(new Date(baseTestDate), -1);
    const M_minus_1_date = addMonths(new Date(baseTestDate), -2);

    const posts = [
      mockMetricPost('p1m1', new Date(M1_date.getFullYear(), M1_date.getMonth(), 5)),
      mockMetricPost('p2m1', new Date(M1_date.getFullYear(), M1_date.getMonth(), 10)),
      mockMetricPost('p3m1', new Date(M1_date.getFullYear(), M1_date.getMonth(), 15)),
      mockMetricPost('p1m0', new Date(M0_date.getFullYear(), M0_date.getMonth(), 5)),
      mockMetricPost('p2m0', new Date(M0_date.getFullYear(), M0_date.getMonth(), 10)),
      mockMetricPost('p1m-1', new Date(M_minus_1_date.getFullYear(), M_minus_1_date.getMonth(), 5)),
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });


    const result = await getMonthlyComparisonColumnChartData(userId, "totalPosts", baseTestDate);

    expect(result.chartData.length).toBe(4);
    expect(result.metricCompared).toBe("totalPosts");

    // Mês Passado (Out) vs Mês Retrasado (Set)
    expect(result.chartData[0].value).toBe(1); // M-1 (Set)
    expect(result.chartData[0].periodKey).toBe("M-1");
    expect(result.chartData[1].value).toBe(2); // M0 (Out)
    expect(result.chartData[1].periodKey).toBe("M0");

    // Este Mês (Nov) vs Mês Passado (Out)
    expect(result.chartData[2].value).toBe(2); // M0 (Out)
    expect(result.chartData[2].periodKey).toBe("M0");
    expect(result.chartData[3].value).toBe(3); // M1 (Nov)
    expect(result.chartData[3].periodKey).toBe("M1");

    expect(result.insightSummary).toContain("Este Mês vs Mês Passado: +1 (50%)"); // 3 vs 2
    expect(result.insightSummary).toContain("Mês Passado vs Retrasado: +1 (100%)"); // 2 vs 1
  });

  test('Calcula "stats.total_interactions" (totalEngagement) corretamente', async () => {
    const metricField = "stats.total_interactions";
    const M1_date = baseTestDate;
    const M0_date = addMonths(new Date(baseTestDate), -1);
    const M_minus_1_date = addMonths(new Date(baseTestDate), -2);

    const posts = [
      mockMetricPost('p1m1', new Date(M1_date.getFullYear(), M1_date.getMonth(), 5), 50),
      mockMetricPost('p2m1', new Date(M1_date.getFullYear(), M1_date.getMonth(), 10), 60),
      mockMetricPost('p1m0', new Date(M0_date.getFullYear(), M0_date.getMonth(), 5), 30),
      mockMetricPost('p2m0', new Date(M0_date.getFullYear(), M0_date.getMonth(), 10), 40),
      mockMetricPost('p1m-1', new Date(M_minus_1_date.getFullYear(), M_minus_1_date.getMonth(), 5), 20),
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

    // Mock getNestedValue para retornar total_interactions
    (getNestedValue as jest.Mock).mockImplementation((obj, path) => {
      if (path === metricField && obj.stats && obj.stats.total_interactions !== undefined) {
        return obj.stats.total_interactions;
      }
      return 0;
    });

    const result = await getMonthlyComparisonColumnChartData(userId, metricField, baseTestDate);
    expect(result.chartData.length).toBe(4);
    expect(result.metricCompared).toBe(metricField);

    expect(result.chartData[0].value).toBe(20); // M-1
    expect(result.chartData[1].value).toBe(70); // M0
    expect(result.chartData[2].value).toBe(70); // M0
    expect(result.chartData[3].value).toBe(110); // M1

    // 110 vs 70: +40. (40/70)*100 = 57.14%
    expect(result.insightSummary).toContain("Este Mês vs Mês Passado: +40 (57%)");
    // 70 vs 20: +50. (50/20)*100 = 250%
    expect(result.insightSummary).toContain("Mês Passado vs Retrasado: +50 (250%)");
  });

  test('Lida com meses sem posts (valor 0)', async () => {
    const M1_date = baseTestDate;
    const M0_date = addMonths(new Date(baseTestDate), -1);
    const M_minus_1_date = addMonths(new Date(baseTestDate), -2);

    const posts = [
      mockMetricPost('p1m1', new Date(M1_date.getFullYear(), M1_date.getMonth(), 5)), // M1: 1 post
      mockMetricPost('p1m-1', new Date(M_minus_1_date.getFullYear(), M_minus_1_date.getMonth(), 5)), // M-1: 1 post
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

    const result = await getMonthlyComparisonColumnChartData(userId, "totalPosts", baseTestDate);
    expect(result.chartData[0].value).toBe(1); // M-1
    expect(result.chartData[1].value).toBe(0); // M0
    expect(result.chartData[2].value).toBe(0); // M0
    expect(result.chartData[3].value).toBe(1); // M1

    // 1 vs 0: +1. (1/0)*100 -> 100% (conforme lógica de insight)
    expect(result.insightSummary).toContain("Este Mês vs Mês Passado: +1 (100%)");
    // 0 vs 1: -1. (-1/1)*100 = -100%
    expect(result.insightSummary).toContain("Mês Passado vs Retrasado: -1 (-100%)");
  });

  test('Insight com M0 e M-1 sendo zero para totalPosts', async () => {
    const posts = [
      mockMetricPost('p1m1', new Date(baseTestDate.getFullYear(), baseTestDate.getMonth(), 5)), // M1: 1 post
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

    const result = await getMonthlyComparisonColumnChartData(userId, "totalPosts", baseTestDate);
    expect(result.chartData[0].value).toBe(0); // M-1
    expect(result.chartData[1].value).toBe(0); // M0
    expect(result.chartData[2].value).toBe(0); // M0
    expect(result.chartData[3].value).toBe(1); // M1

    expect(result.insightSummary).toContain("Este Mês vs Mês Passado: +1 (100%)"); // 1 vs 0
    expect(result.insightSummary).toContain("Mês Passado vs Retrasado: +0 (0%)");   // 0 vs 0
  });


  test('Erro no DB durante uma das buscas', async () => {
    // Simula erro na busca do M0, por exemplo
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.reject(new Error("DB Error for M0")) });

    const result = await getMonthlyComparisonColumnChartData(userId, "totalPosts", baseTestDate);
    expect(result.chartData).toEqual([]); // Espera array vazio no erro
    expect(result.insightSummary).toBe("Erro ao buscar dados de comparação mensal.");
    expect((logger as any).error).toHaveBeenCalled();
  });
});
