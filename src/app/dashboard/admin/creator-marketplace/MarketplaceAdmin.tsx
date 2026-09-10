'use client';
import { useEffect, useState } from 'react';

type Result = { dataMode: string; creators: { id: string; username: string; biography: string | null; country: string | null }[]; coverage: { hasMore: boolean }; receipt: { warning: string } };
const categories = [
  ['FOOD_AND_DRINK', 'Comida e bebida'], ['BEAUTY', 'Beleza'], ['FASHION', 'Moda'],
  ['FITNESS_AND_WORKOUTS', 'Fitness'], ['SCIENCE_AND_TECH', 'Ciência e tecnologia'],
  ['BUSINESS_FINANCE_AND_ECONOMICS', 'Negócios e finanças'], ['TRAVEL_AND_LEISURE_ACTIVITIES', 'Viagens e lazer'],
  ['EDUCATION_AND_LEARNING', 'Educação'], ['SPORTS', 'Esportes'], ['ANIMALS_AND_PETS', 'Animais'],
];
export default function MarketplaceAdmin() {
  const [connected, setConnected] = useState(false);
  const [pageName, setPageName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => {
    const outcome = new URLSearchParams(window.location.search).get('connection');
    if (outcome) setMessage(outcome === 'connected' ? 'Conexão autorizada. Você pode testar a busca.' : 'A conexão não foi concluída. Confira as permissões do modelo e a Página vinculada ao seu Instagram.');
    fetch('/api/admin/creator-marketplace', { cache: 'no-store' }).then(r => r.json()).then(data => {
      setConnected(data.connected === true); setPageName(data.pageName || '');
      if (data.message) setMessage(data.message);
    }).catch(() => setMessage('Não foi possível conferir a conexão.'));
  }, []);
  async function act(action: string, filters?: object) {
    setBusy(true); setMessage(''); setResult(null);
    try {
      const response = await fetch('/api/admin/creator-marketplace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, filters }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'A operação falhou.');
      if (action === 'connect') window.location.assign(data.url);
      else if (action === 'disconnect') { setConnected(false); setPageName(''); setMessage('Credencial removida da D2C. Para revogar o consentimento na Meta, use as configurações da sua conta Facebook.'); }
      else setResult(data);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'A operação falhou.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">Descoberta de criadores para campanhas</h1>
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
      <strong>Modo de teste do Marketplace</strong>
      <p>Os resultados servem para validar a integração e a análise da Meta. Não use dados de teste para escolher parceiros ou concluir uma pesquisa de mercado.</p>
    </div>
    <section className="space-y-3 rounded-lg border bg-white p-5">
      <h2 className="font-semibold">Conexão da marca</h2>
      <p>{connected ? `Página autorizada: ${pageName}` : 'Conecte a Página vinculada ao Instagram da sua conta D2C.'}</p>
      <p className="text-sm text-gray-600">A Meta solicitará acesso ao Marketplace, informações básicas do Instagram, lista de Páginas, metadados de Página e gerenciamento da empresa. A D2C usa essa conexão para pesquisar parceiros; a elegibilidade é verificada pela Meta.</p>
      <button className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50" disabled={busy} onClick={() => act('connect')}>{connected ? 'Renovar autorização' : 'Conectar Marketplace'}</button>
      {connected && <button className="ml-4 underline" disabled={busy} onClick={() => act('disconnect')}>Remover conexão da D2C</button>}
    </section>
    <form className="grid gap-4 rounded-lg border bg-white p-5 sm:grid-cols-2" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      act('search', { countries: [String(form.get('country')).trim().toUpperCase()],
        ...(form.get('query') ? { query: String(form.get('query')).trim() } : {}),
        ...(form.get('interest') ? { interests: [form.get('interest')] } : {}),
        ...(form.get('activity') ? { recentActivity: form.get('activity') } : {}),
        ...(form.get('min') ? { minFollowers: Number(form.get('min')) } : {}),
        ...(form.get('max') ? { maxFollowers: Number(form.get('max')) } : {}), limit: 10 });
    }}>
      <label>Assunto<input className="mt-1 block w-full rounded border p-2" name="query" maxLength={200} placeholder="Ex.: receitas" /></label>
      <label>País do criador (sigla)<input className="mt-1 block w-full rounded border p-2" name="country" defaultValue="BR" pattern="[A-Za-z]{2}" maxLength={2} required /></label>
      <label>Nicho<select className="mt-1 block w-full rounded border p-2" name="interest"><option value="">Todos</option>{categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Última publicação<select className="mt-1 block w-full rounded border p-2" name="activity"><option value="">Qualquer</option>{[7, 30, 90].map(days => <option key={days} value={`last_${days}_days`}>Últimos {days} dias</option>)}</select></label>
      {['min', 'max'].map(bound => <label key={bound}>{bound === 'min' ? 'Mínimo' : 'Máximo'} de seguidores<select className="mt-1 block w-full rounded border p-2" name={bound}><option value="">Sem limite</option>{[10000, 25000, 50000, 75000, 100000, 250000, 1000000].map(n => <option key={n} value={n}>{n.toLocaleString('pt-BR')}</option>)}</select></label>)}
      <p className="text-sm text-gray-600 sm:col-span-2">Localização por país. Cidade brasileira, busca por imagens e perfis semelhantes ainda não estão disponíveis nesta versão. Cada consulta mostra até 10 candidatos.</p>
      <button disabled={busy || !connected} className="rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50">{busy ? 'Aguarde…' : 'Buscar dados de teste'}</button>
    </form>
    {message && <p role="status" className="rounded border p-4">{message}</p>}
    {result && <section className="space-y-3"><h2 className="text-xl font-semibold">Resultados de teste ({result.creators.length})</h2>
      <p>{result.receipt.warning}</p>
      {result.creators.map(creator => <article className="rounded border bg-white p-4" key={creator.id}><h3 className="font-semibold">@{creator.username}</h3><p>{creator.country || 'País indisponível'}</p><p>{creator.biography || 'Biografia indisponível'}</p></article>)}
      {!result.creators.length && <p>Nenhum candidato retornado nesta consulta de teste.</p>}
      {result.coverage.hasMore && <p>Existem mais resultados na Meta. Esta versão mostra somente a primeira página.</p>}
    </section>}
  </main>;
}
