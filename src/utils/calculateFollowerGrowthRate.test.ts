import mongoose, { Types } from 'mongoose';
import calculateFollowerGrowthRate, { FollowerGrowthData } from './calculateFollowerGrowthRate'; // Ajuste o caminho se necessário
import AccountInsightModel from '@/app/models/AccountInsight'; // Ajuste o caminho se necessário

// Mock do modelo AccountInsight
jest.mock('@/app/models/AccountInsight', () => ({
  findOne: jest.fn(),
}));

describe('calculateFollowerGrowthRate', () => {
  const userId = new Types.ObjectId().toString(); // Usar um ObjectId válido para testes
  const periodInDays = 30;
  let expectedStartDate: Date;
  let expectedEndDate: Date;

  beforeEach(() => {
    // Resetar mocks antes de cada teste
    (AccountInsightModel.findOne as jest.Mock).mockReset();

    const today = new Date();
    expectedEndDate = new Date(today);
    expectedStartDate = new Date(today);
    expectedStartDate.setDate(today.getDate() - periodInDays);
  });

  const mockSnapshot = (followersCount: number | null, daysAgo: number, id?: string): any => {
    if (followersCount === null) return null;
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return {
      _id: new Types.ObjectId(id || undefined),
      user: new Types.ObjectId(userId),
      followersCount: followersCount,
      recordedAt: date,
      // Adicione outros campos obrigatórios do IAccountInsight se houver
    };
  };

  test('TC1.1.1: Crescimento Positivo', async () => {
    (AccountInsightModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(120, 0)) // latest
      .mockResolvedValueOnce(mockSnapshot(100, periodInDays)); // previous

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBe(120);
    expect(result.previousFollowers).toBe(100);
    expect(result.absoluteGrowth).toBe(20);
    expect(result.percentageGrowth).toBeCloseTo(0.20);
    expect(result.startDate?.toISOString().substring(0,10)).toEqual(expectedStartDate.toISOString().substring(0,10));
    expect(result.endDate?.toISOString().substring(0,10)).toEqual(expectedEndDate.toISOString().substring(0,10));
  });

  test('TC1.1.2: Declínio', async () => {
    (AccountInsightModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(100, 0)) // latest
      .mockResolvedValueOnce(mockSnapshot(120, periodInDays)); // previous

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBe(100);
    expect(result.previousFollowers).toBe(120);
    expect(result.absoluteGrowth).toBe(-20);
    expect(result.percentageGrowth).toBeCloseTo(-20 / 120);
  });

  test('TC1.1.3: Sem Mudança', async () => {
    (AccountInsightModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(100, 0)) // latest
      .mockResolvedValueOnce(mockSnapshot(100, periodInDays)); // previous

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBe(100);
    expect(result.previousFollowers).toBe(100);
    expect(result.absoluteGrowth).toBe(0);
    expect(result.percentageGrowth).toBe(0.0);
  });

  test('TC1.1.4: Sem Snapshot Anterior', async () => {
    (AccountInsightModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(50, 0)) // latest
      .mockResolvedValueOnce(null); // no previous

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBe(50);
    expect(result.previousFollowers).toBe(0);
    expect(result.absoluteGrowth).toBe(50);
    expect(result.percentageGrowth).toBe(1.0);
  });

  test('TC1.1.4b: Sem Snapshot Anterior (followersCount nulo no anterior)', async () => {
    (AccountInsightModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(50, 0)) // latest
      .mockResolvedValueOnce(mockSnapshot(null, periodInDays)); // previous with null followers

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBe(50);
    expect(result.previousFollowers).toBe(0);
    expect(result.absoluteGrowth).toBe(50);
    expect(result.percentageGrowth).toBe(1.0);
  });


  test('TC1.1.5: Followers Anterior Zero, Crescimento', async () => {
    (AccountInsightModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(10, 0)) // latest
      .mockResolvedValueOnce(mockSnapshot(0, periodInDays)); // previous

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBe(10);
    expect(result.previousFollowers).toBe(0);
    expect(result.absoluteGrowth).toBe(10);
    expect(result.percentageGrowth).toBe(1.0);
  });

  test('TC1.1.6: Followers Anterior Zero, Sem Crescimento', async () => {
    (AccountInsightModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(0, 0)) // latest
      .mockResolvedValueOnce(mockSnapshot(0, periodInDays)); // previous

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBe(0);
    expect(result.previousFollowers).toBe(0);
    expect(result.absoluteGrowth).toBe(0);
    expect(result.percentageGrowth).toBe(0.0);
  });

  test('TC1.1.7: Sem Snapshot Recente', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValueOnce(null); // No recent snapshot

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBeNull();
    expect(result.previousFollowers).toBeNull();
    expect(result.absoluteGrowth).toBeNull();
    expect(result.percentageGrowth).toBeNull();
    expect(result.startDate?.toISOString().substring(0,10)).toEqual(expectedStartDate.toISOString().substring(0,10));
    expect(result.endDate?.toISOString().substring(0,10)).toEqual(expectedEndDate.toISOString().substring(0,10));
  });

  test('TC1.1.7b: Sem Snapshot Recente (followersCount nulo no recente)', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValueOnce(mockSnapshot(null,0));

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBeNull();
    expect(result.previousFollowers).toBeNull();
    expect(result.absoluteGrowth).toBeNull();
    expect(result.percentageGrowth).toBeNull();
  });

  test('Erro no Banco de Dados', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockRejectedValue(new Error("DB connection failed"));

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await calculateFollowerGrowthRate(userId, periodInDays);
    expect(result.currentFollowers).toBeNull();
    expect(result.previousFollowers).toBeNull();
    expect(result.absoluteGrowth).toBeNull();
    expect(result.percentageGrowth).toBeNull();
    expect(result.startDate?.toISOString().substring(0,10)).toEqual(expectedStartDate.toISOString().substring(0,10));
    expect(result.endDate?.toISOString().substring(0,10)).toEqual(expectedEndDate.toISOString().substring(0,10));
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error calculating follower growth rate"), expect.any(Error));

    // Restore console.error
    consoleErrorSpy.mockRestore();
  });

  test('User ID como string', async () => {
    const userIdString = new Types.ObjectId().toString();
    (AccountInsightModel.findOne as jest.Mock)
      .mockResolvedValueOnce(mockSnapshot(120, 0, userIdString)) // latest
      .mockResolvedValueOnce(mockSnapshot(100, periodInDays, userIdString)); // previous

    const result = await calculateFollowerGrowthRate(userIdString, periodInDays);
    expect(result.currentFollowers).toBe(120);
    // A query do findOne será chamada com um ObjectId, mesmo que a função receba string.
    // O mock do `mockSnapshot` acima não simula isso perfeitamente, mas o teste é para a conversão do userId.
    expect((AccountInsightModel.findOne as jest.Mock).mock.calls[0][0].user instanceof Types.ObjectId).toBe(true);
    expect((AccountInsightModel.findOne as jest.Mock).mock.calls[1][0].user instanceof Types.ObjectId).toBe(true);
  });

});
```
