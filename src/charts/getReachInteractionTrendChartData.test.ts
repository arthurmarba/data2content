import { Types } from 'mongoose';
import getReachInteractionTrendChartData from './getReachInteractionTrendChartData';
import MetricModel from '@/app/models/Metric';

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
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
    (MetricModel.find as jest.Mock).mockReset();
    baseDate = new Date(2023, 10, 15, 12, 0, 0, 0); // 15 Nov 2023
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  function mockMetric(postDate: Date, reach?: number | null, interactions?: number | null) {
    return {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(userId),
      postDate,
      stats: {
        ...(reach !== null ? { reach } : {}),
        ...(interactions !== null ? { total_interactions: interactions } : {}),
      },
    } as any;
  }

  test('Agrega posts diários e preenche gaps', async () => {
    const posts = [
      mockMetric(addDays(baseDate, -6), 100, 10), // Nov 9
      mockMetric(addDays(baseDate, -4), 120, 12), // Nov 11
      mockMetric(addDays(baseDate, 0), 150, 15),  // Nov 15
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: () => Promise.resolve(posts) });

    const result = await getReachInteractionTrendChartData(userId, 'last_7_days', 'daily');

    expect(result.chartData.length).toBe(7);
    expect(result.chartData[0]).toEqual({ date: formatDateYYYYMMDD(addDays(baseDate, -6)), reach: 100, engagedUsers: 10 });
    expect(result.chartData[1]).toEqual({ date: formatDateYYYYMMDD(addDays(baseDate, -5)), reach: null, engagedUsers: null });
    expect(result.chartData[2]).toEqual({ date: formatDateYYYYMMDD(addDays(baseDate, -4)), reach: 120, engagedUsers: 12 });
    expect(result.chartData[6]).toEqual({ date: formatDateYYYYMMDD(addDays(baseDate, 0)), reach: 150, engagedUsers: 15 });
  });

  test('Agrega posts semanais e preenche gaps', async () => {
    const posts = [
      mockMetric(addDays(baseDate, -28), 200, 20),
      mockMetric(addDays(baseDate, -14), 300, 30),
      mockMetric(addDays(baseDate, 0), 400, 40),
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: () => Promise.resolve(posts) });

    const result = await getReachInteractionTrendChartData(userId, 'last_30_days', 'weekly');

    const week1 = getYearWeek(addDays(baseDate, -28));
    const week2 = getYearWeek(addDays(baseDate, -21)); // gap
    const week3 = getYearWeek(addDays(baseDate, -14));
    const week4 = getYearWeek(addDays(baseDate, -7));  // gap
    const week5 = getYearWeek(addDays(baseDate, 0));

    expect(result.chartData.find(p => p.date === week1)?.reach).toBe(200);
    expect(result.chartData.find(p => p.date === week2)?.reach).toBeNull();
    expect(result.chartData.find(p => p.date === week3)?.engagedUsers).toBe(30);
    expect(result.chartData.find(p => p.date === week4)?.reach).toBeNull();
    expect(result.chartData.find(p => p.date === week5)?.engagedUsers).toBe(40);
  });

  test('Nenhum post retorna todos nulos', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: () => Promise.resolve([]) });
    const result = await getReachInteractionTrendChartData(userId, 'last_3_days', 'daily');
    expect(result.chartData.length).toBe(3);
    result.chartData.forEach(p => {
      expect(p.reach).toBeNull();
      expect(p.engagedUsers).toBeNull();
    });
  });

  test('Erro no DB', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ sort: jest.fn().mockReturnThis(), lean: () => Promise.reject(new Error('DB Error')) });
    const result = await getReachInteractionTrendChartData(userId, 'last_7_days', 'daily');
    expect(result.chartData.length).toBe(7);
    expect(result.insightSummary).toBe('Erro ao buscar dados de alcance e interações.');
    expect(console.error).toHaveBeenCalled();
  });
});
