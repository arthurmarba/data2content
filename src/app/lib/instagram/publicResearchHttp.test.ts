/** @jest-environment node */
import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { getPublicInstagramCreator } from '@/app/lib/mcp/publicInstagramResearch';
import { checkRateLimitStrict } from '@/utils/rateLimit';
import { handlePublicResearchPost } from './publicResearchHttp';
jest.mock('next-auth', () => ({ __esModule: true, default: jest.fn(() => jest.fn()), getServerSession: jest.fn() }));
jest.mock('@/app/api/auth/[...nextauth]/route', () => ({ authOptions: {} }));
jest.mock('./marketplace', () => ({ marketplaceOrigin: () => 'https://data2content.ai' }));
jest.mock('@/utils/rateLimit', () => ({ checkRateLimitStrict: jest.fn() }));
jest.mock('@/app/lib/instagram/db/userActions', () => ({ getInstagramConnectionDetails: jest.fn() }));
jest.mock('@/app/lib/mcp/publicInstagramResearch', () => ({ ...jest.requireActual('@/app/lib/mcp/publicInstagramResearch'), getPublicInstagramCreator: jest.fn() }));
function req(body: object, origin = 'https://data2content.ai') {
 return new NextRequest('https://data2content.ai/api/creator-research', { method: 'POST', headers: { origin }, body: JSON.stringify(body) });
}
beforeEach(() => { jest.clearAllMocks(); (getServerSession as jest.Mock).mockResolvedValue({ user: { id: 'dono' } }); (checkRateLimitStrict as jest.Mock).mockResolvedValue({ allowed: true, available: true }); });
it('consulta com a identidade da sessão e não exige plano', async () => {
 (getPublicInstagramCreator as jest.Mock).mockResolvedValue({ creator: { username: 'nike' } });
 const r = await handlePublicResearchPost(req({ action: 'lookup', username: '@Nike', postLimit: 3 }));
 expect(r.status).toBe(200); expect(r.headers.get('cache-control')).toBe('no-store');
 expect(getPublicInstagramCreator).toHaveBeenCalledWith('dono', { username: 'nike', postLimit: 3 });
});
it('recusa seleção de outra identidade', async () => {
 const r = await handlePublicResearchPost(req({ action: 'lookup', username: 'nike', owner: 'outro' }));
 expect(r.status).toBe(400); expect(getPublicInstagramCreator).not.toHaveBeenCalled();
});
it('recusa origem externa e sessão ausente', async () => {
 expect((await handlePublicResearchPost(req({ action: 'lookup', username: 'nike' }, 'https://outro.test'))).status).toBe(403);
 (getServerSession as jest.Mock).mockResolvedValue(null);
 expect((await handlePublicResearchPost(req({ action: 'lookup', username: 'nike' }))).status).toBe(401);
 expect(getPublicInstagramCreator).not.toHaveBeenCalled();
});
it('não chama Meta se a limitação estiver indisponível', async () => {
 (checkRateLimitStrict as jest.Mock).mockResolvedValue({ available: false, allowed: true });
 expect((await handlePublicResearchPost(req({ action: 'lookup', username: 'nike' }))).status).toBe(429);
 expect(getPublicInstagramCreator).not.toHaveBeenCalled();
});
it('oculta erros internos e tokens', async () => {
 (getPublicInstagramCreator as jest.Mock).mockRejectedValue(new Error('token-privado'));
 const r = await handlePublicResearchPost(req({ action: 'lookup', username: 'nike' }));
 expect(await r.text()).not.toContain('token-privado');
});
