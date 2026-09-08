/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST } from './route';
import { enrichMapaSeedWithInstagram } from '@/app/lib/mapaSeed/enrichMapaSeedForUser';
jest.mock('@/app/lib/mapaSeed/enrichMapaSeedForUser', () => ({ enrichMapaSeedWithInstagram: jest.fn() }));
const secret = process.env.CRON_SECRET;
beforeEach(() => { jest.clearAllMocks(); process.env.CRON_SECRET = 'teste-fila'; });
afterAll(() => { if (secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret; });
const request = (body: unknown, authorized = true) => new NextRequest('http://localhost/api/worker/enrich-mapa-instagram', { method: 'POST', headers: authorized ? { 'x-cron-key': 'teste-fila' } : {}, body: JSON.stringify(body) });
it('rejeita chamada sem assinatura e corpo nulo', async () => {
  expect((await POST(request({}, false))).status).toBe(401);
  expect((await POST(request(null))).status).toBe(400);
  expect(enrichMapaSeedWithInstagram).not.toHaveBeenCalled();
});
it('não apresenta falha de enriquecimento como sucesso', async () => {
  (enrichMapaSeedWithInstagram as jest.Mock).mockResolvedValue('deferred');
  const response = await POST(request({ userId: '69e8f96564be9f1592a5ca6e' }));
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ ok: false, state: 'deferred' });
});
