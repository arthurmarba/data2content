import { Types } from 'mongoose';
import calculateMovingAverageEngagement, { MovingAverageDataPoint } from './calculateMovingAverageEngagement'; // Ajuste
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot'; // Ajuste
import MetricModel from '@/app/models/Metric';

jest.mock('@/app/models/DailyMetricSnapshot', () => ({
  find: jest.fn(),
}));
jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

// Helper para formatar data como YYYY-MM-DD
function formatDateYYYYMMDD(date: Date): string {
  return date.toISOString().split('T')[0];
}
// Helper para criar datas para mocks
function createDate(daysAgo: number, baseDate?: Date): Date {
  const date = baseDate ? new Date(baseDate) : new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12,0,0,0); // Set to midday to avoid timezone issues with day boundaries
  return date;
}

const mockMetricIds = (ids: string[] = [new Types.ObjectId().toString()]) => {
  (MetricModel.find as jest.Mock).mockReturnValue({
    distinct: jest.fn().mockResolvedValue(ids.map(id => new Types.ObjectId(id)))
  });
};


describe('calculateMovingAverageEngagement', () => {
  const userId = new Types.ObjectId().toString();
  let baseTestEndDate: Date; // Data base para os testes, para consistência

  beforeEach(() => {
    (DailyMetricSnapshotModel.find as jest.Mock).mockReset();
    (MetricModel.find as jest.Mock).mockReset();
    mockMetricIds();
    baseTestEndDate = new Date(2023, 10, 15); // Ex: 15 de Novembro de 2023
  });

  const mockSnapshot = (date: Date, dailyLikes: number, dailyComments: number, dailyShares: number): Partial<IDailyMetricSnapshot> => ({
    user: new Types.ObjectId(userId),
    date: date,
    dailyLikes: dailyLikes,
    dailyComments: dailyComments,
    dailyShares: dailyShares,
  });

  test('Cálculo com dados suficientes para média móvel completa na janela de dados', async () => {
    const dataWindowInDays = 7;
    const movingAverageWindowInDays = 3;

    // Precisamos de dados para dataWindowInDays + movingAverageWindowInDays - 1 = 7 + 3 - 1 = 9 dias
    // Datas: Nov 7 a Nov 15 (baseTestEndDate é Nov 15)
    // dataFullStartDate = Nov 15 - 7 - 3 + 1 + 1 = Nov 7
    // dataStartDate = Nov 15 - 7 + 1 = Nov 9
    const snapshots: Partial<IDailyMetricSnapshot>[] = [
      // Buffer para média móvel inicial
      mockSnapshot(createDate(8, baseTestEndDate), 10, 1, 1), // Nov 7 - Eng: 12
      mockSnapshot(createDate(7, baseTestEndDate), 12, 2, 2), // Nov 8 - Eng: 16
      // Início da dataWindowInDays (Nov 9)
      mockSnapshot(createDate(6, baseTestEndDate), 15, 2, 3), // Nov 9 - Eng: 20
      mockSnapshot(createDate(5, baseTestEndDate), 18, 3, 3), // Nov 10 - Eng: 24
      mockSnapshot(createDate(4, baseTestEndDate), 20, 4, 4), // Nov 11 - Eng: 28
      mockSnapshot(createDate(3, baseTestEndDate), 22, 4, 5), // Nov 12 - Eng: 31
      mockSnapshot(createDate(2, baseTestEndDate), 25, 5, 5), // Nov 13 - Eng: 35
      mockSnapshot(createDate(1, baseTestEndDate), 28, 6, 6), // Nov 14 - Eng: 40
      mockSnapshot(createDate(0, baseTestEndDate), 30, 7, 7), // Nov 15 - Eng: 44
    ];
    (DailyMetricSnapshotModel.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: () => Promise.resolve(snapshots)
    });

    const result = await calculateMovingAverageEngagement(userId, dataWindowInDays, movingAverageWindowInDays);

    expect(result.series.length).toBe(dataWindowInDays);

    // Dia 1 (Nov 9): Média de (12+16+20)/3 = 48/3 = 16
    expect(result.series[0].date).toBe(formatDateYYYYMMDD(createDate(6, baseTestEndDate)));
    expect(result.series[0].movingAverageEngagement).toBeCloseTo(16);

    // Dia 2 (Nov 10): Média de (16+20+24)/3 = 60/3 = 20
    expect(result.series[1].date).toBe(formatDateYYYYMMDD(createDate(5, baseTestEndDate)));
    expect(result.series[1].movingAverageEngagement).toBeCloseTo(20);

    // Dia 7 (Nov 15): Média de (35+40+44)/3 = 119/3 = 39.666...
    expect(result.series[6].date).toBe(formatDateYYYYMMDD(createDate(0, baseTestEndDate)));
    expect(result.series[6].movingAverageEngagement).toBeCloseTo(119 / 3);
  });

  test('Dados insuficientes para qualquer janela de média móvel completa', async () => {
    const dataWindowInDays = 5;
    const movingAverageWindowInDays = 3;
    // Apenas 2 dias de dados, menos que movingAverageWindowInDays
    const snapshots = [
      mockSnapshot(createDate(1, baseTestEndDate), 10,0,0),
      mockSnapshot(createDate(0, baseTestEndDate), 12,0,0),
    ];
    (DailyMetricSnapshotModel.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: () => Promise.resolve(snapshots)
    });

    const result = await calculateMovingAverageEngagement(userId, dataWindowInDays, movingAverageWindowInDays);
    expect(result.series.length).toBe(dataWindowInDays);
    result.series.forEach(point => {
      expect(point.movingAverageEngagement).toBeNull();
    });
  });

  test('Dados suficientes para algumas janelas, mas não para o início da dataWindow', async () => {
    const dataWindowInDays = 7; // Nov 9 - Nov 15
    const movingAverageWindowInDays = 3;
    // dataFullStartDate = Nov 9 - 3 + 1 = Nov 7
    // Apenas 3 dias de dados, começando em Nov 7. A primeira média será para Nov 9.
    const snapshots = [
      mockSnapshot(createDate(8, baseTestEndDate), 10,0,0), // Nov 7 - Eng: 10
      mockSnapshot(createDate(7, baseTestEndDate), 12,0,0), // Nov 8 - Eng: 12
      mockSnapshot(createDate(6, baseTestEndDate), 15,0,0), // Nov 9 - Eng: 15
      // Sem mais dados
    ];
     (DailyMetricSnapshotModel.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: () => Promise.resolve(snapshots)
    });
    const result = await calculateMovingAverageEngagement(userId, dataWindowInDays, movingAverageWindowInDays);

    expect(result.series.length).toBe(dataWindowInDays);
    // Nov 9: Média de (10+12+15)/3 = 37/3
    expect(result.series[0].date).toBe(formatDateYYYYMMDD(createDate(6, baseTestEndDate))); // Nov 9
    expect(result.series[0].movingAverageEngagement).toBeCloseTo(37/3);

    // Nov 10 em diante não tem dados suficientes para calcular a média (a janela deslizante não tem mais pontos)
    // A lógica da função preenche com null se o ponto de dados não foi calculado
    expect(result.series[1].date).toBe(formatDateYYYYMMDD(createDate(5, baseTestEndDate))); // Nov 10
    expect(result.series[1].movingAverageEngagement).toBeNull();
    // ... e assim por diante para os dias restantes na dataWindowInDays
     for (let i = 1; i < dataWindowInDays; i++) {
        expect(result.series[i].movingAverageEngagement).toBeNull();
    }
  });

  test('Dias com zero engajamento dentro da janela', async () => {
    const dataWindowInDays = 3; // Nov 13, 14, 15
    const movingAverageWindowInDays = 3;
    // dataFullStartDate = Nov 13 - 3 + 1 = Nov 11
    const snapshots = [
      mockSnapshot(createDate(4, baseTestEndDate), 10,0,0), // Nov 11 - Eng: 10
      mockSnapshot(createDate(3, baseTestEndDate), 0,0,0),  // Nov 12 - Eng: 0 (dia com zero engajamento)
      mockSnapshot(createDate(2, baseTestEndDate), 20,0,0), // Nov 13 - Eng: 20
      mockSnapshot(createDate(1, baseTestEndDate), 5,0,0),  // Nov 14 - Eng: 5
      mockSnapshot(createDate(0, baseTestEndDate), 10,0,0), // Nov 15 - Eng: 10
    ];
    (DailyMetricSnapshotModel.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: () => Promise.resolve(snapshots)
    });
    const result = await calculateMovingAverageEngagement(userId, dataWindowInDays, movingAverageWindowInDays);

    expect(result.series.length).toBe(dataWindowInDays);
    // Nov 13: Média de (10+0+20)/3 = 30/3 = 10
    expect(result.series[0].date).toBe(formatDateYYYYMMDD(createDate(2, baseTestEndDate)));
    expect(result.series[0].movingAverageEngagement).toBeCloseTo(10);
    // Nov 14: Média de (0+20+5)/3 = 25/3
    expect(result.series[1].date).toBe(formatDateYYYYMMDD(createDate(1, baseTestEndDate)));
    expect(result.series[1].movingAverageEngagement).toBeCloseTo(25/3);
    // Nov 15: Média de (20+5+10)/3 = 35/3
    expect(result.series[2].date).toBe(formatDateYYYYMMDD(createDate(0, baseTestEndDate)));
    expect(result.series[2].movingAverageEngagement).toBeCloseTo(35/3);
  });

  test('Erro no Banco de Dados', async () => {
    (DailyMetricSnapshotModel.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: () => Promise.reject(new Error("DB query failed"))
    });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const dataWindowInDays = 5;

    const result = await calculateMovingAverageEngagement(userId, dataWindowInDays, 3);
    expect(result.series.length).toBe(dataWindowInDays);
    result.series.forEach(point => {
      expect(point.movingAverageEngagement).toBeNull();
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error calculating moving average engagement"), expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  test('Janela de dados menor que a janela da média móvel', async () => {
    const dataWindowInDays = 2;
    const movingAverageWindowInDays = 3;
    // dataFullStartDate = Nov 15 - 2 - 3 + 1 + 1 = Nov 12
    const snapshots = [ // Dados suficientes para o buffer, mas a dataWindow é curta
      mockSnapshot(createDate(3, baseTestEndDate), 10,0,0), // Nov 12
      mockSnapshot(createDate(2, baseTestEndDate), 12,0,0), // Nov 13
      mockSnapshot(createDate(1, baseTestEndDate), 15,0,0), // Nov 14
      mockSnapshot(createDate(0, baseTestEndDate), 18,0,0), // Nov 15
    ];
    (DailyMetricSnapshotModel.find as jest.Mock).mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      lean: () => Promise.resolve(snapshots)
    });

    const result = await calculateMovingAverageEngagement(userId, dataWindowInDays, movingAverageWindowInDays);
    // dataWindowInDays é Nov 14 e Nov 15
    expect(result.series.length).toBe(2);

    // Nov 14: Média de (10+12+15)/3 = 37/3
    expect(result.series[0].date).toBe(formatDateYYYYMMDD(createDate(1, baseTestEndDate)));
    expect(result.series[0].movingAverageEngagement).toBeCloseTo(37/3);
    // Nov 15: Média de (12+15+18)/3 = 45/3 = 15
    expect(result.series[1].date).toBe(formatDateYYYYMMDD(createDate(0, baseTestEndDate)));
    expect(result.series[1].movingAverageEngagement).toBeCloseTo(15);
  });

});
