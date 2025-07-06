import { GET } from './route';
import aggregatePlatformTimePerformance from '@/utils/aggregatePlatformTimePerformance';
import { NextRequest } from 'next/server';

jest.mock('@/utils/aggregatePlatformTimePerformance');
const mockAgg = aggregatePlatformTimePerformance as jest.Mock;

const makeRequest = (search = '') => new NextRequest(`http://localhost/api/v1/platform/performance/time-distribution${search}`);

describe('GET /api/v1/platform/performance/time-distribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns aggregated data', async () => {
    mockAgg.mockResolvedValueOnce({
      buckets: [{ dayOfWeek: 1, timeBlock: '6-12', average: 10, count: 2 }],
      bestSlots: [{ dayOfWeek: 1, timeBlock: '6-12', average: 10, count: 2 }],
      worstSlots: [{ dayOfWeek: 2, timeBlock: '0-6', average: 1, count: 1 }],
    });

    const res = await GET(makeRequest('?timePeriod=last_30_days&format=reel&metric=stats.total_interactions'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockAgg).toHaveBeenCalledWith(30, 'stats.total_interactions', {
      format: 'reel',
      proposal: undefined,
      context: undefined,
    }, expect.any(Date));
    expect(body.buckets[0].timeBlock).toBe('6-12');
    expect(body.insightSummary).toContain('pico de engajamento');
  });

  it('returns 400 for invalid time period', async () => {
    const res = await GET(makeRequest('?timePeriod=bad'));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Time period inválido');
    expect(mockAgg).not.toHaveBeenCalled();
  });
});
