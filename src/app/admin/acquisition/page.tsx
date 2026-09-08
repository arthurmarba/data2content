import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import { acquisitionReport } from '@/app/lib/acquisition/report';
import { ACQUISITION_STEPS, type AcquisitionStep } from '@/lib/analytics/acquisition';

export const dynamic = 'force-dynamic';
const money = (value: number | null) => value === null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const date = (value: Date | string) => new Date(value).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
export default async function AcquisitionPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role?.toLowerCase() !== 'admin') redirect('/login');
  const query = await searchParams;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const start = typeof query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.from) ? query.from : '2026-09-08';
  const end = typeof query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.to) ? query.to : today;
  const from = new Date(`${start}T00:00:00-03:00`), to = new Date(new Date(`${end}T00:00:00-03:00`).getTime() + 86400_000);
  if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || to <= from || to.getTime() - from.getTime() > 400 * 86400_000) {
    return <p className="p-8">Escolha um período válido de até 400 dias.</p>;
  }
  const report = await acquisitionReport(from, to, query.qualified === '1');
  const total = (key: AcquisitionStep) => report.rows.reduce((sum, r) => sum + (r.steps[key] || 0), 0);
  const columns: AcquisitionStep[] = ['arrival', 'pricing_viewed', 'signup_clicked', 'account_created', 'checkout_started', 'subscription_started', 'first_payment'];
  const groups = ['Roteiros', 'Ideias', 'Engajamento'].map(name => {
    const ads = report.rows.filter(row => row.group === name);
    return { name, spend: report.deliveryAvailable ? ads.reduce((s, r) => s + (r.spend || 0), 0) : null,
      arrivals: ads.reduce((s, r) => s + (r.steps.arrival || 0), 0),
      subscriptions: ads.reduce((s, r) => s + (r.steps.subscription_started || 0), 0),
      payers: ads.reduce((s, r) => s + (r.steps.first_payment || 0), 0) };
  });
  return <main className="mx-auto max-w-screen-2xl space-y-6 p-4 md:p-8">
    <header><h1 className="text-2xl font-semibold">Anúncios → assinaturas</h1><p className="mt-2 text-sm text-gray-600">Teste ChatGPT Ads · R$ 70 de limite total compartilhado. Este painel não altera orçamento nem campanhas.</p></header>
    <form className="flex flex-wrap items-end gap-4 rounded-xl border bg-white p-4">
      <label className="text-sm">Chegadas desde<input className="mt-1 block rounded border p-2" type="date" name="from" defaultValue={start} required /></label>
      <label className="text-sm">Até<input className="mt-1 block rounded border p-2" type="date" name="to" defaultValue={end} required /></label>
      <label className="text-sm"><input type="checkbox" name="qualified" value="1" defaultChecked={query.qualified === '1'} /> Apenas perfil conhecido com mais de 20 mil seguidores</label>
      <button className="rounded bg-gray-900 px-4 py-2 text-white">Atualizar</button>
    </form>
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[
      ['Investimento', money(report.deliveryAvailable ? report.rows.reduce((s, r) => s + (r.spend || 0), 0) : null)],
      ['Chegadas por anúncio', total('arrival')], ['Assinantes por anúncio (inclui grátis)', total('subscription_started')], ['Pagantes por anúncio', total('first_payment')],
    ].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-4"><p className="text-sm text-gray-600">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}</div>
    <p className="text-sm text-gray-600">{report.deliveryAvailable ? `Entrega da plataforma até ${date(report.deliveryThrough)} (hora completa).` : 'Dados de gasto indisponíveis: não devem ser interpretados como zero.'} Chegadas são visitantes consentidos, não cliques. Cada pessoa conta uma vez por etapa e anúncio; quem visita dois anúncios pode aparecer nos dois. Equipe interna excluída.</p>
    {report.qualifiedOnly && <p className="rounded border border-amber-300 p-3 text-sm">O filtro reduz as pessoas, mas o gasto continua sendo o total do anúncio. Seguidores desconhecidos ficam de fora.</p>}
    <section className="grid gap-3 md:grid-cols-3" aria-label="Comparação dos grupos">{groups.map(g => <div key={g.name} className="rounded-xl border bg-white p-4"><h2 className="font-medium">{g.name}</h2><p className="mt-2 text-sm">{money(g.spend)} · {g.arrivals} chegadas · {g.subscriptions} assinantes · {g.payers} pagantes</p><p className="mt-1 text-xs text-gray-500">Soma dos dois anúncios do grupo.</p></div>)}</section>
    <section className="overflow-x-auto rounded-xl border bg-white"><table className="w-full text-left text-sm"><caption className="p-4 text-left font-medium">Resultado por anúncio</caption><thead className="bg-gray-50"><tr><th className="p-3">Anúncio</th><th className="p-3">Gasto</th><th className="p-3">Cliques</th>{columns.map(c => <th key={c} className="p-3">{ACQUISITION_STEPS[c]}</th>)}<th className="p-3">Custo / assinante</th><th className="p-3">Custo / pagante</th><th className="p-3">Receita bruta BRL</th></tr></thead>
      <tbody>{report.rows.map(r => <tr className="border-t" key={r.content}><td className="min-w-60 p-3"><p>{r.title}</p><p className="text-xs text-gray-500">{r.group} · {r.content}</p></td><td className="p-3">{money(r.spend)}</td><td className="p-3">{r.clicks ?? '—'}</td>{columns.map(c => <td key={c} className="p-3">{r.steps[c] || 0}</td>)}<td className="p-3">{money(r.costPerSubscription)}</td><td className="p-3">{money(r.costPerPayer)}</td><td className="p-3">{money(r.grossRevenue)}</td></tr>)}</tbody>
    </table></section>
    <section className="rounded-xl border bg-white p-4"><h2 className="font-medium">Última etapa observada</h2><p className="my-2 text-sm text-gray-600">Até 100 jornadas mais recentes, com até 40 marcos cada. Não significa desistência; Instagram pode ser conectado antes ou depois da assinatura. A receita inclui renovações, antes de taxas e reembolsos.</p>
      {!report.timelines.length && <p className="py-5 text-gray-500">Ainda não há jornadas consentidas neste período.</p>}
      {report.timelines.map(t => <details key={t.id} className="border-t py-3"><summary className="cursor-pointer text-sm">Visitante {t.id} · {t.touch.content} · {ACQUISITION_STEPS[t.steps[0]?.step as AcquisitionStep]} · {date(t.lastAt)}</summary>
        <p className="my-2 text-sm text-gray-600">Primeiro anúncio: {t.firstTouch.content}. Último anúncio desta conversão: {t.touch.content}. Seguidores: {t.followers?.toLocaleString('pt-BR') ?? 'não conhecidos'}. Consentimento: {t.consent ? 'ativo' : 'revogado/expirado'}.</p>
        <ol className="space-y-1 text-sm">{[...t.steps].reverse().map((s: { step: AcquisitionStep; at: string }, i: number) => <li key={i}>{date(s.at)} — {ACQUISITION_STEPS[s.step]}</li>)}</ol>
      </details>)}
    </section>
    <p className="text-xs text-gray-500">Conversões OpenAI: {report.capi.map(c => `${({ pending: 'aguardando', sent: 'enviadas', skipped: 'não enviadas (consentimento/identificador/equipe ou marco interno)', failed: 'falhas' } as Record<string, string>)[c._id]}: ${c.count}`).join(' · ') || 'nenhum evento'}. Atribuição interna: último anúncio elegível em 30 dias, congelado na assinatura; acompanhamos os pagamentos dessa coorte. Os totais da plataforma podem divergir.</p>
  </main>;
}
