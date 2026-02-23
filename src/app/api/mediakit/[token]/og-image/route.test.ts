/** @jest-environment node */
import 'next/dist/server/node-polyfill-fetch';
import { NextRequest } from 'next/server';

jest.mock('@vercel/og', () => {
  class MockImageResponse extends Response {
    constructor(_element: unknown, init: ResponseInit = {}) {
      const headers = new Headers(init.headers ?? {});
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'image/png');
      }
      super('mock-image', { ...init, headers, status: init.status ?? 200 });
    }
  }

  return { ImageResponse: MockImageResponse };
});

jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
jest.mock('@/app/lib/mediakit/slugService', () => ({ resolveMediaKitToken: jest.fn() }));
jest.mock('@/app/models/User', () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));
jest.mock('@/app/models/AccountInsight', () => ({
  __esModule: true,
  default: { findOne: jest.fn() },
}));

const { GET } = require('./route') as typeof import('./route');
const { connectToDatabase } = require('@/app/lib/mongoose');
const { resolveMediaKitToken } = require('@/app/lib/mediakit/slugService');
const UserModel = require('@/app/models/User').default;

const mockConnectToDatabase = connectToDatabase as jest.Mock;
const mockResolveMediaKitToken = resolveMediaKitToken as jest.Mock;
const mockUserFindById = UserModel.findById as jest.Mock;

describe('GET /api/mediakit/[token]/og-image', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(undefined);
  });

  it('retorna imagem OG com cache-control para um mídia kit válido', async () => {
    mockResolveMediaKitToken.mockResolvedValue({ userId: 'user-1', canonicalSlug: 'clara-oficial' });
    mockUserFindById.mockReturnValue({
      select: () => ({
        lean: () =>
          Promise.resolve({
            name: 'Clara',
            mediaKitDisplayName: 'Clara Lemkova',
            username: 'claralemkova_',
            followers_count: 564000,
            media_count: 197,
            biography: 'Veja as fotos e vídeos da Clara.',
          }),
      }),
    });

    const req = new NextRequest('http://localhost/api/mediakit/clara-oficial/og-image');
    const res = await GET(req, { params: { token: 'clara-oficial' } });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(res.headers.get('cache-control')).toContain('max-age=300');
  });

  it('retorna fallback OG quando token não é resolvido', async () => {
    mockResolveMediaKitToken.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/mediakit/invalido/og-image');
    const res = await GET(req, { params: { token: 'invalido' } });

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(mockUserFindById).not.toHaveBeenCalled();
  });
});
