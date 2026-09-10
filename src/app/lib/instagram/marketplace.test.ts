/** @jest-environment node */
import Connection from '@/app/models/InstagramMarketplaceConnection';
import User from '@/app/models/User';
import { getCreatorResearchAccess } from './creatorResearchAccess';
import { checkRateLimitStrict } from '@/utils/rateLimit';
import { finishMarketplaceConnection, MARKETPLACE_SCOPES, marketplaceSearchSchema, openMarketplaceToken, searchMarketplaceCreators, sealMarketplaceToken } from './marketplace';

jest.mock('@/app/models/InstagramMarketplaceConnection', () => ({ __esModule: true, default: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() } }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn() } }));
jest.mock('./creatorResearchAccess', () => ({ getCreatorResearchAccess: jest.fn() }));
jest.mock('@/utils/rateLimit', () => ({ checkRateLimitStrict: jest.fn() }));
jest.mock('@/app/lib/mongoose', () => ({ connectToDatabase: jest.fn() }));
const owner = '507f1f77bcf86cd799439011';
const originalFetch = global.fetch;
const originalSecret = process.env.NEXTAUTH_SECRET;
beforeEach(() => {
  jest.clearAllMocks(); process.env.NEXTAUTH_SECRET = 'segredo-exclusivo-do-teste';
  (getCreatorResearchAccess as jest.Mock).mockResolvedValue('admin');
  (checkRateLimitStrict as jest.Mock).mockResolvedValue({ available: true, allowed: true });
  global.fetch = jest.fn();
});
afterAll(() => { global.fetch = originalFetch; if (originalSecret === undefined) delete process.env.NEXTAUTH_SECRET; else process.env.NEXTAUTH_SECRET = originalSecret; });
test('recusa cidade, campos desconhecidos e intervalo invertido', () => {
  expect(marketplaceSearchSchema.safeParse({ city: 'Rio' }).success).toBe(false);
  expect(marketplaceSearchSchema.safeParse({ query: 'receitas', similar_to_creators: ['teste'] }).success).toBe(false);
  expect(marketplaceSearchSchema.safeParse({ minFollowers: 50000, maxFollowers: 10000 }).success).toBe(false);
  expect(marketplaceSearchSchema.safeParse({ minFollowers: 12000 }).success).toBe(false);
});
test('criptografia vincula a credencial ao dono e detecta adulteração', () => {
  const sealed = sealMarketplaceToken('credencial-secreta', owner);
  expect(sealed).not.toContain('credencial-secreta');
  expect(openMarketplaceToken(sealed, owner)).toBe('credencial-secreta');
  expect(() => openMarketplaceToken(sealed, 'outro')).toThrow();
  expect(() => openMarketplaceToken(`${sealed[0] === 'A' ? 'B' : 'A'}${sealed.slice(1)}`, owner)).toThrow();
});
test('recusa usuário sem autorização antes de consultar a conexão', async () => {
  (getCreatorResearchAccess as jest.Mock).mockResolvedValue(null);
  await expect(searchMarketplaceCreators(owner, {})).rejects.toMatchObject({ code: 'admin_required' });
  expect(Connection.findOne).not.toHaveBeenCalled(); expect(global.fetch).not.toHaveBeenCalled();
});
test('falha fechada se limite de consultas não estiver disponível', async () => {
  (checkRateLimitStrict as jest.Mock).mockResolvedValue({ available: false, allowed: false });
  await expect(searchMarketplaceCreators(owner, {})).rejects.toMatchObject({ code: 'marketplace_rate_limited' });
  expect(global.fetch).not.toHaveBeenCalled();
});
test('callback exige cookie, estado consumível e não troca código reutilizado', async () => {
  const state = 'a'.repeat(64);
  await expect(finishMarketplaceConnection(owner, 'code', state, 'b'.repeat(64))).rejects.toMatchObject({ code: 'marketplace_invalid_state' });
  expect(Connection.findOneAndUpdate).not.toHaveBeenCalled();
  (Connection.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
  await expect(finishMarketplaceConnection(owner, 'code', state, state)).rejects.toMatchObject({ code: 'marketplace_invalid_state' });
  expect(global.fetch).not.toHaveBeenCalled();
});
function connected() {
  (Connection.findOne as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue({ sealedToken: sealMarketplaceToken('token-pagina', owner), accountId: '123456', expiresAt: new Date(Date.now() + 60000) }) }) });
}
test('retorna apenas campos permitidos, marca teste e não expõe paginação credenciada', async () => {
  connected();
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: '789', username: 'teste', biography: 'texto', email: 'privado', access_token: 'token-pagina' }], paging: { next: 'https://graph.facebook.com?access_token=token-pagina' } }) });
  const result = await searchMarketplaceCreators(owner, { query: 'receitas', interests: ['FOOD_AND_DRINK'] });
  expect(result.dataMode).toBe('test'); expect(result.coverage.hasMore).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/token-pagina|privado|access_token/);
  const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).not.toContain('token-pagina'); expect(options.headers.Authorization).toBe('Bearer token-pagina');
  expect(Connection.findOne).toHaveBeenCalledWith({ owner });
});
test('erro do provedor não vaza credencial nem mensagem bruta', async () => {
  connected();
  (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 403, json: async () => ({ error: { code: 200, message: 'segredo token-pagina' } }) });
  await expect(searchMarketplaceCreators(owner, {})).rejects.toMatchObject({ code: 'marketplace_permission_required' });
});

test('callback grava somente a credencial criptografada da Página vinculada ao dono', async () => {
  const previousId = process.env.FACEBOOK_CLIENT_ID; const previousSecret = process.env.FACEBOOK_CLIENT_SECRET;
  process.env.FACEBOOK_CLIENT_ID = 'app'; process.env.FACEBOOK_CLIENT_SECRET = 'segredo-app';
  try {
    (Connection.findOneAndUpdate as jest.Mock).mockResolvedValue({ owner });
    (User.findById as jest.Mock).mockReturnValue({ select: () => ({ lean: async () => ({ instagramAccountId: '123' }) }) });
    const responses = [
      { access_token: 'token-usuario', expires_in: 3600 },
      { data: MARKETPLACE_SCOPES.map(permission => ({ permission, status: 'granted' })) },
      { data: [ { name: 'Outra página', access_token: 'token-outro', instagram_business_account: { id: '456' } },
        { name: 'Página própria', access_token: 'token-proprio', instagram_business_account: { id: '123' } } ] },
    ];
    (global.fetch as jest.Mock).mockImplementation(async () => ({ ok: true, json: async () => responses.shift() }));
    await finishMarketplaceConnection(owner, 'code', 'a'.repeat(64), 'a'.repeat(64));
    const [filter, update] = (Connection.updateOne as jest.Mock).mock.calls[0];
    expect(filter).toEqual({ owner }); expect(update.$set.accountId).toBe('123');
    expect(JSON.stringify(update)).not.toMatch(/token-proprio|token-usuario|token-outro/);
    expect(openMarketplaceToken(update.$set.sealedToken, owner)).toBe('token-proprio');
  } finally {
    if (previousId === undefined) delete process.env.FACEBOOK_CLIENT_ID; else process.env.FACEBOOK_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.FACEBOOK_CLIENT_SECRET; else process.env.FACEBOOK_CLIENT_SECRET = previousSecret;
  }
});
