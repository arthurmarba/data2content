import { Types } from 'mongoose';
import { getUserReachInteractionTrendChartData } from './getReachInteractionTrendChartData';
import MetricModel from '@/app/models/Metric';
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/models/Metric', () => ({
  aggregate: jest.fn(),
}));
jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));
jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn() },
}));

function formatDateYYYYMMDD(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = date.getMonth() + 1;
  const dd = date.getDate();
  const mmStr = mm < 10 ? `0${mm}` : `${mm}`;
  const ddStr = dd < 10 ? `0${dd}` : `${dd}`;
  return `${yyyy}-${mmStr}-${ddStr}`;
}
function getYearWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return d.getUTCFullYear() + '-' + String(weekNo).padStart(2, '0');
}
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

describe('getReachInteractionTrendChartData', () => {
  const userId = new Types.ObjectId().toString();
  let baseDate: Date;

  beforeEach(() => {
    (MetricModel.aggregate as jest.Mock).mockReset();
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
    baseDate = new Date(2023, 10, 15, 12, 0, 0, 0); // 15 Nov 2023
    jest.useFakeTimers();
    jest.setSystemTime(baseDate);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  function mockAggregateEntry(postDate: Date, reach?: number | null, interactions?: number | null) {
    return {
      _id: formatDateYYYYMMDD(postDate),
      totalReach: reach ?? 0,
      totalInteractions: interactions ?? 0,
    };
  }

  test('Agrega posts diários e preenche gaps', async () => {
    const aggregated = [
      mockAggregateEntry(addDays(baseDate, -6), 100, 10), // Nov 9
      mockAggregateEntry(addDays(baseDate, -4), 120, 12), // Nov 11
      mockAggregateEntry(addDays(baseDate, 0), 150, 15),  // Nov 15
    ];
    (MetricModel.aggregate as jest.Mock).mockResolvedValue(aggregated);

    const result = await getUserReachInteractionTrendChartData(userId, 'last_7_days', 'daily');

    expect(result.chartData.length).toBe(7);
    expect(result.chartData[0]).toEqual({ date: formatDateYYYYMMDD(addDays(baseDate, -6)), reach: 100, totalInteractions: 10 });
    expect(result.chartData[1]).toEqual({ date: formatDateYYYYMMDD(addDays(baseDate, -5)), reach: 0, totalInteractions: 0 });
    expect(result.chartData[2]).toEqual({ date: formatDateYYYYMMDD(addDays(baseDate, -4)), reach: 120, totalInteractions: 12 });
    expect(result.chartData[6]).toEqual({ date: formatDateYYYYMMDD(addDays(baseDate, 0)), reach: 150, totalInteractions: 15 });
  });

  test('Agrega posts semanais e preenche gaps', async () => {
    const aggregated = [
      mockAggregateEntry(addDays(baseDate, -28), 200, 20),
      mockAggregateEntry(addDays(baseDate, -14), 300, 30),
      mockAggregateEntry(addDays(baseDate, 0), 400, 40),
    ];
    (MetricModel.aggregate as jest.Mock).mockResolvedValue(aggregated);

    const result = await getUserReachInteractionTrendChartData(userId, 'last_30_days', 'weekly');

    const week1 = getYearWeek(addDays(baseDate, -28));
    const week2 = getYearWeek(addDays(baseDate, -21)); // gap
    const week3 = getYearWeek(addDays(baseDate, -14));
    const week4 = getYearWeek(addDays(baseDate, -7));  // gap
    const week5 = getYearWeek(addDays(baseDate, 0));

    expect(result.chartData.find(p => p.date === week1)?.reach).toBe(200);
    expect(result.chartData.find(p => p.date === week2)?.reach).toBe(0);
    expect(result.chartData.find(p => p.date === week3)?.totalInteractions).toBe(30);
    expect(result.chartData.find(p => p.date === week4)?.reach).toBe(0);
    expect(result.chartData.find(p => p.date === week5)?.totalInteractions).toBe(40);
  });

  test('Nenhum post retorna todos nulos', async () => {
    (MetricModel.aggregate as jest.Mock).mockResolvedValue([]);
    const result = await getUserReachInteractionTrendChartData(userId, 'last_7_days', 'daily');
    expect(result.chartData.length).toBe(7);
    result.chartData.forEach(p => {
      expect(p.reach).toBe(0);
      expect(p.totalInteractions).toBe(0);
    });
  });

  test('Erro no DB', async () => {
    (MetricModel.aggregate as jest.Mock).mockRejectedValue(new Error('DB Error'));
    const result = await getUserReachInteractionTrendChartData(userId, 'last_7_days', 'daily');
    expect(result.chartData.length).toBe(0);
    expect(result.insightSummary).toBe('Erro ao buscar dados de alcance e interações do usuário.');
    expect((logger as any).error).toHaveBeenCalled();
  });
});
