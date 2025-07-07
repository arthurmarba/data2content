import { Types } from 'mongoose';
import getReachEngagementTrendChartData from './getReachEngagementTrendChartData'; // Ajuste
import AccountInsightModel, { IAccountInsight, IAccountInsightsPeriod, PeriodEnum } from '@/app/models/AccountInsight'; // Ajuste

jest.mock('@/app/models/AccountInsight', () => ({
  find: jest.fn(),
  // findOne is not used by this function directly, but AccountInsightModel is imported
}));

// Helper para formatar data como YYYY-MM-DD
function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}
// Helper para criar datas para mocks
function createDate(daysAgo: number, baseDate?: Date): Date {
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12,0,0,0);
  return date;
}
// Função para obter o identificador da semana YYYY-WW (copiada da implementação para testes)
function getYearWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-' + String(weekNo).padStart(2, '0');
}
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}


describe('getReachEngagementTrendChartData', () => {
  const userId = new Types.ObjectId().toString();
  let baseTestDate: Date;

  beforeEach(() => {
    (AccountInsightModel.find as jest.Mock).mockReset();
    baseTestDate = new Date(2023, 10, 15, 12, 0, 0, 0); // 15 de Novembro de 2023
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  const mockInsightPeriodData = (period: PeriodEnum, reach: number | null, engaged: number | null): IAccountInsightsPeriod => ({
    period: period,
    reach: reach,
    accounts_engaged: engaged,
    // outros campos...
  } as IAccountInsightsPeriod);

  const mockAccountInsightSnapshot = (recordedAtDate: Date, periodData: IAccountInsightsPeriod | IAccountInsightsPeriod[]): IAccountInsight => ({
    _id: new Types.ObjectId(),
    user: new Types.ObjectId(userId),
    recordedAt: recordedAtDate,
    accountInsightsPeriod: periodData,
    // outros campos...
  } as IAccountInsight);

  describe('Daily Granularity', () => {
    test('Dados diários válidos com alguns gaps', async () => {
      const period = "last_7_days"; // Nov 9 a Nov 15
      const snapshots = [
        mockAccountInsightSnapshot(createDate(6, baseTestDate), mockInsightPeriodData(PeriodEnum.DAY, 100, 10)), // Nov 9
        mockAccountInsightSnapshot(createDate(4, baseTestDate), mockInsightPeriodData(PeriodEnum.DAY, 120, 12)), // Nov 11
        // Nov 10, 12, 13, 14 são gaps
        mockAccountInsightSnapshot(createDate(0, baseTestDate), mockInsightPeriodData(PeriodEnum.DAY, 150, 15)), // Nov 15
      ];
      (AccountInsightModel.find as jest.Mock).mockResolvedValue(snapshots);

      const result = await getReachEngagementTrendChartData(userId, period, "daily");

      expect(result.chartData.length).toBe(7); // 7 dias
      expect(result.chartData[0]).toEqual({ date: formatDateYYYYMMDD(createDate(6, baseTestDate)), reach: 100, totalInteractions: 10 }); // Nov 9
      expect(result.chartData[1]).toEqual({ date: formatDateYYYYMMDD(createDate(5, baseTestDate)), reach: null, totalInteractions: null });// Nov 10 (gap)
      expect(result.chartData[2]).toEqual({ date: formatDateYYYYMMDD(createDate(4, baseTestDate)), reach: 120, totalInteractions: 12 });// Nov 11
      expect(result.chartData[3]).toEqual({ date: formatDateYYYYMMDD(createDate(3, baseTestDate)), reach: null, totalInteractions: null });// Nov 12 (gap)
      expect(result.chartData[6]).toEqual({ date: formatDateYYYYMMDD(createDate(0, baseTestDate)), reach: 150, totalInteractions: 15 });// Nov 15
      expect(result.insightSummary).toContain("Média de alcance");
    });

    test('Nenhum snapshot no período resulta em todos nulos', async () => {
      (AccountInsightModel.find as jest.Mock).mockResolvedValue([]);
      const result = await getReachEngagementTrendChartData(userId, "last_3_days", "daily");
      expect(result.chartData.length).toBe(3);
      result.chartData.forEach(dp => {
        expect(dp.reach).toBeNull();
        expect(dp.totalInteractions).toBeNull();
      });
      expect(result.insightSummary).toBe("Nenhum dado de alcance ou engajamento encontrado para o período.");
    });

    test('Snapshot com accountInsightsPeriod como array, pega o "day"', async () => {
        const period = "last_3_days"; // Nov 13, 14, 15
        const dailyData = mockInsightPeriodData(PeriodEnum.DAY, 100, 10);
        const weeklyData = mockInsightPeriodData(PeriodEnum.WEEK, 700, 70);
        const snapshots = [
            mockAccountInsightSnapshot(createDate(0, baseTestDate), [dailyData, weeklyData]), // Nov 15
        ];
        (AccountInsightModel.find as jest.Mock).mockResolvedValue(snapshots);
        const result = await getReachEngagementTrendChartData(userId, period, "daily");
        expect(result.chartData.length).toBe(3);
        expect(result.chartData[2]).toEqual({ date: formatDateYYYYMMDD(createDate(0, baseTestDate)), reach: 100, totalInteractions: 10 });
        expect(result.chartData[0].reach).toBeNull(); // Gaps para Nov 13, 14
        expect(result.chartData[1].reach).toBeNull();
    });
  });

  describe('Weekly Granularity', () => {
    test('Dados semanais válidos com alguns gaps', async () => {
      const period = "last_30_days"; // Aproximadamente 4-5 semanas
      // Semanas para baseTestDate (Nov 15, 2023):
      // Nov 15 é 2023-46
      // Nov 8  é 2023-45
      // Nov 1  é 2023-44
      // Out 25 é 2023-43
      // Out 18 é 2023-42 (start date para 30 dias antes de Nov 15 seria ~Out 16)

      const snapshots = [
        mockAccountInsightSnapshot(createDate(28, baseTestDate), mockInsightPeriodData(PeriodEnum.WEEK, 700, 70)), // ~Out 18 (Semana 2023-42)
        mockAccountInsightSnapshot(createDate(14, baseTestDate), mockInsightPeriodData(PeriodEnum.WEEK, 800, 80)), // ~Nov 1  (Semana 2023-44)
        // Semana 2023-43 e 2023-45 são gaps
        mockAccountInsightSnapshot(createDate(0, baseTestDate), mockInsightPeriodData(PeriodEnum.WEEK, 900, 90)),   // ~Nov 15 (Semana 2023-46)
      ];
      (AccountInsightModel.find as jest.Mock).mockResolvedValue(snapshots);

      const result = await getReachEngagementTrendChartData(userId, period, "weekly");

      // O número de semanas pode variar um pouco. A lógica preenche todas as semanas do período.
      // startDate para "last_30_days" a partir de Nov 15 é ~Out 16.
      // A primeira semana no gráfico será a que contém Out 16 (2023-42).
      // A última semana no gráfico será a que contém Nov 15 (2023-46).
      // Então, 2023-42, 2023-43, 2023-44, 2023-45, 2023-46. Total 5 semanas.
      expect(result.chartData.length).toBe(5);

      const weekForOct18 = getYearWeek(createDate(28, baseTestDate)); // 2023-42
      const weekForNov1 = getYearWeek(createDate(14, baseTestDate));  // 2023-44
      const weekForNov15 = getYearWeek(createDate(0, baseTestDate));  // 2023-46
      const weekForOct25 = getYearWeek(createDate(21, baseTestDate)); // 2023-43 (gap)

      expect(result.chartData.find(p=>p.date === weekForOct18)).toEqual({ date: weekForOct18, reach: 700, totalInteractions: 70 });
      expect(result.chartData.find(p=>p.date === weekForOct25)).toEqual({ date: weekForOct25, reach: null, totalInteractions: null });
      expect(result.chartData.find(p=>p.date === weekForNov1)).toEqual({ date: weekForNov1, reach: 800, totalInteractions: 80 });
      expect(result.chartData.find(p=>p.date === getYearWeek(createDate(7, baseTestDate)))).toEqual({ date: getYearWeek(createDate(7, baseTestDate)), reach: null, totalInteractions: null }); // 2023-45 (gap)
      expect(result.chartData.find(p=>p.date === weekForNov15)).toEqual({ date: weekForNov15, reach: 900, totalInteractions: 90 });
    });
     test('Sobrescreve com o último snapshot se múltiplos para a mesma semana/dia', async () => {
        const snapshots = [
            mockAccountInsightSnapshot(createDate(6, baseTestDate), mockInsightPeriodData(PeriodEnum.DAY, 100, 10)), // Nov 9
            mockAccountInsightSnapshot(addDays(createDate(6, baseTestDate),0.5), mockInsightPeriodData(PeriodEnum.DAY, 105, 11)), // Nov 9, mais tarde
        ];
        (AccountInsightModel.find as jest.Mock).mockResolvedValue(snapshots);
        const result = await getReachEngagementTrendChartData(userId, "last_7_days", "daily");
        const pointForNov9 = result.chartData.find(p=>p.date === formatDateYYYYMMDD(createDate(6, baseTestDate)));
        expect(pointForNov9?.reach).toBe(105); // Valor do último snapshot para o dia
        expect(pointForNov9?.totalInteractions).toBe(11);
    });
  });

  test('Erro no DB', async () => {
    (AccountInsightModel.find as jest.Mock).mockRejectedValue(new Error("DB Find Error"));
    const result = await getReachEngagementTrendChartData(userId, "last_7_days", "daily");
    expect(result.chartData.length).toBe(7); // Deve preencher com nulos
    result.chartData.forEach(dp => {
        expect(dp.reach).toBeNull();
        expect(dp.totalInteractions).toBeNull();
    });
    expect(result.insightSummary).toBe("Erro ao buscar dados de alcance e engajamento.");
    expect(console.error).toHaveBeenCalled();
  });
});

