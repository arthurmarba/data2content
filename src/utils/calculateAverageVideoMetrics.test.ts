import { Types } from 'mongoose';
import calculateAverageVideoMetrics from './calculateAverageVideoMetrics'; // Ajuste o caminho
import MetricModel, { IMetricStats, FormatType } from '@/app/models/Metric'; // Ajuste o caminho

jest.mock('@/app/models/Metric', () => ({
  find: jest.fn(),
}));

describe('calculateAverageVideoMetrics', () => {
  const userId = new Types.ObjectId().toString();
  const periodInDays = 30;
  const videoFormats = [FormatType.REEL, FormatType.VIDEO];
  let expectedStartDate: Date;
  let expectedEndDate: Date;

  beforeEach(() => {
    (MetricModel.find as jest.Mock).mockReset();
    const today = new Date();
    expectedEndDate = new Date(today);
    expectedStartDate = new Date(today);
    expectedStartDate.setDate(today.getDate() - periodInDays);
  });

  const mockVideoPost = (
    id: string,
    retention_rate: number | null,
    average_video_watch_time_seconds: number | null,
    format: FormatType = FormatType.REEL // Default to REEL
  ): any => {
    const stats: Partial<IMetricStats> = {};
    if (retention_rate !== null) {
      stats.retention_rate = retention_rate;
    }
    if (average_video_watch_time_seconds !== null) {
      stats.average_video_watch_time_seconds = average_video_watch_time_seconds;
    }
    return {
      _id: new Types.ObjectId(id),
      user: new Types.ObjectId(userId),
      postDate: new Date(),
      format: format,
      stats: Object.keys(stats).length > 0 ? stats : undefined,
    };
  };

  test('Múltiplos posts de vídeo com dados válidos', async () => {
    const posts = [
      mockVideoPost('post1', 0.5, 30), // 50% retention
      mockVideoPost('post2', 0.3, 15), // 30% retention
      mockVideoPost('post3', 0.7, 45, FormatType.VIDEO), // 70% retention
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });

    const result = await calculateAverageVideoMetrics(userId, periodInDays, videoFormats);

    expect(result.numberOfVideoPosts).toBe(3);
    // sumRetentionRate = 0.5 + 0.3 + 0.7 = 1.5
    // averageRetentionRate = (1.5 / 3) * 100 = 0.5 * 100 = 50.0
    expect(result.averageRetentionRate).toBeCloseTo(50.0);
    // sumAverageVideoWatchTimeSeconds = 30 + 15 + 45 = 90
    // averageWatchTimeSeconds = 90 / 3 = 30
    expect(result.averageWatchTimeSeconds).toBeCloseTo(30);
    expect(result.startDate?.toISOString().substring(0,10)).toEqual(expectedStartDate.toISOString().substring(0,10));
    expect(result.endDate?.toISOString().substring(0,10)).toEqual(expectedEndDate.toISOString().substring(0,10));
  });

  test('Zero posts de vídeo', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve([]) });
    const result = await calculateAverageVideoMetrics(userId, periodInDays, videoFormats);
    expect(result.numberOfVideoPosts).toBe(0);
    expect(result.averageRetentionRate).toBe(0.0);
    expect(result.averageWatchTimeSeconds).toBe(0);
  });

  test('Alguns posts de vídeo com métricas nulas ou ausentes', async () => {
    const posts = [
      mockVideoPost('post1', 0.6, 60),        // 60%
      mockVideoPost('post2', null, 30),       // retention null
      mockVideoPost('post3', 0.4, null),      // watch time null
      mockVideoPost('post4', null, null),     // both null
      { // Post de vídeo sem campo stats
        _id: new Types.ObjectId('post5'),
        user: new Types.ObjectId(userId),
        postDate: new Date(),
        format: FormatType.REEL,
      } as any,
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await calculateAverageVideoMetrics(userId, periodInDays, videoFormats);

    expect(result.numberOfVideoPosts).toBe(5);
    // sumRetentionRate = 0.6 + 0 (de null) + 0.4 + 0 (de null) + 0 (de stats ausente) = 1.0
    // averageRetentionRate = (1.0 / 5) * 100 = 0.2 * 100 = 20.0
    expect(result.averageRetentionRate).toBeCloseTo(20.0);
    // sumAverageVideoWatchTimeSeconds = 60 + 30 + 0 (de null) + 0 (de null) + 0 (de stats ausente) = 90
    // averageWatchTimeSeconds = 90 / 5 = 18
    expect(result.averageWatchTimeSeconds).toBeCloseTo(18);
  });

  test('Todos os posts de vídeo com métricas nulas', async () => {
    const posts = [
      mockVideoPost('post1', null, null),
      mockVideoPost('post2', null, null),
    ];
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve(posts) });
    const result = await calculateAverageVideoMetrics(userId, periodInDays, videoFormats);
    expect(result.numberOfVideoPosts).toBe(2);
    expect(result.averageRetentionRate).toBe(0.0);
    expect(result.averageWatchTimeSeconds).toBe(0);
  });

  test('Nenhum post corresponde aos videoFormats especificados', async () => {
    const posts = [ // Estes não são os formatos de vídeo padrão
      mockVideoPost('post1', 0.5, 30, FormatType.IMAGE),
      mockVideoPost('post2', 0.3, 15, FormatType.CAROUSEL_ALBUM),
    ];
     // A query no DB não retornaria nada por causa do filtro de format
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.resolve([]) });
    const result = await calculateAverageVideoMetrics(userId, periodInDays, videoFormats); // Usando videoFormats padrão

    expect(result.numberOfVideoPosts).toBe(0);
    expect(result.averageRetentionRate).toBe(0.0);
    expect(result.averageWatchTimeSeconds).toBe(0);
  });

  test('Usando videoFormats customizados', async () => {
    const posts = [ // Apenas VIDEO é o formato customizado
      mockVideoPost('post1', 0.5, 30, FormatType.VIDEO),
      mockVideoPost('post2', 0.3, 15, FormatType.REEL), // Este será ignorado
    ];
    // Simular que a query só retorna o post FormatType.VIDEO
    (MetricModel.find as jest.Mock).mockImplementation(query => {
        if(query.format.$in.includes(FormatType.VIDEO) && query.format.$in.length === 1) {
            return { lean: () => Promise.resolve([posts[0]]) };
        }
        return { lean: () => Promise.resolve([]) };
    });

    const result = await calculateAverageVideoMetrics(userId, periodInDays, [FormatType.VIDEO]);

    expect(result.numberOfVideoPosts).toBe(1);
    expect(result.averageRetentionRate).toBeCloseTo(50.0); // (0.5 / 1) * 100
    expect(result.averageWatchTimeSeconds).toBeCloseTo(30); // 30 / 1
  });


  test('Erro no Banco de Dados', async () => {
    (MetricModel.find as jest.Mock).mockReturnValue({ lean: () => Promise.reject(new Error("DB query failed")) });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const result = await calculateAverageVideoMetrics(userId, periodInDays, videoFormats);
    expect(result.numberOfVideoPosts).toBe(0);
    expect(result.averageRetentionRate).toBe(0.0);
    expect(result.averageWatchTimeSeconds).toBe(0);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("Error calculating average video metrics"), expect.any(Error));

    consoleErrorSpy.mockRestore();
  });
});
```
