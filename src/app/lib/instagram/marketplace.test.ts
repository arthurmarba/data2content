/** @jest-environment node */
import Connection from '@/app/models/InstagramMarketplaceConnection';
import User from '@/app/models/User';
import { getCreatorResearchAccess } from './creatorResearchAccess';
import { checkRateLimitStrict } from '@/utils/rateLimit';
import { finishMarketplaceConnection, MARKETPLACE_SCOPES, marketplaceSearchSchema, openMarketplaceToken, searchMarketplaceCreators, sealMarketplaceToken } from './marketplace';
import { getMarketplaceCreatorDetails, getMarketplaceCreatorProfile } from './marketplaceCreator';

jest.mock('@/app/models/InstagramMarketplaceConnection', () => ({ __esModule: true, default: { findOne: jest.fn(), findOneAndUpdate: jest.fn(), updateOne: jest.fn() } }));
jest.mock('@/app/models/User', () => ({ __esModule: true, default: { findById: jest.fn(), find: jest.fn() } }));
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
  expect(marketplaceSearchSchema.safeParse({ minEngagedAccounts: 50000, maxEngagedAccounts: 2000 }).success).toBe(false);
  expect(marketplaceSearchSchema.safeParse({ audienceAgeBuckets: ['30_to_40'] }).success).toBe(false);
  expect(marketplaceSearchSchema.safeParse({ audienceGender: 'other' }).success).toBe(false);
  expect(marketplaceSearchSchema.safeParse({ query: 'maternidade', similarTo: ['ana'] }).success).toBe(false);
  expect(marketplaceSearchSchema.safeParse({ query: 'maternidade', recommendation: 'high_ad_performance' }).success).toBe(false);
  expect(marketplaceSearchSchema.safeParse({ limit: 101 }).success).toBe(false);
  expect(marketplaceSearchSchema.safeParse({ languages: ['pt-BR'] }).success).toBe(false);
  expect(marketplaceSearchSchema.parse({ similarTo: ['@Amamaecegonha_'] })).toMatchObject({ similarTo: ['Amamaecegonha_'], sortBy: 'engaged_accounts', limit: 20, countries: ['BR'] });
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
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: '789', username: 'teste', biography: 'This is mocked creator data. To access real creator data, proceed through app review.', email: 'privado', access_token: 'token-pagina' }], paging: { next: 'https://graph.facebook.com?access_token=token-pagina' } }) });
  const result = await searchMarketplaceCreators(owner, { query: 'receitas', interests: ['FOOD_AND_DRINK'] });
  expect(result.dataMode).toBe('test'); expect(result.coverage.hasMore).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/token-pagina|privado|access_token/);
  const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
  expect(url).not.toContain('token-pagina'); expect(options.headers.Authorization).toBe('Bearer token-pagina');
  expect(Connection.findOne).toHaveBeenCalledWith({ owner });
});
test('envia nicho, alcance e audiência no formato da Meta e lê as métricas do criador', async () => {
  connected();
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: '1', username: 'real', biography: 'Receitas de casa', country: 'BR',
    insights: { data: [
      { name: 'total_followers', time_range: 'lifetime', total_value: { value: 20000 } },
      { name: 'creator_reach', time_range: 'this_month', total_value: { value: 5000 } },
      { name: 'creator_engaged_accounts', time_range: 'this_month', total_value: { value: 1200 } },
      { name: 'reels_interaction_rate', time_range: 'last_90_days', total_value: { value: 4.5 } },
    ] } }] }) });
  const result = await searchMarketplaceCreators(owner, { interests: ['FOOD_AND_DRINK'], minFollowers: 10000, maxFollowers: 100000, minEngagedAccounts: 2000,
    audienceCountries: ['BR'], audienceAgeBuckets: ['25_to_34'], audienceGender: 'female' });
  const url = new URL((global.fetch as jest.Mock).mock.calls[0][0]);
  expect(url.searchParams.get('creator_interests')).toBe('["FOOD_AND_DRINK"]');
  expect(url.searchParams.get('creator_min_engaged_accounts')).toBe('2000');
  expect(url.searchParams.get('major_audience_countries')).toBe('["BR"]');
  expect(url.searchParams.get('major_audience_age_bucket')).toBe('["25_to_34"]');
  expect(url.searchParams.get('major_audience_gender')).toBe('["female"]');
  expect(url.searchParams.get('fields')).toContain('insights');
  expect(result.dataMode).toBe('live');
  expect(result.creators[0].metrics).toMatchObject({ followers: 20000, reachThisMonth: 5000, engagedAccountsThisMonth: 1200, reelsInteractionRate90d: 4.5, reachPerFollowerPercent: 25 });
});
test('detalhe consulta o @ em partes separadas e devolve posts recentes sem link inseguro', async () => {
  connected();
  (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ data: [{ id: '1', username: 'real', has_brand_partnership_experience: true, past_brand_partnership_partners: ['Marca'],
    recent_media: { data: [{ id: 'm1', media_type: 'VIDEO', product_type: 'REELS', permalink: 'https://www.instagram.com/reel/x/', creation_time: '2026-09-20T10:00:00+0000', caption: 'Bolo' },
      { id: 'm2', permalink: 'javascript:alert(1)' }] } }] }) });
  const result = await getMarketplaceCreatorDetails(owner, '@real');
  const urls = (global.fetch as jest.Mock).mock.calls.map(([u]) => new URL(u));
  expect(urls.length).toBeGreaterThan(3);
  expect(urls.every(u => u.searchParams.get('username') === 'real' && u.searchParams.get('creator_countries') === null)).toBe(true);
  // Nenhuma consulta junta posts com parcerias: com dados reais a Meta recusa o pedido inteiro.
  expect(urls.some(u => /recent_media/.test(u.searchParams.get('fields')!) && /partner/.test(u.searchParams.get('fields')!))).toBe(false);
  expect(result.creator).toMatchObject({ brandPartnershipExperience: true, pastBrandPartners: ['Marca'] });
  expect(result.recentMedia.map(m => m.url)).toEqual(['https://www.instagram.com/reel/x/', null]);
  expect(result.coverage).toEqual({ partnershipsAvailable: true, recentMediaAvailable: true });
  await expect(getMarketplaceCreatorDetails(owner, 'nome com espaço')).rejects.toBeDefined();
});
test('detalhe sobrevive quando a Meta recusa as parcerias', async () => {
  connected();
  (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
    const fields = new URL(url).searchParams.get('fields')!;
    if (/partner/.test(fields)) return { ok: false, status: 500, json: async () => ({ error: { code: 1, message: 'Please reduce the amount of data' } }) };
    if (/recent_media/.test(fields)) return { ok: true, json: async () => ({ data: [{ id: '1', username: 'real', recent_media: { data: [{ id: 'm1', product_type: 'FEED' }] } }] }) };
    return { ok: true, json: async () => ({ data: [{ id: '1', username: 'real', biography: 'Receitas', insights: { data: [{ name: 'total_followers', total_value: { value: 900 } }] } }] }) };
  });
  const result = await getMarketplaceCreatorDetails(owner, 'real');
  expect(result.dataMode).toBe('live');
  expect(result.creator).toMatchObject({ username: 'real', brandPartnershipExperience: null, pastBrandPartners: [] });
  expect(result.creator.metrics.followers).toBe(900);
  expect(result.recentMedia).toHaveLength(1);
  expect(result.coverage).toEqual({ partnershipsAvailable: false, recentMediaAvailable: true });
});
test('detalhe falha quando a Meta recusa o perfil', async () => {
  connected();
  (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
    const fields = new URL(url).searchParams.get('fields')!;
    if (/insights/.test(fields)) return { ok: false, status: 500, json: async () => ({ error: { code: 1, message: 'x' } }) };
    return { ok: true, json: async () => ({ data: [{ id: '1', username: 'real' }] }) };
  });
  await expect(getMarketplaceCreatorDetails(owner, 'real')).rejects.toMatchObject({ code: 'marketplace_query_rejected' });
});
test('busca percorre páginas até o limite, ordena por contas engajadas e marca quem já está na D2C', async () => {
  connected();
  (User.find as jest.Mock).mockReturnValue({ collation: () => ({ select: () => ({ lean: async () => [{ _id: '64b7f1f77bcf86cd79943901', username: 'Bia' }] }) }) });
  const creator = (n: number, engaged: number) => ({ id: String(n), username: n === 2 ? 'bia' : `c${n}`, biography: 'Mãe de dois',
    insights: { data: [{ name: 'creator_engaged_accounts', total_value: { value: engaged } }, { name: 'total_followers', total_value: { value: 1000 } }] } });
  const pages = [
    { data: Array.from({ length: 25 }, (_, i) => creator(i + 1, i === 1 ? 9000 : 100)), paging: { cursors: { after: 'CUR1' }, next: 'https://graph.facebook.com/x?access_token=segredo' } },
    { data: [creator(51, 5000), creator(52, 10)], paging: { cursors: { after: 'CUR2' } } },
  ];
  (global.fetch as jest.Mock).mockImplementation(async () => ({ ok: true, json: async () => pages.shift() }));
  const result = await searchMarketplaceCreators(owner, { query: 'maternidade', limit: 35, creatorGender: 'female', languages: ['pt'], hasPublicEmail: true });
  const [first, second] = (global.fetch as jest.Mock).mock.calls.map(([u]) => new URL(u));
  expect(first.searchParams.get('limit')).toBe('25');
  expect(first.searchParams.get('creator_gender')).toBe('["female"]');
  expect(first.searchParams.get('creator_language')).toBe('["pt"]');
  expect(first.searchParams.get('has_public_contact_email')).toBe('true');
  expect(second.searchParams.get('after')).toBe('CUR1');
  expect(second.searchParams.get('limit')).toBe('10');
  expect(result.coverage).toMatchObject({ pagesFetched: 2, returned: 27, hasMore: false, nextCursor: null });
  expect(result.creators.slice(0, 2).map(c => [c.rank, c.username, c.metrics.engagedAccountsThisMonth])).toEqual([[1, 'bia', 9000], [2, 'c51', 5000]]);
  expect(result.creators[0]).toMatchObject({ metaPosition: 2, d2cCreatorRef: 'creator:64b7f1f77bcf86cd79943901' });
  expect(JSON.stringify(result)).not.toContain('segredo');
});
test('página recusada pelo tamanho é tentada de novo com a metade', async () => {
  connected();
  (User.find as jest.Mock).mockReturnValue({ collation: () => ({ select: () => ({ lean: async () => [] }) }) });
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: 1, message: 'Please reduce the amount of data' } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '1', username: 'a' }] }) });
  const result = await searchMarketplaceCreators(owner, { query: 'x', limit: 20 });
  const sizes = (global.fetch as jest.Mock).mock.calls.map(([u]) => new URL(u).searchParams.get('limit'));
  expect(sizes).toEqual(['20', '10']);
  expect(result.coverage).toMatchObject({ pagesFetched: 1, returned: 1 });
});
test('busca devolve o que já tem quando uma página seguinte falha', async () => {
  connected();
  (User.find as jest.Mock).mockReturnValue({ collation: () => ({ select: () => ({ lean: async () => [] }) }) });
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ id: '1', username: 'a' }], paging: { cursors: { after: 'C1' }, next: 'x' } }) })
    .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: 1, message: 'reduce' } }) });
  const result = await searchMarketplaceCreators(owner, { query: 'x', limit: 100, sortBy: 'meta' });
  expect(result.coverage).toMatchObject({ pagesFetched: 1, returned: 1 });
  expect(result.coverage.partial).toMatch(/página seguinte/);
});
test('ficha junta janelas, público engajado e posts, e lista o que a Meta não entregou', async () => {
  connected();
  (User.find as jest.Mock).mockReturnValue({ collation: () => ({ select: () => ({ lean: async () => [] }) }) });
  (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
    const fields = new URL(url).searchParams.get('fields')!;
    const ok = (row: object) => ({ ok: true, json: async () => ({ data: [{ id: '1', username: 'real', ...row }] }) });
    if (/breakdown\(top_cities\)/.test(fields)) return ok({ insights: { data: [{ name: 'creator_engaged_accounts', total_value: { value: 200,
      breakdowns: { dimension_key: 'top_cities', results: [{ dimension_value: 'São Paulo, SP', percentage: 4.1 }, { dimension_value: 'Recife, PE', percentage: 6.5 }] } } }] } });
    if (/breakdown\(follow_type\)/.test(fields)) return ok({ insights: { data: [{ name: 'creator_engaged_accounts', total_value: { value: 200,
      breakdowns: { dimension_key: 'follow_type', results: [{ dimension_value: 'follower_count', value: 50 }, { dimension_value: 'non_follower_count', value: 150 }] } } }] } });
    if (/time_range\(this_week\)/.test(fields)) return ok({ insights: { data: [{ name: 'creator_reach', total_value: { value: 777 } }] } });
    if (/partner/.test(fields) || /breakdown/.test(fields)) return { ok: false, status: 500, json: async () => ({ error: { code: 1, message: 'reduce' } }) };
    if (/recent_media\.limit\(12\)/.test(fields)) return ok({ recent_media: { data: [{ id: 'm1', insights: { data: [{ name: 'views', total_value: { value: 900 } }] } }] } });
    if (/recent_media/.test(fields)) return ok({ recent_media: { data: [{ id: 'm1', product_type: 'REELS', permalink: 'https://instagram.com/reel/1/' }, { id: 'm2', product_type: 'FEED' }] } });
    if (/branded_content_media|time_range\(last_14_days\)/.test(fields)) return { ok: false, status: 500, json: async () => ({ error: { code: 1 } }) };
    return ok({ biography: 'Receitas', email: 'contato@real.com', insights: { data: [{ name: 'total_followers', total_value: { value: 1000 } }, { name: 'creator_reach', total_value: { value: 3000 } }] } });
  });
  const result = await getMarketplaceCreatorProfile(owner, 'real');
  expect(result.creator).toMatchObject({ username: 'real', email: 'contato@real.com', d2cCreatorRef: null });
  expect(result.metrics).toMatchObject({ followers: 1000, thisWeek: { reach: 777 }, last14Days: null, thisMonth: { reach: 3000 } });
  expect(result.engagedAudienceThisMonth.topCities).toEqual([{ segment: 'Recife, PE', value: null, sharePercent: 6.5 }, { segment: 'São Paulo, SP', value: null, sharePercent: 4.1 }]);
  expect(result.engagedAudienceThisMonth.followType).toEqual([{ segment: 'não seguidores', value: 150, sharePercent: 75 }, { segment: 'seguidores', value: 50, sharePercent: 25 }]);
  expect(result.engagedAudienceThisMonth.age).toBeNull();
  expect(result.recentPosts.map(p => [p.type, p.views])).toEqual([['REELS', 900], ['FEED', null]]);
  expect(result.coverage.missing).toEqual(expect.arrayContaining(['marcas anteriores', 'idade do público engajado', 'números de 14 dias', 'conteúdo de marca']));
  expect(result.coverage.missing).not.toContain('cidades do público engajado');
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
      { access_token: 'token-usuario-longo', expires_in: 5183944 },
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
    // A Página é lida com a credencial de longa duração, e a conexão deixa de expirar em uma hora.
    expect((global.fetch as jest.Mock).mock.calls[3][1].headers.Authorization).toBe('Bearer token-usuario-longo');
    expect(update.$set.expiresAt.getTime() - Date.now()).toBeGreaterThan(50 * 86400000);
  } finally {
    if (previousId === undefined) delete process.env.FACEBOOK_CLIENT_ID; else process.env.FACEBOOK_CLIENT_ID = previousId;
    if (previousSecret === undefined) delete process.env.FACEBOOK_CLIENT_SECRET; else process.env.FACEBOOK_CLIENT_SECRET = previousSecret;
  }
});
