import { Types } from 'mongoose';
import getEngagementDistributionByFormatChartData from './getEngagementDistributionByFormatChartData'; // Ajuste
import MetricModel, { IMetric, FormatType, IMetricStats } from '@/app/models/Metric'; // Ajuste
import { getNestedValue } from '@/utils/dataAccessHelpers'; // Ajuste

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

// Mock getNestedValue apenas para garantir que o teste não dependa da sua implementação interna aqui
jest.mock('@/utils/dataAccessHelpers', () => ({
  getNestedValue: jest.fn((obj, path) => {
    // Simples mock, a função real é mais robusta
    const parts = path.split('.');
    let value = obj;
    for (const part of parts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }
    return typeof value === 'number' ? value : null;
  }),
}));


describe('getEngagementDistributionByFormatChartData', () => {
  const userId = new Types.ObjectId().toString();
  const engagementMetricField = "stats.total_interactions";
  let baseTestDate: Date;

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
    (getNestedValue as jest.Mock).mockClear(); // Limpar mocks de getNestedValue também
    baseTestDate = new Date();
    baseTestDate.setHours(12,0,0,0);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  const mockMetricPost = (format: FormatType, interactions: number | null, postDate?: Date): Partial<IMetric> => {
    const stats: Partial<IMetricStats> = {};
    if (interactions !== null) {
      stats.total_interactions = interactions; // Assumindo que este é o metricField para os mocks
    }
    return {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(userId),
      format: format,
      postDate: postDate || new Date(baseTestDate),
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  };

  test('Agregação correta por formato e cálculo de percentuais', async () => {
    const posts = [
      mockMetricPost(FormatType.REEL, 100),
      mockMetricPost(FormatType.REEL, 50),  // REEL: 150
      mockMetricPost(FormatType.IMAGE, 100), // IMAGE: 100
      mockMetricPost(FormatType.CAROUSEL_ALBUM, 250), // CAROUSEL: 250
    ];
    // Mock getNestedValue para retornar o valor de total_interactions
    (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions || 0);
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

    // Grand total = 150 + 100 + 250 = 500
    const result = await getEngagementDistributionByFormatChartData(userId, "last_30_days", engagementMetricField);

    expect(result.chartData.length).toBe(3);
    result.chartData.sort((a,b) => a.name.localeCompare(b.name)); // Ordenar para consistência do teste

    const reelData = result.chartData.find(d => d.name === "Reel");
    expect(reelData?.value).toBe(150);
    expect(reelData?.percentage).toBeCloseTo((150/500)*100);

    const imageData = result.chartData.find(d => d.name === "Image");
    expect(imageData?.value).toBe(100);
    expect(imageData?.percentage).toBeCloseTo((100/500)*100);

    const carouselData = result.chartData.find(d => d.name === "Carousel Album");
    expect(carouselData?.value).toBe(250);
    expect(carouselData?.percentage).toBeCloseTo((250/500)*100);

    expect(result.insightSummary).toContain("Carousel Album é o formato com maior engajamento");
  });

  test('Lida com "all_time" e formata nomes padrão', async () => {
    const posts = [mockMetricPost(FormatType.VIDEO, 200)];
    (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions || 0);
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

    const result = await getEngagementDistributionByFormatChartData(userId, "all_time", engagementMetricField);
    expect(result.chartData.length).toBe(1);
    expect(result.chartData[0].name).toBe("Video"); // Testando formatação padrão
    expect(result.chartData[0].value).toBe(200);
    expect(result.chartData[0].percentage).toBe(100);
    expect(result.insightSummary).toContain("Video representa todo o engajamento");

    // Verificar se a query não tem postDate para "all_time"
    expect((MetricModel.find as jest.Mock).mock.calls[0][0].postDate).toBeUndefined();
  });

  test('Usa formatMapping quando fornecido', async () => {
    const posts = [mockMetricPost(FormatType.REEL, 100)];
    (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions || 0);
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const formatMapping = { [FormatType.REEL]: "Vídeos Curtos (Reel)" };

    const result = await getEngagementDistributionByFormatChartData(userId, "last_30_days", engagementMetricField, formatMapping);
    expect(result.chartData[0].name).toBe("Vídeos Curtos (Reel)");
  });

  test('Agrupa slices pequenos em "Outros"', async () => {
    const posts = [
      mockMetricPost(FormatType.REEL, 100),
      mockMetricPost(FormatType.IMAGE, 80),
      mockMetricPost(FormatType.VIDEO, 60),
      mockMetricPost(FormatType.CAROUSEL_ALBUM, 40),
      mockMetricPost(FormatType.TEXT, 20), // FormatType.TEXT não existe, mas para teste de string
      mockMetricPost("AUDIO_TRACK" as FormatType, 10), // Testar string como formatKey
      mockMetricPost("LIVE_STREAM" as FormatType, 5),
      mockMetricPost("MIXED_MEDIA" as FormatType, 2),
    ];
    // Total = 100+80+60+40+20+10+5+2 = 317
    (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions || 0);
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

    const maxSlices = 5; // Mostrar top 4 + "Outros"
    const result = await getEngagementDistributionByFormatChartData(userId, "last_90_days", engagementMetricField, undefined, maxSlices);

    expect(result.chartData.length).toBe(maxSlices);
    const otrosSlice = result.chartData.find(s => s.name === "Outros");
    expect(otrosSlice).toBeDefined();
    // Outros = TEXT (20) + AUDIO_TRACK (10) + LIVE_STREAM (5) + MIXED_MEDIA (2) = 37
    expect(otrosSlice?.value).toBe(37);
    expect(otrosSlice?.percentage).toBeCloseTo((37/317)*100);
    // Top slice (Reel) deve estar presente
    expect(result.chartData.find(s => s.name === "Reel")?.value).toBe(100);
    expect(result.insightSummary).toContain("Reel é o formato com maior engajamento");
  });

  test('Nenhum post no período retorna array vazio e sumário default', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve([]) });
    const result = await getEngagementDistributionByFormatChartData(userId, "last_30_days", engagementMetricField);
    expect(result.chartData).toEqual([]);
    expect(result.insightSummary).toBe("Nenhum dado de engajamento encontrado para o período.");
  });

  test('Posts sem engajamento relevante retornam array vazio', async () => {
    const posts = [
      mockMetricPost(FormatType.REEL, 0),
      mockMetricPost(FormatType.IMAGE, null), // getNestedValue mock retornará 0
    ];
    (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions || 0);
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await getEngagementDistributionByFormatChartData(userId, "last_30_days", engagementMetricField);
    expect(result.chartData).toEqual([]);
    expect(result.insightSummary).toBe("Nenhum dado de engajamento encontrado para o período.");
  });

  test('Erro no DB retorna array vazio e sumário de erro', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.reject(new Error("DB Error")) });
    const result = await getEngagementDistributionByFormatChartData(userId, "last_30_days", engagementMetricField);
    expect(result.chartData).toEqual([]);
    expect(result.insightSummary).toBe("Erro ao buscar dados de distribuição de engajamento.");
    expect(console.error).toHaveBeenCalled();
  });
});
```
