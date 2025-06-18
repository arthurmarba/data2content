import { POST } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { fetchTopMoversData } from '@/app/lib/dataService/marketAnalysisService';
import { logger } from '@/app/lib/logger';
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
  fetchTopMoversData: jest.fn(),
  // Need to also mock the types if they are used for Zod enums and not re-declared here
  // For this test, we'll re-declare minimal versions or trust Zod to handle enum values.
}));

const mockFetchTopMoversData = fetchTopMoversData as jest.Mock;

describe('API Route: /api/admin/dashboard/top-movers', () => {

  const createMockRequest = (body: any): NextRequest => {
    return new NextRequest('http://localhost/api/admin/dashboard/top-movers', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validPeriods = {
    previousPeriod: {
      startDate: new Date('2023-01-01T00:00:00.000Z').toISOString(),
      endDate: new Date('2023-01-31T23:59:59.999Z').toISOString()
    },
    currentPeriod: {
      startDate: new Date('2023-02-01T00:00:00.000Z').toISOString(),
      endDate: new Date('2023-02-28T23:59:59.999Z').toISOString()
    },
  };

  const validPayloadBase = {
    entityType: 'content',
    metric: 'cumulative_likes',
    ...validPeriods,
  };

  it('should return 200 with top movers data on a valid request', async () => {
    const mockResults = [{ entityId: 'post1', entityName: 'Post 1', previousValue: 10, currentValue: 20, absoluteChange: 10, percentageChange: 1 }];
    mockFetchTopMoversData.mockResolvedValue(mockResults);

    const req = createMockRequest(validPayloadBase);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockResults);
    expect(fetchTopMoversData).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'content',
      metric: 'cumulative_likes',
      previousPeriod: {
        startDate: new Date(validPeriods.previousPeriod.startDate),
        endDate: new Date(validPeriods.previousPeriod.endDate),
      },
      currentPeriod: {
        startDate: new Date(validPeriods.currentPeriod.startDate),
        endDate: new Date(validPeriods.currentPeriod.endDate),
      },
    }));
  });

  it('should pass optional parameters like topN, sortBy, contentFilters to service', async () => {
    mockFetchTopMoversData.mockResolvedValue([]);
    const payloadWithOptional = {
      ...validPayloadBase,
      topN: 5,
      sortBy: 'percentageChange_increase',
      contentFilters: { format: 'Video', context: 'Gaming' },
    };
    const req = createMockRequest(payloadWithOptional);
    await POST(req);

    expect(fetchTopMoversData).toHaveBeenCalledWith(expect.objectContaining({
      topN: 5,
      sortBy: 'percentageChange_increase',
      contentFilters: { format: 'Video', context: 'Gaming' },
    }));
  });

  it('should handle entityType "creator" without warning', async () => {
    mockFetchTopMoversData.mockResolvedValue([]);
    const creatorPayload = { ...validPayloadBase, entityType: 'creator' };
    const req = createMockRequest(creatorPayload);
    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(logger.warn).not.toHaveBeenCalled();
    expect(fetchTopMoversData).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'creator' }));
  });

  it('should pass valid creatorFilters to service for entityType "creator"', async () => {
    mockFetchTopMoversData.mockResolvedValue([]);
    const creatorFiltersPayload = {
      ...validPayloadBase,
      entityType: 'creator',
      creatorFilters: {
        planStatus: ['Pro', 'Active'],
        inferredExpertiseLevel: ['Avançado']
      }
    };
    const req = createMockRequest(creatorFiltersPayload);
    await POST(req);

    expect(fetchTopMoversData).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'creator',
      creatorFilters: {
        planStatus: ['Pro', 'Active'],
        inferredExpertiseLevel: ['Avançado']
      }
    }));
  });


  // --- Zod Validation Error Tests ---
  it('should return 400 if entityType is missing', async () => {
    const { entityType, ...payload } = validPayloadBase; // Remove entityType
    const req = createMockRequest(payload);
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('entityType: Required');
  });

  it('should return 400 if metric is invalid', async () => {
    const req = createMockRequest({ ...validPayloadBase, metric: 'invalid_metric' });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('metric: Invalid enum value.');
  });

  it('should return 400 if previousPeriod.endDate is not before currentPeriod.startDate', async () => {
    const overlappingPeriods = {
      previousPeriod: { startDate: '2023-01-01T00:00:00Z', endDate: '2023-02-05T00:00:00Z' },
      currentPeriod: { startDate: '2023-02-01T00:00:00Z', endDate: '2023-02-28T00:00:00Z' },
    };
    const req = createMockRequest({ ...validPayloadBase, ...overlappingPeriods });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('Previous period must end before the current period starts.');
  });

  it('should return 400 if currentPeriod.startDate is after currentPeriod.endDate', async () => {
    const invalidCurrentPeriod = {
      currentPeriod: { startDate: '2023-02-28T00:00:00Z', endDate: '2023-02-01T00:00:00Z' },
    };
    const req = createMockRequest({ ...validPayloadBase, ...invalidCurrentPeriod });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('currentPeriod.endDate: startDate in a period cannot be after its endDate.');
  });

  it('should return 400 for invalid topN value', async () => {
    const req = createMockRequest({ ...validPayloadBase, topN: 0 }); // topN must be positive
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('topN: Number must be greater than 0');
  });

  // --- Service & Auth Error Tests ---
  it('should return 500 if service function throws a DatabaseError', async () => {
    mockFetchTopMoversData.mockRejectedValue(new DatabaseError('Service DB Error'));
    const req = createMockRequest(validPayloadBase);
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe('Erro de banco de dados: Service DB Error');
  });

  it('should return 500 for an unexpected service error', async () => {
    mockFetchTopMoversData.mockRejectedValue(new Error('Unexpected service layer boom'));
    const req = createMockRequest(validPayloadBase);
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(500);
    expect(body.error).toBe('Ocorreu um erro interno no servidor.');
  });

  // Conceptual 401 test
  /*
  it('should return 401 if admin session is invalid', async () => {
    // Requires getAdminSession to be mockable within the route file itself
    console.warn("Skipping 401 test for top-movers route due to getAdminSession hardcoding.");
  });
  */
});
