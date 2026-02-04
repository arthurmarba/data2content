import { Types } from 'mongoose';
import calculateCumulativeEngagementPercentage from './calculateCumulativeEngagementPercentage'; // Ajuste
import DailyMetricSnapshotModel, { IDailyMetricSnapshot } from '@/app/models/DailyMetricSnapshot'; // Ajuste
import { connectToDatabase } from '@/app/lib/mongoose';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/models/DailyMetricSnapshot', () => ({
  findOne: jest.fn(),
}));
jest.mock('@/app/lib/mongoose', () => ({
  connectToDatabase: jest.fn(),
}));
jest.mock('@/app/lib/logger', () => ({
  logger: { warn: jest.fn(), error: jest.fn() },
}));

describe('calculateCumulativeEngagementPercentage', () => {
  const metricId = new Types.ObjectId().toString();
  const cumulativeMetricName: keyof IDailyMetricSnapshot = 'cumulativeViews'; // Exemplo de métrica

  beforeEach(() => {
    (DailyMetricSnapshotModel.findOne as jest.Mock).mockReset();
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
    (logger as any).warn.mockClear();
  });

  afterEach(() => {
    // no-op
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
  const buildQuery = (value: Partial<IDailyMetricSnapshot> | null) => ({
    lean: () => Promise.resolve(value),
    sort: jest.fn().mockReturnValue({ lean: () => Promise.resolve(value) }),
  });
  const buildRejectingQuery = (error: Error) => ({
    lean: () => Promise.reject(error),
    sort: jest.fn().mockReturnValue({ lean: () => Promise.reject(error) }),
  });

  test('TC1.5.1: Caso Normal com finalDayNumber numérico', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(mockSnapshot(2, 500)))    // Target day snapshot
      .mockImplementationOnce(() => buildQuery(mockSnapshot(30, 1000))); // Final day snapshot

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtTargetDay).toBe(500);
    expect(result.cumulativeValueAtFinalDay).toBe(1000);
    expect(result.percentageAccumulated).toBeCloseTo(50.0);
    expect(result.finalDayNumberUsed).toBe(30);
    expect(result.metricName).toBe(cumulativeMetricName);
  });

  test('Caso Normal com finalDayNumber="latest"', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(mockSnapshot(2, 600)))
      .mockImplementationOnce(() => buildQuery(mockSnapshot(28, 1200))); // latest

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, "latest");
    expect(result.cumulativeValueAtTargetDay).toBe(600);
    expect(result.cumulativeValueAtFinalDay).toBe(1200);
    expect(result.percentageAccumulated).toBeCloseTo(50.0);
    expect(result.finalDayNumberUsed).toBe(28); // Corretamente pega o dayNumber do snapshot "latest"
  });

  test('finalDayNumber="latest" não encontra snapshots', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(mockSnapshot(2, 600))) // Target day snapshot
      .mockImplementationOnce(() => buildQuery(null)); // No snapshot for "latest"

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, "latest");
    expect(result.cumulativeValueAtTargetDay).toBe(600);
    expect(result.cumulativeValueAtFinalDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect(result.finalDayNumberUsed).toBeNull(); // Nenhum snapshot "latest" encontrado
  });


  test('TC1.5.2: Final Day Zero, Target Day Zero', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(mockSnapshot(2, 0)))
      .mockImplementationOnce(() => buildQuery(mockSnapshot(30, 0)));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.percentageAccumulated).toBe(0.0);
  });

  test('TC1.5.3: Final Day Zero, Target Day Positivo', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(mockSnapshot(2, 50)))
      .mockImplementationOnce(() => buildQuery(mockSnapshot(30, 0)));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.percentageAccumulated).toBeNull(); // Indefinido/Infinito
  });

  test('TC1.5.4: Target Day Snapshot Ausente (retorna null do DB)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(null)) // Target day snapshot não encontrado
      .mockImplementationOnce(() => buildQuery(mockSnapshot(30, 1000)));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtTargetDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
  });

  test('Target Day Snapshot métrica inválida (não numérica)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(mockSnapshot(2, "not-a-number"))) // Métrica inválida
      .mockImplementationOnce(() => buildQuery(mockSnapshot(30, 1000)));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtTargetDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect((logger as any).warn).toHaveBeenCalled();
  });


  test('TC1.5.5: Final Day Snapshot Ausente (retorna null do DB)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(mockSnapshot(2, 500)))
      .mockImplementationOnce(() => buildQuery(null)); // Final day snapshot não encontrado

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtFinalDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect(result.finalDayNumberUsed).toBe(30); // Mantém o input numérico
  });

  test('Final Day Snapshot métrica inválida (não numérica)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(mockSnapshot(2, 500)))
      .mockImplementationOnce(() => buildQuery(mockSnapshot(30, "not-a-number"))); // Métrica inválida

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtFinalDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect((logger as any).warn).toHaveBeenCalled();
  });


  test('TC1.5.6: Target > Final (e final > 0)', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock)
      .mockImplementationOnce(() => buildQuery(mockSnapshot(2, 1200)))
      .mockImplementationOnce(() => buildQuery(mockSnapshot(30, 1000)));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.percentageAccumulated).toBeCloseTo(120.0);
  });

  test('Erro no Banco de Dados', async () => {
    (DailyMetricSnapshotModel.findOne as jest.Mock).mockImplementation(() => buildRejectingQuery(new Error("DB query failed")));

    const result = await calculateCumulativeEngagementPercentage(metricId, cumulativeMetricName, 2, 30);
    expect(result.cumulativeValueAtTargetDay).toBeNull();
    expect(result.cumulativeValueAtFinalDay).toBeNull();
    expect(result.percentageAccumulated).toBeNull();
    expect((logger as any).error).toHaveBeenCalledWith(
      expect.stringContaining("Error calculating cumulative engagement percentage"),
      expect.any(Error)
    );
  });
});
