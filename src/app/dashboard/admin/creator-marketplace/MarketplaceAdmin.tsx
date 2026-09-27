'use client';
import { useEffect, useState } from 'react';
import type { ResearchLang } from '@/app/dashboard/creator-research/researchLang';

type Metrics = { followers: number | null; reachThisMonth: number | null; engagedAccountsThisMonth: number | null; reelsInteractionRate90d: number | null; reachPerFollowerPercent: number | null };
type Creator = { id: string; username: string; biography: string | null; country: string | null; verified: boolean | null; profilePictureUrl: string | null; category: string | null; badges: string[]; metrics: Metrics };
type Result = { dataMode: 'test' | 'live'; creators: Creator[]; coverage: { hasMore: boolean }; receipt: { warning: string } };
type Details = { creator: Creator & { brandPartnershipExperience: boolean | null; pastBrandPartners: string[] }; recentMedia: { id: string; type: string | null; publishedAt: string | null; caption: string | null; url: string | null }[] };

// Nicho, alcance e audiência seguem os nomes que a Meta usa na análise (industry, reach, audience).
const INTERESTS: [string, string, string][] = [
  ['FOOD_AND_DRINK', 'Comida e bebida', 'Food and drink'], ['BEAUTY', 'Beleza', 'Beauty'], ['FASHION', 'Moda', 'Fashion'],
  ['FITNESS_AND_WORKOUTS', 'Fitness', 'Fitness and workouts'], ['SCIENCE_AND_TECH', 'Ciência e tecnologia', 'Science and tech'],
  ['BUSINESS_FINANCE_AND_ECONOMICS', 'Negócios e finanças', 'Business, finance and economics'], ['TRAVEL_AND_LEISURE_ACTIVITIES', 'Viagens e lazer', 'Travel and leisure'],
  ['EDUCATION_AND_LEARNING', 'Educação', 'Education and learning'], ['SPORTS', 'Esportes', 'Sports'], ['ANIMALS_AND_PETS', 'Animais', 'Animals and pets'],
  ['HOME_AND_GARDEN', 'Casa e jardim', 'Home and garden'], ['MUSIC_AND_AUDIO', 'Música', 'Music and audio'], ['TV_AND_MOVIES', 'TV e cinema', 'TV and movies'],
  ['GAMES_PUZZLES_AND_PLAY', 'Jogos', 'Games'], ['BOOKS_AND_LITERATURE', 'Livros', 'Books and literature'], ['PERFORMING_ARTS', 'Artes cênicas', 'Performing arts'],
  ['VISUAL_ARTS_ARCHITECTURE_AND_CRAFTS', 'Artes visuais e artesanato', 'Visual arts and crafts'], ['HOLIDAYS_AND_CELEBRATIONS', 'Festas e datas', 'Holidays and celebrations'],
  ['HISTORY_AND_PHILOSOPHY', 'História e filosofia', 'History and philosophy'], ['VEHICLES_AND_TRANSPORTATION', 'Veículos', 'Vehicles and transportation'],
];
const COUNTRIES: [string, string, string][] = [['BR', 'Brasil', 'Brazil'], ['PT', 'Portugal', 'Portugal'], ['US', 'Estados Unidos', 'United States'], ['MX', 'México', 'Mexico'], ['AR', 'Argentina', 'Argentina'], ['ES', 'Espanha', 'Spain'], ['GB', 'Reino Unido', 'United Kingdom']];
const AGES = ['18_to_24', '25_to_34', '35_to_44', '45_to_54', '55_to_64', '65_and_above'];
const FOLLOWERS = [10000, 25000, 50000, 75000, 100000, 250000, 1000000];
const ENGAGED = [2000, 10000, 50000, 100000];
const COPY = {
  pt: {
    title: 'Descoberta de criadores para campanhas',
    intro: 'Encontre criadores elegíveis do Marketplace de Criadores do Instagram por nicho, alcance e audiência e avalie cada um antes de convidar para uma campanha ou parceria.',
    sample: 'Acesso padrão da Meta: até o acesso avançado ser aprovado, a API do Marketplace devolve perfis de teste (a própria Meta escreve “mocked creator data” na biografia). A busca, os filtros e as métricas abaixo são as mesmas chamadas usadas com dados reais.',
    step1: '1. Conecte a conta da marca', connected: 'Página autorizada', none: 'Nenhuma Página conectada ainda.',
    step1Text: 'Pelo Login do Facebook para Empresas, a D2C pede à Meta: descobrir criadores no Marketplace de Criadores do Instagram, informações básicas do Instagram, lista de Páginas, metadados da Página e ativos da empresa. Você escolhe a Página ligada ao Instagram da marca. A D2C só lê; não publica nem envia mensagens.',
    connect: 'Conectar com o Facebook', renew: 'Renovar autorização', remove: 'Remover conexão da D2C',
    removed: 'Credencial removida da D2C. Para revogar o consentimento na Meta, use as configurações da sua conta Facebook.',
    ok: 'Conexão autorizada. Agora escolha os filtros e busque criadores.', notOk: 'A conexão não foi concluída. Confira as permissões e a Página vinculada ao seu Instagram.',
    step2: '2. Busque criadores com os filtros da Meta',
    industry: 'Nicho', industryHelp: 'Categoria do conteúdo do criador, conforme a Meta (creator_interests).', interest: 'Categoria do criador', any: 'Qualquer',
    reach: 'Alcance', reachHelp: 'Tamanho do criador e quantas contas engajam com o conteúdo dele por mês.', minFollowers: 'Seguidores: mínimo', maxFollowers: 'Seguidores: máximo', minEngaged: 'Contas engajadas por mês: mínimo', noLimit: 'Sem limite',
    audience: 'Audiência', audienceHelp: 'Quem segue o criador: país, faixa etária e gênero da maior parte do público.', audCountry: 'País da maior parte do público', audAge: 'Faixa etária da maior parte do público', audGender: 'Gênero da maior parte do público', female: 'Feminino', male: 'Masculino',
    creator: 'Criador', creatorHelp: 'Onde o criador está, palavra-chave do conteúdo e se publicou recentemente.', keyword: 'Palavra-chave', keywordPh: 'Ex.: receitas', country: 'País do criador', activity: 'Publicou nos últimos', days: 'dias',
    search: 'Buscar criadores', wait: 'Aguarde…', needConnect: 'Conecte a conta da marca para buscar.',
    results: 'Criadores encontrados', applied: 'Filtros aplicados', empty: 'A Meta não retornou criadores para esses filtros.', more: 'Há mais resultados na Meta; esta versão mostra a primeira página.',
    followers: 'Seguidores', reachMonth: 'Alcance no mês', engagedMonth: 'Contas engajadas no mês', reelsRate: 'Interação nos Reels (90 dias)', reachRatio: 'Alcance ÷ seguidores', na: 'Indisponível',
    sampleBadge: 'Perfil de teste da Meta', verified: 'Verificado', view: 'Ver posts recentes e parcerias', hide: 'Ocultar detalhes',
    recent: 'Posts recentes', partnership: 'Experiência com marcas no último ano', yes: 'Sim', no: 'Não', partners: 'Marcas parceiras', open: 'Abrir no Instagram',
    contact: 'A D2C não envia mensagens aos criadores; a marca faz o contato pelos próprios canais.', noBio: 'Biografia indisponível',
  },
  en: {
    title: 'Creator discovery for campaigns',
    intro: 'Find eligible creators in the Instagram Creator Marketplace by industry, reach and audience, and evaluate each one before inviting them to a campaign or partnership.',
    sample: 'Meta standard access: until advanced access is approved, the Marketplace API returns sample profiles (Meta itself writes “mocked creator data” in the bio). The search, filters and metrics below are the same calls used with real data.',
    step1: '1. Connect the brand account', connected: 'Authorized Page', none: 'No Page connected yet.',
    step1Text: 'With Facebook Login for Business, Data2Content asks Meta for: discovering creators on the Instagram Creator Marketplace, basic Instagram info, your list of Pages, Page metadata and business assets. You choose the Page linked to the brand’s Instagram account. Data2Content only reads; it never posts or sends messages.',
    connect: 'Connect with Facebook', renew: 'Renew authorization', remove: 'Remove connection from Data2Content',
    removed: 'Credential removed from Data2Content. To revoke consent on Meta, use your Facebook account settings.',
    ok: 'Connection authorized. Now choose the filters and search creators.', notOk: 'The connection was not completed. Check the permissions and the Page linked to your Instagram.',
    step2: '2. Search creators with Meta’s filters',
    industry: 'Industry', industryHelp: 'Category of the creator’s content, as defined by Meta (creator_interests).', interest: 'Creator category', any: 'Any',
    reach: 'Reach', reachHelp: 'Creator size and how many accounts engage with their content each month.', minFollowers: 'Followers: minimum', maxFollowers: 'Followers: maximum', minEngaged: 'Accounts engaged per month: minimum', noLimit: 'No limit',
    audience: 'Audience', audienceHelp: 'Who follows the creator: country, age range and gender of most of the audience.', audCountry: 'Main audience country', audAge: 'Main audience age range', audGender: 'Main audience gender', female: 'Female', male: 'Male',
    creator: 'Creator', creatorHelp: 'Where the creator is, a content keyword and whether they posted recently.', keyword: 'Keyword', keywordPh: 'e.g. recipes', country: 'Creator country', activity: 'Posted in the last', days: 'days',
    search: 'Search creators', wait: 'Please wait…', needConnect: 'Connect the brand account to search.',
    results: 'Creators found', applied: 'Filters applied', empty: 'Meta returned no creators for these filters.', more: 'Meta has more results; this version shows the first page.',
    followers: 'Followers', reachMonth: 'Reach (this month)', engagedMonth: 'Accounts engaged (this month)', reelsRate: 'Reels interaction rate (90 days)', reachRatio: 'Reach ÷ followers', na: 'Not available',
    sampleBadge: 'Meta sample profile', verified: 'Verified', view: 'View recent posts & partnerships', hide: 'Hide details',
    recent: 'Recent posts', partnership: 'Brand partnership experience (last year)', yes: 'Yes', no: 'No', partners: 'Past brand partners', open: 'Open on Instagram',
    contact: 'Data2Content does not message creators; the brand contacts them through its own channels.', noBio: 'Bio not available',
  },
};
const ageLabel = (age: string) => age.replace('_to_', '–').replace('_and_above', '+');

