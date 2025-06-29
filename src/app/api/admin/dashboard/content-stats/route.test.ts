import { GET } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { fetchDashboardOverallContentStats } from '@/app/lib/dataService/marketAnalysisService';
import { logger } from '@/app/lib/logger';
import { getAdminSession } from '@/lib/getAdminSession';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn(),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

// Mock logger
jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock marketAnalysisService
jest.mock('@/app/lib/dataService/marketAnalysisService', () => ({
  fetchDashboardOverallContentStats: jest.fn(),
}));

const mockGetAdminSession = getAdminSession as jest.Mock;

const mockFetchDashboardOverallContentStats = fetchDashboardOverallContentStats as jest.Mock;

describe('API Route: /api/admin/dashboard/content-stats', () => {

  const createMockRequest = (searchParams: Record<string, string> = {}): NextRequest => {
    const url = new URL(`http://localhost/api/admin/dashboard/content-stats?${new URLSearchParams(searchParams)}`);
    return new NextRequest(url.toString());
    // Session mocking considerations are similar to the creators route test.
    // The getAdminSession in route.ts is hardcoded to success.
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
  });

  it('should return 200 with content stats on a valid request without filters', async () => {
    const mockData = { totalPlatformPosts: 100, averagePlatformEngagementRate: 0.05 };
    mockFetchDashboardOverallContentStats.mockResolvedValue(mockData);

    const req = createMockRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockData);
    expect(fetchDashboardOverallContentStats).toHaveBeenCalledWith({}); // Empty filter object
  });

  it('should pass valid date filters to service function', async () => {
    const mockData = { totalPlatformPosts: 50, averagePlatformEngagementRate: 0.03 };
    mockFetchDashboardOverallContentStats.mockResolvedValue(mockData);

    const startDate = '2023-01-01T00:00:00.000Z';
    const endDate = '2023-01-31T23:59:59.999Z';

    const req = createMockRequest({ startDate, endDate });
    await GET(req);

    expect(fetchDashboardOverallContentStats).toHaveBeenCalledWith({
      dateRange: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
  });

  it('should return 400 on invalid date format for startDate', async () => {
    const req = createMockRequest({ startDate: 'invalid-date' });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Parâmetros de consulta inválidos:');
    // Zod error messages can be specific, check for general structure or key parts
    expect(body.error).toContain('startDate');
  });

  it('should return 400 if startDate is after endDate', async () => {
    const req = createMockRequest({
      startDate: '2023-02-01T00:00:00.000Z',
      endDate: '2023-01-01T00:00:00.000Z'
    });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('startDate cannot be after endDate');
  });

  it('should return 401 if admin session is invalid', async () => {
    mockGetAdminSession.mockResolvedValueOnce({ user: { role: 'user' } });
    const req = createMockRequest();
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('should return 500 if service function throws an error', async () => {
    mockFetchDashboardOverallContentStats.mockRejectedValue(new Error('Service error'));
    const req = createMockRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Ocorreu um erro interno no servidor.');
  });

  it('should correctly handle request with only startDate', async () => {
    mockFetchDashboardOverallContentStats.mockResolvedValue({});
    const startDate = '2023-03-01T00:00:00.000Z';
    const req = createMockRequest({ startDate });
    await GET(req);

    expect(fetchDashboardOverallContentStats).toHaveBeenCalledWith({
      dateRange: {
        startDate: new Date(startDate),
        // endDate will be undefined
      },
    });
  });

   it('should correctly handle request with only endDate', async () => {
    mockFetchDashboardOverallContentStats.mockResolvedValue({});
    const endDate = '2023-03-31T00:00:00.000Z';
    const req = createMockRequest({ endDate });
    await GET(req);

    expect(fetchDashboardOverallContentStats).toHaveBeenCalledWith({
      dateRange: {
        // startDate will be undefined
        endDate: new Date(endDate),
      },
    });
  });
});
