import { GET } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { findGlobalPostsByCriteria } from '@/app/lib/dataService/marketAnalysisService';
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
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
  findGlobalPostsByCriteria: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;

const mockFindGlobalPostsByCriteria = findGlobalPostsByCriteria as jest.Mock;

describe('API Route: /api/admin/dashboard/posts', () => {

  const createMockRequest = (searchParams: Record<string, string> = {}): NextRequest => {
    const url = new URL(`http://localhost/api/admin/dashboard/posts?${new URLSearchParams(searchParams)}`);
    return new NextRequest(url.toString());
    // Session mocking considerations are similar to previous tests.
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue({ user: { role: 'admin' } });
  });

  it('should return 200 with posts on a valid request with default params', async () => {
    const mockResponseData = { posts: [{ content: 'Test Post' }], totalPosts: 1, page: 1, limit: 10 };
    mockFindGlobalPostsByCriteria.mockResolvedValue(mockResponseData);

    const req = createMockRequest(); // Uses default params from Zod schema in route
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockResponseData);
    expect(findGlobalPostsByCriteria).toHaveBeenCalledWith({
      page: 1,
      limit: 10,
      sortBy: 'stats.total_interactions', // Default from schema
      sortOrder: 'desc', // Default from schema
      // other optional filters would be undefined
    });
  });

  it('should pass all valid query parameters to service function', async () => {
    mockFindGlobalPostsByCriteria.mockResolvedValue({ posts: [], totalPosts: 0 });
    const startDate = '2023-01-01T00:00:00.000Z';
    const endDate = '2023-01-31T23:59:59.999Z';
    const query = {
      page: '3',
      limit: '15',
      sortBy: 'postDate',
      sortOrder: 'asc',
      context: 'Gaming',
      proposal: 'Livestream',
      format: 'Video',
      tone: 'Humor',
      references: 'Cultura Pop',
      minInteractions: '100',
      startDate,
      endDate,
    };
    const req = createMockRequest(query);
    await GET(req);

    expect(findGlobalPostsByCriteria).toHaveBeenCalledWith({
      page: 3,
      limit: 15,
      sortBy: 'postDate',
      sortOrder: 'asc',
      context: 'Gaming',
      proposal: 'Livestream',
      format: 'Video',
      tone: 'Humor',
      references: 'Cultura Pop',
      minInteractions: 100,
      dateRange: {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      },
    });
  });

  it('should return 400 on invalid query parameter type (e.g., minInteractions not a number)', async () => {
    const req = createMockRequest({ minInteractions: 'not-a-number' });
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain('Parâmetros de consulta inválidos:');
    expect(body.error).toContain('minInteractions');
  });

  it('should return 400 if startDate is after endDate for posts route', async () => {
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
    mockGetServerSession.mockResolvedValueOnce({ user: { role: 'user' } });
    const req = createMockRequest();
    const response = await GET(req);
    expect(response.status).toBe(401);
  });

  it('should return 500 if service function throws an error', async () => {
    mockFindGlobalPostsByCriteria.mockRejectedValue(new Error('Service error Posts'));
    const req = createMockRequest();
    const response = await GET(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Ocorreu um erro interno no servidor.');
  });

  it('should handle optional filters not being present', async () => {
    mockFindGlobalPostsByCriteria.mockResolvedValue({ posts: [], totalPosts: 0 });
    const req = createMockRequest({ page: '1', limit: '5' }); // Only pagination
    await GET(req);

    expect(findGlobalPostsByCriteria).toHaveBeenCalledWith({
      page: 1,
      limit: 5,
      sortBy: 'stats.total_interactions', // Default
      sortOrder: 'desc', // Default
      // context, proposal, format, minInteractions, dateRange should be undefined or not present
    });
    // To be more precise, check that undefined optional fields are not passed or handled as undefined by the service
    const calledArgs = mockFindGlobalPostsByCriteria.mock.calls[0][0];
    expect(calledArgs.context).toBeUndefined();
    expect(calledArgs.proposal).toBeUndefined();
    expect(calledArgs.format).toBeUndefined();
    expect(calledArgs.tone).toBeUndefined();
    expect(calledArgs.references).toBeUndefined();
    expect(calledArgs.minInteractions).toBeUndefined();
    expect(calledArgs.dateRange).toBeUndefined();
  });
});
