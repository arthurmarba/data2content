import { GET } from './route';
import aggregatePlatformPerformanceHighlights from '@/utils/aggregatePlatformPerformanceHighlights';
import aggregatePlatformDayPerformance from '@/utils/aggregatePlatformDayPerformance';
import { NextRequest } from 'next/server';

jest.mock('@/utils/aggregatePlatformPerformanceHighlights');
jest.mock('@/utils/aggregatePlatformDayPerformance');

const mockAgg = aggregatePlatformPerformanceHighlights as jest.Mock;
const mockDayAgg = aggregatePlatformDayPerformance as jest.Mock;

const makeRequest = (search = '') => new NextRequest(`http://localhost/api/v1/platform/highlights/performance-summary${search}`);

describe('GET /api/v1/platform/highlights/performance-summary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns formatted highlights', async () => {
    mockAgg.mockResolvedValueOnce({
      topFormat: { name: 'VIDEO', average: 10, count: 2 },
      lowFormat: { name: 'IMAGE', average: 2, count: 1 },
      topContext: { name: 'FEED', average: 5, count: 3 },
      topProposal: { name: 'educational', average: 8, count: 4 },
      topTone: { name: 'humor', average: 7, count: 2 },
      topReference: { name: 'pop_culture', average: 6, count: 3 },
    });
    mockDayAgg.mockResolvedValueOnce({
      buckets: [],
      bestDays: [{ dayOfWeek: 5, average: 12, count: 4 }],
      worstDays: [],
    });

    const res = await GET(makeRequest('?timePeriod=last_30_days'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockAgg).toHaveBeenCalled();
    expect(mockDayAgg).toHaveBeenCalled();
    expect(body.topPerformingFormat.name).toBe('VIDEO');
    expect(body.lowPerformingFormat.name).toBe('IMAGE');
    expect(body.topPerformingContext.name).toBe('FEED');
    expect(body.topPerformingProposal.name).toBe('educational');
    expect(body.topPerformingTone.name).toBe('humor');
    expect(body.topPerformingReference.name).toBe('pop_culture');
    expect(body.bestDay.dayOfWeek).toBe(5);
  });

  it('returns 400 for invalid timePeriod', async () => {
    const res = await GET(makeRequest('?timePeriod=bad'));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Time period inválido');
    expect(mockAgg).not.toHaveBeenCalled();
    expect(mockDayAgg).not.toHaveBeenCalled();
  });
});
