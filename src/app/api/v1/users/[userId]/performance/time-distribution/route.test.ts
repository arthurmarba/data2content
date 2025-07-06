import { GET } from './route';
import { aggregateUserTimePerformance } from '@/utils/aggregateUserTimePerformance';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

jest.mock('@/utils/aggregateUserTimePerformance');
const mockAgg = aggregateUserTimePerformance as jest.Mock;

const makeRequest = (userId: string, search = '') => new NextRequest(`http://localhost/api/v1/users/${userId}/performance/time-distribution${search}`);

describe('GET /api/v1/users/[userId]/performance/time-distribution', () => {
  const userId = new Types.ObjectId().toString();
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns aggregated data', async () => {
    mockAgg.mockResolvedValueOnce({
      buckets: [{ dayOfWeek: 1, hour: 6, average: 10, count: 2 }],
      bestSlots: [{ dayOfWeek: 1, hour: 6, average: 10, count: 2 }],
      worstSlots: [{ dayOfWeek: 2, hour: 0, average: 1, count: 1 }],
    });

    const res = await GET(makeRequest(userId, '?timePeriod=last_30_days&format=reel'), { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mockAgg).toHaveBeenCalledWith(userId, 30, 'stats.total_interactions', {
      format: 'reel',
      proposal: undefined,
      context: undefined,
    }, expect.any(Date));
    expect(body.buckets[0].hour).toBe(6);
  });

  it('returns 400 for invalid time period', async () => {
    const res = await GET(makeRequest(userId, '?timePeriod=bad'), { params: { userId } });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Time period inválido');
    expect(mockAgg).not.toHaveBeenCalled();
  });
});
