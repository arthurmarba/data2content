/** @jest-environment node */

import { GET } from './route';

jest.mock('@vercel/og', () => {
  class MockImageResponse extends Response {
    constructor(_element: unknown, init: ResponseInit = {}) {
      const headers = new Headers(init.headers ?? {});
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'image/png');
      }
      super('mock-home-og-image', { ...init, headers, status: init.status ?? 200 });
    }
  }

  return { ImageResponse: MockImageResponse };
});

describe('GET /api/og/home', () => {
  it('retorna imagem OG com cabeçalho de cache', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
    expect(res.headers.get('cache-control')).toContain('max-age=300');
  });
});
