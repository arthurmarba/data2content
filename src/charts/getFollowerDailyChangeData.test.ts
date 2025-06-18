import { Types } from 'mongoose';
import getFollowerDailyChangeData from './getFollowerDailyChangeData';
import AccountInsightModel, { IAccountInsight } from '@/app/models/AccountInsight';

jest.mock('@/app/models/AccountInsight', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
}));

function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}

function createDate(daysAgo: number, baseDate?: Date): Date {
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12,0,0,0);
  return date;
}

describe('getFollowerDailyChangeData', () => {
  const userId = new Types.ObjectId().toString();
  let baseTestDate: Date;

  beforeEach(() => {
    (AccountInsightModel.find as jest.Mock).mockReset();
    (AccountInsightModel.findOne as jest.Mock).mockReset();
    baseTestDate = new Date();
    baseTestDate.setHours(12,0,0,0);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  const mockInsight = (followersCount: number, date: Date): IAccountInsight => ({
    _id: new Types.ObjectId(),
    user: new Types.ObjectId(userId),
    followersCount,
    recordedAt: date,
    accountInsightsPeriod: {}
  } as IAccountInsight);

  test('last_30_days com dados e carry-forward', async () => {
    const period = 'last_30_days';
    const numDays = 30;
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValueOnce(
      mockInsight(100, createDate(numDays, baseTestDate))
    );

    const snapshotsInPeriod = [
      mockInsight(105, createDate(numDays - 5, baseTestDate)),
      mockInsight(110, createDate(numDays - 15, baseTestDate)),
      mockInsight(110, createDate(numDays - 15, baseTestDate)),
      mockInsight(120, createDate(numDays - 25, baseTestDate)),
    ];
    (AccountInsightModel.find as jest.Mock).mockResolvedValue(snapshotsInPeriod);

    const result = await getFollowerDailyChangeData(userId, period);

    expect(result.chartData.length).toBe(numDays + 1);
    const changeMap = new Map(result.chartData.map(p => [p.date, p.change]));

    const dayKeySnapshot1 = formatDateYYYYMMDD(createDate(numDays - 5, baseTestDate));
    expect(changeMap.get(dayKeySnapshot1)).toBe(5); // 105 - 100

    const dayAfterSnapshot1 = formatDateYYYYMMDD(createDate(numDays - 4, baseTestDate));
    expect(changeMap.get(dayAfterSnapshot1)).toBe(0);

    const dayKeySnapshot2 = formatDateYYYYMMDD(createDate(numDays - 15, baseTestDate));
    expect(changeMap.get(dayKeySnapshot2)).toBe(5); // 110 - 105

    const dayKeySnapshot3 = formatDateYYYYMMDD(createDate(numDays - 25, baseTestDate));
    expect(changeMap.get(dayKeySnapshot3)).toBe(10); // 120 - 110

    const lastPoint = result.chartData[result.chartData.length -1];
    expect(lastPoint.change).toBe(0);
    expect(result.insightSummary).toContain('Ganho de 20 seguidores');
  });

  test('Sem snapshots no período, mas com snapshot anterior', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValueOnce(
      mockInsight(90, createDate(30, baseTestDate))
    );
    (AccountInsightModel.find as jest.Mock).mockResolvedValue([]);

    const result = await getFollowerDailyChangeData(userId, 'last_30_days');
    expect(result.chartData.length).toBe(31);
    result.chartData.forEach(p => expect(p.change).toBe(0));
    expect(result.insightSummary).toContain('Sem mudança');
  });

  test('Sem nenhum snapshot', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValueOnce(null);
    (AccountInsightModel.find as jest.Mock).mockResolvedValue([]);

    const result = await getFollowerDailyChangeData(userId, 'last_30_days');
    expect(result.chartData.length).toBe(31);
    result.chartData.forEach(p => expect(p.change).toBeNull());
    expect(result.insightSummary).toBe('Nenhum dado encontrado para o período.');
  });
});
