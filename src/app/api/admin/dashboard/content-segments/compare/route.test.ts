import { POST } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { fetchSegmentPerformanceData } from '@/app/lib/dataService/marketAnalysisService';
import { logger } from '@/app/lib/logger';
import { getAdminSession } from '@/lib/getAdminSession';

jest.mock('@/lib/getAdminSession', () => ({
  getAdminSession: jest.fn(),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));
import { DatabaseError } from '@/app/lib/errors'; // Import DatabaseError

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
  fetchSegmentPerformanceData: jest.fn(),
}));

const mockGetAdminSession = getAdminSession as jest.Mock;

const mockFetchSegmentPerformanceData = fetchSegmentPerformanceData as jest.Mock;

describe('API Route: /api/admin/dashboard/content-segments/compare', () => {

  const createMockRequest = (body: any): NextRequest => {
    return new NextRequest('http://localhost/api/admin/dashboard/content-segments/compare', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
  });

  const validDateRange = {
    startDate: new Date('2023-01-01T00:00:00.000Z').toISOString(),
    endDate: new Date('2023-01-31T23:59:59.999Z').toISOString(),
  };

  const validSegmentCriteria1: App.Lib.DataService.MarketAnalysisService.ISegmentDefinition = { format: 'Video' };
  const validSegmentCriteria2: App.Lib.DataService.MarketAnalysisService.ISegmentDefinition = { context: 'Tech' };

  const mockPerformanceResult1 = { postCount: 10, avgEngagementRate: 0.1, avgLikes: 10, avgShares: 1, avgComments: 1 };
  const mockPerformanceResult2 = { postCount: 20, avgEngagementRate: 0.2, avgLikes: 20, avgShares: 2, avgComments: 2 };


  it('should return 200 with comparison data on a valid request', async () => {
    mockFetchSegmentPerformanceData
      .mockResolvedValueOnce(mockPerformanceResult1)
      .mockResolvedValueOnce(mockPerformanceResult2);

    const requestBody = {
      dateRange: validDateRange,
      segments: [
        { name: 'Video Segment', criteria: validSegmentCriteria1 },
        { name: 'Tech Segment', criteria: validSegmentCriteria2 },
      ],
    };
    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ name: 'Video Segment', performance: mockPerformanceResult1, criteria: validSegmentCriteria1 });
    expect(body[1]).toMatchObject({ name: 'Tech Segment', performance: mockPerformanceResult2, criteria: validSegmentCriteria2 });

    expect(fetchSegmentPerformanceData).toHaveBeenCalledTimes(2);
    expect(fetchSegmentPerformanceData).toHaveBeenCalledWith({
      criteria: validSegmentCriteria1,
      dateRange: { startDate: new Date(validDateRange.startDate), endDate: new Date(validDateRange.endDate) },
    });
    expect(fetchSegmentPerformanceData).toHaveBeenCalledWith({
      criteria: validSegmentCriteria2,
      dateRange: { startDate: new Date(validDateRange.startDate), endDate: new Date(validDateRange.endDate) },
    });
  });

  it('should generate segment name if not provided', async () => {
    mockFetchSegmentPerformanceData.mockResolvedValueOnce(mockPerformanceResult1);
    const requestBody = {
      dateRange: validDateRange,
      segments: [{ criteria: { format: 'Reel', context: 'Humor' } }], // No name
    };
    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe('Formato: Reel, Contexto: Humor'); // Check generated name
    expect(body[0].performance).toEqual(mockPerformanceResult1);
  });


  // --- Zod Validation Tests ---
  it('should return 400 if dateRange is missing', async () => {
    const req = createMockRequest({ segments: [{ criteria: validSegmentCriteria1 }] });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('dateRange: Required');
  });

  it('should return 400 if segments array is empty', async () => {
    const req = createMockRequest({ dateRange: validDateRange, segments: [] });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('segments: At least one segment is required for comparison.');
  });

  it('should return 400 if segments array exceeds max limit', async () => {
    const tooManySegments = Array(6).fill({ criteria: validSegmentCriteria1 });
    const req = createMockRequest({ dateRange: validDateRange, segments: tooManySegments });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('segments: Cannot compare more than 5 segments at a time.');
  });

  it('should return 400 if startDate is after endDate', async () => {
    const req = createMockRequest({
      dateRange: { startDate: validDateRange.endDate, endDate: validDateRange.startDate },
      segments: [{ criteria: validSegmentCriteria1 }]
    });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('dateRange.endDate: startDate cannot be after endDate.');
  });

  it('should return 400 if a segment has no criteria', async () => {
    const req = createMockRequest({
      dateRange: validDateRange,
      segments: [{ name: 'Empty Segment', criteria: {} }] // Empty criteria object
    });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('segments.0.criteria: At least one criterion (format, proposal, or context) must be provided for a segment definition.');
  });

   it('should return 400 for invalid date format in dateRange', async () => {
    const req = createMockRequest({
      dateRange: { startDate: 'not-a-date', endDate: validDateRange.endDate },
      segments: [{ criteria: validSegmentCriteria1 }]
    });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('dateRange.startDate: Invalid startDate format. Expected ISO datetime string.');
  });

  // --- Error Handling & Session Tests ---
  it('should return 401 if admin session is invalid', async () => {
    mockGetAdminSession.mockResolvedValueOnce({ user: { role: 'user' } });
    const requestBody = { dateRange: validDateRange, segments: [{ criteria: validSegmentCriteria1 }] };
    const req = createMockRequest(requestBody);
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should return 500 if fetchSegmentPerformanceData throws a DatabaseError', async () => {
    mockFetchSegmentPerformanceData.mockRejectedValue(new DatabaseError('DB query failed for segment'));
    const requestBody = { dateRange: validDateRange, segments: [{ criteria: validSegmentCriteria1 }] };
    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erro de banco de dados: DB query failed for segment');
  });

  it('should return 500 for unexpected service error', async () => {
    mockFetchSegmentPerformanceData.mockRejectedValue(new Error('Unexpected segment processing failure'));
    const requestBody = { dateRange: validDateRange, segments: [{ criteria: validSegmentCriteria1 }] };
    const req = createMockRequest(requestBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Ocorreu um erro interno no servidor.');
  });
});

// Helper type for easier casting in tests if needed, mirroring the ISegmentDefinition from service
declare global {
  namespace App.Lib.DataService.MarketAnalysisService { // Adjust if your global namespace is different
    export interface ISegmentDefinition {
      format?: string;
      proposal?: string;
      context?: string;
    }
  }
}
