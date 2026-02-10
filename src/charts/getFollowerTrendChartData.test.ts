import { Types } from 'mongoose';
import getFollowerTrendChartData from './getFollowerTrendChartData'; // Ajuste
import AccountInsightModel, { IAccountInsight } from '@/app/models/AccountInsight'; // Ajuste
import { addDays, addMonths } from '@/utils/dateHelpers';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/app/models/AccountInsight', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    findOne: jest.fn(),
  },
}));

// Helper para formatar data como YYYY-MM-DD
function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0]!;
}
function formatDateYYYYMM(date: Date): string {
  return date.toISOString().substring(0, 7);
}

// Helper para criar datas para mocks
function createDate(daysAgo: number, baseDate?: Date): Date {
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0); // Consistent time to avoid TZ issues across test runs
  return date;
}

const mockQuery = <T,>(value: T, options?: { reject?: boolean }) => ({
  sort: jest.fn().mockReturnThis(),
  lean: jest.fn().mockImplementation(() => (
    options?.reject ? Promise.reject(value) : Promise.resolve(value)
  )),
});


describe('getFollowerTrendChartData', () => {
  const userId = new Types.ObjectId().toString();
  let baseTestDate: Date; // Data base para os testes, para consistência

  beforeEach(() => {
    (AccountInsightModel.find as jest.Mock).mockReset();
    (AccountInsightModel.findOne as jest.Mock).mockReset();
    // baseTestDate = new Date(2023, 10, 15, 12, 0, 0, 0); // 15 de Novembro de 2023, meio-dia
    baseTestDate = new Date(); // Use current date for more dynamic tests, or fixed for stability
    baseTestDate.setHours(12, 0, 0, 0);


    jest.spyOn(console, 'error').mockImplementation(() => { });
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  const mockInsight = (followersCount: number, date: Date): IAccountInsight => ({
    _id: new Types.ObjectId(),
    user: new Types.ObjectId(userId),
    followersCount: followersCount,
    recordedAt: date,
    accountInsightsPeriod: {} // Mocking other required fields if any
  } as IAccountInsight);


  describe('Daily Granularity', () => {
    test('last_30_days com dados e carry-forward', async () => {
      const period = "last_30_days";
      const numDays = 30;
      // Mock para snapshot *antes* do período de início para carry-forward
      (AccountInsightModel.findOne as jest.Mock).mockReturnValueOnce(
        mockQuery(mockInsight(100, createDate(numDays, baseTestDate))) // Ex: 100 seguidores 30 dias antes do início do gráfico
      );

      const snapshotsInPeriod = [
        mockInsight(105, createDate(numDays - 5, baseTestDate)), // 25 dias atrás
        mockInsight(110, createDate(numDays - 15, baseTestDate)), // 15 dias atrás
        mockInsight(110, createDate(numDays - 15, baseTestDate)), // Outro no mesmo dia, o último deve ser usado
        mockInsight(120, createDate(numDays - 25, baseTestDate)), // 5 dias atrás
      ];
      (AccountInsightModel.find as jest.Mock).mockReturnValue(mockQuery(snapshotsInPeriod));

      const result = await getFollowerTrendChartData(userId, period, "daily");

      expect(result.chartData.length).toBe(numDays); // 30 dias incluindo hoje = 30 pontos
      expect((AccountInsightModel.findOne as jest.Mock)).toHaveBeenCalledTimes(1); // Para o carry-forward inicial
      expect((AccountInsightModel.find as jest.Mock)).toHaveBeenCalledTimes(1);

      // Verificar carry-forward inicial
      expect(result.chartData[0]!.value).toBe(100);
      // O primeiro dia do gráfico deve ser 30 dias antes de baseTestDate
      const expectedChartStartDate = createDate(numDays - 1, baseTestDate);
      expect(result.chartData[0]!.date).toBe(formatDateYYYYMMDD(expectedChartStartDate));


      // Verificar ponto com snapshot
      const dateOfSnapshot1 = createDate(numDays - 5, baseTestDate);
      const point1 = result.chartData.find(p => p.date === formatDateYYYYMMDD(dateOfSnapshot1));
      expect(point1?.value).toBe(105);

      // Verificar carry-forward entre snapshots
      const dateAfterSnapshot1 = createDate(numDays - 6, baseTestDate); // dia seguinte ao snapshot1 (mais antigo)
      const pointAfter1 = result.chartData.find(p => p.date === formatDateYYYYMMDD(dateAfterSnapshot1));
      // Se snapshot1 foi em D-25, e o anterior em D-30 (inicial), D-26, D-27, D-28, D-29 devem ser 100.
      // O ponto em D-25 é 105. O ponto em D-24 deve ser 105.
      const dayBeforeSnapshot1 = result.chartData.find(p => p.date === formatDateYYYYMMDD(addDays(dateOfSnapshot1, -1)));
      if (dayBeforeSnapshot1) expect(dayBeforeSnapshot1.value).toBe(100); // Valor do carry-forward inicial

      const dayAfterSnapshot1 = result.chartData.find(p => p.date === formatDateYYYYMMDD(addDays(dateOfSnapshot1, 1)));
      if (dayAfterSnapshot1) expect(dayAfterSnapshot1.value).toBe(105); // Carry-forward do valor de snapshot1


      // Verificar que o último valor de um dia com múltiplos snapshots é usado (não testável diretamente com map)
      // A lógica de dailyDataMap.set já cuida disso.

      // Verificar último ponto
      const lastChartPoint = result.chartData[result.chartData.length - 1]!;
      expect(lastChartPoint.date).toBe(formatDateYYYYMMDD(baseTestDate)); // "Hoje"
      expect(lastChartPoint.value).toBe(120); // Último valor conhecido

      expect(result.insightSummary).toContain("Ganho de 20 seguidores"); // 120 (último) - 100 (primeiro)
    });

    test('Sem snapshots no período, mas com snapshot anterior para carry-forward', async () => {
      (AccountInsightModel.findOne as jest.Mock).mockReturnValueOnce(mockQuery(mockInsight(90, createDate(30, baseTestDate))));
      (AccountInsightModel.find as jest.Mock).mockReturnValue(mockQuery([])); // Nenhum snapshot no período

      const result = await getFollowerTrendChartData(userId, "last_30_days", "daily");
      expect(result.chartData.length).toBe(30);
      result.chartData.forEach(point => {
        expect(point.value).toBe(90);
      });
      expect(result.insightSummary).toContain("Sem mudança no número de seguidores");
    });

    test('Sem nenhum snapshot (nem anterior, nem no período)', async () => {
      (AccountInsightModel.findOne as jest.Mock).mockReturnValueOnce(mockQuery(null)); // Nenhum snapshot anterior
      (AccountInsightModel.find as jest.Mock).mockReturnValue(mockQuery([]));    // Nenhum snapshot no período

      const result = await getFollowerTrendChartData(userId, "last_30_days", "daily");
      expect(result.chartData.length).toBe(30);
      result.chartData.forEach(point => {
        expect(point.value).toBeNull();
      });
      expect(result.insightSummary).toBe("Não há dados de seguidores suficientes para gerar um resumo.");
    });
  });

  describe('Monthly Granularity', () => {
    test('last_12_months com dados e carry-forward', async () => {
      const period = "last_12_months";
      // Mock para snapshot *antes* do período de início
      (AccountInsightModel.findOne as jest.Mock).mockReturnValueOnce(
        mockQuery(mockInsight(1000, addMonths(createDate(0, baseTestDate), -12)))
      );

      const snapshotsInPeriod = [
        // Mês -11 (relativo ao fim do período)
        mockInsight(1050, addMonths(createDate(0, baseTestDate), -11)),
        // Mês -9, dois snapshots, o último deve ser usado
        mockInsight(1100, addDays(addMonths(createDate(0, baseTestDate), -9), 1)),
        mockInsight(1150, addMonths(createDate(0, baseTestDate), -9)),
        // Mês -5
        mockInsight(1200, addMonths(createDate(0, baseTestDate), -5)),
      ];
      (AccountInsightModel.find as jest.Mock).mockReturnValue(mockQuery(snapshotsInPeriod));

      const result = await getFollowerTrendChartData(userId, period, "monthly");

      expect(result.chartData.length).toBe(13); // 12 meses + mês atual = 13 pontos

      // Verificar carry-forward inicial
      const firstMonthData = result.chartData[0]!;
      // O primeiro mês do gráfico deve ser 12 meses antes do baseTestDate
      const expectedChartStartMonth = addMonths(createDate(0, baseTestDate), -12);
      expectedChartStartMonth.setDate(1); // O loop mensal começa no dia 1

      // A data retornada é YYYY-MM
      expect(firstMonthData.date).toBe(formatDateYYYYMM(expectedChartStartMonth));
      expect(firstMonthData.value).toBe(1000); // Do snapshotBeforeFirstMonth

      // Mês com snapshot (Mês -11)
      const monthMinus11Data = result.chartData.find(p => p.date === formatDateYYYYMM(addMonths(createDate(0, baseTestDate), -11)));
      expect(monthMinus11Data?.value).toBe(1050);

      // Mês com carry-forward (Mês -10)
      const monthMinus10Data = result.chartData.find(p => p.date === formatDateYYYYMM(addMonths(createDate(0, baseTestDate), -10)));
      expect(monthMinus10Data?.value).toBe(1050); // Carry-forward de Mês -11

      // Mês com múltiplos snapshots (Mês -9)
      const monthMinus9Data = result.chartData.find(p => p.date === formatDateYYYYMM(addMonths(createDate(0, baseTestDate), -9)));
      expect(monthMinus9Data?.value).toBe(1150); // Último valor do mês

      // Último ponto do gráfico (mês atual)
      const lastChartPoint = result.chartData[result.chartData.length - 1]!;
      expect(lastChartPoint.date).toBe(formatDateYYYYMM(baseTestDate));
      expect(lastChartPoint.value).toBe(1200); // Último valor conhecido (do Mês -5)

      expect(result.insightSummary).toContain("Ganho de 200 seguidores"); // 1200 (M-5) - 1000 (M-12)
    });

    test('Sem snapshots no período mensal, mas com anterior', async () => {
      (AccountInsightModel.findOne as jest.Mock).mockReturnValueOnce(mockQuery(mockInsight(500, addMonths(createDate(0, baseTestDate), -3))));
      (AccountInsightModel.find as jest.Mock).mockReturnValue(mockQuery([]));
      const result = await getFollowerTrendChartData(userId, "last_3_months", "monthly");
      expect(result.chartData.length).toBe(4); // 3 meses + atual
      result.chartData.forEach(p => expect(p.value).toBe(500));
      expect(result.insightSummary).toContain("Sem mudança");
    });
  });

  test('Erro no DB', async () => {
    (AccountInsightModel.find as jest.Mock).mockReturnValue(mockQuery(new Error("DB Find Error"), { reject: true }));
    // findOne também pode ser chamado para o carry-forward inicial
    (AccountInsightModel.findOne as jest.Mock).mockReturnValueOnce(mockQuery(new Error("DB FindOne Error"), { reject: true }));


    const result = await getFollowerTrendChartData(userId, "last_30_days", "daily");
    expect(result.chartData).toEqual([]);
    expect(result.insightSummary).toBe("Erro ao buscar dados de tendência de seguidores.");
    expect(logger.error).toHaveBeenCalled();
  });

  test('Time period customizado "last_7_days"', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockReturnValueOnce(mockQuery(mockInsight(100, createDate(7, baseTestDate))));
    const snapshotsInPeriod = [mockInsight(105, createDate(3, baseTestDate))];
    (AccountInsightModel.find as jest.Mock).mockReturnValue(mockQuery(snapshotsInPeriod));

    const result = await getFollowerTrendChartData(userId, "last_7_days", "daily");
    expect(result.chartData.length).toBe(7); // 7 dias incluindo hoje
    expect(result.insightSummary).toContain("Ganho de 5 seguidores");
  });
});
