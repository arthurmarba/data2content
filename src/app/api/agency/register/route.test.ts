import { POST } from './route';
import { NextRequest } from 'next/server';
import AgencyModel from '@/app/models/Agency';
import UserModel from '@/app/models/User';

const mockAgencyFindOne = jest.fn();
const mockAgencyCreate = jest.fn();
const mockUserFindOne = jest.fn();
const mockUserCreate = jest.fn();

jest.mock('@/app/models/Agency', () => ({
  __esModule: true,
  default: { findOne: mockAgencyFindOne, create: mockAgencyCreate },
}));

jest.mock('@/app/models/User', () => ({
  __esModule: true,
  default: { findOne: mockUserFindOne, create: mockUserCreate },
}));

function makeRequest(body: any): NextRequest {
  return new NextRequest('http://localhost/api/agency/register', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/agency/register', () => {
  const validBody = {
    name: 'My Agency',
    contactEmail: 'contact@test.com',
    managerEmail: 'manager@test.com',
    managerPassword: 'secret123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUserFindOne.mockResolvedValue(null);
    mockAgencyFindOne.mockResolvedValue(null);
    mockAgencyCreate.mockResolvedValue({ _id: '1' });
    mockUserCreate.mockResolvedValue({ _id: '2' });
  });

  it('returns 200 on success', async () => {
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.agency).toBeDefined();
    expect(mockAgencyCreate).toHaveBeenCalled();
    expect(mockUserCreate).toHaveBeenCalled();
  });

  it('returns 409 if agency already exists', async () => {
    mockAgencyFindOne.mockResolvedValueOnce({ _id: 'existing' });
    const res = await POST(makeRequest(validBody));
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.error).toContain('agência');
    expect(mockAgencyCreate).not.toHaveBeenCalled();
    expect(mockUserCreate).not.toHaveBeenCalled();
  });
});
