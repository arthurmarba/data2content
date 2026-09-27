'use client';
import { useState } from 'react';
import { startInstagramReconnect } from '@/app/lib/instagram/client/startInstagramReconnect';
import type { ResearchLang } from './researchLang';

type Profile = {
  creator: { username: string; biography: string | null; followersCount: number | null; publishedMediaCount: number | null };
  posts: { id: string; caption: string | null; url: string | null; publishedAt: string | null; format: string | null; likes: number | null; comments: number | null; views: number | null }[];
  coverage: { returnedPosts: number };
};
const COPY = {
  pt: {
    back: 'Voltar para a D2C', title: 'Pesquisa de criadores por @',
    intro: 'Estude referências e possíveis parceiros usando os dados públicos de perfis profissionais do Instagram. Esta é a mesma consulta disponível no MCP da D2C.',
    authTitle: 'Autorizar sua conexão Instagram',
    auth1: 'A pesquisa usa sua própria conta profissional vinculada a uma Página do Facebook. A Meta pode exigir permissões adicionais ou aprovação do app.',
    auth2: 'A autorização inclui leitura da Página vinculada (pages_read_engagement), que a Meta exige para a consulta Business Discovery, além das permissões de identificação do Instagram, métricas, lista de Páginas e ativos da empresa. A D2C usa esses acessos para consultar; esta função não publica nem altera conteúdo.',
    consent: 'Quero revisar na Meta as permissões necessárias à pesquisa por @.', review: 'Revisar autorização na Meta', manage: 'Gerenciar ou desconectar Instagram',
    startFailed: 'Não foi possível iniciar a autorização. Tente novamente.',
    handles: 'Perfis profissionais (até três @s)', perProfile: 'Posts por perfil',
    note: 'Até 50 posts por perfil. As amostras podem cobrir períodos diferentes. Alcance privado, demografia, salvamentos e compartilhamentos externos não estão disponíveis.',
    search: 'Pesquisar perfis públicos', wait: 'Aguarde…', count: 'Informe de um a três @s.', unavailable: 'Consulta indisponível.', failed: 'Não foi possível pesquisar.',
    na: 'Indisponível', noBio: 'Biografia indisponível', followers: 'Seguidores', posts: 'Publicações', sampled: 'Posts consultados',
    noFormat: 'Formato indisponível', noDate: 'Data indisponível', noCaption: 'Legenda indisponível', likes: 'Curtidas', comments: 'Comentários', views: 'Visualizações', open: 'Abrir publicação no Instagram',
  },
  en: {
    back: 'Back to Data2Content', title: 'Creator research by @',
    intro: 'Study references and potential partners using public data from Instagram professional accounts. This is the same lookup available in the Data2Content MCP.',
    authTitle: 'Authorize your Instagram connection',
    auth1: 'The lookup runs through your own Instagram professional account, linked to a Facebook Page. Meta may require additional permissions or app approval.',
    auth2: 'The authorization includes reading the linked Page (pages_read_engagement), which Meta requires for the Business Discovery lookup, plus Instagram basic info, insights, the list of Pages and business assets. Data2Content only reads with these permissions; this feature never posts or changes content.',
    consent: 'I want to review on Meta the permissions required for the @ lookup.', review: 'Review authorization on Meta', manage: 'Manage or disconnect Instagram',
    startFailed: 'Could not start the authorization. Try again.',
    handles: 'Professional accounts (up to three @s)', perProfile: 'Posts per profile',
    note: 'Up to 50 posts per profile. Samples may cover different periods. Private reach, demographics, saves and shares of external accounts are not available.',
    search: 'Search public profiles', wait: 'Please wait…', count: 'Enter one to three @s.', unavailable: 'Lookup unavailable.', failed: 'The search failed.',
    na: 'Not available', noBio: 'Bio not available', followers: 'Followers', posts: 'Posts', sampled: 'Posts sampled',
    noFormat: 'Format not available', noDate: 'Date not available', noCaption: 'Caption not available', likes: 'Likes', comments: 'Comments', views: 'Views', open: 'Open post on Instagram',
  },
};
export default function PublicResearch({ lang = 'pt' }: { lang?: ResearchLang }) {
  const t = COPY[lang];
  const locale = lang === 'en' ? 'en-US' : 'pt-BR';
  const number = (value: number | null | undefined) => value == null ? t.na : value.toLocaleString(locale);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  async function connect() {
    if (!consent || busy) return;
    setBusy(true); setMessage('');
    try { await startInstagramReconnect({ nextTarget: 'creator-research', publicResearch: true, source: 'creator_research' }); }
    catch { setMessage(t.startFailed); setBusy(false); }
  }
  return <main id="research" className="mx-auto max-w-4xl space-y-5 p-6">
    <a href="/dashboard" className="underline">{t.back}</a>
    <h1 className="text-2xl font-semibold">{t.title}</h1>
    <p>{t.intro}</p>
    <section className="space-y-3 rounded-lg border bg-white p-5">
      <h2 className="font-semibold">{t.authTitle}</h2>
      <p>{t.auth1}</p>
      <p>{t.auth2}</p>
      <label className="flex gap-2"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t.consent}</label>
      <button disabled={busy || !consent} onClick={connect} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{t.review}</button>
      <a className="ml-3 underline" href="/dashboard/instagram-connection">{t.manage}</a>
    </section>
    <form className="space-y-3 rounded-lg border bg-white p-5" onSubmit={async event => {
      event.preventDefault(); if (busy) return;
      const data = new FormData(event.currentTarget);
      const usernames = String(data.get('usernames')).split(/[,\s]+/).filter(Boolean);
      setBusy(true); setMessage(''); setProfiles([]);
      try {
        if (usernames.length < 1 || usernames.length > 3) throw new Error(t.count);
        const response = await fetch('/api/creator-research', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...(usernames.length === 1 ? { action: 'lookup', username: usernames[0] } : { action: 'compare', usernames }), postLimit: Number(data.get('limit')) }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || t.unavailable);
        if (result.creators) {
          setProfiles(result.creators.filter((entry: {data?: Profile}) => entry.data).map((entry: {data: Profile}) => entry.data));
          setMessage(result.creators.filter((entry: {error?: unknown}) => entry.error).map((entry: {username: string; error: {message: string}}) => `@${entry.username}: ${entry.error.message}`).join(' '));
        } else setProfiles([result]);
      } catch (error) { setMessage(error instanceof Error ? error.message : t.failed); }
      finally { setBusy(false); }
    }}>
      <label className="block">{t.handles}<input name="usernames" maxLength={95} required placeholder="@perfil1, @perfil2" className="mt-1 block w-full rounded border p-2" /></label>
      <label className="block">{t.perProfile}<input name="limit" type="number" defaultValue={3} min={1} max={50} required className="ml-3 rounded border p-2" /></label>
      <p className="text-sm">{t.note}</p>
      <button disabled={busy} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{busy ? t.wait : t.search}</button>
    </form>
    {message && <p role="status" className="rounded border p-4">{message}</p>}
    {profiles.map(profile => <section key={profile.creator.username} className="space-y-3 rounded-lg border bg-white p-5">
      <h2 className="text-xl font-semibold">@{profile.creator.username}</h2>
      <p>{profile.creator.biography || t.noBio}</p>
      <p>{t.followers}: {number(profile.creator.followersCount)} · {t.posts}: {number(profile.creator.publishedMediaCount)} · {t.sampled}: {profile.coverage.returnedPosts}</p>
      {profile.posts.map(post => <article key={post.id} className="space-y-2 border-t pt-3">
        <p>{post.format || t.noFormat} · {post.publishedAt || t.noDate}</p>
        <p className="whitespace-pre-wrap">{post.caption || t.noCaption}</p>
        <p>{t.likes}: {number(post.likes)} · {t.comments}: {number(post.comments)} · {t.views}: {number(post.views)}</p>
        {post.url && <a href={post.url} target="_blank" rel="noopener noreferrer" className="underline">{t.open}</a>}
      </article>)}
    </section>)}
  </main>;
}
