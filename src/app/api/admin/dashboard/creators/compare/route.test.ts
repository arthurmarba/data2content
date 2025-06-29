import { POST } from './route'; // Adjust path as necessary
import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { fetchMultipleCreatorProfiles } from '@/app/lib/dataService/marketAnalysisService';
import { logger } from '@/app/lib/logger';
import { DatabaseError } from '@/app/lib/errors'; // Import DatabaseError
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
  fetchMultipleCreatorProfiles: jest.fn(),
}));

const mockGetAdminSession = getAdminSession as jest.Mock;

const mockFetchMultipleCreatorProfiles = fetchMultipleCreatorProfiles as jest.Mock;

describe('API Route: /api/admin/dashboard/creators/compare', () => {

  const createMockRequest = (body: any): NextRequest => {
    const req = new NextRequest('http://localhost/api/admin/dashboard/creators/compare', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    return req;
  };

  // Session mocking considerations: getAdminSession is hardcoded in the route.
  // We assume happy path for session validation for these tests.

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAdminSession.mockResolvedValue({ user: { role: 'admin' } });
  });

  it('should return 200 with comparison data on a valid request', async () => {
    const mockProfiles = [{ creatorId: new Types.ObjectId().toString(), creatorName: 'Creator 1' }];
    mockFetchMultipleCreatorProfiles.mockResolvedValue(mockProfiles);

    const validBody = { creatorIds: [new Types.ObjectId().toString(), new Types.ObjectId().toString()] };
    const req = createMockRequest(validBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(mockProfiles);
    expect(fetchMultipleCreatorProfiles).toHaveBeenCalledWith({ creatorIds: validBody.creatorIds });
  });

  it('should return 400 if creatorIds is missing', async () => {
    const req = createMockRequest({}); // Empty body
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('creatorIds: Required');
  });

  it('should return 400 if creatorIds is not an array', async () => {
    const req = createMockRequest({ creatorIds: 'not-an-array' });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('creatorIds: Expected array, received string');
  });

  it('should return 400 if creatorIds array is empty', async () => {
    const req = createMockRequest({ creatorIds: [] });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('creatorIds: creatorIds array cannot be empty.');
  });

  it('should return 400 if creatorIds array exceeds max limit', async () => {
    const tooManyIds = Array(6).fill(null).map(() => new Types.ObjectId().toString());
    const req = createMockRequest({ creatorIds: tooManyIds });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('creatorIds: Cannot compare more than 5 creators at a time.');
  });

  it('should return 400 if creatorIds array contains invalid ObjectId strings', async () => {
    const req = createMockRequest({ creatorIds: [new Types.ObjectId().toString(), 'invalid-id'] });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('creatorIds.1: Invalid Creator ID format provided in the array.');
  });

  it('should return 401 if admin session is invalid', async () => {
    mockGetAdminSession.mockResolvedValueOnce({ user: { role: 'user' } });
    const validBody = { creatorIds: [new Types.ObjectId().toString()] };
    const req = createMockRequest(validBody);
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should return 500 if service function throws a DatabaseError', async () => {
    mockFetchMultipleCreatorProfiles.mockRejectedValue(new DatabaseError('DB query failed'));
    const validBody = { creatorIds: [new Types.ObjectId().toString()] };
    const req = createMockRequest(validBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erro de banco de dados: DB query failed');
  });

  it('should return 500 for unexpected service error', async () => {
    mockFetchMultipleCreatorProfiles.mockRejectedValue(new Error('Unexpected internal failure'));
    const validBody = { creatorIds: [new Types.ObjectId().toString()] };
    const req = createMockRequest(validBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Ocorreu um erro interno no servidor.');
  });
});
