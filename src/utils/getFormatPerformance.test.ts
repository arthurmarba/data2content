import { Types } from 'mongoose';
import getTopPerformingFormat from './getTopPerformingFormat'; // Ajuste
import getLowPerformingFormat from './getLowPerformingFormat'; // Ajuste
import MetricModel, { IMetric, FormatType, IMetricStats } from '@/app/models/Metric'; // Ajuste
import { getNestedValue } from "./dataAccessHelpers"; // Importar a função compartilhada

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

describe('Format PerformanceCalculations', () => {
  const userId = new Types.ObjectId().toString();
  const periodInDays = 30;
  const performanceMetricField = "stats.total_interactions";

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
  });

  const setupFindMock = (result: any, isError = false) => {
    (MetricModel.find as jest.Mock).mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: isError
          ? () => Promise.reject(result)
          : () => Promise.resolve(result),
      }),
    });
  };

  const mockPost = (id: string, format: FormatType, interactions: number | null): Partial<IMetric> => {
    const stats: Partial<IMetricStats> = {};
    if (interactions !== null) {
      // Usar o helper getNestedValue para definir o valor pode ser um exagero aqui,
      // é mais para ler. Definimos diretamente para o mock.
      if (performanceMetricField === "stats.total_interactions") {
        stats.total_interactions = interactions;
      } else if (performanceMetricField === "stats.views") {
        stats.views = interactions; // Exemplo se estivéssemos testando com views
      }
      // Adicionar outros campos conforme necessário para diferentes performanceMetricField
    }
    return {
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(userId),
      postDate: new Date(),
      format: format,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  };

  describe('getTopPerformingFormat', () => {
    test('Identifica corretamente o formato com maior média de performance', async () => {
      const posts = [
        mockPost('p1', FormatType.IMAGE, 100),
        mockPost('p2', FormatType.IMAGE, 150), // Avg IMAGE = 125
        mockPost('p3', FormatType.REEL, 200),
        mockPost('p4', FormatType.REEL, 250),  // Avg REEL = 225 (Top)
        mockPost('p5', FormatType.VIDEO, 50),   // Avg VIDEO = 50
      ];
      setupFindMock(posts);
      const result = await getTopPerformingFormat(userId, periodInDays, performanceMetricField);
      expect(result).not.toBeNull();
      expect(result?.format).toBe(FormatType.REEL);
      expect(result?.averagePerformance).toBe(225);
      expect(result?.postsCount).toBe(2);
      expect(result?.metricUsed).toBe(performanceMetricField);
    });

    test('Retorna null se não houver posts', async () => {
      setupFindMock([]);
      const result = await getTopPerformingFormat(userId, periodInDays, performanceMetricField);
      expect(result).toBeNull();
    });

    test('Retorna null se nenhum post tiver a métrica de performance válida', async () => {
      const posts = [
        mockPost('p1', FormatType.IMAGE, null),
        mockPost('p2', FormatType.REEL, null),
      ];
      setupFindMock(posts);
      const result = await getTopPerformingFormat(userId, periodInDays, performanceMetricField);
      expect(result).toBeNull();
    });

    test('Lida com um único formato', async () => {
      const posts = [
        mockPost('p1', FormatType.IMAGE, 100),
        mockPost('p2', FormatType.IMAGE, 150), // Avg IMAGE = 125
      ];
      setupFindMock(posts);
      const result = await getTopPerformingFormat(userId, periodInDays, performanceMetricField);
      expect(result?.format).toBe(FormatType.IMAGE);
      expect(result?.averagePerformance).toBe(125);
    });
     test('Erro no DB retorna null', async () => {
      setupFindMock(new Error("DB Error"), true);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await getTopPerformingFormat(userId, periodInDays, performanceMetricField);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getLowPerformingFormat', () => {
    const minPosts = 2;
    test('Identifica corretamente o formato com menor média (atendendo minPosts)', async () => {
      const posts = [
        mockPost('p1', FormatType.IMAGE, 100), // IMAGE count = 1 (ignorado por minPosts)
        mockPost('p2', FormatType.REEL, 200),
        mockPost('p3', FormatType.REEL, 250),  // Avg REEL = 225
        mockPost('p4', FormatType.VIDEO, 50),
        mockPost('p5', FormatType.VIDEO, 70),   // Avg VIDEO = 60 (Low)
      ];
      setupFindMock(posts);
      const result = await getLowPerformingFormat(userId, periodInDays, performanceMetricField, minPosts);
      expect(result).not.toBeNull();
      expect(result?.format).toBe(FormatType.VIDEO);
      expect(result?.averagePerformance).toBe(60);
      expect(result?.postsCount).toBe(2);
    });

    test('Retorna null se nenhum formato atender minPostsForConsideration', async () => {
      const posts = [
        mockPost('p1', FormatType.IMAGE, 100), // Count = 1
        mockPost('p2', FormatType.REEL, 200),  // Count = 1
      ];
      setupFindMock(posts);
      const result = await getLowPerformingFormat(userId, periodInDays, performanceMetricField, minPosts);
      expect(result).toBeNull();
    });

    test('Retorna null se não houver posts', async () => {
      setupFindMock([]);
      const result = await getLowPerformingFormat(userId, periodInDays, performanceMetricField, minPosts);
      expect(result).toBeNull();
    });

    test('Lida com um único formato que atende minPosts', async () => {
      const posts = [
        mockPost('p1', FormatType.REEL, 100),
        mockPost('p2', FormatType.REEL, 150), // Avg REEL = 125
      ];
      setupFindMock(posts);
      const result = await getLowPerformingFormat(userId, periodInDays, performanceMetricField, minPosts);
      expect(result?.format).toBe(FormatType.REEL);
      expect(result?.averagePerformance).toBe(125);
    });

    test('Erro no DB retorna null', async () => {
      setupFindMock(new Error("DB Error"), true);
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const result = await getLowPerformingFormat(userId, periodInDays, performanceMetricField, minPosts);
      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
