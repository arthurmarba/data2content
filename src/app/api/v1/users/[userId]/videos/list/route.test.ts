import { GET } from './route';
import { NextRequest } from 'next/server';
import { findUserVideoPosts } from '@/app/lib/dataService/marketAnalysis/postsService';
import { Types } from 'mongoose';

jest.mock('@/app/lib/dataService/marketAnalysis/postsService', () => ({
  findUserVideoPosts: jest.fn(),
}));

const mockFindUserVideoPosts = findUserVideoPosts as jest.Mock;

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
    mockFindUserVideoPosts.mockResolvedValueOnce({
      videos: [{ id: 1 }],
      totalVideos: 3,
      page: 1,
      limit: 10,
    });

    const req = createRequest(userId);
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.videos).toEqual([{ id: 1 }]);
    expect(body.pagination.totalVideos).toBe(3);
    expect(mockFindUserVideoPosts).toHaveBeenCalledWith({
      userId,
      timePeriod: 'last_90_days',
      sortBy: 'postDate',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
    });
  });

  it('maps sortBy params using helper', async () => {
    mockFindUserVideoPosts.mockResolvedValueOnce({
      videos: [],
      totalVideos: 0,
      page: 1,
      limit: 10,
    });

    const req = createRequest(userId, '?sortBy=views');
    await GET(req, { params: { userId } });

    expect(mockFindUserVideoPosts).toHaveBeenCalledWith({
      userId,
      timePeriod: 'last_90_days',
      sortBy: 'stats.views',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
    });
  });

  it('returns 400 for invalid timePeriod', async () => {
    const req = createRequest(userId, '?timePeriod=bad');
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('timePeriod inválido');
    expect(mockFindUserVideoPosts).not.toHaveBeenCalled();
  });

  it('handles db errors', async () => {
    mockFindUserVideoPosts.mockRejectedValueOnce(new Error('db error'));
    const req = createRequest(userId);
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Erro ao buscar vídeos.');
  });
});
