import { GET } from './route';
import { NextRequest } from 'next/server';
import { findUserPosts } from '@/app/lib/dataService/marketAnalysis/postsService';
import { Types } from 'mongoose';

jest.mock('@/app/lib/dataService/marketAnalysis/postsService', () => ({
  findUserPosts: jest.fn(),
  toProxyUrl: jest.fn((url) => url),
}));

const mockFindUserPosts = findUserPosts as jest.Mock;

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
    mockFindUserPosts.mockResolvedValueOnce({
      posts: [{ id: 1 }],
      totalPosts: 3,
      page: 1,
      limit: 10,
    });

    const req = createRequest(userId);
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.posts).toEqual([expect.objectContaining({ id: 1 })]);
    expect(body.pagination.totalPosts).toBe(3);
    expect(mockFindUserPosts).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      timePeriod: 'last_90_days',
      sortBy: 'postDate',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
      filters: expect.objectContaining({
        source: undefined,
      }),
    }));
  });

  it('maps sortBy params using helper', async () => {
    mockFindUserPosts.mockResolvedValueOnce({
      posts: [],
      totalPosts: 0,
      page: 1,
      limit: 10,
    });

    const req = createRequest(userId, '?sortBy=views');
    await GET(req, { params: { userId } });

    expect(mockFindUserPosts).toHaveBeenCalledWith(expect.objectContaining({
      userId,
      timePeriod: 'last_90_days',
      sortBy: 'stats.views',
      sortOrder: 'desc',
      page: 1,
      limit: 10,
      filters: expect.objectContaining({
        source: undefined,
      }),
    }));
  });

  it('forwards source filter when provided', async () => {
    mockFindUserPosts.mockResolvedValueOnce({
      posts: [],
      totalPosts: 0,
      page: 1,
      limit: 10,
    });

    const req = createRequest(userId, '?source=api&types=REEL,VIDEO');
    await GET(req, { params: { userId } });

    expect(mockFindUserPosts).toHaveBeenCalledWith(expect.objectContaining({
      filters: expect.objectContaining({
        source: 'api',
        types: ['REEL', 'VIDEO'],
      }),
    }));
  });

  it('accepts references filter with the plural query param used by older callers', async () => {
    mockFindUserPosts.mockResolvedValueOnce({
      posts: [],
      totalPosts: 0,
      page: 1,
      limit: 10,
    });

    const req = createRequest(userId, '?references=city');
    await GET(req, { params: { userId } });

    expect(mockFindUserPosts).toHaveBeenCalledWith(expect.objectContaining({
      filters: expect.objectContaining({
        references: 'city',
      }),
    }));
  });

  it('forwards duration bucket filter when provided', async () => {
    mockFindUserPosts.mockResolvedValueOnce({
      posts: [],
      totalPosts: 0,
      page: 1,
      limit: 10,
    });

    const req = createRequest(userId, '?durationBucket=30_60');
    await GET(req, { params: { userId } });

    expect(mockFindUserPosts).toHaveBeenCalledWith(expect.objectContaining({
      filters: expect.objectContaining({
        durationBucket: '30_60',
      }),
    }));
  });

  it('returns 400 for invalid timePeriod', async () => {
    const req = createRequest(userId, '?timePeriod=bad');
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('timePeriod inválido');
    expect(mockFindUserPosts).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid durationBucket', async () => {
    const req = createRequest(userId, '?durationBucket=bad_bucket');
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('durationBucket inválido');
    expect(mockFindUserPosts).not.toHaveBeenCalled();
  });

  it('handles db errors', async () => {
    mockFindUserPosts.mockRejectedValueOnce(new Error('db error'));
    const req = createRequest(userId);
    const res = await GET(req, { params: { userId } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe('Erro ao buscar posts.');
  });
});
