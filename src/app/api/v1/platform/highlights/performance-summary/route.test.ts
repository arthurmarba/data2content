import { GET } from './route';
import aggregatePlatformPerformanceHighlights from '@/utils/aggregatePlatformPerformanceHighlights';
import { NextRequest } from 'next/server';

jest.mock('@/utils/aggregatePlatformPerformanceHighlights');

const mockAgg = aggregatePlatformPerformanceHighlights as jest.Mock;

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
    });

    const res = await GET(makeRequest('?timePeriod=last_30_days'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockAgg).toHaveBeenCalled();
    expect(body.topPerformingFormat.name).toBe('VIDEO');
    expect(body.lowPerformingFormat.name).toBe('IMAGE');
    expect(body.topPerformingContext.name).toBe('FEED');
  });

  it('returns 400 for invalid timePeriod', async () => {
    const res = await GET(makeRequest('?timePeriod=bad'));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Time period inválido');
    expect(mockAgg).not.toHaveBeenCalled();
  });
});
