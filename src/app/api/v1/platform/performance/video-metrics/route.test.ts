import { GET } from './route';
import MetricModel from '@/app/models/Metric';
import { NextRequest } from 'next/server';

jest.mock('@/app/models/Metric', () => ({
  aggregate: jest.fn(),
}));

const mockAggregate = MetricModel.aggregate as jest.Mock;

const createRequest = (search = ''): NextRequest => {
  const url = `http://localhost/api/v1/platform/performance/video-metrics${search}`;
  return new NextRequest(url);
};

describe('GET /api/v1/platform/performance/video-metrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns aggregated metrics', async () => {
    mockAggregate.mockResolvedValueOnce([
      {
        totalRetentionSum: 2,
        countRetentionValid: 2,
        totalWatchTimeSum: 300,
        countWatchTimeValid: 3,
        totalVideoPosts: 5,
      },
    ]);

    const res = await GET(createRequest('?timePeriod=last_30_days'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.averageRetentionRate).toBeCloseTo(100);
    expect(body.averageWatchTimeSeconds).toBeCloseTo(100);
    expect(body.numberOfVideoPosts).toBe(5);
    expect(body.insightSummary).toContain('last_30_days');
  });

  it('returns zero metrics when no posts found', async () => {
    mockAggregate.mockResolvedValueOnce([]);

    const res = await GET(createRequest('?timePeriod=last_30_days'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.averageRetentionRate).toBeNull();
    expect(body.averageWatchTimeSeconds).toBeNull();
    expect(body.numberOfVideoPosts).toBe(0);
    expect(body.insightSummary).toContain('Nenhum post de vídeo encontrado');
  });

  it('returns 400 for invalid timePeriod', async () => {
    const res = await GET(createRequest('?timePeriod=invalid'));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('Time period inválido');
    expect(mockAggregate).not.toHaveBeenCalled();
  });
});
