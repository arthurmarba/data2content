import { Types } from 'mongoose';
import getRadarChartData, { RadarMetricConfig, NormalizeValueFn } from './getRadarChartData';

// Mock individual indicator functions
import calculateFollowerGrowthRate from '@/utils/calculateFollowerGrowthRate';
import calculateAverageEngagementPerPost from '@/utils/calculateAverageEngagementPerPost';
import calculateWeeklyPostingFrequency from '@/utils/calculateWeeklyPostingFrequency';
import calculateAverageVideoMetrics from '@/utils/calculateAverageVideoMetrics';
import { fetchSegmentRadarStats } from "@/lib/services/segmentRadarService";

// Mock helper para min/max da plataforma
import { getPlatformMinMaxValues, PlatformMinMaxData } from '@/utils/platformMetricsHelpers';

// Mock da função de normalização real que será injetada
import { normalizeValue as actualNormalizeValue } from '@/utils/normalizationHelpers';

jest.mock('@/utils/calculateFollowerGrowthRate');
jest.mock('@/utils/calculateAverageEngagementPerPost');
jest.mock('@/utils/calculateWeeklyPostingFrequency');
jest.mock('@/utils/calculateAverageVideoMetrics');
jest.mock('@/utils/platformMetricsHelpers');

// Usaremos a função de normalização real nos testes agora, ou um mock dela se quisermos isolar ainda mais.
// Para testar a integração com a normalização real, não precisamos mockar `actualNormalizeValue` em si,
// mas sim controlar seus inputs (value, min, max) através dos mocks de `getPlatformMinMaxValues` e dos indicadores.
// Se quiséssemos testar `getRadarChartData` isoladamente da `actualNormalizeValue`, poderíamos mocká-la.
// Por ora, vamos testar com a `actualNormalizeValue` importada, mas controlando seus inputs.

const mockActualNormalizeValue = actualNormalizeValue; // Para referência, não é um jest.fn() a menos que queiramos espiar
const mockFetchSegmentRadarStats = fetchSegmentRadarStats as jest.Mock;

