import { GET } from './route';
import UserModel from '@/app/models/User';
import getFollowerTrendChartData from '@/charts/getFollowerTrendChartData';
import { NextRequest } from 'next/server';
import { logger } from '@/app/lib/logger';

jest.mock('@/app/models/User', () => ({
  find: jest.fn(),
}));

jest.mock('@/charts/getFollowerTrendChartData', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockFind = UserModel.find as jest.Mock;
const mockGetTrend = getFollowerTrendChartData as jest.Mock;

const createRequest = (searchParams: string = ''): NextRequest => {
  const url = `http://localhost/api/v1/platform/trends/followers${searchParams}`;
  return new NextRequest(url);
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('GET /api/v1/platform/trends/followers', () => {
  it('aggregates follower trends for active users', async () => {
    const users = [{ _id: 'u1' }, { _id: 'u2' }];
    const leanMock = jest.fn().mockResolvedValue(users);
    const limitMock = jest.fn();
    const selectMock = jest.fn().mockReturnValue({ lean: leanMock, limit: limitMock });
    mockFind.mockReturnValue({ select: selectMock });

    mockGetTrend
      .mockResolvedValueOnce({ chartData: [{ date: '2024-01-01', value: 100 }], insightSummary: '' })
      .mockResolvedValueOnce({ chartData: [{ date: '2024-01-01', value: 50 }], insightSummary: '' });

    const res = await GET(createRequest());
    const body = await res.json();

    expect(mockFind).toHaveBeenCalledWith({ planStatus: 'active' });
    expect(selectMock).toHaveBeenCalledWith('_id');
    expect(limitMock).not.toHaveBeenCalled();
    expect(mockGetTrend).toHaveBeenCalledTimes(2);
    expect(body.chartData).toEqual([{ date: '2024-01-01', value: 150 }]);
  });

  it('returns empty chart when no users found', async () => {
    const leanMock = jest.fn().mockResolvedValue([]);
    const selectMock = jest.fn().mockReturnValue({ lean: leanMock });
    mockFind.mockReturnValue({ select: selectMock });

    const res = await GET(createRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.chartData).toEqual([]);
    expect(body.insightSummary).toContain('Nenhum usuário');
  });
});
