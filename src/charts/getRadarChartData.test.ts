import { Types } from 'mongoose';
import getRadarChartData, { RadarMetricConfig, NormalizeValueFn } from './getRadarChartData'; // Ajuste, importar NormalizeValueFn

// Mock individual indicator functions
import calculateFollowerGrowthRate from '@/utils/calculateFollowerGrowthRate';
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost';
import calculateWeeklyPostingFrequency from '@/utils/calculateWeeklyPostingFrequency';
import calculateAverageVideoMetrics from '@/utils/calculateAverageVideoMetrics';

jest.mock('@/utils/calculateFollowerGrowthRate');
jest.mock('@/utils/calculateAverageEngagementPerPost');
jest.mock('@/utils/calculateWeeklyPostingFrequency');
jest.mock('@/utils/calculateAverageVideoMetrics');

// Mock da função de normalização que será injetada nos testes
const mockNormalizeValueForTest: NormalizeValueFn = jest.fn(async (metricId, rawValue, profileIdentifier) => {
  if (rawValue === null || rawValue === undefined) return 0;
  // Simples normalização para teste: rawValue / 1000 para followers, rawValue * 100 para rates, etc.
  // Isso é para ter valores previsíveis nos testes.
  switch (metricId) {
    case "totalFollowers": return rawValue / 1000; // 50000 -> 50
    case "followerGrowthRate_percentage": return (rawValue * 100) * 2; // 0.10 (10%) -> 20
    case "avgEngagementPerPost_avgPerPost": return rawValue / 10; // 1500 -> 150 (clipado para 100)
    case "weeklyPostingFrequency_current": return rawValue * 10; // 3.5 -> 35
    case "avgVideoRetention_avgRetention": return rawValue; // Já é 0-100, ex: 45.0 -> 45
    default: return rawValue;
  }
});


