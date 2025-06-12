import { GET } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { fetchCreatorTimeSeriesData } from '@/app/lib/dataService/marketAnalysisService';
import { logger } from '@/app/lib/logger';

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
  fetchCreatorTimeSeriesData: jest.fn(),
}));

const mockFetchCreatorTimeSeriesData = fetchCreatorTimeSeriesData as jest.Mock;
const validCreatorId = new Types.ObjectId().toString();

describe('API Route: /api/admin/dashboard/creators/[creatorId]/time-series', () => {

  const createMockRequest = (creatorIdParam: string, searchParams: Record<string, string> = {}): NextRequest => {
    const url = new URL(`http://localhost/api/admin/dashboard/creators/${creatorIdParam}/time-series?${new URLSearchParams(searchParams)}`);
    // Params for the dynamic route part are passed in the second argument to GET handler
    return new NextRequest(url.toString());
  };

  // As with other route tests, getAdminSession is hardcoded in the route,
  // so testing the 401 path by directly manipulating it from here is not straightforward.
  // We assume happy path for session validation unless getAdminSession is refactored for testability.

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 200 with time series data on a valid request', async () => {
    const mockData = [{ date: new Date(), value: 10 }];
    mockFetchCreatorTimeSeriesData.mockResolvedValue(mockData);

    const query = {
      metric: 'post_count',
      period: 'monthly',
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2023-01-31T23:59:59.999Z',
    };
    const req = createMockRequest(validCreatorId, query);
    const response = await GET(req, { params: { creatorId: validCreatorId } });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockData.map(d => ({...d, date: d.date.toISOString() }))); // Dates are stringified in JSON
    expect(fetchCreatorTimeSeriesData).toHaveBeenCalledWith({
      creatorId: validCreatorId,
      metric: 'post_count',
      period: 'monthly',
      dateRange: {
        startDate: new Date(query.startDate),
        endDate: new Date(query.endDate),
      },
    });
  });

  it('should return 400 if creatorId is invalid', async () => {
    const invalidId = 'invalid-object-id';
    const req = createMockRequest(invalidId, { metric: 'post_count', period: 'monthly', startDate: '2023-01-01T00:00:00Z', endDate: '2023-01-31T00:00:00Z'});
    const response = await GET(req, { params: { creatorId: invalidId } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('creatorId: Invalid MongoDB ObjectId for creatorId');
  });

  it('should return 400 if metric is missing', async () => {
    const req = createMockRequest(validCreatorId, { period: 'monthly', startDate: '2023-01-01T00:00:00Z', endDate: '2023-01-31T00:00:00Z'});
    const response = await GET(req, { params: { creatorId: validCreatorId } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('metric: Required');
  });

  it('should return 400 if period is invalid', async () => {
    const req = createMockRequest(validCreatorId, { metric: 'post_count', period: 'yearly', startDate: '2023-01-01T00:00:00Z', endDate: '2023-01-31T00:00:00Z'});
    const response = await GET(req, { params: { creatorId: validCreatorId } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain("period: Invalid enum value. Expected 'monthly' | 'weekly', received 'yearly'");
  });

  it('should return 400 if startDate is invalid date format', async () => {
    const req = createMockRequest(validCreatorId, { metric: 'post_count', period: 'monthly', startDate: 'not-a-date', endDate: '2023-01-31T00:00:00Z'});
    const response = await GET(req, { params: { creatorId: validCreatorId } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('startDate: Invalid datetime string');
  });

  it('should return 400 if endDate is missing', async () => {
    const req = createMockRequest(validCreatorId, { metric: 'post_count', period: 'monthly', startDate: '2023-01-01T00:00:00Z'});
    const response = await GET(req, { params: { creatorId: validCreatorId } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('endDate: Required');
  });

  it('should return 400 if startDate is after endDate', async () => {
    const req = createMockRequest(validCreatorId, {
      metric: 'post_count',
      period: 'monthly',
      startDate: '2023-02-01T00:00:00Z',
      endDate: '2023-01-01T00:00:00Z'
    });
    const response = await GET(req, { params: { creatorId: validCreatorId } });
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('endDate: startDate cannot be after endDate.'); // Zod refine path
  });

  // 401 Test (conceptual, due to hardcoded getAdminSession in route)
  /*
  it('should return 401 if admin session is invalid', async () => {
    console.warn("Skipping 401 test for time-series route due to getAdminSession hardcoding.");
    // const req = createMockRequest(validCreatorId, {}, false); // if isAdmin flag worked
    // const response = await GET(req, { params: { creatorId: validCreatorId } });
    // expect(response.status).toBe(401);
  });
  */

  it('should return 500 if service function throws a DatabaseError', async () => {
    mockFetchCreatorTimeSeriesData.mockRejectedValue(new DatabaseError('DB connection failed'));
    const query = { metric: 'post_count', period: 'monthly', startDate: '2023-01-01T00:00:00Z', endDate: '2023-01-31T00:00:00Z'};
    const req = createMockRequest(validCreatorId, query);
    const response = await GET(req, { params: { creatorId: validCreatorId } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erro de banco de dados: DB connection failed');
  });

  it('should return 400 if service function throws specific known error (e.g. Invalid creatorId format from service)', async () => {
    // This tests if the service itself throws an error that the API should map to 400
    // The Zod validation for creatorId in the API route should catch most malformed IDs first.
    // However, if the service had its own deeper validation that Zod didn't cover:
    mockFetchCreatorTimeSeriesData.mockRejectedValue(new Error('Invalid creatorId format.'));
    const query = { metric: 'post_count', period: 'monthly', startDate: '2023-01-01T00:00:00Z', endDate: '2023-01-31T00:00:00Z'};
    const req = createMockRequest(validCreatorId, query); // validCreatorId here, but service mock rejects
    const response = await GET(req, { params: { creatorId: validCreatorId } });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Erro na requisição: Invalid creatorId format.');
  });

  it('should return 500 for unexpected service error', async () => {
    mockFetchCreatorTimeSeriesData.mockRejectedValue(new Error('Unexpected service failure'));
    const query = { metric: 'post_count', period: 'monthly', startDate: '2023-01-01T00:00:00Z', endDate: '2023-01-31T00:00:00Z'};
    const req = createMockRequest(validCreatorId, query);
    const response = await GET(req, { params: { creatorId: validCreatorId } });
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Ocorreu um erro interno no servidor.');
  });
});
