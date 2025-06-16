import { Types } from 'mongoose';
import calculateWeeklyPostingFrequency from './calculateWeeklyPostingFrequency'; // Ajuste o caminho
import MetricModel from '@/app/models/Metric'; // Ajuste o caminho

jest.mock('@/app/models/Metric', () => ({
  countDocuments: jest.fn(),
}));

describe('calculateWeeklyPostingFrequency', () => {
  const userId = new Types.ObjectId().toString();
  const periodInDays = 30;

  // Helper para mockear countDocuments
  const mockCountDocuments = (count: number) => {
    (MetricModel.countDocuments as jest.Mock).mockResolvedValueOnce(count);
  };

  beforeEach(() => {
    (MetricModel.countDocuments as jest.Mock).mockReset();
  });

  test('TC1.4.1: Posts no Período Atual e Anterior', async () => {
    mockCountDocuments(10); // postsInCurrentPeriod
    mockCountDocuments(5);  // postsInPreviousPeriod

    const result = await calculateWeeklyPostingFrequency(userId, periodInDays);

    expect(result.postsInCurrentPeriod).toBe(10);
    expect(result.currentWeeklyFrequency).toBeCloseTo((10 / 30) * 7);
    expect(result.postsInPreviousPeriod).toBe(5);
    expect(result.previousWeeklyFrequency).toBeCloseTo((5 / 30) * 7);
    expect(result.deltaInWeeklyFrequency).toBeCloseTo(((10 / 30) * 7) - ((5 / 30) * 7));

    // Verificar se as datas dos períodos estão definidas (não nulas)
    expect(result.currentPeriodStartDate).toBeDefined();
    expect(result.currentPeriodEndDate).toBeDefined();
    expect(result.previousPeriodStartDate).toBeDefined();
    expect(result.previousPeriodEndDate).toBeDefined();

    // Verificar a lógica das datas (simplificado)
    const today = new Date();
    const expectedCurrentStartDate = new Date();
    expectedCurrentStartDate.setDate(today.getDate() - periodInDays);

    expect(result.currentPeriodEndDate?.toISOString().substring(0,10)).toEqual(today.toISOString().substring(0,10));
    expect(result.currentPeriodStartDate?.toISOString().substring(0,10)).toEqual(expectedCurrentStartDate.toISOString().substring(0,10));

    const expectedPreviousEndDate = new Date(expectedCurrentStartDate);
    expectedPreviousEndDate.setDate(expectedPreviousEndDate.getDate() - 1);
    const expectedPreviousStartDate = new Date(expectedPreviousEndDate);
    expectedPreviousStartDate.setDate(expectedPreviousEndDate.getDate() - (periodInDays - 1));

    expect(result.previousPeriodEndDate?.toISOString().substring(0,10)).toEqual(expectedPreviousEndDate.toISOString().substring(0,10));
    expect(result.previousPeriodStartDate?.toISOString().substring(0,10)).toEqual(expectedPreviousStartDate.toISOString().substring(0,10));
  });

  test('TC1.4.2: Sem Posts no Período Atual', async () => {
    mockCountDocuments(0);  // current
    mockCountDocuments(5);  // previous

    const result = await calculateWeeklyPostingFrequency(userId, periodInDays);
    expect(result.postsInCurrentPeriod).toBe(0);
    expect(result.currentWeeklyFrequency).toBe(0);
    expect(result.postsInPreviousPeriod).toBe(5);
    expect(result.previousWeeklyFrequency).toBeCloseTo((5 / 30) * 7);
  });

  test('TC1.4.3: Sem Posts em Nenhum Período', async () => {
    mockCountDocuments(0); // current
    mockCountDocuments(0); // previous

    const result = await calculateWeeklyPostingFrequency(userId, periodInDays);
    expect(result.currentWeeklyFrequency).toBe(0);
    expect(result.previousWeeklyFrequency).toBe(0);
    expect(result.deltaInWeeklyFrequency).toBe(0);
  });

  test('TC1.4.4: periodInDays = 0 (ou inválido)', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await calculateWeeklyPostingFrequency(userId, 0);
    expect(result.currentWeeklyFrequency).toBe(0);
    expect(result.postsInCurrentPeriod).toBe(0);
    // ... todos os outros campos numéricos devem ser 0
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("periodInDays must be greater than 0"));
    consoleWarnSpy.mockRestore();
  });

  test('periodInDays = 1 (caso de borda para cálculo de data anterior)', async () => {
    mockCountDocuments(1); // current
    mockCountDocuments(1); // previous
    const result = await calculateWeeklyPostingFrequency(userId, 1);

    expect(result.postsInCurrentPeriod).toBe(1);
    expect(result.currentWeeklyFrequency).toBeCloseTo((1/1)*7);
    expect(result.postsInPreviousPeriod).toBe(1);
    expect(result.previousWeeklyFrequency).toBeCloseTo((1/1)*7);

    const today = new Date();
    const expectedCurrentStartDate = new Date(); // hoje - 1 dia
    expectedCurrentStartDate.setDate(today.getDate() - 1);

    expect(result.currentPeriodEndDate?.toISOString().substring(0,10)).toEqual(today.toISOString().substring(0,10));
    expect(result.currentPeriodStartDate?.toISOString().substring(0,10)).toEqual(expectedCurrentStartDate.toISOString().substring(0,10));

    // previousPeriodEndDate = currentPeriodStartDate - 1 dia
    const expectedPreviousEndDate = new Date(expectedCurrentStartDate);
    expectedPreviousEndDate.setDate(expectedPreviousEndDate.getDate() - 1);
    // previousPeriodStartDate = previousPeriodEndDate - (1-1) dias = previousPeriodEndDate
    const expectedPreviousStartDate = new Date(expectedPreviousEndDate);
     expectedPreviousStartDate.setDate(expectedPreviousEndDate.getDate() - (1-1));


    expect(result.previousPeriodEndDate?.toISOString().substring(0,10)).toEqual(expectedPreviousEndDate.toISOString().substring(0,10));
    expect(result.previousPeriodStartDate?.toISOString().substring(0,10)).toEqual(expectedPreviousStartDate.toISOString().substring(0,10));
  });


  test('Erro no Banco de Dados', async () => {
    (MetricModel.countDocuments as jest.Mock).mockRejectedValue(new Error("DB query failed"));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await calculateWeeklyPostingFrequency(userId, periodInDays);
    expect(result.currentWeeklyFrequency).toBe(0);
    // ... outros campos numéricos também devem ser 0
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error calculating weekly posting frequency"), expect.any(Error));

    consoleErrorSpy.mockRestore();
  });
});
```
