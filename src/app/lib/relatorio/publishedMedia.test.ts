/** @jest-environment node */
import { freshPublishedMedia } from './publishedMedia';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
it('renova a foto e preserva ordem de imagens e capas dos vídeos do carrossel', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ media_type: 'CAROUSEL_ALBUM', children: { data: [
    { media_type: 'IMAGE', media_url: 'slide1' },
    { media_type: 'VIDEO', media_url: 'video', thumbnail_url: 'slide2' },
    { media_type: 'IMAGE', media_url: 'slide3' },
  ] } }) });
  expect((await freshPublishedMedia('post', 'token')).imageUrls).toEqual(['slide1', 'slide2', 'slide3']);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ media_type: 'IMAGE', media_url: 'foto-renovada' }) });
  expect((await freshPublishedMedia('post', 'token')).imageUrls).toEqual(['foto-renovada']);
});
it('propaga falha do Instagram para a recuperação, sem confundir com formato incompatível', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });
  await expect(freshPublishedMedia('post', 'token')).rejects.toThrow('Instagram HTTP 403');
});
it('busca as páginas restantes e conserva itens sem URL para não esconder lacunas', async () => {
  global.fetch = jest.fn()
    .mockResolvedValueOnce({ok:true,json:async()=>({media_type:'CAROUSEL_ALBUM',children:{data:[{media_type:'IMAGE',media_url:'a'}],paging:{next:'ignorado',cursors:{after:'cursor'}}}})})
    .mockResolvedValueOnce({ok:true,json:async()=>({data:[{media_type:'VIDEO',media_url:'video',thumbnail_url:'capa'},{media_type:'IMAGE'}]})});
  const media = await freshPublishedMedia('post', 'token');
  expect(media.items).toEqual([{position:1,type:'IMAGE',url:'a'},{position:2,type:'VIDEO',url:'video'},{position:3,type:'IMAGE',url:null}]);
  expect(global.fetch).toHaveBeenCalledTimes(2);
});
