/** @jest-environment node */
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { beginMarketplaceConnection, finishMarketplaceConnection, searchMarketplaceCreators } from './marketplace';
import { handleMarketplaceCallback, handleMarketplacePost } from './marketplaceHttp';
jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn(() => jest.fn()), getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('./marketplace', () => ({
  marketplaceOrigin: () => 'https://data2content.ai',
  beginMarketplaceConnection: jest.fn(), finishMarketplaceConnection: jest.fn(),
  searchMarketplaceCreators: jest.fn(), marketplaceStatus: jest.fn(), disconnectMarketplace: jest.fn(),
}));
beforeEach(() => { jest.clearAllMocks(); (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'dono' } }); });
test('recusa origem externa antes de iniciar OAuth ou consultar', async () => {
  const result = await handleMarketplacePost(new NextRequest('https://data2content.ai/api/admin/creator-marketplace', { method: 'POST', headers: { origin: 'https://outro.example' }, body: JSON.stringify({ action: 'connect' }) }));
  expect(result.status).toBe(400); expect(beginMarketplaceConnection).not.toHaveBeenCalled(); expect(searchMarketplaceCreators).not.toHaveBeenCalled();
});
test('sem sessão não inicia conexão', async () => {
  (getServerSession as jest.Mock).mockResolvedValue(null);
  const result = await handleMarketplacePost(new NextRequest('https://data2content.ai/api/admin/creator-marketplace', { method: 'POST', headers: { origin: 'https://data2content.ai' }, body: JSON.stringify({ action: 'connect' }) }));
  expect(result.status).toBe(403); expect(beginMarketplaceConnection).not.toHaveBeenCalled();
});
test('a identidade vem da sessão e o estado fica em cookie restrito', async () => {
  (beginMarketplaceConnection as jest.Mock).mockResolvedValue({ url: 'https://www.facebook.com/dialog/oauth', state: 'nonce' });
  const result = await handleMarketplacePost(new NextRequest('https://data2content.ai/api/admin/creator-marketplace', { method: 'POST', headers: { origin: 'https://data2content.ai' }, body: JSON.stringify({ action: 'connect', actorUserId: 'invasor' }) }));
  expect(beginMarketplaceConnection).toHaveBeenCalledWith('dono');
  expect(result.cookies.get('d2c-marketplace-state')).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/api/admin/creator-marketplace/callback' });
  expect(await result.json()).not.toHaveProperty('state');
});
test('callback não devolve código ou erro bruto no redirecionamento', async () => {
  (finishMarketplaceConnection as jest.Mock).mockRejectedValue(new Error('credencial sigilosa'));
  const result = await handleMarketplaceCallback(new NextRequest('https://data2content.ai/api/admin/creator-marketplace/callback?code=segredo&state=estado', { headers: { cookie: 'd2c-marketplace-state=estado' } }));
  expect(finishMarketplaceConnection).toHaveBeenCalledWith('dono', 'segredo', 'estado', 'estado');
  expect(result.headers.get('location')).toBe('https://data2content.ai/admin/creator-marketplace?connection=marketplace_unavailable');
  expect(result.cookies.get('d2c-marketplace-state')?.maxAge).toBe(0);
});
