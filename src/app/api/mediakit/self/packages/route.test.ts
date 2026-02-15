/** @jest-environment node */
import 'next/dist/server/node-polyfill-fetch';
import { NextRequest } from 'next/server';

jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/models/MediaKitPackage', () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
    deleteMany: jest.fn(),
    insertMany: jest.fn(),
  },
}));
jest.mock('@/app/lib/logger', () => ({ logger: { error: jest.fn() } }));

const { POST } = require('./route') as typeof import('./route');
const getServerSession = require('next-auth/next').getServerSession as jest.Mock;
const { connectToDatabase } = require('@/app/lib/mongoose');
const MediaKitPackage = require('@/app/models/MediaKitPackage').default;

const mockConnectToDatabase = connectToDatabase as jest.Mock;
const mockDeleteMany = (MediaKitPackage as any).deleteMany as jest.Mock;
const mockInsertMany = (MediaKitPackage as any).insertMany as jest.Mock;

const makePostRequest = (body: unknown) =>
  new NextRequest('http://localhost/api/mediakit/self/packages', {
    method: 'POST',
    headers: new Headers({ 'content-type': 'application/json' }),
    body: JSON.stringify(body),
  } as any);

describe('POST /api/mediakit/self/packages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: 'user-1' } });
    mockConnectToDatabase.mockResolvedValue(undefined);
    mockDeleteMany.mockResolvedValue({ acknowledged: true });
    mockInsertMany.mockResolvedValue([]);
  });

  it('returns 401 when not authenticated', async () => {
    getServerSession.mockResolvedValue(null);
    const res = await POST(makePostRequest({ packages: [] }));
    expect(res.status).toBe(401);
  });

  it('returns 400 and does not mutate when payload is invalid', async () => {
    const res = await POST(
      makePostRequest({
        packages: [
          {
            name: 'Pacote inválido',
            price: -12,
            currency: 'BRL',
            deliverables: [],
            type: 'manual',
          },
        ],
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('INVALID_PACKAGES_PAYLOAD');
    expect(body.error).toBe('Dados de pacotes inválidos.');
    expect(Array.isArray(body.details)).toBe(true);
    expect(mockDeleteMany).not.toHaveBeenCalled();
    expect(mockInsertMany).not.toHaveBeenCalled();
  });

  it('returns 400 when package array exceeds limit', async () => {
    const packages = Array.from({ length: 11 }).map((_, index) => ({
      name: `Pacote ${index + 1}`,
      price: 100 + index,
      currency: 'BRL',
      deliverables: ['1x Reel'],
      type: 'manual',
    }));

    const res = await POST(makePostRequest({ packages }));
    expect(res.status).toBe(400);
    expect(mockDeleteMany).not.toHaveBeenCalled();
  });

  it('persists valid packages and returns success payload', async () => {
    const res = await POST(
      makePostRequest({
        packages: [
          {
            name: 'Pacote Essencial',
            price: 1200,
            currency: 'BRL',
            deliverables: ['1x Reels', '3x Stories'],
            description: 'Combo inicial',
            type: 'manual',
          },
        ],
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true, count: 1 });
    expect(mockDeleteMany).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(mockInsertMany).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          userId: 'user-1',
          name: 'Pacote Essencial',
          price: 1200,
          currency: 'BRL',
          deliverables: ['1x Reels', '3x Stories'],
          type: 'manual',
          order: 0,
        }),
      ]),
    );
  });
});
