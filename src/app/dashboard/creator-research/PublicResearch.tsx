'use client';
import { useState } from 'react';
import { startInstagramReconnect } from '@/app/lib/instagram/client/startInstagramReconnect';

type Profile = {
  creator: { username: string; biography: string | null; followersCount: number | null; publishedMediaCount: number | null };
  posts: { id: string; caption: string | null; url: string | null; publishedAt: string | null; format: string | null; likes: number | null; comments: number | null; views: number | null }[];
  coverage: { returnedPosts: number };
};
const number = (value: number | null | undefined) => value == null ? 'Indisponível' : value.toLocaleString('pt-BR');
export default function PublicResearch() {
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  async function connect() {
    if (!consent || busy) return;
    setBusy(true); setMessage('');
    try { await startInstagramReconnect({ nextTarget: 'creator-research', publicResearch: true, source: 'creator_research' }); }
    catch { setMessage('Não foi possível iniciar a autorização. Tente novamente.'); setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-5 p-6">
    <a href="/dashboard" className="underline">Voltar para a D2C</a>
    <h1 className="text-2xl font-semibold">Pesquisa de criadores por @</h1>
    <p>Estude referências e possíveis parceiros usando os dados públicos de perfis profissionais do Instagram. Esta é a mesma consulta disponível no MCP da D2C.</p>
    <section className="space-y-3 rounded-lg border bg-white p-5">
      <h2 className="font-semibold">Autorizar sua conexão Instagram</h2>
      <p>A pesquisa usa sua própria conta profissional vinculada a uma Página do Facebook. A Meta pode exigir permissões adicionais ou aprovação do app.</p>
      <p>A autorização inclui leitura da Página vinculada (pages_read_engagement), além das permissões de identificação do Instagram, métricas, lista de Páginas e ativos da empresa. A D2C usa esses acessos para consultar; esta função não publica nem altera conteúdo.</p>
      <label className="flex gap-2"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Quero revisar na Meta as permissões necessárias à pesquisa por @.</label>
      <button disabled={busy || !consent} onClick={connect} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">Revisar autorização na Meta</button>
      <a className="ml-3 underline" href="/dashboard/instagram-connection">Gerenciar ou desconectar Instagram</a>
    </section>
    <form className="space-y-3 rounded-lg border bg-white p-5" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const data = new FormData(event.currentTarget);
      const usernames = String(data.get('usernames')).split(/[,\s]+/).filter(Boolean);
      setBusy(true); setMessage(''); setProfiles([]);
      try {
        if (usernames.length < 1 || usernames.length > 3) throw new Error('Informe de um a três @s.');
        const response = await fetch('/api/creator-research', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...(usernames.length === 1 ? { action: 'lookup', username: usernames[0] } : { action: 'compare', usernames }), postLimit: Number(data.get('limit')) }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Consulta indisponível.');
        if (result.creators) {
          setProfiles(result.creators.filter((entry: {data?: Profile}) => entry.data).map((entry: {data: Profile}) => entry.data));
          setMessage(result.creators.filter((entry: {error?: unknown}) => entry.error).map((entry: {username: string; error: {message: string}}) => `@${entry.username}: ${entry.error.message}`).join(' '));
        } else setProfiles([result]);
      } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível pesquisar.'); }
      finally { setBusy(false); }
    }}>
      <label className="block">Perfis profissionais (até três @s)<input name="usernames" maxLength={95} required placeholder="@perfil1, @perfil2" className="mt-1 block w-full rounded border p-2" /></label>
      <label className="block">Posts por perfil<input name="limit" type="number" defaultValue={3} min={1} max={50} required className="ml-3 rounded border p-2" /></label>
      <p className="text-sm">Até 50 posts por perfil. As amostras podem cobrir períodos diferentes. Alcance privado, demografia, salvamentos e compartilhamentos externos não estão disponíveis.</p>
      <button disabled={busy} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Aguarde…' : 'Pesquisar perfis públicos'}</button>
    </form>
    {message && <p role="status" className="rounded border p-4">{message}</p>}
    {profiles.map(profile => <section key={profile.creator.username} className="space-y-3 rounded-lg border bg-white p-5">
      <h2 className="text-xl font-semibold">@{profile.creator.username}</h2>
      <p>{profile.creator.biography || 'Biografia indisponível'}</p>
      <p>Seguidores: {number(profile.creator.followersCount)} · Publicações: {number(profile.creator.publishedMediaCount)} · Posts consultados: {profile.coverage.returnedPosts}</p>
      {profile.posts.map(post => <article key={post.id} className="space-y-2 border-t pt-3">
        <p>{post.format || 'Formato indisponível'} · {post.publishedAt || 'Data indisponível'}</p>
        <p className="whitespace-pre-wrap">{post.caption || 'Legenda indisponível'}</p>
        <p>Curtidas: {number(post.likes)} · Comentários: {number(post.comments)} · Visualizações: {number(post.views)}</p>
        {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="underline">Abrir publicação no Instagram</a>}
      </article>)}
    </section>)}
  </main>;
}
