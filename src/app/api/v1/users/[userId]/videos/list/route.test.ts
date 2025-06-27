import { GET } from './route';
import MetricModel from '@/app/models/Metric';
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';

jest.mock('@/app/models/Metric', () => ({
  aggregate: jest.fn(),
}));

const mockAggregate = MetricModel.aggregate as jest.Mock;

const createRequest = (userId: string, search: string = ''): NextRequest => {
  const url = `http://localhost/api/v1/users/${userId}/videos/list${search}`;
  return new NextRequest(url);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/users/[userId]/videos/list', () => {
  const userId = new Types.ObjectId().toString();

  it('returns videos with pagination using defaults', async () => {
    const aggResult = [{ videos: [{ id: 1 }], totalCount: [{ count: 3 }] }];
    mockAggregate.mockResolvedValueOnce(aggResult);

    const req = createRequest(userId);
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.videos).toEqual([{ id: 1 }]);
    expect(body.pagination.totalVideos).toBe(3);
    expect(mockAggregate).toHaveBeenCalled();
  });

  it('returns 400 for invalid timePeriod', async () => {
    const req = createRequest(userId, '?timePeriod=bad');
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('timePeriod inválido');
    expect(mockAggregate).not.toHaveBeenCalled();
  });

  it('handles db errors', async () => {
    mockAggregate.mockRejectedValueOnce(new Error('db error'));
    const req = createRequest(userId);
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Erro ao buscar vídeos.');
  });
});
