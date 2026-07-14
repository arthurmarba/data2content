'use client';

import React, { useEffect, useState } from 'react';
import { PresentationChartBarIcon } from '@heroicons/react/24/outline';

/* ── tipos ── */
interface PlanItem { _id: string; total: number }
interface MauPoint { month: string; mau: number; avgDau: number }
interface WeekPoint { _id: { year: number; week: number }; total: number; uniqueUsers: number }
interface MkMonth  { _id: { year: number; month: number }; acessos: number; visitantesUnicos: number }
interface Creator  { name: string; username: string | null; planStatus: string; followers: number | null; visitantesUnicos: number; acessosTotais: number }
interface ToolStat { eventName: string; total: number; uniqueUsers: number; mobileTotal: number; mobileUniqueUsers: number }
interface Data {
  generatedAt: string
  users: { total: number; planDist: PlanItem[] }
  activity: { avgDau30: number; peakDau: number; mau30: number; mauByMonth: MauPoint[]; dauLogin: number; mauLogin30d: number }
  features: {
    pautas: { total30d: number; users30d: number; byWeek: WeekPoint[] }
    publi:  { total: number; total30d: number; users30d: number }
    video:  { total30d: number }
    mapa:   { total: number; confirmations30d: number }
    byTool: ToolStat[]
  }
  mediakit: { humanTotal: number; human30d: number; byMonth: MkMonth[]; ranking: Creator[] }
}

const TOOL_LABELS: Record<string, string> = {
  publi_calculated: 'Calculadora de publi',
  media_kit_opened: 'Mídia kit (aberto pelo criador)',
  pauta_created: 'Pautas geradas',
  map_dimension_confirmed: 'Confirmações no mapa',
  video_upload_started: 'Vídeo — upload iniciado',
  video_diagnosis_created: 'Vídeo — diagnóstico concluído',
  collab_swiped: 'Collabs — swipe',
  collab_matched: 'Collabs — match',
  chat_session_started: 'Chat — sessão iniciada',
  session_start: 'Login',
};
function toolLabel(eventName: string) { return TOOL_LABELS[eventName] ?? eventName; }

/* ── helpers ── */
const PLAN_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  canceled: 'bg-orange-100 text-orange-800',
  inactive: 'bg-gray-100 text-gray-600',
  non_renewing: 'bg-yellow-100 text-yellow-700',
  past_due: 'bg-red-100 text-red-700',
};
const MONTHS_PT = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function fmtMonth(m: MkMonth) { return `${MONTHS_PT[m._id.month - 1]}/${String(m._id.year).slice(2)}`; }
function fmtWeek(w: WeekPoint) { return `W${String(w._id.week).padStart(2,'0')}`; }
function num(n: number) { return n.toLocaleString('pt-BR'); }

