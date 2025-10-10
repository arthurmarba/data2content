// @jest-environment node
import { NextRequest } from 'next/server';
import { POST as chat } from './chat/route';
import { POST as dynamicCards } from './dynamicCards/route';
import { GET as insights } from './insights/route';
import { getToken } from 'next-auth/jwt';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock('jose', () => ({ jwtVerify: jest.fn() }));

const mockGetToken = getToken as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (DbUser as any).findById as jest.Mock;

function makeRequest(url: string) {
  return new NextRequest(url);
}

describe('plan guard for ai routes', () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
    mockConnect.mockResolvedValue(null);
    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ planStatus: 'inactive' }),
      }),
    });
  });

  it('blocks inactive plan for chat', async () => {
    const res = await chat(makeRequest('http://localhost/api/ai/chat'));
    expect(res.status).toBe(403);
  });

  it('blocks inactive plan for dynamicCards', async () => {
    const res = await dynamicCards(makeRequest('http://localhost/api/ai/dynamicCards'));
    expect(res.status).toBe(403);
  });

  it('blocks inactive plan for insights', async () => {
    const res = await insights(makeRequest('http://localhost/api/ai/insights?userId=u1'));
    expect(res.status).toBe(403);
  });
});
