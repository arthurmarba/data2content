/** @jest-environment node */
import { getPublicInstagramCreator } from '@/app/lib/mcp/publicInstagramResearch';
import { graph, marketplaceToken } from './marketplace';
import { findCreatorPublis } from './marketplacePublis';

jest.mock('@/app/lib/mcp/publicInstagramResearch', () => {
  const actual = jest.requireActual('@/app/lib/mcp/publicInstagramResearch');
  return { ...actual, getPublicInstagramCreator: jest.fn() };
});
jest.mock('./marketplace', () => ({
  graph: jest.fn(), marketplaceToken: jest.fn(), requireMarketplaceAdmin: jest.fn(), throttle: jest.fn(),
}));

const owner = '507f1f77bcf86cd799439011';
const day = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const post = (n: number, caption: string, ago: number) => ({ id: `p${n}`, caption, url: `https://instagram.com/p/${n}/`, publishedAt: day(ago), likes: 10, comments: 1, views: null });

beforeEach(() => {
  jest.clearAllMocks();
  (marketplaceToken as jest.Mock).mockResolvedValue({ accountId: '1', token: 't' });
  (graph as jest.Mock).mockImplementation(async (path: string) => {
    const fields = new URLSearchParams(path.split('?')[1]).get('fields')!;
    if (/branded_content_media/.test(fields)) return { data: [{ username: 'ana', branded_content_media: { data: [
      { creation_time: day(5), permalink: 'https://instagram.com/p/b1/', caption: 'Look novo com a @sheinbrasil 💗', product_type: 'REELS' },
      { creation_time: day(200), permalink: 'https://instagram.com/p/b2/', caption: 'antigo' }] } }] };
    throw new Error('reduce the amount of data');
  });
});

test('separa publi marcada, campanha sem marcação e menção, só dentro do período e com a marca procurada', async () => {
  (getPublicInstagramCreator as jest.Mock).mockImplementation(async (_: string, { username }: { username: string }) => ({
    creator: { followersCount: 1000, publishedMediaCount: 300 },
    posts: username === 'ana' ? [
      post(1, 'publi | Meu verão com a @sheinbrasil, cupom ANA10', 3),
      post(2, 'Usei o cupom ANA15 na @renner, corre pro site', 10),
      post(3, 'vestido @shein, bolsa @arezzo', 20),
      post(4, '#publi do @nubank', 30),
      post(5, 'Dia de praia com a família', 40),
      post(6, '#publi da @shein no ano passado', 120),
    ] : [post(7, 'sem nada de marca', 2)],
  }));
  const result = await findCreatorPublis(owner, { usernames: ['@Ana', 'bia'], brands: ['Shein'], sinceDays: 60 });
  const ana = result.creators.find((c: any) => c.username === 'ana');
  expect(ana.publis.map((p: any) => [p.kind, p.brandsMatched])).toEqual([
    ['marcada', ['Shein']], ['mencao_da_marca', ['Shein']], ['marcada', []]]);
  expect(ana.counts).toEqual({ marcada: 2, possivelSemMarcacao: 0, mencaoDaMarca: 1, comMarcaProcurada: 2 });
  expect(ana.periodFullyCovered).toBe(true);
  // Parcerias falharam na Meta (null), conteúdo de marca veio e respeita o período.
  expect(ana.marketplace.pastPartnersLastYear).toBeNull();
  expect(ana.marketplace.paidPartnershipPosts).toEqual([expect.objectContaining({ url: 'https://instagram.com/p/b1/', brandsMatched: ['Shein'] })]);
  expect(result.summary).toEqual({ creatorsWithBrandMention: ['ana'] });
  expect(result.creators.map((c: any) => c.username)).toEqual(['ana', 'bia']);
});

test('sem marcas, devolve publis marcadas e campanhas claras, e avisa quando 50 posts não cobrem o período', async () => {
  (getPublicInstagramCreator as jest.Mock).mockResolvedValue({
    creator: { followersCount: 1000, publishedMediaCount: 900 },
    posts: [post(1, 'Usei o cupom ANA15 na @renner, corre pro site', 2), post(2, 'Olha meu cachorro', 4)],
  });
  const result = await findCreatorPublis(owner, { usernames: ['ana'], sinceDays: 30 });
  const ana = result.creators[0];
  expect(ana.publis.map((p: any) => [p.kind, p.mentions])).toEqual([['possivel_sem_marcacao', ['renner']]]);
  expect(ana.periodFullyCovered).toBe(false);
  expect(result.summary).toBeNull();
});

test('um @ com erro não derruba os outros e o Marketplace é opcional', async () => {
  (marketplaceToken as jest.Mock).mockRejectedValue(new Error('sem conexão'));
  const { PublicInstagramResearchError } = jest.requireActual('@/app/lib/mcp/publicInstagramResearch');
  (getPublicInstagramCreator as jest.Mock)
    .mockRejectedValueOnce(new PublicInstagramResearchError('instagram_public_profile_unavailable', 'Conta pessoal.'))
    .mockResolvedValueOnce({ creator: { followersCount: 1, publishedMediaCount: 1 }, posts: [post(1, '#publi @marca', 1)] });
  const result = await findCreatorPublis(owner, { usernames: ['pessoal', 'ok'] });
  expect(result.creators.map((c: any) => [c.username, c.status])).toEqual([['pessoal', 'error'], ['ok', 'ok']]);
  expect(result.creators[1].marketplace).toBeNull();
  expect(graph).not.toHaveBeenCalled();
});
