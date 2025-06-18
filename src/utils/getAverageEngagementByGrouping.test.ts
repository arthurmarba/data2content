import { Types } from 'mongoose';
import getAverageEngagementByGrouping, { GroupingType } from './getAverageEngagementByGrouping'; // Ajuste
import MetricModel, { IMetric, FormatType, IMetricStats } from '@/app/models/Metric'; // Ajuste
import { getNestedValue } from "./dataAccessHelpers"; // Importar para mock ou referência
import { getStartDateFromTimePeriod } from "./dateHelpers"; // Para referência de datas

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

// Mock do getNestedValue, pois ele é usado internamente
jest.mock('./dataAccessHelpers', () => ({
  getNestedValue: jest.fn(),
}));

describe('getAverageEngagementByGrouping', () => {
  const userId = new Types.ObjectId().toString();
  const timePeriod = "last_30_days";
  const performanceMetricField = "stats.total_interactions";

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
    (getNestedValue as jest.Mock).mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  const mockMetric = (
    id: string,
    format: FormatType | string,
    context: string | null,
    interactions: number | null,
    postDate?: Date,
    proposal?: string | null
  ): Partial<IMetric> => {
    const stats: Partial<IMetricStats> = {};
    if (interactions !== null) {
      stats.total_interactions = interactions; // Assumindo que este é o metricField
    }
    return {
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(userId),
      postDate: postDate || new Date(),
      format: format as FormatType, // Cast para o tipo esperado
      context: context,
      proposal: proposal ?? undefined,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  };

  describe('groupBy="format"', () => {
    const groupBy: GroupingType = "format";
    test('Agrega e calcula médias corretamente por formato', async () => {
      const posts = [
        mockMetric('p1', FormatType.REEL, "c1", 100),
        mockMetric('p2', FormatType.REEL, "c1", 50),  // REEL: sum=150, count=2, avg=75
        mockMetric('p3', FormatType.IMAGE, "c2", 200), // IMAGE: sum=200, count=1, avg=200
        mockMetric('p4', FormatType.VIDEO, "c1", null), // VIDEO: interactions null, não deve contar
        mockMetric('p5', FormatType.IMAGE, "c2", 100), // IMAGE: sum=200+100=300, count=2, avg=150
      ];
      (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
      (getNestedValue as jest.Mock).mockImplementation((obj, path) => {
        return obj.stats?.total_interactions !== undefined ? obj.stats.total_interactions : null;
      });

      const result = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, groupBy);

      expect(result.length).toBe(2); // REEL e IMAGE. VIDEO não tem interações válidas.
      result.sort((a,b) => a.name.localeCompare(b.name)); // Ordenar para teste consistente

      expect(result[0].name).toBe("Image"); // DEFAULT_FORMAT_MAPPING não aplicado no mock, usa nome padrão
      expect(result[0].value).toBe(150); // 300/2
      expect(result[0].postsCount).toBe(2);

      expect(result[1].name).toBe("Reel");
      expect(result[1].value).toBe(75); // 150/2
      expect(result[1].postsCount).toBe(2);
    });

    test('Usa formatMapping e default formatting', async () => {
        const posts = [
            mockMetric('p1', FormatType.CAROUSEL_ALBUM, "c1", 100),
            mockMetric('p2', "CUSTOM_FORMAT" as FormatType, "c1", 50),
        ];
        (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
        (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions);

        const formatMapping = { [FormatType.CAROUSEL_ALBUM]: "My Carousel" };
        const result = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, groupBy, formatMapping);
        result.sort((a,b) => a.name.localeCompare(b.name));

        expect(result.find(r => r.name === "Custom Format")?.value).toBe(50); // Default formatting
        expect(result.find(r => r.name === "My Carousel")?.value).toBe(100); // Mapped
    });
  });

  describe('groupBy="context"', () => {
    const groupBy: GroupingType = "context";
    test('Agrega e calcula médias corretamente por contexto', async () => {
      const posts = [
        mockMetric('p1', FormatType.REEL, "Educational", 100),
        mockMetric('p2', FormatType.IMAGE, "Educational", 50), // Educational: sum=150, count=2, avg=75
        mockMetric('p3', FormatType.REEL, "Entertainment", 200), // Entertainment: sum=200, count=1, avg=200
        mockMetric('p4', FormatType.VIDEO, null, 100),       // Contexto null, não deve ser agrupado
      ];
      (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
      (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions);

      const result = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, groupBy);
      expect(result.length).toBe(2); // Educational e Entertainment
      result.sort((a,b) => a.name.localeCompare(b.name));

      expect(result[0].name).toBe("Educational");
      expect(result[0].value).toBe(75);
      expect(result[0].postsCount).toBe(2);

      expect(result[1].name).toBe("Entertainment");
      expect(result[1].value).toBe(200);
      expect(result[1].postsCount).toBe(1);
    });
  });

  describe('groupBy="proposal"', () => {
    const groupBy: GroupingType = 'proposal';
    test('Agrega e calcula médias corretamente por proposta', async () => {
      const posts = [
        mockMetric('p1', FormatType.REEL, 'Educational', 100, new Date(), 'News'),
        mockMetric('p2', FormatType.REEL, 'Educational', 200, undefined, 'Review'),
        mockMetric('p3', FormatType.IMAGE, 'Entertainment', 50, undefined, 'Review'),
      ];
      (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
      (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions);

      const result = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, groupBy);
      expect(result.length).toBeGreaterThan(0);
      // Order for test determinism
      result.sort((a,b) => a.name.localeCompare(b.name));
      expect(result[0].postsCount).toBeGreaterThan(0);
    });
  });

  test('Retorna array vazio se não houver posts', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve([]) });
    const result = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, "format");
    expect(result).toEqual([]);
  });

  test('Retorna array vazio se nenhum post tiver a métrica de performance válida', async () => {
    const posts = [mockMetric('p1', FormatType.IMAGE, "c1", null)];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    (getNestedValue as jest.Mock).mockReturnValue(null); // Todos os posts retornam null para a métrica

    const result = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, "format");
    expect(result).toEqual([]);
  });

   test('Retorna array vazio se nenhum post tiver groupKey válido', async () => {
    const posts = [mockMetric('p1', "" as FormatType, null, 100)]; // Formato vazio e contexto nulo
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions);

    const resultFormat = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, "format");
    expect(resultFormat).toEqual([]); // Nenhum groupKey "format" válido (string vazia é ignorada)

    const resultContext = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, "context");
    expect(resultContext).toEqual([]); // Nenhum groupKey "context" válido (null é ignorado)
  });


  test('Ordena resultados por valor descendente', async () => {
    const posts = [
      mockMetric('p1', FormatType.REEL, "c1", 50),  // Avg 50
      mockMetric('p2', FormatType.IMAGE, "c2", 200), // Avg 200
      mockMetric('p3', FormatType.VIDEO, "c3", 100), // Avg 100
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    (getNestedValue as jest.Mock).mockImplementation((obj, path) => obj.stats?.total_interactions);

    const result = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, "format");
    expect(result.length).toBe(3);
    expect(result[0].value).toBe(200); // IMAGE
    expect(result[1].value).toBe(100); // VIDEO
    expect(result[2].value).toBe(50);  // REEL
  });

  test('Erro no DB retorna array vazio', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.reject(new Error("DB Error")) });
    const result = await getAverageEngagementByGrouping(userId, timePeriod, performanceMetricField, "format");
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalled();
  });
});