/* ── sub-componentes ── */
function KpiCard({ label, value, sub, color = 'text-gray-900' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function HBar({ label, value, max, color = 'bg-indigo-500' }: { label: string; value: number; max: number; color?: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 text-xs text-gray-500 text-right shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded h-5 overflow-hidden">
        <div className={`h-full ${color} rounded flex items-center pl-2`} style={{ width: `${pct}%` }}>
          <span className="text-white text-xs font-semibold">{num(value)}</span>
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, labelFn, valueFn, color = 'bg-indigo-500', label }: {
  data: unknown[]; labelFn: (d: unknown) => string; valueFn: (d: unknown) => number; color?: string; label?: string;
}) {
  const max = Math.max(...data.map(d => valueFn(d)), 1);
  return (
    <div className="space-y-2">
      {label && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{label}</p>}
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-16 text-xs text-gray-500 text-right shrink-0">{labelFn(d)}</span>
          <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden">
            <div
              className={`h-full ${color} rounded flex items-center pl-2 transition-all`}
              style={{ width: `${Math.round((valueFn(d) / max) * 100)}%` }}
            >
              <span className="text-white text-xs font-semibold">{num(valueFn(d))}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── página ── */
export default function PlatformUsagePage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'geral' | 'features' | 'midia-kit'>('geral');

  useEffect(() => {
    fetch('/api/admin/platform-usage')
      .then(r => { if (!r.ok) throw new Error('Erro ao carregar'); return r.json(); })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
    </div>
  );
  if (error || !data) return <div className="text-red-600 p-6">{error || 'Sem dados'}</div>;

  const d = data;
  const activeCount = d.users.planDist.find(p => p._id === 'active')?.total ?? 0;
  const updatedAt = new Date(d.generatedAt).toLocaleString('pt-BR');

  const TABS = [
    { key: 'geral', label: 'Visão Geral' },
    { key: 'features', label: 'Features' },
    { key: 'midia-kit', label: 'Mídia Kit' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PresentationChartBarIcon className="w-7 h-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Uso da Plataforma</h1>
            <p className="text-sm text-gray-500">Atualizado em {updatedAt}</p>
          </div>
        </div>
        <button
          onClick={() => { setLoading(true); fetch('/api/admin/platform-usage').then(r => r.json()).then(setData).finally(() => setLoading(false)); }}
          className="text-sm text-indigo-600 hover:underline"
        >
          Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── VISÃO GERAL ── */}
      {tab === 'geral' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Usuários cadastrados" value={num(d.users.total)} sub="desde o lançamento" />
            <KpiCard label="Pagantes ativos" value={activeCount} sub={`${((activeCount / d.users.total) * 100).toFixed(1)}% de conversão`} color="text-green-700" />
            <KpiCard label="MAU — mês atual (ação)" value={d.activity.mau30} sub="usuários únicos com ação registrada" color="text-indigo-700" />
            <KpiCard label="DAU médio (30d, ação)" value={d.activity.avgDau30} sub={`pico: ${d.activity.peakDau} usuários/dia`} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="DAU — hoje (login)" value={num(d.activity.dauLogin)} sub="sessão autenticada nas últimas 24h" color="text-sky-700" />
            <KpiCard label="MAU — 30d (login)" value={num(d.activity.mauLogin30d)} sub="sessão autenticada nos últimos 30d" color="text-sky-700" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* MAU por mês */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">MAU mensal por ação (últimos 4 meses)</h3>
              <BarChart
                data={d.activity.mauByMonth.slice(-4)}
                labelFn={(d: unknown) => (d as MauPoint).month.slice(5)}
                valueFn={(d: unknown) => (d as MauPoint).mau}
                color="bg-indigo-500"
              />
            </div>

            {/* Distribuição de plano */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuição de plano</h3>
              <div className="space-y-3">
                {d.users.planDist.map(p => (
                  <HBar key={p._id} label={p._id || 'null'} value={p.total} max={d.users.total} color={
                    p._id === 'active' ? 'bg-green-500' :
                    p._id === 'canceled' ? 'bg-orange-400' :
                    p._id === 'inactive' ? 'bg-gray-400' : 'bg-yellow-400'
                  } />
                ))}
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
            <strong>Nota:</strong> &ldquo;Ação&rdquo; conta eventos reais gravados no log de uso (pautas, publi, mapa, vídeo, chat, sessão). &ldquo;Login&rdquo; conta sessões autenticadas — mais amplo, mas só reflete dados a partir do deploy desta instrumentação; o histórico anterior não existe.
          </div>
        </div>
      )}

      {/* ── FEATURES ── */}
      {tab === 'features' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Pautas (30d)" value={num(d.features.pautas.total30d)} sub={`${d.features.pautas.users30d} criadores únicos`} color="text-indigo-700" />
            <KpiCard label="Calc. Publi (30d)" value={d.features.publi.total30d} sub={`${d.features.publi.users30d} criadores · ${num(d.features.publi.total)} histórico`} />
            <KpiCard label="Uploads de vídeo (30d)" value={d.features.video.total30d} />
            <KpiCard label="Criadores no Mapa" value={d.features.mapa.total} sub={`${d.features.mapa.confirmations30d} confirmações 30d`} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Pautas por semana</h3>
              <BarChart
                data={d.features.pautas.byWeek.slice(-6)}
                labelFn={(d: unknown) => fmtWeek(d as WeekPoint)}
                valueFn={(d: unknown) => (d as WeekPoint).total}
                color="bg-violet-500"
              />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Criadores únicos por semana</h3>
              <BarChart
                data={d.features.pautas.byWeek.slice(-6)}
                labelFn={(d: unknown) => fmtWeek(d as WeekPoint)}
                valueFn={(d: unknown) => (d as WeekPoint).uniqueUsers}
                color="bg-indigo-400"
              />
            </div>
          </div>

          {/* Por ferramenta */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Uso por ferramenta (30d)</h3>
            <p className="text-xs text-gray-400 mb-4">Eventos reais gravados no log de uso. &ldquo;Mobile&rdquo; = disparado a partir do board mobile (Mapa/Collabs/Vídeo/Mídia Kit/Calculadora); eventos sem essa tag ainda não distinguem plataforma.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="pb-2 text-left">Ferramenta</th>
                    <th className="pb-2 text-right">Eventos (30d)</th>
                    <th className="pb-2 text-right">Criadores únicos</th>
                    <th className="pb-2 text-right">% mobile</th>
                  </tr>
                </thead>
                <tbody>
                  {d.features.byTool.map(t => (
                    <tr key={t.eventName} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 font-medium text-gray-800">{toolLabel(t.eventName)}</td>
                      <td className="py-2 text-right">{num(t.total)}</td>
                      <td className="py-2 text-right text-indigo-700 font-semibold">{num(t.uniqueUsers)}</td>
                      <td className="py-2 text-right text-gray-500">
                        {t.total > 0 ? `${Math.round((t.mobileTotal / t.total) * 100)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                  {d.features.byTool.length === 0 && (
                    <tr><td colSpan={4} className="py-4 text-center text-gray-400">Sem eventos nos últimos 30 dias.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MÍDIA KIT ── */}
      {tab === 'midia-kit' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KpiCard label="Acessos humanos (1 ano)" value={num(d.mediakit.humanTotal)} sub="bots/crawlers excluídos" color="text-green-700" />
            <KpiCard label="Acessos humanos (30d)" value={num(d.mediakit.human30d)} />
            <KpiCard label="Pico mensal" value={num(Math.max(...d.mediakit.byMonth.map(m => m.visitantesUnicos), 0))} sub="visitantes únicos" />
            <KpiCard label="Criadores no ranking" value={d.mediakit.ranking.length} sub="com kit aberto" />
          </div>

          {/* Gráfico mensal */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Visitantes únicos por mês</h3>
            <BarChart
              data={d.mediakit.byMonth}
              labelFn={(d: unknown) => fmtMonth(d as MkMonth)}
              valueFn={(d: unknown) => (d as MkMonth).visitantesUnicos}
              color="bg-emerald-500"
            />
          </div>

          {/* Ranking */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Ranking — visitantes únicos no kit</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="pb-2 text-left w-8">#</th>
                    <th className="pb-2 text-left">Criador</th>
                    <th className="pb-2 text-left">Handle</th>
                    <th className="pb-2 text-right">Visitantes</th>
                    <th className="pb-2 text-right">Acessos</th>
                    <th className="pb-2 text-right">Seguidores</th>
                    <th className="pb-2 text-left pl-4">Plano</th>
                  </tr>
                </thead>
                <tbody>
                  {d.mediakit.ranking.map((c, i) => (
                    <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2 text-gray-400 text-xs">{String(i + 1).padStart(2, '0')}</td>
                      <td className="py-2 font-medium text-gray-800">{c.name}</td>
                      <td className="py-2 text-gray-500 text-xs">{c.username ? `@${c.username}` : '—'}</td>
                      <td className="py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 bg-gray-100 rounded h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded"
                              style={{ width: `${Math.round((c.visitantesUnicos / (d.mediakit.ranking[0]?.visitantesUnicos || 1)) * 100)}%` }}
                            />
                          </div>
                          <span className="font-semibold w-10 text-right">{num(c.visitantesUnicos)}</span>
                        </div>
                      </td>
                      <td className="py-2 text-right text-gray-500">{num(c.acessosTotais)}</td>
                      <td className="py-2 text-right text-gray-500">{c.followers ? num(c.followers) : '—'}</td>
                      <td className="py-2 pl-4">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${PLAN_COLORS[c.planStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                          {c.planStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
