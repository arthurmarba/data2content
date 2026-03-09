// @jest-environment node

import { NextRequest } from 'next/server';

import { GET } from './route';
import {
  fetchCoverageRegions,
  getCoverageRegionsFallback,
} from '@/app/lib/landing/coverageService';

jest.mock('@/app/lib/landing/coverageService', () => ({
  fetchCoverageRegions: jest.fn(),
  getCoverageRegionsFallback: jest.fn(() => []),
}));

jest.mock('@/app/lib/logger', () => ({
  logger: { error: jest.fn(), info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

const mockFetchCoverageRegions = fetchCoverageRegions as jest.Mock;
const mockGetCoverageRegionsFallback = getCoverageRegionsFallback as jest.Mock;

describe('GET /api/landing/coverage/geography', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns coverage regions when the service succeeds', async () => {
    mockFetchCoverageRegions.mockResolvedValue([{ code: 'SP', label: 'Sao Paulo' }]);

    const req = new NextRequest('http://localhost/api/landing/coverage/geography?limit=8');
    const res = await GET(req);
    const body = await res.json();

    expect(mockFetchCoverageRegions).toHaveBeenCalledWith({ limit: 8 });
    expect(body).toEqual({ items: [{ code: 'SP', label: 'Sao Paulo' }] });
    expect(res.status).toBe(200);
  });

  it('falls back to cached regions instead of returning 500', async () => {
    mockFetchCoverageRegions.mockRejectedValue(new Error('pool cleared'));
    mockGetCoverageRegionsFallback.mockReturnValue([{ code: 'RJ', label: 'Rio de Janeiro' }]);

    const req = new NextRequest('http://localhost/api/landing/coverage/geography');
    const res = await GET(req);
    const body = await res.json();

    expect(mockGetCoverageRegionsFallback).toHaveBeenCalledWith({ limit: 6 });
    expect(body).toEqual({ items: [{ code: 'RJ', label: 'Rio de Janeiro' }] });
    expect(res.status).toBe(200);
  });
});
