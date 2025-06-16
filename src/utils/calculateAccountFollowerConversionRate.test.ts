import { Types } from 'mongoose';
import calculateAccountFollowerConversionRate, { AccountFollowerConversionRateData } from './calculateAccountFollowerConversionRate'; // Ajuste
import AccountInsightModel, { IAccountInsight, IAccountInsightsPeriod } from '@/app/models/AccountInsight'; // Ajuste
import * as FollowerGrowthRateModule from './calculateFollowerGrowthRate'; // Para mockar a função de fallback

jest.mock('@/app/models/AccountInsight', () => ({
  findOne: jest.fn(),
}));

// Mock a função de fallback
jest.mock('./calculateFollowerGrowthRate', () => ({
  __esModule: true, // Necessário para default export mock
  default: jest.fn(),
}));


describe('calculateAccountFollowerConversionRate', () => {
  const userId = new Types.ObjectId().toString();
  const periodInDays = 30; // Período de referência para fallback
  let expectedStartDate: Date;
  let expectedEndDate: Date;

  beforeEach(() => {
    (AccountInsightModel.findOne as jest.Mock).mockReset();
    (FollowerGrowthRateModule.default as jest.Mock).mockReset();

    const today = new Date();
    expectedEndDate = new Date(today);
    expectedStartDate = new Date(today);
    expectedStartDate.setDate(today.getDate() - periodInDays);
  });

  const mockInsightPeriod = (accounts_engaged: number | null, follower_gains: number | null, period_name = "days_28"): Partial<IAccountInsightsPeriod> => {
    const data: Partial<IAccountInsightsPeriod> = { period: period_name };
    if (accounts_engaged !== null) data.accounts_engaged = accounts_engaged;
    if (follower_gains !== null) {
      data.follows_and_unfollows = { follower_gains: follower_gains, total_follows: follower_gains, total_unfollows: 0 }; // Simulação
    }
    return data;
  };

  const mockAccountInsight = (insightPeriodData: Partial<IAccountInsightsPeriod> | Partial<IAccountInsightsPeriod>[] | null): any => {
    if (insightPeriodData === null) return null;
    return {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(userId),
      recordedAt: new Date(),
      accountInsightsPeriod: insightPeriodData,
      // Outros campos do IAccountInsight
    };
  };

  test('Cálculo com dados diretos de AccountInsight (days_28)', async () => {
    const insightData = mockInsightPeriod(1000, 50, "days_28");
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValue(mockAccountInsight(insightData));

    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);

    expect(result.accountsEngagedInPeriod).toBe(1000);
    expect(result.followersGainedInPeriod).toBe(50);
    expect(result.accountFollowerConversionRate).toBeCloseTo((50 / 1000) * 100); // 5%
    expect(result.periodName).toBe("days_28");
    expect(result.dataSourceMessage).toContain("Using follower_gains from AccountInsight period: days_28");
    expect(FollowerGrowthRateModule.default).not.toHaveBeenCalled();
  });

  test('Cálculo com dados diretos de AccountInsight (primeiro de um array)', async () => {
    const insightDataArray = [mockInsightPeriod(800, 40, "week"), mockInsightPeriod(100,10,"day")];
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValue(mockAccountInsight(insightDataArray));

    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);
    // A lógica prioriza 'days_28', se não encontrar, pega o primeiro do array.
    // Como 'days_28' não está, deve pegar o 'week'.
    expect(result.accountsEngagedInPeriod).toBe(800);
    expect(result.followersGainedInPeriod).toBe(40);
    expect(result.accountFollowerConversionRate).toBeCloseTo((40 / 800) * 100); // 5%
    expect(result.periodName).toBe("week");
  });


  test('Fallback para calculateFollowerGrowthRate se follower_gains não estiver no AccountInsight', async () => {
    const insightData = mockInsightPeriod(1000, null); // follower_gains é null
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValue(mockAccountInsight(insightData));
    (FollowerGrowthRateModule.default as jest.Mock).mockResolvedValue({
      absoluteGrowth: 30, // Mock do fallback
      currentFollowers: 0, previousFollowers: 0, percentageGrowth: 0 // Outros campos não são usados diretamente
    });

    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);

    expect(result.accountsEngagedInPeriod).toBe(1000);
    expect(result.followersGainedInPeriod).toBe(30); // Veio do fallback
    expect(result.accountFollowerConversionRate).toBeCloseTo((30 / 1000) * 100); // 3%
    expect(FollowerGrowthRateModule.default).toHaveBeenCalledWith(expect.any(Types.ObjectId), periodInDays);
    expect(result.dataSourceMessage).toContain("follower_gains was missing, using difference");
  });

  test('Fallback para calculateFollowerGrowthRate se accountInsightsPeriod estiver totalmente ausente', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValue(mockAccountInsight(null)); // accountInsightsPeriod é null
    (FollowerGrowthRateModule.default as jest.Mock).mockResolvedValue({
      absoluteGrowth: 25,
      currentFollowers: 0, previousFollowers: 0, percentageGrowth: 0
    });

    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);
    expect(result.accountsEngagedInPeriod).toBeNull(); // Não havia dados de engajamento
    expect(result.followersGainedInPeriod).toBe(25);   // Veio do fallback
    expect(result.accountFollowerConversionRate).toBe(0); // Porque accountsEngaged é null/0
    expect(FollowerGrowthRateModule.default).toHaveBeenCalled();
    expect(result.dataSourceMessage).toContain("Using follower growth (difference)");
  });


  test('Sem AccountInsight e sem dados do fallback', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValue(null); // Nenhum AccountInsight
    (FollowerGrowthRateModule.default as jest.Mock).mockResolvedValue({
      absoluteGrowth: null, // Fallback não retorna dados
       currentFollowers: null, previousFollowers: null, percentageGrowth: null
    });

    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);
    expect(result.accountsEngagedInPeriod).toBeNull();
    expect(result.followersGainedInPeriod).toBeNull();
    expect(result.accountFollowerConversionRate).toBe(0.0);
    expect(result.dataSourceMessage).toBe("Follower gains could not be determined.");
  });

  test('accountsEngagedInPeriod é 0, followersGainedInPeriod > 0', async () => {
    const insightData = mockInsightPeriod(0, 10); // 0 engajados, 10 ganhos
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValue(mockAccountInsight(insightData));

    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);
    expect(result.accountsEngagedInPeriod).toBe(0);
    expect(result.followersGainedInPeriod).toBe(10);
    expect(result.accountFollowerConversionRate).toBe(100.0); // Caso especial
  });

  test('accountsEngagedInPeriod > 0, followersGainedInPeriod é 0', async () => {
    const insightData = mockInsightPeriod(1000, 0);
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValue(mockAccountInsight(insightData));

    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);
    expect(result.accountFollowerConversionRate).toBe(0.0);
  });

  test('accountsEngagedInPeriod é null, followersGainedInPeriod > 0 (via fallback)', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValue(mockAccountInsight(mockInsightPeriod(null, null)));
    (FollowerGrowthRateModule.default as jest.Mock).mockResolvedValue({ absoluteGrowth: 10 });

    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);
    expect(result.accountsEngagedInPeriod).toBeNull();
    expect(result.followersGainedInPeriod).toBe(10);
    expect(result.accountFollowerConversionRate).toBe(0.0); // accountsEngagedInPeriod é null, então a taxa é 0
  });


  test('Erro no Banco de Dados ao buscar AccountInsight', async () => {
    (AccountInsightModel.findOne as jest.Mock).mockRejectedValue(new Error("DB AccountInsight failed"));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);
    expect(result.accountFollowerConversionRate).toBe(0.0);
    expect(result.accountsEngagedInPeriod).toBeNull();
    expect(result.followersGainedInPeriod).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error calculating account follower conversion rate"), expect.any(Error));
    expect(FollowerGrowthRateModule.default).not.toHaveBeenCalled(); // Não deve tentar fallback se o erro foi no AccountInsight

    consoleErrorSpy.mockRestore();
  });

  test('Erro no Banco de Dados durante o fallback de FollowerGrowthRate', async () => {
    // AccountInsight não tem follower_gains, forçando fallback
    const insightData = mockInsightPeriod(1000, null);
    (AccountInsightModel.findOne as jest.Mock).mockResolvedValue(mockAccountInsight(insightData));
    // Fallback falha
    (FollowerGrowthRateModule.default as jest.Mock).mockRejectedValue(new Error("DB GrowthRate failed"));
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});


    const result = await calculateAccountFollowerConversionRate(userId, periodInDays);
    // O erro no fallback não é propagado, mas logado pela função calculateFollowerGrowthRate.
    // calculateAccountFollowerConversionRate receberá null de absoluteGrowth.
    expect(result.accountsEngagedInPeriod).toBe(1000);
    expect(result.followersGainedInPeriod).toBeNull(); // Porque o fallback falhou e retornou null para absoluteGrowth
    expect(result.accountFollowerConversionRate).toBe(0.0);
    // A mensagem de erro de calculateFollowerGrowthRate seria logada por ela mesma.
    // A mensagem de erro de calculateAccountFollowerConversionRate não deve ser chamada aqui.
    // Mas a função calculateFollowerGrowthRate em si logaria o erro.
    // Para verificar isso, precisaríamos espiar o console.error *dentro* da chamada mockada, o que é mais complexo.
    // O importante é que a função principal (calculateAccountFollowerConversionRate) lida com o null retornado.
    expect(result.dataSourceMessage).toContain("Follower gains could not be determined.");

    consoleErrorSpy.mockRestore(); // Se calculateAccountFollowerConversionRate logasse seu próprio erro aqui.
  });

});
```
