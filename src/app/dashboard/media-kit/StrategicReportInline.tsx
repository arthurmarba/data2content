"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import useCachedFetch from '@/hooks/useCachedFetch';
import Card from '@/components/ui/Card';
import DeltaBadge from '@/components/ui/DeltaBadge';
import ConfidencePill from '@/components/ui/ConfidencePill';
import EvidenceBadge from '@/components/ui/EvidenceBadge';
import Drawer from '@/components/ui/Drawer';
import QuickStatCard from '@/components/ui/QuickStatCard';
import Heatmap from '@/components/ui/Heatmap';
import BillingSubscribeModal from '@/app/dashboard/billing/BillingSubscribeModal';
import type { StrategicReport } from 'types/StrategicReport';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { isPlanActiveLike } from '@/utils/planStatus';
import { PRO_PLAN_FLEXIBILITY_COPY } from '@/app/constants/trustCopy';

type ApiResponse = {
  status: 'ready' | 'building' | 'error';
  report?: StrategicReport;
  expiresAt?: string;
  error?: string;
};

export default function StrategicReportInline() {
  const { data: session } = useSession();
  const userId = (session as any)?.user?.id as string | undefined;
  const billingStatus = useBillingStatus();
  const planStatus = (session as any)?.user?.planStatus;
  const isActiveLike = useMemo(
    () => Boolean(billingStatus.hasPremiumAccess || isPlanActiveLike(planStatus)),
    [billingStatus.hasPremiumAccess, planStatus]
  );

  const [periodDays, setPeriodDays] = useState<number>(30);
  const [showBilling, setShowBilling] = useState(false);
  const [regenLoading, setRegenLoading] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [openHowTo, setOpenHowTo] = useState(false);
  const [howToContext, setHowToContext] = useState<{ title: string; rationale?: string } | null>(null);
  const [expandNarrative, setExpandNarrative] = useState(false);

  const cacheKey = useMemo(() => (userId ? `strategic-report:inline:${userId}:${periodDays}` : ''), [userId, periodDays]);

  const fetcher = async (): Promise<ApiResponse> => {
    if (!userId) throw new Error('unauthenticated');
    const res = await fetch(`/api/reports/strategic/${userId}?periodDays=${periodDays}`);
    if (res.status === 401) throw new Error('unauthorized');
    if (res.status === 403) throw new Error('forbidden');
    if (!res.ok) throw new Error('failed');
    return res.json();
  };

  const shouldFetch = isActiveLike && !!userId;
  const { data, loading, error, refresh } = useCachedFetch<ApiResponse>(
    shouldFetch ? cacheKey : `skip:${cacheKey}`,
    async () => (shouldFetch ? fetcher() : Promise.resolve({ status: 'error', error: 'disabled' } as ApiResponse)),
    5 * 60 * 1000
  );
  const report = data?.report;
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [showAllCorrelations, setShowAllCorrelations] = useState(false);

  const handleRegenerate = async () => {
    if (!userId) return;
    setRegenLoading(true);
    setRegenError(null);
    try {
      const res = await fetch(`/api/reports/strategic/${userId}?periodDays=${periodDays}`, { method: 'POST' });
      if (res.status === 401) throw new Error('unauthorized');
      if (res.status === 403) throw new Error('forbidden');
      if (!res.ok) throw new Error('failed');
      await refresh();
    } catch (e: any) {
      setRegenError(e?.message || 'Falha ao regenerar relatório');
    } finally {
      setRegenLoading(false);
    }
  };

  function mapDayOfWeekName(day?: number): string {
    const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    if (!day || !Number.isFinite(day)) return 'Dia';
    const idx = Math.max(1, Math.min(7, day)) - 1;
    return names[idx] ?? 'Dia';
  }

  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">Relatório Estratégico</h2>

        {!isActiveLike && (
          <Card
            variant="brand"
            title="Desbloqueie o Relatório Estratégico"
            subtitle="Transforme seu Mídia Kit em um relatório completo, com horários, categorias e benchmarks prontos para enviar às marcas."
          >
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-white/40 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Insights Prioritários</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Impacto estimado, confiança e próximos passos guiados pela IA.
                  </p>
                </div>
                <div className="rounded-lg border border-white/40 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Roteiros & Calendário</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Formatos, ganchos e melhores horários para manter o plano no ritmo.
                  </p>
                </div>
                <div className="rounded-lg border border-white/40 bg-white px-4 py-3 shadow-sm">
                  <p className="text-sm font-semibold text-slate-900">Provas & Oportunidades</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Benchmarks do seu nicho, peças de mídia kit e próximos pitches.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-white/60 bg-white/95 px-5 py-4 shadow-[0_18px_48px_rgba(15,23,42,0.1)]">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-brand-purple">
                  <span aria-hidden="true">👀</span> Peek do modo PRO
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-900">
                  Categorias que mais puxam crescimento nas últimas semanas
                </p>
                <div className="mt-2 flex flex-wrap gap-2" aria-hidden="true">
                  {["Lifestyle", "Tutoriais", "Bastidores"].map((chip) => (
                    <span
                      key={chip}
                      className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-800 shadow-sm blur-[2px]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="sr-only">
                  Prévia borrada das categorias de maior crescimento — disponível ao ativar o modo
                  PRO.
                </p>
                <p className="mt-3 text-xs text-slate-600">
                  Reels ↑ +22% com essas categorias. Ative 48h de trial para ver o porquê, dias ideais
                  e formatos que destravam alcance.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">
                    ⏳ 48h grátis
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                    Benchmarks por categoria
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                    Heatmap de horários
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event('open-subscribe-modal' as any))}
                  className="inline-flex w-full items-center justify-center rounded-lg bg-black px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black sm:w-auto"
                >
                  Ativar trial de 48h
                </button>
                <button
                  type="button"
                  onClick={() => setShowBilling(true)}
                  className="inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 sm:w-auto"
                >
                  Ver planos completos
                </button>
              </div>
              <p className="text-[11px] text-slate-600">{PRO_PLAN_FLEXIBILITY_COPY}</p>
            </div>

            <BillingSubscribeModal open={showBilling} onClose={() => setShowBilling(false)} />
          </Card>
        )}

        {isActiveLike && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => refresh()} className="border px-3 py-2 rounded text-xs">Atualizar</button>
              <button onClick={handleRegenerate} disabled={regenLoading} className="border px-3 py-2 rounded text-xs disabled:opacity-60">
                {regenLoading ? 'Gerando…' : 'Regenerar'}
              </button>
              <label className="text-xs text-gray-600 inline-flex items-center gap-2">
                Período:
                <select
                  className="border rounded px-2 py-1 text-xs"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(parseInt(e.target.value, 10))}
                >
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>
              </label>
            </div>

            {regenError && <div className="text-xs text-red-600">{regenError}</div>}

            {loading && (
              <div className="grid md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 border border-gray-200 rounded-xl bg-white">
                    <div className="h-4 w-1/2 bg-gray-200 rounded animate-pulse" />
                    <div className="mt-3 h-20 bg-gray-100 rounded animate-pulse" />
                    <div className="mt-3 h-3 w-2/3 bg-gray-200 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {!loading && report && (
              <>
                {/* Destaques rápidos */}
                {(() => {
                  const buckets = (report as any)?.evidence?.timeBuckets as Array<{ dayOfWeek: number; hour: number; avg: number; count?: number }> | undefined;
                  const bestSlot = Array.isArray(buckets) && buckets.length ? [...buckets].sort((a, b) => (b?.avg ?? 0) - (a?.avg ?? 0))[0] : undefined;
                  const mapDay = (d?: number) => {
                    const names = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                    if (!d || !Number.isFinite(d)) return '—';
                    const idx = Math.max(1, Math.min(7, d)) - 1;
                    return names[idx] ?? '—';
                  };
                  const ga = ((report as any)?.evidence?.groupingAverages as Array<{ dimension: string; name: string; value: number; postsCount: number }>) || [];
                  const topBy = (dim: string) => {
                    const list = ga.filter(g => g.dimension === dim);
                    if (!list.length) return undefined;
                    return [...list].sort((a, b) => (b.value ?? 0) - (a.value ?? 0))[0];
                  };
                  const topFormatSaved = topBy('format'); // valor ~ saved médio
                  const topProposalShares = topBy('proposal'); // valor ~ shares médio
                  const topContextInteractions = topBy('context'); // valor ~ interações médias
                  const corrComments = report.correlations?.find((c: any) => c.id === 'corr_time_comments');

                  if (!bestSlot && !topFormatSaved && !topProposalShares && !topContextInteractions && !corrComments) return null;

                  return (
                    <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
                      {bestSlot && (
                        <QuickStatCard
                          title="Melhor horário (interações)"
                          value={`${mapDay(bestSlot.dayOfWeek)} · ${bestSlot.hour}h`}
                          hint={`média ${Math.round(bestSlot.avg).toLocaleString('pt-BR')} · n=${bestSlot.count}`}
                        />
                      )}
                      {corrComments && (
                        <QuickStatCard
                          title="Melhor horário (comentários)"
                          value={corrComments.insightText}
                          hint="Δ vs mediana"
                          deltaPct={corrComments.coeffOrDelta}
                        />
                      )}
                      {topFormatSaved && (
                        <QuickStatCard
                          title="Top formato (salvos)"
                          value={topFormatSaved.name}
                          hint={`média ${Math.round(topFormatSaved.value)}`}
                        />
                      )}
                      {topProposalShares && (
                        <QuickStatCard
                          title="Top proposta (compartilhamentos)"
                          value={topProposalShares.name}
                          hint={`média ${Math.round(topProposalShares.value)}`}
                        />
                      )}
                      {topContextInteractions && (
                        <QuickStatCard
                          title="Top contexto (interações)"
                          value={topContextInteractions.name}
                          hint={`média ${Math.round(topContextInteractions.value)}`}
                        />
                      )}
                    </div>
                  );
                })()}

                {/* Heatmap de horários */}
                {Array.isArray((report as any)?.evidence?.timeBuckets) && (report as any).evidence.timeBuckets.length > 0 && (
                  <Card variant="brand" title="Heatmap de horários" subtitle="Cores mais intensas indicam maior média de interações">
                    <div className="mt-2">
                      <Heatmap buckets={(report as any).evidence.timeBuckets as any} />
                    </div>
                  </Card>
                )}

                <Card variant="brand" title="Resumo" subtitle={report.summary?.dataSufficiencyNote || undefined}>
                  <p className="text-sm">{report.summary?.intro}</p>
                </Card>

                {report.narrative && (
                  <Card variant="brand" title="Resumo narrativo" actions={<button className="text-xs border px-2 py-1 rounded" onClick={() => setExpandNarrative(v => !v)}>{expandNarrative ? 'Recolher' : 'Ver completo'}</button>}>
                    <div className="text-sm text-gray-800 space-y-1">
                      <p>{report.narrative.intro}</p>
                      {(expandNarrative ? report.narrative.body : report.narrative.body?.slice(0,1))?.map((p, idx) => (
                        <p key={idx}>{p}</p>
                      ))}
                      {expandNarrative && <p>{report.narrative.conclusion}</p>}
                    </div>
                  </Card>
                )}

                <div className="grid md:grid-cols-2 gap-4">
                  <Card variant="brand" title="Principais Insights" actions={
                    report.keyInsights?.length > 6 ? (
                      <button className="text-xs border px-2 py-1 rounded" onClick={() => setShowAllInsights(v => !v)}>
                        {showAllInsights ? 'Ver menos' : 'Ver todos'}
                      </button>
                    ) : undefined
                  }>
                    {report.keyInsights?.length ? (
                      <div className="grid md:grid-cols-2 gap-3">
                        {([...report.keyInsights]
                          .sort((a, b) => Math.abs((b.upliftPct ?? 0)) - Math.abs((a.upliftPct ?? 0)))
                          .slice(0, showAllInsights ? report.keyInsights.length : 6)
                        ).map((i) => (
                          <Card key={i.id} density="compact" variant="brand" title={i.statement} actions={<EvidenceBadge title="Evidências" refs={(i.evidenceRefs as any) || []} />}>
                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                              {typeof i.upliftPct === 'number' && <DeltaBadge value={i.upliftPct} />}
                              <ConfidencePill confidence={i.confidence} n={i.sampleSize} />
                            </div>
                          </Card>
                        ))}
                      </div>
                    ) : (
                      <>
                        {report.correlations?.length ? (
                          <div>
                            <p className="text-xs text-gray-500 mb-2">Sinais emergentes (amostra/confiança limitada):</p>
                            <div className="grid md:grid-cols-2 gap-3">
                              {([...report.correlations]
                                  .sort((a, b) => Math.abs((b.coeffOrDelta ?? 0)) - Math.abs((a.coeffOrDelta ?? 0)))
                                  .slice(0, 4)
                                ).map((c) => (
                                <Card key={c.id} density="compact" variant="brand" title={c.insightText} actions={<EvidenceBadge title="Evidências" refs={(c.evidenceRefs as any) || []} />}>
                                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                                    {typeof c.coeffOrDelta === 'number' && <DeltaBadge value={c.coeffOrDelta} />}
                                    <ConfidencePill confidence={c.significance} n={c.sampleSize} />
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600">Sem insights prioritários no período.</p>
                        )}
                      </>
                    )}
                  </Card>

                  <Card variant="brand" title="Roteiros prontos">
                    {report.scriptSuggestions?.length ? (
                      <div className="grid md:grid-cols-2 gap-3">
                        {report.scriptSuggestions.map((s) => {
                          const best = s.bestSlots?.[0];
                          return (
                            <Card key={s.id} density="compact" variant="brand" title={`${s.format} — ${s.theme}`} subtitle={s.why}>
                              <ol className="list-decimal pl-5 text-sm space-y-1">
                                {s.steps.map((st) => (<li key={st.order}>{st.text}</li>))}
                              </ol>
                              {best && (
                                <div className="text-xs text-gray-500 mt-2">Melhor horário: {best.day} {best.hour}h</div>
                              )}
                              {s.cta && (
                                <div className="text-xs text-gray-700 mt-2 font-medium">CTA: {s.cta}</div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600">Sem roteiros destacados.</p>
                    )}
                  </Card>
                </div>

                {/* Melhor horário (resumo) */}
                {(() => {
                  const buckets = (report as any)?.evidence?.timeBuckets as Array<{ dayOfWeek: number; hour: number; avg: number; count?: number }> | undefined;
                  if (!Array.isArray(buckets) || buckets.length === 0) return null;
                  const best = [...buckets].sort((a, b) => (b?.avg ?? 0) - (a?.avg ?? 0))[0];
                  const dayName = mapDayOfWeekName(best?.dayOfWeek);
                  if (!best || !isFinite(best.avg)) return null;
                  return (
                    <Card variant="brand" title="Melhor horário (interações)">
                      <p className="text-sm">{dayName} às {best.hour}h apresentou a melhor média de interações neste período.</p>
                    </Card>
                  );
                })()}

                {/* Melhor horário (comentários) — via correlação dedicada se existir */}
                {(() => {
                  const corr = report.correlations?.find((c) => c.id === 'corr_time_comments');
                  if (!corr) return null;
                  return (
                    <Card variant="brand" title="Melhor horário (comentários)">
                      <p className="text-sm">{corr.insightText}</p>
                      <p className="text-xs text-gray-500 mt-1">Estimado a partir da variação vs. mediana. Confiança: {typeof corr.significance === 'number' ? `${Math.round((corr.significance as number) * 100)}%` : '—'}</p>
                    </Card>
                  );
                })()}

                {/* Oportunidades comerciais (completas) */}
                {report.commercialOpportunities?.length ? (
                  <Card variant="brand" title="Oportunidades comerciais">
                    <div className="grid md:grid-cols-2 gap-3">
                      {report.commercialOpportunities.map((o) => (
                        <Card key={o.id} density="compact" variant="brand" title={o.category} subtitle={o.rationale}>
                          <div className="mt-1 flex items-center gap-2 flex-wrap text-sm">
                            <span className="inline-flex items-center gap-1 border rounded-full px-2 py-0.5 text-xs text-blue-700 bg-blue-50 border-blue-200">Score {(o.score * 100).toFixed(0)}%</span>
                            {typeof o.upliftPct === 'number' && <span className="text-xs text-gray-500">(+{o.upliftPct.toFixed(0)}%)</span>}
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
                                <li>Adapte um roteiro compatível em “Roteiros prontos”.</li>
                                <li>Publique no melhor horário sugerido em “Análise por horário”.</li>
                                <li>Reforce nos Stories 2–6h após publicar (enquete/CTA).</li>
                                <li>Após 48h, registre o desempenho e repita a variação promissora.</li>
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
                  </Card>
                ) : null}

                {/* Plano da semana */}
                {report.weeklyPlan ? (
                  <Card variant="brand" title="Plano da semana" subtitle={report.weeklyPlan.cadence}>
                    {report.weeklyPlan.bestSlots?.[0] && (
                      <p className="text-xs text-gray-600 mb-2">Melhor horário sugerido: {report.weeklyPlan.bestSlots[0].day} {report.weeklyPlan.bestSlots[0].hour}h</p>
                    )}
                    <ol className="list-decimal pl-5 text-sm space-y-1">
                      {report.weeklyPlan.actions?.map((a) => (
                        <li key={a.order}>{a.title}</li>
                      ))}
                    </ol>
                    {report.weeklyPlan.reminders?.length ? (
                      <ul className="mt-2 list-disc pl-5 text-xs text-gray-600 space-y-1">
                        {report.weeklyPlan.reminders.map((r, i) => (<li key={i}>{r}</li>))}
                      </ul>
                    ) : null}
                  </Card>
                ) : null}

                {/* Inspirações da comunidade */}
                {report.communityInspirations?.length ? (
                  <Card variant="brand" title="Inspirações">
                    <div className="grid md:grid-cols-2 gap-3">
                      {report.communityInspirations.map((ci) => (
                        <div key={ci.id} className="border border-gray-200 rounded p-2">
                          <div className="text-sm font-medium">{ci.handleOrAnon}</div>
                          <div className="text-xs text-gray-500">{ci.format} · {ci.proposal} · {ci.context}</div>
                          <div className="text-sm mt-1">{ci.whyItWorks}</div>
                          {ci.link && <a className="text-blue-600 text-xs" href={ci.link} target="_blank" rel="noreferrer">Ver post</a>}
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {/* Correlações completas */}
                {report.correlations?.length ? (
                  <Card variant="brand" title="Correlações" actions={
                    report.correlations.length > 6 ? (
                      <button className="text-xs border px-2 py-1 rounded" onClick={() => setShowAllCorrelations(v => !v)}>
                        {showAllCorrelations ? 'Ver menos' : 'Ver todas'}
                      </button>
                    ) : undefined
                  }>
                    <div className="grid md:grid-cols-2 gap-3">
                      {([...report.correlations]
                        .sort((a, b) => Math.abs((b.coeffOrDelta ?? 0)) - Math.abs((a.coeffOrDelta ?? 0)))
                        .slice(0, showAllCorrelations ? report.correlations.length : 6)
                      ).map((c) => (
                        <Card key={c.id} density="compact" variant="brand" title={c.insightText} actions={<EvidenceBadge title="Evidências" refs={(c.evidenceRefs as any) || []} />}>
                          <div className="mt-1 flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] border rounded-full px-2 py-0.5 text-gray-700 bg-gray-50 border-gray-200">{c.dimension}</span>
                            <span className="text-[10px] border rounded-full px-2 py-0.5 text-gray-700 bg-gray-50 border-gray-200">{String(c.metric)}</span>
                            {typeof c.coeffOrDelta === 'number' && <DeltaBadge value={c.coeffOrDelta} />}
                            <ConfidencePill confidence={c.significance} n={c.sampleSize} />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </Card>
                ) : null}
              </>
            )}

            {!loading && !report && !error && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-900">
                <h3 className="text-base font-semibold">Estamos coletando seus dados recentes 📊</h3>
                <p className="mt-1 text-sm text-blue-800">
                  Em até 24h seu Relatório Estratégico estará pronto com métricas completas e oportunidades por
                  categoria.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/dashboard/whatsapp"
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700"
                  >
                    Avisar quando estiver pronto
                  </Link>
                  <Link
                    href="/dashboard/instagram/faq"
                    className="inline-flex items-center justify-center rounded-lg border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-white"
                  >
                    Entenda como os dados são coletados
                  </Link>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600">Falha ao carregar o relatório.</p>
            )}
          </div>
        )}
      </div>
      <Drawer open={openHowTo} onClose={() => setOpenHowTo(false)} title={`Como executar — ${howToContext?.title ?? ''}`}>
        <div className="text-sm space-y-3">
          {howToContext?.rationale && (
            <p className="text-gray-700">Por que fazer: {howToContext.rationale}</p>
          )}
          <ol className="list-decimal pl-5 space-y-1">
            <li>Defina o objetivo do post (salvamentos, compartilhamentos ou visitas ao perfil).</li>
            <li>Adapte um roteiro compatível na seção “Roteiros sugeridos”.</li>
            <li>Publique no melhor horário sugerido acima.</li>
            <li>Reforce nos Stories entre 2–6h após publicar (enquete ou CTA).</li>
            <li>Após 48h, registre o desempenho e repita a variação promissora.</li>
          </ol>
          <p className="text-xs text-gray-500">Dica: gancho claro nos primeiros 3s, proposta explícita e CTA específico.</p>
        </div>
      </Drawer>
    </section>
  );
}
