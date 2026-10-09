/** @jest-environment node */
import { getPublicInstagramCreator } from '@/app/lib/mcp/publicInstagramResearch';
import { d2cCreatorRefs, graph, marketplaceToken } from './marketplace';
import { evaluateCampaignShortlist } from './marketplaceShortlist';

jest.mock('@/app/lib/mcp/publicInstagramResearch', () => {
  const actual = jest.requireActual('@/app/lib/mcp/publicInstagramResearch');
  return { ...actual, getPublicInstagramCreator: jest.fn() };
});
jest.mock('./marketplace', () => {
  const actual = jest.requireActual('./marketplace');
  return { ...actual, graph: jest.fn(), marketplaceToken: jest.fn(), requireMarketplaceAdmin: jest.fn(), throttle: jest.fn(), d2cCreatorRefs: jest.fn() };
});

const owner = '507f1f77bcf86cd799439011';
const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
const post = (n: number, days: number, views: number | null, likes: number, caption = 'dia comum') =>
  ({ id: `p${n}`, caption, url: `https://instagram.com/p/${n}/`, publishedAt: ago(days), format: views === null ? 'IMAGE' : 'VIDEO', likes, comments: 1, views });

beforeEach(() => {
  jest.clearAllMocks();
  (marketplaceToken as jest.Mock).mockResolvedValue({ accountId: '1', token: 't' });
  (d2cCreatorRefs as jest.Mock).mockResolvedValue(new Map([['ana', 'creator:64b7f1f77bcf86cd79943901']]));
  (graph as jest.Mock).mockImplementation(async (path: string) => {
    const query = new URLSearchParams(path.split('?')[1]);
    const username = query.get('username'); const fields = query.get('fields')!;
    if (username === 'fora') throw new Error('not found');
    const ok = (row: object) => ({ data: [{ id: '1', username, ...row }] });
    if (/top_cities/.test(fields)) return ok({ insights: { data: [{ name: 'creator_engaged_accounts', total_value: { value: 10,
      breakdowns: { results: [{ dimension_value: 'Recife, PE', percentage: 8 }, { dimension_value: 'São Paulo, SP', percentage: 5 }] } } }] } });
    if (/breakdown\(gender\)/.test(fields)) return ok({ insights: { data: [{ name: 'creator_engaged_accounts', total_value: { value: 10,
      breakdowns: { results: [{ dimension_value: 'Masculino', percentage: 10 }, { dimension_value: 'Feminino', percentage: 90 }] } } }] } });
    if (/breakdown\(age\)/.test(fields)) return ok({ insights: { data: [{ name: 'creator_engaged_accounts', total_value: { value: 10,
      breakdowns: { results: [{ dimension_value: '25 a 34', percentage: 50 }, { dimension_value: '18 a 24', percentage: 30 }] } } }] } });
    if (/branded_content_media/.test(fields)) return ok({ branded_content_media: { data: [] } });
    if (/partner/.test(fields)) throw new Error('reduce');
    return ok({ category: 'Mãe', badges: ['Ganchos fortes'], insights: { data: [
      { name: 'total_followers', total_value: { value: 10000 } }, { name: 'creator_engaged_accounts', total_value: { value: 4000 } },
      { name: 'creator_reach', total_value: { value: 50000 } }] } });
  });
});

test('junta Marketplace, desempenho recente contra o normal e publis de concorrentes, por @', async () => {
  (getPublicInstagramCreator as jest.Mock).mockImplementation(async (_: string, { username }: { username: string }) => ({
    creator: { followersCount: 9000, publishedMediaCount: 500 },
    summary: { meanPublicEngagementByFollowersPercent: 1.234 },
    posts: username === 'ana'
      ? [post(1, 2, 3000, 300), post(2, 5, 900, 90), post(3, 10, 1000, 100), post(4, 12, 1100, 110), post(5, 20, null, 100, '#publi da @sheinbrasil')]
      : [post(9, 3, null, 10)],
  }));
  const result = await evaluateCampaignShortlist(owner, { usernames: ['@Ana', 'fora'], competitorBrands: ['Shein'] });
  const [ana, fora] = result.creators as any[];
  expect(ana).toMatchObject({
    username: 'ana', status: 'ok', d2cCreatorRef: 'creator:64b7f1f77bcf86cd79943901', inMarketplace: true,
    followers: 10000, thisMonth: { reach: 50000, engagedAccounts: 4000, reachPerFollowerPercent: 500 },
    engagedAudienceThisMonth: { topCities: [{ segment: 'Recife, PE' }, { segment: 'São Paulo, SP' }], mainAgeRange: { segment: '25 a 34' }, femalePercent: 90 },
    competitorPublis: { count: 1, brands: ['Shein'] },
  });
  expect(ana.recent).toMatchObject({ postsRead: 5, medianViewsVideo: 1050, engagementPerFollowerPercent: 1.23 });
  expect(ana.recent.last7Days.posts).toBe(2);
  expect(ana.recent.last7Days.aboveUsual.map((p: any) => [p.url, p.viewsVsUsual])).toEqual([['https://instagram.com/p/1/', 2.9]]);
  // Fora do Marketplace, ainda avalia pelo que é público e declara a lacuna.
  expect(fora).toMatchObject({ status: 'ok', inMarketplace: false, thisMonth: null, followers: 9000 });
  expect(fora.gaps).toContain('fora do Marketplace ou sem resposta da Meta');
});

test('@ sem nenhuma fonte vira erro sem derrubar os demais', async () => {
  const { PublicInstagramResearchError } = jest.requireActual('@/app/lib/mcp/publicInstagramResearch');
  (getPublicInstagramCreator as jest.Mock).mockRejectedValue(new PublicInstagramResearchError('instagram_public_profile_unavailable', 'Conta pessoal.'));
  const result = await evaluateCampaignShortlist(owner, { usernames: ['fora', 'ana'] });
  expect((result.creators as any[]).map(c => [c.username, c.status])).toEqual([['fora', 'error'], ['ana', 'ok']]);
  expect((result.creators as any[])[1].recent).toBeNull();
});
