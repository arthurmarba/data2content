'use client';

import { useState, useMemo } from 'react';
import useCachedFetch from '@/hooks/useCachedFetch';
import PlanTeaser from '@/app/dashboard/components/PlanTeaser';
import type { StrategicReport } from 'types/StrategicReport';
import BillingSubscribeModal from '@/app/dashboard/billing/BillingSubscribeModal';
import Tabs from '@/components/ui/Tabs';
import Card from '@/components/ui/Card';
import DeltaBadge from '@/components/ui/DeltaBadge';
import ConfidencePill from '@/components/ui/ConfidencePill';
import Drawer from '@/components/ui/Drawer';
import Heatmap from '@/components/ui/Heatmap';
import EvidenceBadge from '@/components/ui/EvidenceBadge';

type ApiResponse = {
  status: 'ready' | 'building' | 'error';
  report?: StrategicReport;
  expiresAt?: string;
  error?: string;
};

interface Props {
  userId: string;
}

export default function StrategicReportClient({ userId }: Props) {
  const [periodDays, setPeriodDays] = useState<number>(30);
  const cacheKey = useMemo(() => `strategic-report:${userId}:${periodDays}`, [userId, periodDays]);

  const fetcher = async (): Promise<ApiResponse> => {
    const res = await fetch(`/api/reports/strategic/${userId}?periodDays=${periodDays}`);
    if (res.status === 401) throw new Error('unauthorized');
    if (res.status === 403) throw new Error('forbidden');
    if (!res.ok) throw new Error('failed');
    return res.json();
  };

  const { data, loading, error, refresh } = useCachedFetch<ApiResponse>(cacheKey, fetcher, 5 * 60 * 1000);

  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [showBilling, setShowBilling] = useState(false);

  const [activeTab, setActiveTab] = useState<'resumo' | 'oportunidades' | 'calendario' | 'roteiros' | 'inspiracoes'>('resumo');
  const [openHowTo, setOpenHowTo] = useState(false);
  const [howToContext, setHowToContext] = useState<{ title: string; rationale?: string } | null>(null);

  const handleRegenerate = async () => {
    setRegenLoading(true);
    setRegenError(null);
    try {
      const res = await fetch(`/api/reports/strategic/${userId}?periodDays=${periodDays}`, { method: 'POST' });
      if (res.status === 401) throw new Error('unauthorized');
      if (res.status === 403) throw new Error('forbidden');
      if (!res.ok) throw new Error('failed');
      await refresh();
    } catch (e: any) {
      setRegenError(e?.message || 'Falha ao regenerar.');
    } finally {
      setRegenLoading(false);
    }
  };

  if (error === 'unauthorized') {
    return <div className="p-6">Faça login para acessar o relatório estratégico.</div>;
  }
  if (error === 'forbidden') {
    return (
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-2">Relatório Estratégico (Pro)</h2>
        <p className="text-sm text-gray-600 mb-4">Assine o plano Pro para desbloquear recomendações personalizadas e oportunidades.</p>
        <div className="flex gap-3 mb-4">
          <button className="bg-black text-white px-3 py-2 rounded text-sm" onClick={() => setShowBilling(true)}>Assinar Pro</button>
          <button className="border px-3 py-2 rounded text-sm" onClick={() => refresh()}>Tentar novamente</button>
        </div>
        <PlanTeaser />
        <BillingSubscribeModal open={showBilling} onClose={() => setShowBilling(false)} />
      </div>
    );
  }

  const report = data?.report;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Relatório Estratégico</h1>
          <p className="text-sm text-gray-600">Período analisado:&nbsp;
            <select
              className="border rounded px-2 py-1 text-sm"
              value={periodDays}
              onChange={(e) => setPeriodDays(parseInt(e.target.value, 10))}
            >
              <option value={30}>Últimos 30 dias</option>
              <option value={90}>Últimos 90 dias</option>
            </select>
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="border px-3 py-2 rounded text-sm"
            onClick={() => refresh()}
            disabled={loading}
          >Atualizar</button>
          <button
            className="bg-black text-white px-3 py-2 rounded text-sm disabled:opacity-60"
            onClick={handleRegenerate}
            disabled={regenLoading}
          >{regenLoading ? 'Gerando…' : 'Regenerar'}</button>
        </div>
      </div>

      {regenError && <div className="text-red-600 text-sm">{regenError}</div>}

      {loading && (
        <div className="space-y-3">
          <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
          <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
          <div className="grid md:grid-cols-2 gap-3">
            <div className="h-24 bg-gray-100 rounded animate-pulse" />
            <div className="h-24 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>
      )}

      {!loading && data?.status === 'building' && (
        <div className="text-sm text-gray-700 border rounded p-3 bg-amber-50">
          Este relatório está sendo gerado. Você pode aguardar alguns segundos e clicar em “Atualizar”.
        </div>
      )}

      {!loading && data?.status !== 'building' && report && (
        <div className="space-y-6">
          <Tabs
            items={[
              { key: 'resumo', label: 'Resumo' },
              { key: 'oportunidades', label: 'Oportunidades' },
              { key: 'calendario', label: 'Calendário' },
              { key: 'roteiros', label: 'Roteiros' },
              { key: 'inspiracoes', label: 'Inspirações' },
            ]}
            value={activeTab}
            onChange={(key) => setActiveTab(key as 'resumo' | 'oportunidades' | 'calendario' | 'roteiros' | 'inspiracoes')}
            className="border-b pb-2"
          />

          {activeTab === 'resumo' && (
            <div className="space-y-6">
              <Card variant="brand" title="Resumo" subtitle={report.summary.dataSufficiencyNote ?? undefined}>
                <div className="text-sm text-gray-800">
                  <div className="font-medium mb-1">{report.summary.title}</div>
                  <p>{report.summary.intro}</p>
                </div>
              </Card>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold">Insights Principais</h3>
                </div>
                {report.keyInsights.length === 0 ? (
                  <p className="text-sm text-gray-600">Sem insights fortes para o período selecionado.</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {report.keyInsights.map((i) => (
                      <Card key={i.id} variant="brand" density="compact" title={i.statement} actions={
                        <EvidenceBadge title="Evidências" refs={(i.evidenceRefs as any) || []} />
                      }>
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {typeof i.upliftPct === 'number' && (
                            <DeltaBadge value={i.upliftPct} />
                          )}
                          <ConfidencePill confidence={i.confidence} n={i.sampleSize} />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>

              {report.narrative && (
                <Card variant="brand" title="Resumo Narrativo">
                  <div className="text-sm text-gray-800">
                    <p>{report.narrative.intro}</p>
                    {report.narrative.body.map((p, idx) => (
                      <p key={idx} className="mt-1">{p}</p>
                    ))}
                    <p className="mt-1">{report.narrative.conclusion}</p>
                  </div>
                </Card>
              )}

              <div className="text-xs text-gray-500">Expira em: {data?.expiresAt ? new Date(data.expiresAt).toLocaleString() : '—'}</div>
            </div>
          )}

          {activeTab === 'oportunidades' && (
            <div className="space-y-3">
              {report.commercialOpportunities.length === 0 ? (
                <p className="text-sm text-gray-600">Sem oportunidades ranqueadas no momento.</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {report.commercialOpportunities.map((o) => (
                    <Card key={o.id} variant="brand" density="compact" title={o.category} subtitle={o.rationale}>
                      <div className="mt-1 flex items-center gap-2 flex-wrap text-sm">
                        <span className="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs text-blue-700 bg-blue-50 border-blue-200">
                          Score: {(o.score * 100).toFixed(0)}%
                        </span>
                        {typeof o.upliftPct === 'number' && <DeltaBadge value={o.upliftPct} />}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                        <div className="border rounded p-2 bg-white">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Contexto</div>
                          <p className="text-gray-700">{o.rationale}</p>
                        </div>
                        <div className="border rounded p-2 bg-white">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Passos práticos</div>
                          <ol className="list-decimal pl-5 space-y-1">
                            <li>Defina o objetivo (salvos, compartilhamentos ou visitas ao perfil).</li>
                            <li>Adapte um roteiro compatível na aba “Roteiros”.</li>
                            <li>Publique no melhor horário sugerido na aba “Calendário”.</li>
                            <li>Reforce nos Stories 2–6h após publicar (enquete/CTA).</li>
                            <li>Após 48h, registre e repita a variação promissora.</li>
                          </ol>
                        </div>
                        <div className="border rounded p-2 bg-white">
                          <div className="text-xs font-semibold text-gray-700 mb-1">KPIs</div>
                          <div className="flex flex-wrap gap-2">
                            <span className="text-[11px] border rounded-full px-2 py-0.5 text-gray-700 bg-gray-50 border-gray-200">Interações</span>
                            <span className="text-[11px] border rounded-full px-2 py-0.5 text-gray-700 bg-gray-50 border-gray-200">Salvos</span>
                            <span className="text-[11px] border rounded-full px-2 py-0.5 text-gray-700 bg-gray-50 border-gray-200">Compartilhamentos</span>
                            <span className="text-[11px] border rounded-full px-2 py-0.5 text-gray-700 bg-gray-50 border-gray-200">Alcance</span>
                          </div>
                        </div>
                        <div className="border rounded p-2 bg-white">
                          <div className="text-xs font-semibold text-gray-700 mb-1">Riscos/Observações</div>
                          <ul className="list-disc pl-5 space-y-1 text-gray-700">
                            <li>Amostra limitada pode reduzir confiança do impacto.</li>
                            <li>Evite saturação do tema; varie formatos/ângulos.</li>
                            <li>Ajuste a proposta conforme feedback nos comentários.</li>
                          </ul>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'calendario' && (
            <div className="space-y-4">
              {report.evidence?.timeBuckets && report.evidence.timeBuckets.length > 0 && (
                <Card title="Mapa de Horários" density="compact">
                  <Heatmap buckets={report.evidence.timeBuckets as any} />
                </Card>
              )}
              <Card title="Plano da Semana" density="compact">
                <div className="text-sm text-gray-700">{report.weeklyPlan.cadence}</div>
                <ol className="list-decimal pl-5 text-sm space-y-1 mt-2">
                  {report.weeklyPlan.actions.map((a) => (
                    <li key={a.order}>{a.title}{a.slot ? ` — ${a.slot.day} ${a.slot.hour}h` : ''}</li>
                  ))}
                </ol>
              </Card>
              <Card title="Correlações de Tempo" density="compact">
                {report.correlations.filter(c => c.dimension === 'time').length === 0 ? (
                  <p className="text-sm text-gray-600">Sem correlações relevantes de tempo.</p>
                ) : (
                  <ul className="text-sm space-y-2">
                    {report.correlations.filter(c => c.dimension === 'time').map(c => (
                      <li key={c.id} className="flex items-center gap-2 flex-wrap">
                        <span className="text-gray-800">{c.insightText} ({c.metric})</span>
                        {typeof c.coeffOrDelta === 'number' && <DeltaBadge value={c.coeffOrDelta} />}
                        <ConfidencePill confidence={c.significance} n={c.sampleSize} />
                        <EvidenceBadge title="Evidências" refs={(c.evidenceRefs as any) || []} />
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}

          {activeTab === 'roteiros' && (
            <div className="grid md:grid-cols-2 gap-4">
              {report.scriptSuggestions.length === 0 ? (
                <p className="text-sm text-gray-600">Sem sugestões no momento.</p>
              ) : report.scriptSuggestions.map((s) => {
                const best = s.bestSlots?.[0];
                return (
                  <Card key={s.id} variant="brand" density="compact" title={`${s.format} — ${s.theme}`} subtitle={s.why}>
                    <ol className="list-decimal pl-5 text-sm space-y-1">
                      {s.steps.map((st) => (<li key={st.order}>{st.text}</li>))}
                    </ol>
                    {best && (
                      <div className="text-xs text-gray-500 mt-2">Melhor horário: {best.day} {best.hour}h</div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {activeTab === 'inspiracoes' && (
            <div className="grid md:grid-cols-2 gap-4">
              {report.communityInspirations.length === 0 ? (
                <p className="text-sm text-gray-600">Sem inspirações no momento.</p>
              ) : report.communityInspirations.map((ci) => (
                <Card key={ci.id} variant="brand" density="compact" title={ci.handleOrAnon} subtitle={`${ci.format} · ${ci.proposal} · ${ci.context}`}>
                  <div className="text-sm">{ci.whyItWorks}</div>
                  {ci.link && <a className="text-blue-600 text-xs" href={ci.link} target="_blank" rel="noreferrer">Ver post</a>}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
      <Drawer open={openHowTo} onClose={() => setOpenHowTo(false)} title={`Como executar — ${howToContext?.title ?? ''}`}>
        <div className="text-sm space-y-3">
          {howToContext?.rationale && (
            <p className="text-gray-700">Por que fazer: {howToContext.rationale}</p>
          )}
          <ol className="list-decimal pl-5 space-y-1">
            <li>Defina o objetivo do post (salvamentos, compartilhamentos ou visitas ao perfil).</li>
            <li>Adapte um roteiro compatível na aba “Roteiros”.</li>
            <li>Publique no melhor horário sugerido na aba “Calendário”.</li>
            <li>Reforce nos Stories entre 2–6h após publicar (enquete ou CTA).</li>
            <li>Após 48h, registre o desempenho e repita a variação promissora.</li>
          </ol>
          <p className="text-xs text-gray-500">Dica: gancho claro nos primeiros 3s, proposta explícita e CTA específico.</p>
        </div>
      </Drawer>
    </div>
  );
}
