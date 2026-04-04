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
import type { StrategicReport } from 'types/StrategicReport';
import useBillingStatus from '@/app/hooks/useBillingStatus';
import { isPlanActiveLike } from '@/utils/planStatus';
import { PRO_PLAN_FLEXIBILITY_COPY } from '@/app/constants/trustCopy';
import { openPaywallModal } from '@/utils/paywallModal';
import {
  formatCommunityInspirationSubtitle,
  getStrategicQuickStats,
} from '@/app/lib/strategicReportPresentation';

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
    <section className="bg-transparent">
      <div className="dashboard-page-shell space-y-4 py-6">
        <h2 className="text-2xl font-bold tracking-[-0.03em] text-zinc-950">Relatório Estratégico</h2>

        {!isActiveLike && (
          <Card
            variant="brand"
            title="Desbloqueie o Relatório Estratégico"
            subtitle="Transforme seu Mídia Kit em um relatório completo, com horários, leituras editoriais e benchmarks prontos para enviar às marcas."
          >
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="dashboard-panel-subtle rounded-[1.35rem] px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-900">Insights Prioritários</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Impacto estimado, confiança e próximos passos guiados pela IA.
                  </p>
                </div>
                <div className="dashboard-panel-subtle rounded-[1.35rem] px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-900">Roteiros & Calendário</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Formatos, ganchos e melhores horários para manter o plano no ritmo.
                  </p>
                </div>
                <div className="dashboard-panel-subtle rounded-[1.35rem] px-4 py-3">
                  <p className="text-sm font-semibold text-zinc-900">Provas & Oportunidades</p>
                  <p className="mt-1 text-xs text-zinc-600">
                    Benchmarks do seu nicho, peças de mídia kit e próximos pitches.
                  </p>
                </div>
              </div>

              <div className="dashboard-dark-spotlight rounded-[1.75rem] px-5 py-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-pink-200">
                  <span aria-hidden="true">👀</span> Peek do Modo Pro
                </div>
                <p className="mt-3 text-sm font-semibold text-white">
                  Camadas que mais puxam crescimento nas últimas semanas
                </p>
                <div className="mt-2 flex flex-wrap gap-2" aria-hidden="true">
                  {["Converter", "Review", "Quebra de Mito"].map((chip) => (
                    <span
                      key={chip}
                      className="dashboard-glass-pill rounded-full px-3 py-1 text-sm font-semibold text-zinc-100 shadow-sm blur-[2px]"
                    >
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="sr-only">
                  Prévia borrada das categorias de maior crescimento — disponível ao ativar o Modo
                  Pro.
                </p>
                <p className="mt-3 text-xs text-zinc-300">
                  Reels ↑ +22% com essas leituras. Ative o Plano Pro para ver por que, os dias
                  ideais e as combinações que destravam alcance.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-300">
                  <span className="dashboard-glass-pill inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium">
                    Benchmarks por categoria
                  </span>
                  <span className="dashboard-glass-pill inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium">
                    Heatmap de horários
                  </span>
                  <span className="dashboard-glass-pill inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium">
                    Insights semanais
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() =>
                    openPaywallModal({ context: 'planning', source: 'strategic_report_inline_primary' })
                  }
                  className="dashboard-primary-button inline-flex w-full items-center justify-center rounded-[1rem] px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black sm:w-auto"
                >
                  Ativar Plano Pro
                </button>
                <button
                  type="button"
                  onClick={() => openPaywallModal({ context: 'planning', source: 'strategic_report_inline' })}
                  className="dashboard-secondary-button inline-flex w-full items-center justify-center rounded-[1rem] px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 sm:w-auto"
                >
                  Ver planos completos
                </button>
              </div>
              <p className="text-[11px] text-zinc-500">{PRO_PLAN_FLEXIBILITY_COPY}</p>
            </div>
          </Card>
        )}

        {isActiveLike && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => refresh()} className="dashboard-secondary-button rounded-full px-3 py-2 text-xs font-semibold">Atualizar</button>
              <button onClick={handleRegenerate} disabled={regenLoading} className="dashboard-secondary-button rounded-full px-3 py-2 text-xs font-semibold disabled:opacity-60">
                {regenLoading ? 'Gerando…' : 'Regenerar'}
              </button>
              <label className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Período:
                <select
                  className="dashboard-select rounded-full px-3 py-1.5 text-xs font-semibold normal-case tracking-normal"
                  value={periodDays}
                  onChange={(e) => setPeriodDays(parseInt(e.target.value, 10))}
                >
                  <option value={30}>Últimos 30 dias</option>
                  <option value={90}>Últimos 90 dias</option>
                </select>
              </label>
            </div>

            {regenError && <div className="text-xs text-rose-600">{regenError}</div>}

            {loading && (
              <div className="grid md:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="dashboard-panel-subtle rounded-[1.35rem] p-4">
                    <div className="h-4 w-1/2 rounded bg-zinc-200 animate-pulse" />
                    <div className="mt-3 h-20 rounded bg-zinc-100 animate-pulse" />
                    <div className="mt-3 h-3 w-2/3 rounded bg-zinc-200 animate-pulse" />
                  </div>
                ))}
              </div>
            )}

            {!loading && report && (
              <>
                {/* Destaques rápidos */}
                {(() => {
                  const quickStats = getStrategicQuickStats(report);
                  if (!quickStats.length) return null;

                  return (
                    <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-3">
                      {quickStats.map((stat) => (
                        <QuickStatCard
                          key={stat.key}
                          title={stat.title}
                          value={stat.value}
                          hint={stat.hint}
                          deltaPct={stat.deltaPct}
                        />
                      ))}
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
                  <Card variant="brand" title="Resumo narrativo" actions={<button className="dashboard-secondary-button rounded-full px-2.5 py-1 text-xs font-semibold" onClick={() => setExpandNarrative(v => !v)}>{expandNarrative ? 'Recolher' : 'Ver completo'}</button>}>
                    <div className="space-y-1 text-sm text-zinc-800">
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
                      <button className="dashboard-secondary-button rounded-full px-2.5 py-1 text-xs font-semibold" onClick={() => setShowAllInsights(v => !v)}>
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
                            <p className="mb-2 text-xs text-zinc-500">Sinais emergentes (amostra/confiança limitada):</p>
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
                          <p className="text-sm text-zinc-600">Sem insights prioritários no período.</p>
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
                                <div className="mt-2 text-xs text-zinc-500">Melhor horário: {best.day} {best.hour}h</div>
                              )}
                              {s.cta && (
                                <div className="mt-2 text-xs font-medium text-zinc-700">CTA: {s.cta}</div>
                              )}
                            </Card>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-600">Sem roteiros destacados.</p>
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
                      <p className="mt-1 text-xs text-zinc-500">Estimado a partir da variação vs. mediana. Confiança: {typeof corr.significance === 'number' ? `${Math.round((corr.significance as number) * 100)}%` : '—'}</p>
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
                            <span className="inline-flex items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-2.5 py-1 text-xs font-semibold text-pink-700">Score {(o.score * 100).toFixed(0)}%</span>
                            {typeof o.upliftPct === 'number' && <span className="text-xs text-zinc-500">(+{o.upliftPct.toFixed(0)}%)</span>}
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                            <div className="dashboard-panel-subtle rounded-[1rem] p-2">
                              <div className="mb-1 text-xs font-semibold text-zinc-700">Leitura</div>
                              <p className="text-zinc-700">{o.rationale}</p>
                            </div>
                            <div className="dashboard-panel-subtle rounded-[1rem] p-2">
                              <div className="mb-1 text-xs font-semibold text-zinc-700">Passos práticos</div>
                              <ol className="list-decimal pl-5 space-y-1">
                                <li>Defina o objetivo (salvos, compartilhamentos ou visitas ao perfil).</li>
                                <li>Adapte um roteiro compatível em “Roteiros prontos”.</li>
                                <li>Publique no melhor horário sugerido em “Análise por horário”.</li>
                                <li>Reforce nos Stories 2–6h após publicar (enquete/CTA).</li>
                                <li>Após 48h, registre o desempenho e repita a variação promissora.</li>
                              </ol>
                            </div>
                            <div className="dashboard-panel-subtle rounded-[1rem] p-2">
                              <div className="mb-1 text-xs font-semibold text-zinc-700">KPIs</div>
                              <div className="flex flex-wrap gap-2">
                                <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">Interações</span>
                                <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">Salvos</span>
                                <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">Compartilhamentos</span>
                                <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">Alcance</span>
                              </div>
                            </div>
                            <div className="dashboard-panel-subtle rounded-[1rem] p-2">
                              <div className="mb-1 text-xs font-semibold text-zinc-700">Riscos/Observações</div>
                              <ul className="list-disc pl-5 space-y-1 text-zinc-700">
                                <li>Amostra limitada pode reduzir confiança do impacto.</li>
                                <li>Evite saturação; varie narrativas, provas e ângulos.</li>
                                <li>Ajuste a abordagem conforme o retorno nos comentários.</li>
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
                      <p className="mb-2 text-xs text-zinc-600">Melhor horário sugerido: {report.weeklyPlan.bestSlots[0].day} {report.weeklyPlan.bestSlots[0].hour}h</p>
                    )}
                    <ol className="list-decimal pl-5 text-sm space-y-1">
                      {report.weeklyPlan.actions?.map((a) => (
                        <li key={a.order}>{a.title}</li>
                      ))}
                    </ol>
                    {report.weeklyPlan.reminders?.length ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-zinc-600">
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
                        <div key={ci.id} className="dashboard-panel-subtle rounded-[1rem] p-2">
                          <div className="text-sm font-medium">{ci.handleOrAnon}</div>
                          <div className="text-xs text-zinc-500">{formatCommunityInspirationSubtitle(ci)}</div>
                          <div className="text-sm mt-1">{ci.whyItWorks}</div>
                          {ci.link && <a className="text-xs font-semibold text-pink-600" href={ci.link} target="_blank" rel="noreferrer">Ver post</a>}
                        </div>
                      ))}
                    </div>
                  </Card>
                ) : null}

                {/* Correlações completas */}
                {report.correlations?.length ? (
                  <Card variant="brand" title="Correlações" actions={
                    report.correlations.length > 6 ? (
                      <button className="dashboard-secondary-button rounded-full px-2.5 py-1 text-xs font-semibold" onClick={() => setShowAllCorrelations(v => !v)}>
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
                            <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">{c.dimension}</span>
                            <span className="inline-flex rounded-full border border-zinc-200 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-700">{String(c.metric)}</span>
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
              <div className="dashboard-empty-state rounded-[1.75rem] p-5 text-zinc-900">
                <h3 className="text-base font-semibold tracking-[-0.02em]">Estamos coletando seus dados recentes 📊</h3>
                <p className="mt-1 text-sm text-zinc-700">
                  Em até 24h seu Relatório Estratégico estará pronto com métricas completas e oportunidades por
                  categoria.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/planning/whatsapp"
                    className="dashboard-primary-button inline-flex items-center justify-center rounded-[1rem] px-4 py-2 text-sm font-semibold"
                  >
                    Avisar quando estiver pronto
                  </Link>
                  <Link
                    href="/dashboard/instagram/faq"
                    className="dashboard-secondary-button inline-flex items-center justify-center rounded-[1rem] px-4 py-2 text-sm font-semibold"
                  >
                    Entenda como os dados são coletados
                  </Link>
                </div>
              </div>
            )}

            {error && (
              <p className="text-sm text-rose-600">Falha ao carregar o relatório.</p>
            )}
          </div>
        )}
      </div>
      <Drawer open={openHowTo} onClose={() => setOpenHowTo(false)} title={`Como executar — ${howToContext?.title ?? ''}`}>
        <div className="text-sm space-y-3">
          {howToContext?.rationale && (
            <p className="text-zinc-700">Por que fazer: {howToContext.rationale}</p>
          )}
          <ol className="list-decimal pl-5 space-y-1">
            <li>Defina o objetivo do post (salvamentos, compartilhamentos ou visitas ao perfil).</li>
            <li>Adapte um roteiro compatível na seção “Roteiros sugeridos”.</li>
            <li>Publique no melhor horário sugerido acima.</li>
            <li>Reforce nos Stories entre 2–6h após publicar (enquete ou CTA).</li>
            <li>Após 48h, registre o desempenho e repita a variação promissora.</li>
          </ol>
          <p className="text-xs text-zinc-500">Dica: gancho claro nos primeiros 3s, promessa explícita e CTA específico.</p>
        </div>
      </Drawer>
    </section>
  );
}
