import { Types } from 'mongoose';
import calculateCumulativeEngagementPercentage from './calculateCumulativeEngagementPercentage'; // Ajuste
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot'; // Ajuste

jest.mock('@/app/models/DailyMetricSnapshot', () => ({
  findOne: jest.fn(),
}));

describe('calculateCumulativeEngagementPercentage', () => {
  const metricId = new Types.ObjectId().toString();
  const cumulativeMetricName: keyof IDailyMetricSnapshot = 'cumulativeViews'; // Exemplo de métrica

  beforeEach(() => {
    (DailyMetricSnapshotModel.findOne as jest.Mock).mockReset();
    // Mock console.warn para evitar poluir a saída do teste, mas podemos espiá-lo se necessário
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restaurar mocks
    (console.warn as jest.Mock).mockRestore();
  });


  const mockSnapshot = (dayNumber: number, value: number | null | string): Partial<IDailyMetricSnapshot> | null => {
    if (value === undefined) return null; // Simula snapshot não encontrado
    const data: Partial<IDailyMetricSnapshot> = {
      metric: new Types.ObjectId(metricId),
      dayNumber: dayNumber,
    };
    if (value !== null) { // Permite testar valor nulo vs. campo ausente
      data[cumulativeMetricName] = value as any; // 'as any' para permitir string para teste de tipo inválido
    }
    return data;
  };

  test('TC1.5.1: Caso Normal com finalDayNumber numérico', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(2, 500))    // Target day snapshot
      .mockResolvedValueOnce(mockSnapshot(30, 1000)); // Final day snapshot

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtTargetDay).toBe(500);
    expect(result.cumulativeValueAtFinalDay).toBe(1000);
    expect(result.percentageAccumulated).toBeCloseTo(50.0);
    expect(result.finalDayNumberUsed).toBe(30);
    expect(result.metricName).toBe(cumulativeMetricName);
  });

  test('Caso Normal com finalDayNumber="latest"', async () => {
    // findOne para targetDay
    (DailyMetricSnapshotModel.findOne as jest.Mock).mockImplementation((query) => {
      if (query.dayNumber === 2) return Promise.resolve(mockSnapshot(2, 600));
      if (!query.dayNumber && query['metric']) { // Query para 'latest' (sem dayNumber, ordenado)
        return Promise.resolve(mockSnapshot(28, 1200)); // Simula que o dia 28 é o mais recente
      }
      return Promise.resolve(null);
    });

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, "latest");
    expect(result.cumulativeValueAtTargetDay).toBe(600);
    expect(result.cumulativeValueAtFinalDay).toBe(1200);
    expect(result.percentageAccumulated).toBeCloseTo(50.0);
    expect(result.finalDayNumberUsed).toBe(28); // Corretamente pega o dayNumber do snapshot "latest"
  });

  test('finalDayNumber="latest" não encontra snapshots', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(2, 600)) // Target day snapshot
      .mockResolvedValueOnce(null); // No snapshot for "latest"

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, "latest");
    expect(result.cumulativeValueAtTargetDay).toBe(600);
    expect(result.cumulativeValueAtFinalDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect(result.finalDayNumberUsed).toBeNull(); // Nenhum snapshot "latest" encontrado
  });


  test('TC1.5.2: Final Day Zero, Target Day Zero', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(2, 0))
      .mockResolvedValueOnce(mockSnapshot(30, 0));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.percentageAccumulated).toBe(0.0);
  });

  test('TC1.5.3: Final Day Zero, Target Day Positivo', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(2, 50))
      .mockResolvedValueOnce(mockSnapshot(30, 0));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.percentageAccumulated).toBeNull(); // Indefinido/Infinito
  });

  test('TC1.5.4: Target Day Snapshot Ausente (retorna null do DB)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockResolvedValueOnce(null) // Target day snapshot não encontrado
      .mockResolvedValueOnce(mockSnapshot(30, 1000));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtTargetDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
  });

  test('Target Day Snapshot métrica inválida (não numérica)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(2, "not-a-number")) // Métrica inválida
      .mockResolvedValueOnce(mockSnapshot(30, 1000));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtTargetDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });


  test('TC1.5.5: Final Day Snapshot Ausente (retorna null do DB)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(2, 500))
      .mockResolvedValueOnce(null); // Final day snapshot não encontrado

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtFinalDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect(result.finalDayNumberUsed).toBe(30); // Mantém o input numérico
  });

  test('Final Day Snapshot métrica inválida (não numérica)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(2, 500))
      .mockResolvedValueOnce(mockSnapshot(30, "not-a-number")); // Métrica inválida

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtFinalDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });


  test('TC1.5.6: Target > Final (e final > 0)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(2, 1200))
      .mockResolvedValueOnce(mockSnapshot(30, 1000));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.percentageAccumulated).toBeCloseTo(120.0);
  });

  test('Erro no Banco de Dados', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock).mockRejectedValue(new Error("DB query failed"));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtTargetDay).toBeNull();
    expect(result.cumulativeValueAtFinalDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error calculating cumulative engagement percentage"), expect.any(Error));

    consoleErrorSpy.mockRestore();
  });
});
