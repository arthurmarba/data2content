import { GET } from './route';
import aggregateUserPerformanceHighlights from '@/utils/aggregateUserPerformanceHighlights';
import aggregateUserDayPerformance from '@/utils/aggregateUserDayPerformance';
import calculatePlatformAverageMetric from '@/utils/calculatePlatformAverageMetric';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

jest.mock('@/utils/aggregateUserPerformanceHighlights');
jest.mock('@/utils/aggregateUserDayPerformance');
jest.mock('@/utils/calculatePlatformAverageMetric');

const mockAgg = aggregateUserPerformanceHighlights as jest.Mock;
const mockDayAgg = aggregateUserDayPerformance as jest.Mock;
const mockPlatformAvg = calculatePlatformAverageMetric as jest.Mock;

const makeRequest = (userId: string, search = '') => new NextRequest(`http://localhost/api/v1/users/${userId}/highlights/performance-summary${search}`);

describe('GET /api/v1/users/[userId]/highlights/performance-summary', () => {
  const userId = new Types.ObjectId().toString();
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
    }).mockResolvedValueOnce({
      topFormat: { name: 'VIDEO', average: 8, count: 2 },
      lowFormat: { name: 'IMAGE', average: 1, count: 1 },
      topContext: { name: 'FEED', average: 4, count: 3 },
      topProposal: { name: 'educational', average: 6, count: 4 },
      topTone: { name: 'humor', average: 5, count: 2 },
      topReference: { name: 'pop_culture', average: 5, count: 3 },
    });
    mockDayAgg.mockResolvedValueOnce({
      buckets: [],
      bestDays: [{ dayOfWeek: 5, average: 12, count: 4 }],
      worstDays: [],
    });
    mockPlatformAvg.mockResolvedValueOnce(5);

    const res = await GET(makeRequest(userId, '?timePeriod=last_30_days'), { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockAgg).toHaveBeenCalled();
    expect(mockDayAgg).toHaveBeenCalled();
    expect(body.topPerformingFormat.name).toBe('VIDEO');
    expect(body.bestDay.dayOfWeek).toBe(5);
  });

  it('returns 400 for invalid timePeriod', async () => {
    const res = await GET(makeRequest(userId, '?timePeriod=bad'), { params: { userId } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Time period inválido');
    expect(mockAgg).not.toHaveBeenCalled();
    expect(mockDayAgg).not.toHaveBeenCalled();
  });
});
