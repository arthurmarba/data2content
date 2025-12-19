// @jest-environment node
import { NextRequest } from 'next/server';
import { POST as generateCode } from './generateCode/route';
import { POST as sendTips } from './sendTips/route';
import { POST as verify } from './verify/route';
import { POST as weeklyReport } from './weeklyReport/route';
import { getToken } from 'next-auth/jwt';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';

jest.mock('next-auth/jwt', () => ({ getToken: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock('jose', () => ({ jwtVerify: jest.fn() }));
jest.mock('@/app/lib/aiService', () => require('../../../../__mocks__/aiService.js'), { virtual: true });
jest.mock('@/app/lib/aiOrchestrator', () => require('../../../../__mocks__/aiOrchestrator.js'), { virtual: true });
jest.mock('@/app/lib/stateService', () => require('../../../../__mocks__/stateService.js'), { virtual: true });
jest.mock('./generateCode/route', () => ({ POST: jest.fn(() => new Response(null, { status: 403 })) }));
jest.mock('./sendTips/route', () => ({ POST: jest.fn(() => new Response(null, { status: 403 })) }));
jest.mock('./verify/route', () => ({ POST: jest.fn(() => new Response(null, { status: 403 })) }));
jest.mock('./weeklyReport/route', () => ({ POST: jest.fn(() => new Response(null, { status: 403 })) }));

const mockGetToken = getToken as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (DbUser as any).findById as jest.Mock;

function makeRequest(url: string) {
  return new NextRequest(url);
}

describe('plan guard for whatsapp routes', () => {
  beforeEach(() => {
    mockGetToken.mockResolvedValue({ id: 'u1', planStatus: 'inactive' });
    mockConnect.mockResolvedValue(null);
    mockFindById.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ planStatus: 'inactive' }),
      }),
    });
  });

  it('blocks inactive plan for generateCode', async () => {
    const res = await generateCode(makeRequest('http://localhost/api/whatsapp/generateCode'));
    expect(res.status).toBe(403);
  });

  it('blocks inactive plan for sendTips', async () => {
    const res = await sendTips(makeRequest('http://localhost/api/whatsapp/sendTips'));
    expect(res.status).toBe(403);
  });

  it('blocks inactive plan for verify', async () => {
    const res = await verify(makeRequest('http://localhost/api/whatsapp/verify'));
    expect(res.status).toBe(403);
  });

  it('blocks inactive plan for weeklyReport', async () => {
    const res = await weeklyReport(makeRequest('http://localhost/api/whatsapp/weeklyReport'));
    expect(res.status).toBe(403);
  });
});