describe('getRadarChartData', () => {
  const userId1 = new Types.ObjectId().toString();
  const userId2 = new Types.ObjectId().toString();
  const segmentId = "gamers_tier1";

  const mockMetricSetConfig: RadarMetricConfig[] = [
    { label: "Seguidores", id: "totalFollowers", calculationLogic: "getFollowersCount_current", params: [{ periodInDays: 0 }] },
    { label: "Cresc. Seguidores %", id: "followerGrowthRatePercent30d", calculationLogic: "getFollowerGrowthRate_percentage", params: [{ periodInDays: 30 }] },
    { label: "Engaj. Médio/Post", id: "avgEngagementPerPost30d", calculationLogic: "getAverageEngagementPerPost_avgPerPost", params: [{ periodInDays: 30 }] },
    { label: "Freq. Semanal", id: "avgWeeklyPostingFrequency30d", calculationLogic: "getWeeklyPostingFrequency_current", params: [{ periodInDays: 30 }] },
    { label: "Retenção Vídeo %", id: "avgVideoRetentionRate90d", calculationLogic: "getAverageVideoMetrics_avgRetention", params: [{ periodInDays: 90 }] },
  ];

  // Mock dos valores min/max da plataforma
  const mockPlatformMinMax: PlatformMinMaxData = {
    "totalFollowers": { min: 1000, max: 100000 }, // Ex: 1k a 100k
    "followerGrowthRatePercent30d": { min: -0.10, max: 0.50 }, // Ex: -10% a 50% (em decimal)
    "avgEngagementPerPost30d": { min: 50, max: 2500 },    // Ex: 50 a 2500
    "avgWeeklyPostingFrequency30d": { min: 0.5, max: 14 },   // Ex: 0.5 a 14 posts/semana
    "avgVideoRetentionRate90d": { min: 10, max: 70 },     // Ex: 10% a 70% (em percentual)
  };

  beforeEach(() => {
    (calculateFollowerGrowthRate as jest.Mock).mockReset();
    (calculateAverageEngagementPerPost as jest.Mock).mockReset();
    (fetchSegmentRadarStats as jest.Mock).mockReset();
    (calculateWeeklyPostingFrequency as jest.Mock).mockReset();
    (calculateAverageVideoMetrics as jest.Mock).mockReset();
    (getPlatformMinMaxValues as jest.Mock).mockReset(); // Resetar mock do min/max

    // Configurar mock padrão para getPlatformMinMaxValues
    (getPlatformMinMaxValues as jest.Mock).mockResolvedValue(mockPlatformMinMax);

    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
    (console.warn as jest.Mock).mockRestore();
    (console.log as jest.Mock).mockRestore();
  });

  test('Compara dois usuários com dados válidos e normalização real', async () => {
    // P1 Raw Values
    const p1_followers = 50000;
    const p1_growth = 0.10; // 10%
    const p1_avgEng = 1500;
    const p1_freq = 3.5;
    const p1_retention = 45.0; // 45%

    // P2 Raw Values
    const p2_followers = 80000;
    const p2_growth = 0.05; // 5%
    const p2_avgEng = 1200;
    const p2_freq = 2.5;
    const p2_retention = 55.0; // 55%

    // Mock das funções de cálculo para userId1
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: p1_followers })
        .mockResolvedValueOnce({ percentageGrowth: p1_growth });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: p1_avgEng });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: p1_freq });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: p1_retention });

    // Mock das funções de cálculo para userId2
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: p2_followers })
        .mockResolvedValueOnce({ percentageGrowth: p2_growth });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: p2_avgEng });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: p2_freq });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: p2_retention });

    // Usar a função de normalização real importada
    const result = await getRadarChartData(userId1, userId2, mockMetricSetConfig, actualNormalizeValue);

    expect(getPlatformMinMaxValues).toHaveBeenCalledWith(mockMetricSetConfig.map(m => m.id));
    expect(fetchSegmentRadarStats).not.toHaveBeenCalled();
    expect(result.labels).toEqual(mockMetricSetConfig.map(m => m.label));
    expect(result.datasets.length).toBe(2);

    expect(result.rawValues?.[0].data).toEqual([p1_followers, p1_growth, p1_avgEng, p1_freq, p1_retention]);
    expect(result.rawValues?.[1].data).toEqual([p2_followers, p2_growth, p2_avgEng, p2_freq, p2_retention]);

    // Verificar valores normalizados com base na `actualNormalizeValue` e `mockPlatformMinMax`
    expect(result.datasets[0].data[0]).toBe(actualNormalizeValue(p1_followers, mockPlatformMinMax.totalFollowers.min, mockPlatformMinMax.totalFollowers.max));
    expect(result.datasets[0].data[1]).toBe(actualNormalizeValue(p1_growth, mockPlatformMinMax.followerGrowthRatePercent30d.min, mockPlatformMinMax.followerGrowthRatePercent30d.max));
    expect(result.datasets[0].data[2]).toBe(actualNormalizeValue(p1_avgEng, mockPlatformMinMax.avgEngagementPerPost30d.min, mockPlatformMinMax.avgEngagementPerPost30d.max));
    expect(result.datasets[0].data[3]).toBe(actualNormalizeValue(p1_freq, mockPlatformMinMax.avgWeeklyPostingFrequency30d.min, mockPlatformMinMax.avgWeeklyPostingFrequency30d.max));
    expect(result.datasets[0].data[4]).toBe(actualNormalizeValue(p1_retention, mockPlatformMinMax.avgVideoRetentionRate90d.min, mockPlatformMinMax.avgVideoRetentionRate90d.max));

    expect(result.datasets[1].data[0]).toBe(actualNormalizeValue(p2_followers, mockPlatformMinMax.totalFollowers.min, mockPlatformMinMax.totalFollowers.max));
    // ... e assim por diante para os outros dados do perfil 2
    expect(result.debugMinMax).toEqual(mockPlatformMinMax);
  });

  test('Compara usuário com média de segmento, usando normalização real', async () => {
    const p1_followers = 60000; // Outros valores P1 como no teste anterior
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: p1_followers })
        .mockResolvedValueOnce({ percentageGrowth: 0.15 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValueOnce({ averageEngagementPerPost: 1800 });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValueOnce({ currentWeeklyFrequency: 4.0 });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValueOnce({ averageRetentionRate: 60.0 });

    // Valores brutos simulados para o segmento retornados pelo serviço
    const seg_followers = 72000;
    const seg_growth = 0.12;
    const seg_avgEng = 1620;
    const seg_freq = 3.6;
    const seg_retention = 54.0;

    mockFetchSegmentRadarStats.mockResolvedValue({
      totalFollowers: seg_followers,
      followerGrowthRate_percentage: seg_growth,
      avgEngagementPerPost30d: seg_avgEng,
      avgWeeklyPostingFrequency30d: seg_freq,
      avgVideoRetentionRate90d: seg_retention,
    });

    const result = await getRadarChartData(userId1, { type: "segment", id: segmentId }, mockMetricSetConfig, actualNormalizeValue);

    expect(getPlatformMinMaxValues).toHaveBeenCalled();
    expect(fetchSegmentRadarStats).toHaveBeenCalledWith(segmentId);
    expect(result.datasets[1].label).toContain(`Média Segmento ${segmentId}`);

    expect(result.rawValues?.[0].data).toEqual([60000, 0.15, 1800, 4.0, 60.0]);
    expect(result.rawValues?.[1].data).toEqual([seg_followers, seg_growth, seg_avgEng, seg_freq, seg_retention]);

    expect(result.datasets[0].data[0]).toBe(actualNormalizeValue(60000, mockPlatformMinMax.totalFollowers.min, mockPlatformMinMax.totalFollowers.max));
    expect(result.datasets[1].data[0]).toBe(actualNormalizeValue(seg_followers, mockPlatformMinMax.totalFollowers.min, mockPlatformMinMax.totalFollowers.max));
  });

  test('Lida com min/max iguais para uma métrica', async () => {
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValue({ currentFollowers: 10000 }); // Ambos os perfis terão 10k

    const specificMinMax = { ...mockPlatformMinMax, "totalFollowers": {min: 10000, max: 10000}};
    (getPlatformMinMaxValues as jest.Mock).mockResolvedValue(specificMinMax);

    const result = await getRadarChartData(userId1, userId2, mockMetricSetConfig, actualNormalizeValue);
    // Conforme normalizeValue: se min===max, retorna 50 se valor !== 0, senão 0.
    expect(result.datasets[0].data[0]).toBe(50);
    expect(result.datasets[1].data[0]).toBe(50);
  });

  test('Lida com valor nulo de indicador e min/max nulos da plataforma', async () => {
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: 30000 }) // P1 OK
        .mockResolvedValueOnce({ percentageGrowth: null }); // P1 Crescimento NULO
    // ... outros P1 OK
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValue({ averageEngagementPerPost: 1000 });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValue({ currentWeeklyFrequency: 3 });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValue({ averageRetentionRate: 50 });

    // P2 OK para todas as métricas
    (calculateFollowerGrowthRate as jest.Mock)
        .mockResolvedValueOnce({ currentFollowers: 40000 })
        .mockResolvedValueOnce({ percentageGrowth: 0.1 });

    // Simular que getPlatformMinMaxValues retorna null para min/max de followerGrowthRatePercent30d
    const minMaxWithNulls = { ...mockPlatformMinMax, "followerGrowthRatePercent30d": {min: null, max: null} as any};
    (getPlatformMinMaxValues as jest.Mock).mockResolvedValue(minMaxWithNulls);

    const result = await getRadarChartData(userId1, userId2, mockMetricSetConfig, actualNormalizeValue);

    expect(result.rawValues?.[0].data[1]).toBeNull(); // P1 Crescimento % bruto é nulo
    // normalizeValue retorna 0 se min ou max for null
    expect(result.datasets[0].data[1]).toBe(0);
    // P2 tem valor, mas min/max são null, então também normaliza para 0
    expect(result.datasets[1].data[1]).toBe(0);
  });


  test('Erro em getPlatformMinMaxValues deve resultar em todos normalizados para 0 ou valor default', async () => {
    (getPlatformMinMaxValues as jest.Mock).mockRejectedValue(new Error("Failed to fetch platform min/max"));

    // Mock das funções de cálculo para P1 e P2 (elas serão chamadas, mas a normalização falhará em obter min/max)
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValue({ currentFollowers: 50000, percentageGrowth: 0.10 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValue({ averageEngagementPerPost: 1500 });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValue({ currentWeeklyFrequency: 3.5 });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValue({ averageRetentionRate: 45.0 });
     // Segunda leva de mocks para o segundo perfil
    (calculateFollowerGrowthRate as jest.Mock).mockResolvedValue({ currentFollowers: 80000, percentageGrowth: 0.05 });
    (calculateAverageEngagementPerPost as jest.Mock).mockResolvedValue({ averageEngagementPerPost: 1200 });
    (calculateWeeklyPostingFrequency as jest.Mock).mockResolvedValue({ currentWeeklyFrequency: 2.5 });
    (calculateAverageVideoMetrics as jest.Mock).mockResolvedValue({ averageRetentionRate: 55.0 });


    const result = await getRadarChartData(userId1, userId2, mockMetricSetConfig, actualNormalizeValue);

    expect(result.insightSummary).toBe("Erro ao buscar dados para o gráfico de radar.");
    // Todos os valores normalizados devem ser null (ou 0 se normalizeValue tratar erro assim)
    // A função getRadarChartData em si pega o erro e preenche com null
    result.datasets.forEach(dataset => {
      dataset.data.forEach(value => expect(value).toBeNull());
    });
    expect(console.error).toHaveBeenCalledWith("Error in getRadarChartData:", expect.any(Error));
  });

});

