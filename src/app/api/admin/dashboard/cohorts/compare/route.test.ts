import { POST } from './route';
import { NextRequest } from 'next/server';
import { fetchCohortComparison } from '@/app/lib/dataService/marketAnalysis/cohortsService';
import { logger } from '@/app/lib/logger';
import { DatabaseError } from '@/app/lib/errors';

jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/app/lib/dataService/marketAnalysis/cohortsService', () => ({
  fetchCohortComparison: jest.fn(),
}));

const mockFetchCohortComparison = fetchCohortComparison as jest.Mock;

describe('API Route: /api/admin/dashboard/cohorts/compare', () => {
  const createRequest = (body: any): NextRequest => {
    return new NextRequest('http://localhost/api/admin/dashboard/cohorts/compare', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseBody = {
    metric: 'total_interactions',
    cohorts: [
      { filterBy: 'planStatus', value: 'Pro' },
      { filterBy: 'planStatus', value: 'Free' },
    ],
  };

  it('passes dateRange to service and returns 200', async () => {
    const result = [{ cohortName: 'planStatus: Pro', avgMetricValue: 5, userCount: 1 }];
    mockFetchCohortComparison.mockResolvedValue(result);
    const body = {
      ...baseBody,
      dateRange: {
        startDate: '2023-01-01T00:00:00.000Z',
        endDate: '2023-01-31T23:59:59.999Z',
      },
    };
    const req = createRequest(body);
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual(result);
    expect(fetchCohortComparison).toHaveBeenCalledWith({
      metric: 'total_interactions',
      cohorts: baseBody.cohorts,
      dateRange: {
        startDate: new Date('2023-01-01T00:00:00.000Z'),
        endDate: new Date('2023-01-31T23:59:59.999Z'),
      },
    });
  });

  it('works without dateRange', async () => {
    mockFetchCohortComparison.mockResolvedValue([]);
    const req = createRequest(baseBody);
    const res = await POST(req);
    await res.json();

    expect(res.status).toBe(200);
    expect(fetchCohortComparison).toHaveBeenCalledWith({
      metric: 'total_interactions',
      cohorts: baseBody.cohorts,
    });
  });

  it('returns 500 on service DatabaseError', async () => {
    mockFetchCohortComparison.mockRejectedValue(new DatabaseError('db fail'));
    const req = createRequest(baseBody);
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.error).toBe('Erro de banco de dados: db fail');
  });

  it('returns 400 on validation error', async () => {
    const invalidBody = { ...baseBody, cohorts: [baseBody.cohorts[0]] };
    const req = createRequest(invalidBody);
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toContain('Corpo da requisição inválido');
  });
});
