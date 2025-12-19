import { NextRequest } from 'next/server';
import { Types } from 'mongoose';
import { getCreatorProfile } from '@/app/lib/dataService/marketAnalysis/profilesService';
import { logger } from '@/app/lib/logger';
import { DatabaseError } from '@/app/lib/errors';
import { getServerSession } from 'next-auth/next';
import UserModel from '@/app/models/User';

jest.mock('next-auth/next', () => ({
  getServerSession: jest.fn(),
}));

jest.mock('@/app/api/auth/[...nextauth]/route', () => ({
  authOptions: {},
}));

jest.mock('@/app/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('@/app/models/User', () => ({
  find: jest.fn(),
}));

jest.mock('@/app/lib/dataService/marketAnalysis/profilesService', () => ({
  getCreatorProfile: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;
const mockGetCreatorProfile = getCreatorProfile as jest.Mock;
const mockFind = UserModel.find as jest.Mock;
let POST: any;

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
    mockGetServerSession.mockResolvedValue({ user: { role: 'admin' } });
    mockFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          { name: 'Creator 1' },
          { name: 'Creator 2' },
        ]),
      }),
    });
    mockGetCreatorProfile.mockResolvedValue({ creatorId: 'id', creatorName: 'Creator 1' });
    POST = require('./route').POST;
  });

  it('should return 200 with comparison data on a valid request', async () => {
    const mockProfiles = [{ creatorId: new Types.ObjectId().toString(), creatorName: 'Creator 1' }];
    mockGetCreatorProfile.mockResolvedValueOnce(mockProfiles[0]).mockResolvedValueOnce(mockProfiles[0]);

    const validBody = { creatorIds: [new Types.ObjectId().toString(), new Types.ObjectId().toString()] };
    const req = createMockRequest(validBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([mockProfiles[0], mockProfiles[0]]);
    expect(getCreatorProfile).toHaveBeenCalled();
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
    expect(body.error).toContain('creatorIds: O array creatorIds não pode estar vazio.');
  });

  it('should return 400 if creatorIds array exceeds max limit', async () => {
    const tooManyIds = Array(6).fill(null).map(() => new Types.ObjectId().toString());
    const req = createMockRequest({ creatorIds: tooManyIds });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('creatorIds: Não é possível comparar mais de 5 criadores de uma vez.');
  });

  it('should return 400 if creatorIds array contains invalid ObjectId strings', async () => {
    const req = createMockRequest({ creatorIds: [new Types.ObjectId().toString(), 'invalid-id'] });
    const response = await POST(req);
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.error).toContain('creatorIds.1: Formato de Creator ID inválido.');
  });

  it('should return 401 if admin session is invalid', async () => {
    mockGetServerSession.mockResolvedValueOnce({ user: { role: 'user' } });
    const validBody = { creatorIds: [new Types.ObjectId().toString()] };
    const req = createMockRequest(validBody);
    const response = await POST(req);
    expect(response.status).toBe(401);
  });

  it('should return 500 if service function throws a DatabaseError', async () => {
    mockGetCreatorProfile.mockRejectedValue(new DatabaseError('DB query failed'));
    const validBody = { creatorIds: [new Types.ObjectId().toString()] };
    const req = createMockRequest(validBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Erro de base de dados: DB query failed');
  });

  it('should return 500 for unexpected service error', async () => {
    mockGetCreatorProfile.mockRejectedValue(new Error('Unexpected internal failure'));
    const validBody = { creatorIds: [new Types.ObjectId().toString()] };
    const req = createMockRequest(validBody);
    const response = await POST(req);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Ocorreu um erro interno no servidor.');
  });
});