describe('getRadarChartData', () => {
  const userId1 = new Types.ObjectId().toString();
  const userId2 = new Types.ObjectId().toString();
  const segmentId = "gamers_tier1";

  const mockMetricSetConfig: RadarMetricConfig[] = [
    { label: "Seguidores", id: "totalFollowers", calculationLogic: "getFollowersCount_current", params: [{ periodInDays: 0 }] },
    { label: "Cresc. Seguidores %", id: "followerGrowthRate_percentage", calculationLogic: "getFollowerGrowthRate_percentage", params: [{ periodInDays: 30 }] },
    { label: "Engaj. Médio/Post", id: "avgEngagementPerPost_avgPerPost", calculationLogic: "getAverageEngagementPerPost_avgPerPost", params: [{ periodInDays: 30 }] },
    { label: "Freq. Semanal", id: "weeklyPostingFrequency_current", calculationLogic: "getWeeklyPostingFrequency_current", params: [{ periodInDays: 30 }] },
    { label: "Retenção Vídeo %", id: "avgVideoRetention_avgRetention", calculationLogic: "getAverageVideoMetrics_avgRetention", params: [{ periodInDays: 90 }] },
  ];

  beforeEach(() => {
    (calculateFollowerGrowthRate as jest.Mock).mockReset();
    (calculateAverageEngagementPerPost as jest.Mock).mockReset();
    (calculateWeeklyPostingFrequency as jest.Mock).mockReset();
    (calculateAverageVideoMetrics as jest.Mock).mockReset();
    mockNormalizeValueForTest.mockClear();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    (console.warn as jest.Mock).mockRestore();
    (console.log as jest.Mock).mockRestore();
  });

  test('Compara dois usuários com dados válidos', async () => {
    // Mock das funções de cálculo para userId1
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: 50000 }) // P1 - Seguidores
        .mockResolvedValueOnce({ percentageGrowth: 0.10 }); // P1 - Cresc. %
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 1500 }); // P1 Engaj/Post
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: 3.5 }); // P1 Freq.
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: 45.0 }); // P1 Retenção

    // Mock das funções de cálculo para userId2
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: 80000 }) // P2 - Seguidores
        .mockResolvedValueOnce({ percentageGrowth: 0.05 }); // P2 - Cresc. %
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 1200 }); // P2 Engaj/Post
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: 2.5 }); // P2 Freq.
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: 55.0 }); // P2 Retenção

    const result = await getRadarChartData(userId1, userId2, mockMetricSetConfig, mockNormalizeValueForTest);

    expect(result.labels).toEqual(mockMetricSetConfig.map(m => m.label));
    expect(result.datasets.length).toBe(2);
    expect(result.datasets[0].label).toContain(userId1.substring(0,5));
    expect(result.datasets[1].label).toContain(userId2.substring(0,5));

    expect(result.rawValues?.[0].data).toEqual([50000, 0.10, 1500, 3.5, 45.0]);
    expect(result.rawValues?.[1].data).toEqual([80000, 0.05, 1200, 2.5, 55.0]);

    // Verificar valores normalizados com base no mockNormalizeValueForTest
    // totalFollowers: val / 1000
    // followerGrowthRate_percentage: (val * 100) * 2
    // avgEngagementPerPost_avgPerPost: val / 10 (max 100)
    // weeklyPostingFrequency_current: val * 10
    // avgVideoRetention_avgRetention: val
    expect(result.datasets[0].data).toEqual([
        50000 / 1000,       // 50
        (0.10 * 100) * 2,   // 20
        Math.min(100, 1500 / 10), // 100 (clipado de 150)
        3.5 * 10,           // 35
        45.0                // 45
    ]);
    expect(result.datasets[1].data).toEqual([
        80000 / 1000,       // 80
        (0.05 * 100) * 2,   // 10
        Math.min(100, 1200 / 10), // 100 (clipado de 120)
        2.5 * 10,           // 25
        55.0                // 55
    ]);
    expect(mockNormalizeValueForTest).toHaveBeenCalledTimes(mockMetricSetConfig.length * 2);
    expect(result.insightSummary).toBeDefined();
  });

  test('Compara usuário com média de segmento (simulado e normalizado)', async () => {
    // Mock para userId1
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: 60000 })
        .mockResolvedValueOnce({ percentageGrowth: 0.15 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 1800 });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: 4.0 });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: 60.0 });

    // Valores simulados para o segmento (brutos, antes da normalização)
    // Estes serão gerados pela lógica de simulação interna em getRadarChartData
    // totalFollowers: 60000 * 1.2 = 72000
    // followerGrowthRate_percentage: 0.15 * 0.8 = 0.12
    // avgEngagementPerPost_avgPerPost: 1800 * 0.9 = 1620
    // weeklyPostingFrequency_current: 4.0 * 0.9 = 3.6
    // avgVideoRetention_avgRetention: 60.0 * 0.9 = 54.0

    const result = await getRadarChartData(userId1, { type: "segment", id: segmentId }, mockMetricSetConfig, mockNormalizeValueForTest);

    expect(result.datasets[1].label).toEqual(`Média Segmento ${segmentId}`);
    expect(result.rawValues?.[0].data).toEqual([60000, 0.15, 1800, 4.0, 60.0]);
    expect(result.rawValues?.[1].data).toEqual([
        72000,       // 60000 * 1.2
        0.12,        // 0.15 * 0.8
        1620,        // 1800 * 0.9
        3.6,         // 4.0 * 0.9
        54.0         // 60.0 * 0.9
    ]);

    expect(result.datasets[0].data).toEqual([ 60, 30, 100, 40, 60.0 ]); // P1 normalizado
    expect(result.datasets[1].data).toEqual([ 72, 24, 100, 36, 54.0 ]); // Segmento normalizado
  });

  test('Lida com dados ausentes (null) de uma função de cálculo para um perfil', async () => {
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: 50000 })
        .mockResolvedValueOnce({ percentageGrowth: null }); // P1 Crescimento NULO
    // ... mocks para outras métricas P1 (assumindo que retornam valores válidos)
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 1500 });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: 3.5 });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: 45.0 });


    // P2 com todos os dados válidos
     (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: 80000 })
        .mockResolvedValueOnce({ percentageGrowth: 0.05 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 1200 });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: 2.5 });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: 55.0 });

    const result = await getRadarChartData(userId1, userId2, mockMetricSetConfig, mockNormalizeValueForTest);

    expect(result.rawValues?.[0].data[1]).toBeNull(); // P1 Crescimento % bruto é nulo
    expect(result.datasets[0].data[1]).toBe(0); // P1 Crescimento % normalizado para 0 (conforme mockNormalizeValueForTest)
    expect(result.datasets[1].data[1]).not.toBe(0); // P2 deve ter valor normalizado válido
  });

  test('Erro em uma das funções de cálculo de indicador deve resultar em null/0 para essa métrica', async () => {
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: 50000 }) // P1 Seguidores OK
        .mockRejectedValueOnce(new Error("Growth calc failed P1")); // P1 Crescimento FALHA
    // ... outros P1 OK
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 1500 });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: 3.5 });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: 45.0 });

    // P2 todos OK
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: 80000 })
        .mockResolvedValueOnce({ percentageGrowth: 0.05 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 1200 });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: 2.5 });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: 55.0 });


    const result = await getRadarChartData(userId1, userId2, mockMetricSetConfig, mockNormalizeValueForTest);

    expect(result.rawValues?.[0].data[1]).toBeNull(); // P1 Crescimento % bruto é nulo devido ao erro
    expect(result.datasets[0].data[1]).toBe(0);      // P1 Crescimento % normalizado é 0
    expect(result.datasets[1].data[1]).not.toBe(0);  // P2 está OK
    expect(console.warn).toHaveBeenCalledWith("Lógica de cálculo desconhecida: getFollowerGrowthRate_percentage", expect.any(Error)); // O erro é pego e logado
  });

   test('Identificador do Perfil 2 inválido lança erro', async () => {
    // Teste já estava no arquivo da função, mas bom ter aqui também.
    // A função getRadarChartData agora lança o erro diretamente.
    await expect(
        getRadarChartData(userId1, {} as any, mockMetricSetConfig, mockNormalizeValueForTest)
    ).rejects.toThrow("Identificador do Perfil 2 inválido.");
  });

});
```