export default function MarketplaceAdmin({ lang = 'pt' }: { lang?: ResearchLang }) {
  const t = COPY[lang];
  const locale = lang === 'en' ? 'en-US' : 'pt-BR';
  const num = (value: number | null) => value == null ? t.na : value.toLocaleString(locale);
  const [connected, setConnected] = useState(false);
  const [pageName, setPageName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [applied, setApplied] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, Details>>({});
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get('connection');
    if (outcome) setMessage(outcome === 'connected' ? t.ok : t.notOk);
    fetch('/api/admin/creator-marketplace', { cache: 'no-store' }).then(r => r.json()).then(data => {
      setConnected(data.connected === true); setPageName(data.pageName || '');
      if (data.message) setMessage(data.message);
    }).catch(() => setMessage(lang === 'en' ? 'Could not check the connection.' : 'Não foi possível conferir a conexão.'));
  }, [t, lang]);
  async function post(body: object) {
    const response = await fetch('/api/admin/creator-marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || (lang === 'en' ? 'The request failed.' : 'A operação falhou.'));
    return data;
  }
  async function act(action: 'connect' | 'disconnect') {
    setBusy(true); setMessage('');
    try {
      const data = await post({ action });
      if (action === 'connect') window.location.assign(data.url);
      else { setConnected(false); setPageName(''); setResult(null); setMessage(t.removed); }
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  }
  async function toggle(username: string) {
    if (open === username) { setOpen(null); return; }
    setOpen(username);
    if (details[username]) return;
    try { const data = await post({ action: 'details', username }); setDetails(prev => ({ ...prev, [username]: data })); }
    catch (error) { setMessage(error instanceof Error ? error.message : String(error)); setOpen(null); }
  }
  const select = 'mt-1 block w-full rounded border bg-white p-2';
  const group = 'space-y-3 rounded-lg border border-gray-200 p-4';
  return <main id="marketplace" className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">{t.title}</h1>
    <p>{t.intro}</p>
    {result?.dataMode !== 'live' && <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">{t.sample}</p>}
    <section className="space-y-3 rounded-lg border bg-white p-5">
      <h2 className="text-lg font-semibold">{t.step1}</h2>
      <p className="text-sm text-gray-600">{t.step1Text}</p>
      <p>{connected ? <><strong>{t.connected}:</strong> {pageName}</> : t.none}</p>
      <button className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy} onClick={() => act('connect')}>{connected ? t.renew : t.connect}</button>
      {connected && <button className="ml-4 underline" disabled={busy} onClick={() => act('disconnect')}>{t.remove}</button>}
    </section>
    <form className="space-y-4 rounded-lg border bg-white p-5" onSubmit={async event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      const value = (name: string) => String(form.get(name) || '');
      const label = (name: string) => { const el = event.currentTarget.elements.namedItem(name) as HTMLSelectElement | HTMLInputElement | null; return el instanceof HTMLSelectElement ? el.selectedOptions[0]?.text : el?.value; };
      const filters = { countries: [value('country')], limit: 10,
        ...(value('query') ? { query: value('query').trim() } : {}),
        ...(value('interest') ? { interests: [value('interest')] } : {}),
        ...(value('min') ? { minFollowers: Number(value('min')) } : {}),
        ...(value('max') ? { maxFollowers: Number(value('max')) } : {}),
        ...(value('engaged') ? { minEngagedAccounts: Number(value('engaged')) } : {}),
        ...(value('audCountry') ? { audienceCountries: [value('audCountry')] } : {}),
        ...(value('audAge') ? { audienceAgeBuckets: [value('audAge')] } : {}),
        ...(value('audGender') ? { audienceGender: value('audGender') } : {}),
        ...(value('activity') ? { recentActivity: value('activity') } : {}) };
      const named: [string, string][] = [['interest', t.industry], ['min', t.minFollowers], ['max', t.maxFollowers], ['engaged', t.minEngaged], ['audCountry', t.audCountry], ['audAge', t.audAge], ['audGender', t.audGender], ['country', t.country], ['query', t.keyword], ['activity', t.activity]];
      const summary = named.filter(([name]) => value(name)).map(([name, text]) => `${text}: ${label(name)}`).join(' · ');
      setBusy(true); setMessage(''); setResult(null); setOpen(null); setDetails({});
      try { setResult(await post({ action: 'search', filters })); setApplied(summary); }
      catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
      finally { setBusy(false); }
    }}>
      <h2 className="text-lg font-semibold">{t.step2}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <fieldset className={group} title={t.industryHelp}>
          <legend className="px-1 font-semibold">{t.industry}</legend>
          <p className="text-sm text-gray-600">{t.industryHelp}</p>
          <label className="block">{t.interest}<select name="interest" className={select}><option value="">{t.any}</option>{INTERESTS.map(([value, pt, en]) => <option key={value} value={value}>{lang === 'en' ? en : pt}</option>)}</select></label>
        </fieldset>
        <fieldset className={group} title={t.reachHelp}>
          <legend className="px-1 font-semibold">{t.reach}</legend>
          <p className="text-sm text-gray-600">{t.reachHelp}</p>
          <div className="grid grid-cols-2 gap-3">
            {(['min', 'max'] as const).map(bound => <label key={bound}>{bound === 'min' ? t.minFollowers : t.maxFollowers}<select name={bound} className={select}><option value="">{t.noLimit}</option>{FOLLOWERS.map(n => <option key={n} value={n}>{n.toLocaleString(locale)}</option>)}</select></label>)}
          </div>
          <label className="block">{t.minEngaged}<select name="engaged" className={select}><option value="">{t.noLimit}</option>{ENGAGED.map(n => <option key={n} value={n}>{n.toLocaleString(locale)}</option>)}</select></label>
        </fieldset>
        <fieldset className={group} title={t.audienceHelp}>
          <legend className="px-1 font-semibold">{t.audience}</legend>
          <p className="text-sm text-gray-600">{t.audienceHelp}</p>
          <label className="block">{t.audCountry}<select name="audCountry" className={select}><option value="">{t.any}</option>{COUNTRIES.map(([code, pt, en]) => <option key={code} value={code}>{lang === 'en' ? en : pt}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label>{t.audAge}<select name="audAge" className={select}><option value="">{t.any}</option>{AGES.map(age => <option key={age} value={age}>{ageLabel(age)}</option>)}</select></label>
            <label>{t.audGender}<select name="audGender" className={select}><option value="">{t.any}</option><option value="female">{t.female}</option><option value="male">{t.male}</option></select></label>
          </div>
        </fieldset>
        <fieldset className={group} title={t.creatorHelp}>
          <legend className="px-1 font-semibold">{t.creator}</legend>
          <p className="text-sm text-gray-600">{t.creatorHelp}</p>
          <label className="block">{t.keyword}<input name="query" maxLength={200} placeholder={t.keywordPh} className={select} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label>{t.country}<select name="country" defaultValue="BR" className={select}>{COUNTRIES.map(([code, pt, en]) => <option key={code} value={code}>{lang === 'en' ? en : pt}</option>)}</select></label>
            <label>{t.activity}<select name="activity" className={select}><option value="">{t.any}</option>{[7, 30, 90].map(days => <option key={days} value={`last_${days}_days`}>{days} {t.days}</option>)}</select></label>
          </div>
        </fieldset>
      </div>
      <button disabled={busy || !connected} className="rounded bg-gray-900 px-5 py-2 text-white disabled:opacity-50">{busy ? t.wait : t.search}</button>
      {!connected && <span className="ml-3 text-sm text-gray-600">{t.needConnect}</span>}
    </form>
    {message && <p role="status" className="rounded border bg-white p-4">{message}</p>}
    {result && <section className="space-y-4">
      <h2 className="text-xl font-semibold">{t.results} ({result.creators.length})</h2>
      {applied && <p className="text-sm text-gray-600"><strong>{t.applied}:</strong> {applied}</p>}
      {!result.creators.length && <p>{t.empty}</p>}
      {result.creators.map(creator => {
        const extra = details[creator.username];
        return <article key={creator.id} className="space-y-3 rounded-lg border bg-white p-5">
          <header className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {creator.profilePictureUrl && <img src={creator.profilePictureUrl} alt="" className="h-12 w-12 rounded-full border object-cover" />}
            <div>
              <h3 className="text-lg font-semibold">@{creator.username}{creator.verified && <span className="ml-2 text-sm font-normal text-blue-700">✓ {t.verified}</span>}</h3>
              <p className="text-sm text-gray-600">{[creator.country, creator.category].filter(Boolean).join(' · ')}</p>
            </div>
            {result.dataMode === 'test' && <span className="ml-auto rounded bg-amber-100 px-2 py-1 text-xs">{t.sampleBadge}</span>}
          </header>
          <p className="text-sm">{creator.biography || t.noBio}</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {([[t.followers, num(creator.metrics.followers)], [t.reachMonth, num(creator.metrics.reachThisMonth)], [t.engagedMonth, num(creator.metrics.engagedAccountsThisMonth)],
              [t.reelsRate, creator.metrics.reelsInteractionRate90d == null ? t.na : `${creator.metrics.reelsInteractionRate90d.toLocaleString(locale)}%`],
              [t.reachRatio, creator.metrics.reachPerFollowerPercent == null ? t.na : `${creator.metrics.reachPerFollowerPercent.toLocaleString(locale)}%`]] as const)
              .map(([name, value]) => <div key={name} className="rounded bg-gray-50 p-2"><dt className="text-xs text-gray-600">{name}</dt><dd className="font-semibold">{value}</dd></div>)}
          </dl>
          {!!creator.badges.length && <p className="flex flex-wrap gap-2">{creator.badges.map(badge => <span key={badge} className="rounded-full border px-2 py-0.5 text-xs">{badge}</span>)}</p>}
          <button type="button" className="underline" onClick={() => toggle(creator.username)}>{open === creator.username ? t.hide : t.view}</button>
          {open === creator.username && (extra ? <div className="space-y-3 border-t pt-3">
            <p><strong>{t.partnership}:</strong> {extra.creator.brandPartnershipExperience == null ? t.na : extra.creator.brandPartnershipExperience ? t.yes : t.no}
              {!!extra.creator.pastBrandPartners.length && <> · <strong>{t.partners}:</strong> {extra.creator.pastBrandPartners.join(', ')}</>}</p>
            <h4 className="font-semibold">{t.recent}</h4>
            {extra.recentMedia.map(media => <div key={media.id} className="space-y-1 rounded bg-gray-50 p-3 text-sm">
              <p className="text-gray-600">{[media.type, media.publishedAt && new Date(media.publishedAt).toLocaleDateString(locale)].filter(Boolean).join(' · ')}</p>
              <p className="line-clamp-2">{media.caption || t.na}</p>
              {media.url && <a href={media.url} target="_blank" rel="noopener noreferrer" className="underline">{t.open}</a>}
            </div>)}
          </div> : <p className="text-sm text-gray-600">{t.wait}</p>)}
        </article>;
      })}
      {result.coverage.hasMore && <p className="text-sm text-gray-600">{t.more}</p>}
      <p className="text-sm text-gray-600">{t.contact}</p>
    </section>}
  </main>;
}
