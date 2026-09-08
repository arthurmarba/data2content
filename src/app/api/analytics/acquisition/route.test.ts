/** @jest-environment node */
import { NextRequest } from 'next/server';
import { POST, DELETE } from './route';
import { receiveAcquisition, revokeAcquisition } from '@/app/lib/acquisition/journey';
import { getServerSession } from 'next-auth/next';
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn(() => ({})), getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('@/app/lib/acquisition/journey', () => ({ receiveAcquisition: jest.fn(), revokeAcquisition: jest.fn() }));
jest.mock('@/utils/rateLimit', () => ({ checkRateLimit: jest.fn().mockResolvedValue({ allowed: true }) }));
const req = (body: unknown, cookie = 'cookie_consent=granted', origin = 'https://data2content.ai') => new NextRequest('https://data2content.ai/api/analytics/acquisition', { method: 'POST', headers: { origin, cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => {
  jest.clearAllMocks();
  (getServerSession as jest.Mock).mockResolvedValue(null);
  (receiveAcquisition as jest.Mock).mockResolvedValue({ token: 'a'.repeat(64) });
});
it('não grava sem consentimento e não aceita origem externa', async () => {
  expect((await POST(req({ step: 'arrival' }, 'cookie_consent=denied'))).status).toBe(204);
  expect((await POST(req({ step: 'arrival' }, 'cookie_consent=granted', 'https://outro.example'))).status).toBe(403);
  expect(receiveAcquisition).not.toHaveBeenCalled();
});
it('não permite forjar pagamento nem identidade pelo corpo da requisição', async () => {
  expect((await POST(req({ step: 'first_payment' }))).status).toBe(400);
  expect((await POST(req({ step: 'sync', userId: 'outro' }))).status).toBe(400);
  expect(receiveAcquisition).not.toHaveBeenCalled();
});
it('emite cookie HttpOnly e usa apenas a identidade autenticada', async () => {
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'server-user' } });
  const response = await POST(req({ step: 'sync' }));
  expect(response.status).toBe(200);
  expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  expect(response.headers.get('set-cookie')).toContain('Secure');
  expect(receiveAcquisition).toHaveBeenCalledWith(expect.objectContaining({ userId: 'server-user' }));
});
it('permite revogar após a recusa e expira o cookie', async () => {
  const response = await DELETE(new NextRequest('https://data2content.ai/api/analytics/acquisition', { method: 'DELETE', headers: { origin: 'https://data2content.ai', cookie: 'cookie_consent=denied' } }));
  expect(response.status).toBe(204);
  expect(revokeAcquisition).toHaveBeenCalled();
  expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
});
it('aceita Host legítimo quando o Next normaliza o endereço interno', async () => {
  const response = await POST(new NextRequest('http://localhost:3137/api/analytics/acquisition', {
    method: 'POST', headers: { origin: 'http://127.0.0.1:3137', host: '127.0.0.1:3137', cookie: 'cookie_consent=denied' },
    body: JSON.stringify({ step: 'arrival' }),
  }));
  expect(response.status).toBe(204);
});
