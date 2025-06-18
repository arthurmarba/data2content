import { Types } from 'mongoose';
import getEngagementDistributionByFormatChartData from './getEngagementDistributionByFormatChartData';
import MetricModel from '@/app/models/Metric';

jest.mock('@/app/models/Metric', () => ({
  aggregate: jest.fn(),
}));

enum FormatType {
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  REEL = 'REEL',
  CAROUSEL_ALBUM = 'CAROUSEL_ALBUM',
  TEXT = 'TEXT'
}

describe('getEngagementDistributionByFormatChartData', () => {
  const userId = new Types.ObjectId().toString();
  const engagementMetricField = 'stats.total_interactions';

  beforeEach(() => {
    (MetricModel.aggregate as jest.Mock).mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  test('Agregação correta por formato e cálculo de percentuais', async () => {
    const agg = [
      { _id: FormatType.REEL, totalEngagement: 150 },
      { _id: FormatType.IMAGE, totalEngagement: 100 },
      { _id: FormatType.CAROUSEL_ALBUM, totalEngagement: 250 },
    ];
    (MetricModel.aggregate as jest.Mock).mockResolvedValue(agg);

    const result = await getEngagementDistributionByFormatChartData(userId, 'last_30_days', engagementMetricField);

    expect(result.chartData.length).toBe(3);
    result.chartData.sort((a, b) => a.name.localeCompare(b.name));

    const reelData = result.chartData.find(d => d.name === 'Reel');
    expect(reelData?.value).toBe(150);
    expect(reelData?.percentage).toBeCloseTo((150 / 500) * 100);

    const imageData = result.chartData.find(d => d.name === 'Image');
    expect(imageData?.value).toBe(100);
    expect(imageData?.percentage).toBeCloseTo((100 / 500) * 100);

    const carouselData = result.chartData.find(d => d.name === 'Carousel Album');
    expect(carouselData?.value).toBe(250);
    expect(carouselData?.percentage).toBeCloseTo((250 / 500) * 100);

    expect(result.insightSummary).toContain('Carousel Album é o formato com maior engajamento');
  });

  test('Lida com "all_time" e formata nomes padrão', async () => {
    const agg = [{ _id: FormatType.VIDEO, totalEngagement: 200 }];
    (MetricModel.aggregate as jest.Mock).mockResolvedValue(agg);

    const result = await getEngagementDistributionByFormatChartData(userId, 'all_time', engagementMetricField);

    expect(result.chartData.length).toBe(1);
    expect(result.chartData[0].name).toBe('Video');
    expect(result.chartData[0].value).toBe(200);
    expect(result.chartData[0].percentage).toBe(100);
    expect(result.insightSummary).toContain('Video representa todo o engajamento');

    const pipeline = (MetricModel.aggregate as jest.Mock).mock.calls[0][0];
    expect(pipeline[0].$match.postDate).toBeUndefined();
  });

  test('Usa formatMapping quando fornecido', async () => {
    const agg = [{ _id: FormatType.REEL, totalEngagement: 100 }];
    (MetricModel.aggregate as jest.Mock).mockResolvedValue(agg);
    const formatMapping = { [FormatType.REEL]: 'Vídeos Curtos (Reel)' };

    const result = await getEngagementDistributionByFormatChartData(userId, 'last_30_days', engagementMetricField, formatMapping);
    expect(result.chartData[0].name).toBe('Vídeos Curtos (Reel)');
  });

  test('Agrupa slices pequenos em "Outros"', async () => {
    const agg = [
      { _id: FormatType.REEL, totalEngagement: 100 },
      { _id: FormatType.IMAGE, totalEngagement: 80 },
      { _id: FormatType.VIDEO, totalEngagement: 60 },
      { _id: FormatType.CAROUSEL_ALBUM, totalEngagement: 40 },
      { _id: FormatType.TEXT, totalEngagement: 20 },
      { _id: 'AUDIO_TRACK', totalEngagement: 10 },
      { _id: 'LIVE_STREAM', totalEngagement: 5 },
      { _id: 'MIXED_MEDIA', totalEngagement: 2 },
    ];
    (MetricModel.aggregate as jest.Mock).mockResolvedValue(agg);

    const maxSlices = 5;
    const result = await getEngagementDistributionByFormatChartData(userId, 'last_90_days', engagementMetricField, undefined, maxSlices);

    expect(result.chartData.length).toBe(maxSlices);
    const otrosSlice = result.chartData.find(s => s.name === 'Outros');
    expect(otrosSlice).toBeDefined();
    expect(otrosSlice?.value).toBe(37);
    expect(otrosSlice?.percentage).toBeCloseTo((37 / 317) * 100);
    expect(result.chartData.find(s => s.name === 'Reel')?.value).toBe(100);
    expect(result.insightSummary).toContain('Reel é o formato com maior engajamento');
  });

  test('Nenhum post no período retorna array vazio e sumário default', async () => {
    (MetricModel.aggregate as jest.Mock).mockResolvedValue([]);
    const result = await getEngagementDistributionByFormatChartData(userId, 'last_30_days', engagementMetricField);
    expect(result.chartData).toEqual([]);
    expect(result.insightSummary).toBe('Nenhum dado de engajamento encontrado para o período.');
  });

  test('Posts sem engajamento relevante retornam valores zero', async () => {
    const agg = [
      { _id: FormatType.REEL, totalEngagement: 0 },
      { _id: FormatType.IMAGE, totalEngagement: 0 },
    ];
    (MetricModel.aggregate as jest.Mock).mockResolvedValue(agg);
    const result = await getEngagementDistributionByFormatChartData(userId, 'last_30_days', engagementMetricField);
    expect(result.chartData.length).toBe(2);
    expect(result.chartData).toEqual(
      expect.arrayContaining([
        { name: 'Reel', value: 0, percentage: 0 },
        { name: 'Image', value: 0, percentage: 0 },
      ])
    );
    expect(result.insightSummary).toBe('Nenhum dado de engajamento encontrado para o período.');
  });

  test('Erro no DB retorna array vazio e sumário de erro', async () => {
    (MetricModel.aggregate as jest.Mock).mockRejectedValue(new Error('DB Error'));
    const result = await getEngagementDistributionByFormatChartData(userId, 'last_30_days', engagementMetricField);
    expect(result.chartData).toEqual([]);
    expect(result.insightSummary).toBe('Erro ao buscar dados de distribuição de engajamento.');
    expect(console.error).toHaveBeenCalled();
  });
});
