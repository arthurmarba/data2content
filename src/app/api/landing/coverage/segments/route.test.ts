// @jest-environment node

import { NextRequest } from 'next/server';

import { GET } from './route';
import {
  fetchCoverageSegments,
  getCoverageSegmentsFallback,
} from '@/app/lib/landing/coverageService';

jest.mock('@/app/lib/landing/coverageService', () => ({
  fetchCoverageSegments: jest.fn(),
  getCoverageSegmentsFallback: jest.fn(() => []),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFetchCoverageSegments = fetchCoverageSegments as jest.Mock;
const mockGetCoverageSegmentsFallback = getCoverageSegmentsFallback as jest.Mock;

describe('GET /api/landing/coverage/segments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns coverage data when the service succeeds', async () => {
    mockFetchCoverageSegments.mockResolvedValue([{ id: 'beauty', label: 'Beauty' }]);

    const req = new NextRequest('http://localhost/api/landing/coverage/segments?limit=4');
    const res = await GET(req);
    const body = await res.json();

    expect(mockFetchCoverageSegments).toHaveBeenCalledWith({ limit: 4 });
    expect(body).toEqual({ items: [{ id: 'beauty', label: 'Beauty' }] });
    expect(res.status).toBe(200);
  });

  it('falls back to cached data instead of returning 500', async () => {
    mockFetchCoverageSegments.mockRejectedValue(new Error('tlsv1 alert internal error'));
    mockGetCoverageSegmentsFallback.mockReturnValue([{ id: 'fashion', label: 'Fashion' }]);

    const req = new NextRequest('http://localhost/api/landing/coverage/segments');
    const res = await GET(req);
    const body = await res.json();

    expect(mockGetCoverageSegmentsFallback).toHaveBeenCalledWith({ limit: 6 });
    expect(body).toEqual({ items: [{ id: 'fashion', label: 'Fashion' }] });
    expect(res.status).toBe(200);
  });
});
