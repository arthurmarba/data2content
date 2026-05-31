"use client";

import type { ReactNode } from "react";
import type {
  InstagramFormatPerformance,
  InstagramMetricsSummary,
  InstagramWeeklyPerformancePoint,
  InstagramBestDayOfWeek,
  InstagramTerritoryResonance,
} from "@/app/dashboard/boards/videoUpload/instagramMetricsSummaryService";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { DiagnosticoDetailEmptyState } from "./DiagnosticoDetailEmptyState";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { CATEGORY_META } from "./DiagnosticoCategoryMeta";
import { HC, CARD_P, CARD_BODY } from "./diagnosticoTokens";

interface Props {
  instagramMetrics: InstagramMetricsSummary | null;
  instagramConnected: boolean;
  mainNarrativeLabel: string | null;
  onConnectInstagram?: () => void;
  onClose: () => void;
}

export function DiagnosticoInstagramDetailView({
  instagramMetrics,
  instagramConnected,
  mainNarrativeLabel,
  onConnectInstagram,
  onClose,
}: Props) {
  const meta = CATEGORY_META.instagram;

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
    >
      {!instagramConnected ? (
        <DiagnosticoDetailEmptyState
          iconBg="bg-sky-50"
          iconSlot={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="#0284c7" strokeWidth="1.7" />
              <circle cx="12" cy="12" r="4" stroke="#0284c7" strokeWidth="1.7" />
              <circle cx="17.5" cy="6.5" r="1" fill="#0284c7" />
            </svg>
          }
          title="Conecte o Instagram"
          description="Sua análise se cruza com alcance e engajamento reais do seu perfil para uma leitura mais precisa."
          ctaLabel="Conectar Instagram"
          onCta={onConnectInstagram}
        />
      ) : !instagramMetrics ? (
        <DiagnosticoDetailEmptyState
          iconBg="bg-sky-50"
          iconSlot={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="#0284c7" strokeWidth="1.8" />
              <path d="M12 7v5l3 2" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          title="Métricas carregando"
          description="Sintonizando com o seu Instagram para refletir seus padrões..."
        />
      ) : (
        <>
          {/* ── Leitura rápida primeiro: significado antes do número bruto ── */}
          <InstagramInsightCard metrics={instagramMetrics} />

          {/* ── O que ressoa: territórios por conexão (saves + shares) ── */}
          {instagramMetrics.territoryResonance.length > 0 && (
            <InstagramResonanceCard territories={instagramMetrics.territoryResonance} />
          )}

          {/* ── Performance: alcance + barras semanais ── */}
          <InstagramPerformanceCard
            metrics={instagramMetrics}
            narrativeLabel={mainNarrativeLabel}
          />

          {/* ── Engajamento + Intenção ── */}
          <div className="grid grid-cols-2 gap-3">
            <HealthMetricMiniCard
              icon={<EngagementIcon />}
              iconBg="bg-sky-500"
              title="Engajamento"
              value={formatPercent(instagramMetrics.avgEngagementRate)}
              detail={`${formatCompactNumber(instagramMetrics.avgInteractionsPerPost)} interações/post`}
              trend={instagramMetrics.deltas.avgEngagementRate}
            />
            <HealthMetricMiniCard
              icon={<IntentIcon />}
              iconBg="bg-teal-500"
              title="Intenção"
              value={formatPerPost(instagramMetrics.avgIntentActionsPerPost)}
              detail={buildIntentDetail(instagramMetrics)}
              trend={instagramMetrics.deltas.avgIntentActionsPerPost}
            />
          </div>

          {/* ── Breakdown de intenção (salvos, shares, comentários…) ── */}
          {hasIntentBreakdownData(instagramMetrics) && (
            <InstagramIntentBreakdownCard metrics={instagramMetrics} />
          )}

          {/* ── Formatos ── */}
          {instagramMetrics.formatPerformance.length > 0 ? (
            <InstagramFormatsCard formats={instagramMetrics.formatPerformance} />
          ) : instagramMetrics.topFormats.length > 0 ? (
            <InstagramFormatsFallbackCard formats={instagramMetrics.topFormats} postsAnalyzed={instagramMetrics.postsAnalyzed} />
          ) : null}

          {/* ── Reels ── */}
          {hasReelsData(instagramMetrics) && (
            <InstagramReelsCard metrics={instagramMetrics} />
          )}

          {/* ── Dia com mais resposta ── */}
          <InstagramBestDayCard bestDay={instagramMetrics.bestDayOfWeek} />

          {/* ── Rodapé de base analisada ── */}
          <p className="px-1 text-center text-[11px] font-semibold text-zinc-400">
            Base: {instagramMetrics.postsAnalyzed} posts dos últimos {instagramMetrics.sampleWindowDays} dias
            {instagramMetrics.newestPostDate ? ` · mais recente: ${formatShortDate(instagramMetrics.newestPostDate)}` : ""}
          </p>

          {/* ── Disclaimer Stream B ── */}
          <p className="px-2 text-center text-[10.5px] leading-[1.5] text-zinc-400">
            A análise de narrativa lê as legendas das suas publicações — não o vídeo em si.
          </p>
        </>
      )}
    </DiagnosticoCategoryDetailView>
  );
}

function InstagramPerformanceCard({
  metrics,
  narrativeLabel,
}: {
  metrics: InstagramMetricsSummary;
  narrativeLabel?: string | null;
}) {
  const reach = formatCompactNumber(metrics.avgReachPerPost);
  const delta = formatDelta(metrics.deltas.avgReachPerPost);

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.reach.bg}
          iconSlot={<ReachIcon />}
          category="Sinais de alcance"
          catColor={HC.reach.text}
          timestamp={`Últimos ${metrics.sampleWindowDays} dias`}
        />
        <p className="text-[24px] font-bold leading-[1.12] tracking-tight text-zinc-950">
          Alcance médio por post
        </p>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[48px] font-bold leading-none tracking-tight text-zinc-950">
              {reach}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold ${delta.className}`}>
                {delta.label}
              </span>
              <span className="text-[12px] font-semibold text-zinc-400">
                vs período anterior
              </span>
            </div>
          </div>
          <HealthWeeklyBars series={metrics.weeklyPerformance} />
        </div>
        <div className="mt-5 h-px bg-zinc-100" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricStat label="Interações" value={`${formatCompactNumber(metrics.avgInteractionsPerPost)}/post`} />
          <MetricStat label="Posts" value={String(metrics.postsAnalyzed)} />
        </div>
        {narrativeLabel && metrics.avgReachPerPost != null && (
          <p className={`mt-4 ${CARD_BODY}`}>
            A D2C cruza <span className="font-semibold text-zinc-800">{narrativeLabel}</span> com esses sinais para calibrar a leitura narrativa.
          </p>
        )}
      </div>
    </DiagnosticoCardShell>
  );
}

function InstagramInsightCard({ metrics }: { metrics: InstagramMetricsSummary }) {
  const insight = buildPerformanceInsight(metrics);

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg="bg-zinc-900"
          iconSlot={<InsightIcon />}
          category="Leitura rápida"
          catColor="text-zinc-900"
        />
        <p className="text-[23px] font-bold leading-tight tracking-tight text-zinc-950">
          {insight.title}
        </p>
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-zinc-500">
          {insight.body}
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function InstagramResonanceCard({ territories }: { territories: InstagramTerritoryResonance[] }) {
  const top = territories[0]!;
  const maxScore = Math.max(...territories.map((t) => t.resonanceScore ?? 0), 1);

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg="bg-violet-500"
          iconSlot={<ResonanceIcon />}
          category="O que mais conecta"
          catColor="text-violet-500"
          timestamp="por salvos + shares"
        />
        <p className="text-[23px] font-bold leading-tight tracking-tight text-zinc-950">
          <span className="capitalize">{top.label}</span> é o que mais conecta
        </p>
        <p className="mt-2 text-[14px] font-semibold leading-relaxed text-zinc-500">
          Seus posts sobre esse assunto geram mais salvos e compartilhamentos — sinal de que essa parte do seu conteúdo ressoa com quem te vê.
        </p>
        <div className="mt-5 flex flex-col gap-4">
          {territories.map((territory) => (
            <div key={territory.territory}>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold capitalize text-zinc-950">
                    {territory.label}
                  </p>
                  <p className="text-[12px] font-semibold text-zinc-500">
                    {territory.postsCount} posts
                    {territory.avgSavesPerPost != null && ` · ${formatCompactNumber(territory.avgSavesPerPost)} salvos`}
                    {territory.avgSharesPerPost != null && ` · ${formatCompactNumber(territory.avgSharesPerPost)} shares`}
                  </p>
                </div>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-violet-500"
                  style={{ width: `${Math.max(8, ((territory.resonanceScore ?? 0) / maxScore) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DiagnosticoCardShell>
  );
}

function HealthMetricMiniCard({
  icon,
  iconBg,
  title,
  value,
  detail,
  trend,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  value: string;
  detail: string;
  trend: number | null;
}) {
  const delta = trend == null ? null : formatDelta(trend, { compact: true });

  return (
    <DiagnosticoCardShell>
      <div className="flex min-h-[174px] flex-col p-4">
        <div className="flex flex-col items-start gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconBg}`} aria-hidden="true">
              {icon}
            </span>
            <p className="min-w-0 text-[14px] font-bold leading-tight text-zinc-950">
              {title}
            </p>
          </div>
          {delta && (
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${delta.className}`}>
              {delta.label}
            </span>
          )}
        </div>
        <div className="mt-auto">
          <p className="text-[31px] font-bold leading-none tracking-tight text-zinc-950">
            {value}
          </p>
          <p className="mt-2 text-[12px] font-semibold leading-snug text-zinc-500">
            {detail}
          </p>
        </div>
      </div>
    </DiagnosticoCardShell>
  );
}

function InstagramIntentBreakdownCard({ metrics }: { metrics: InstagramMetricsSummary }) {
  const rows = [
    { label: "Salvos", value: metrics.avgSavesPerPost, color: "bg-teal-500" },
    { label: "Compartilhamentos", value: metrics.avgSharesPerPost, color: "bg-sky-500" },
    { label: "Comentários", value: metrics.avgCommentsPerPost, color: "bg-violet-500" },
    { label: "Visitas ao perfil", value: metrics.avgProfileVisitsPerPost, color: "bg-indigo-500" },
    { label: "Novos seguidores", value: metrics.avgFollowsPerPost, color: "bg-emerald-500" },
  ].filter((row): row is { label: string; value: number; color: string } => row.value != null);
  const max = Math.max(...rows.map((row) => row.value), 1);

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg="bg-teal-500"
          iconSlot={<IntentIcon />}
          category="Sinais de intenção"
          catColor="text-teal-500"
          timestamp="por post"
        />
        <div className="flex flex-col gap-3">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <p className="text-[13px] font-bold text-zinc-950">{row.label}</p>
                <p className="text-[13px] font-bold text-zinc-500">{formatCompactNumber(row.value)}</p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={`h-full rounded-full ${row.color}`}
                  style={{ width: `${Math.max(8, (row.value / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {metrics.avgFollowerConversionRate != null && (
          <p className="mt-4 text-[12px] font-semibold leading-snug text-zinc-400">
            Conversão média de visitas em follows: {formatPercent(metrics.avgFollowerConversionRate)}.
          </p>
        )}
      </div>
    </DiagnosticoCardShell>
  );
}

function InstagramFormatsCard({ formats }: { formats: InstagramFormatPerformance[] }) {
  const maxPosts = Math.max(...formats.map((format) => format.postsCount), 1);

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.reach.bg}
          iconSlot={<FormatIcon />}
          category="Formatos"
          catColor={HC.reach.text}
          timestamp="Ranking"
        />
        <p className="text-[24px] font-bold leading-tight tracking-tight text-zinc-950">
          Formatos mais usados no período
        </p>
        <div className="mt-5 flex flex-col gap-4">
          {formats.map((format) => (
            <div key={format.format}>
              <div className="mb-2 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold capitalize text-zinc-950">
                    {format.format}
                  </p>
                  <p className="text-[12px] font-semibold text-zinc-500">
                    {format.postsCount} posts · {formatCompactNumber(format.avgReach)} alcance
                    {format.avgEngagementRate != null && ` · ${formatPercent(format.avgEngagementRate)} eng.`}
                    {format.avgViews != null && ` · ${formatCompactNumber(format.avgViews)} views`}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-bold text-sky-500">
                  {formatPercent(format.shareOfPosts, 0)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-sky-500"
                  style={{ width: `${Math.max(8, (format.postsCount / maxPosts) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </DiagnosticoCardShell>
  );
}

function InstagramFormatsFallbackCard({
  formats,
  postsAnalyzed,
}: {
  formats: string[];
  postsAnalyzed: number;
}) {
  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.reach.bg}
          iconSlot={<FormatIcon />}
          category="Formatos"
          catColor={HC.reach.text}
        />
        <div className="flex flex-col gap-2">
          {formats.map((format, i) => (
            <div key={format} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[12px] font-bold text-sky-600">
                {i + 1}
              </span>
              <span className="text-[15px] font-bold capitalize text-zinc-950">{format}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12px] font-semibold text-zinc-400">
          Baseado em {postsAnalyzed} posts analisados.
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function InstagramReelsCard({ metrics }: { metrics: InstagramMetricsSummary }) {
  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg="bg-indigo-500"
          iconSlot={<ReelsIcon />}
          category="Reels"
          catColor="text-indigo-500"
          timestamp="Médias"
        />
        <div className="grid grid-cols-3 gap-3">
          <MetricStat label="Views" value={formatCompactNumber(metrics.avgReelsViews)} />
          <MetricStat label="Duração" value={formatSeconds(metrics.avgReelsDurationSeconds)} />
          <MetricStat label="Assistido" value={formatSeconds(metrics.avgReelsWatchTimeSeconds)} />
        </div>
      </div>
    </DiagnosticoCardShell>
  );
}

function InstagramBestDayCard({
  bestDay,
}: {
  bestDay: InstagramMetricsSummary["bestDayOfWeek"];
}) {
  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg="bg-sky-500"
          iconSlot={<CalendarIcon />}
          category="Quando sua audiência mais responde"
          catColor="text-sky-600"
        />
        {bestDay ? (
          <>
            <p className="text-[42px] font-bold leading-none tracking-tight text-zinc-950">
              {bestDay.dayLabel}
            </p>
            <p className="mt-2 text-[14px] font-semibold text-zinc-500">
              {formatCompactNumber(bestDay.avgReach)} de alcance médio
            </p>
            <p className="mt-3 text-[12px] font-semibold leading-snug text-zinc-400">
              Baseado em {bestDay.postCount} {bestDay.postCount === 1 ? "post publicado" : "posts publicados"} neste dia nos últimos 60 dias.
            </p>
          </>
        ) : (
          <p className="text-[14px] font-semibold leading-relaxed text-zinc-400">
            Ainda sem padrão identificado. Com mais posts registrados neste dia, a D2C consegue mapear quando sua audiência mais responde.
          </p>
        )}
      </div>
    </DiagnosticoCardShell>
  );
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[12px] font-bold text-zinc-400">{label}</p>
      <p className="mt-1 truncate text-[21px] font-bold leading-tight tracking-tight text-zinc-950">
        {value}
      </p>
    </div>
  );
}

function HealthWeeklyBars({ series }: { series: InstagramWeeklyPerformancePoint[] }) {
  const values = series.map((point) => point.avgReach ?? 0);
  const max = Math.max(...values, 1);
  const hasData = values.some((value) => value > 0);

  return (
    <div className="flex h-[96px] w-[122px] shrink-0 items-end gap-1.5" aria-label="Alcance semanal">
      {(hasData ? values : [14, 32, 22, 56, 44, 78, 28, 64, 46]).map((value, index, arr) => {
        const height = hasData ? Math.max(8, (value / max) * 88) : value;
        const isLast = index === arr.length - 1;
        return (
          <div
            key={`${index}-${value}`}
            className={`w-2.5 rounded-full ${hasData && isLast ? "bg-sky-500" : "bg-zinc-200"}`}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

function hasReelsData(metrics: InstagramMetricsSummary): boolean {
  return (
    metrics.avgReelsViews != null ||
    metrics.avgReelsDurationSeconds != null ||
    metrics.avgReelsWatchTimeSeconds != null
  );
}

function hasIntentBreakdownData(metrics: InstagramMetricsSummary): boolean {
  return (
    metrics.avgSavesPerPost != null ||
    metrics.avgSharesPerPost != null ||
    metrics.avgProfileVisitsPerPost != null ||
    metrics.avgFollowsPerPost != null
  );
}

function buildIntentDetail(metrics: InstagramMetricsSummary): string {
  const parts = [
    metrics.avgSavesPerPost != null ? `${formatCompactNumber(metrics.avgSavesPerPost)} salvos` : null,
    metrics.avgSharesPerPost != null ? `${formatCompactNumber(metrics.avgSharesPerPost)} shares` : null,
    metrics.avgProfileVisitsPerPost != null ? `${formatCompactNumber(metrics.avgProfileVisitsPerPost)} visitas` : null,
  ].filter(Boolean);

  if (metrics.avgFollowerConversionRate != null) {
    parts.push(`${formatPercent(metrics.avgFollowerConversionRate)} conv.`);
  } else if (metrics.avgFollowsPerPost != null) {
    parts.push(`${formatCompactNumber(metrics.avgFollowsPerPost)} follows`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Sem dados suficientes";
}

function buildPerformanceInsight(metrics: InstagramMetricsSummary): { title: string; body: string } {
  const reachDelta = metrics.deltas.avgReachPerPost;
  const engagementDelta = metrics.deltas.avgEngagementRate;
  const intentDelta = metrics.deltas.avgIntentActionsPerPost;
  const format = metrics.formatPerformance[0]?.format;
  const formatCopy = format ? capitalizeLabel(format) : "o formato dominante";

  if (reachDelta != null && reachDelta <= -0.1 && engagementDelta != null && engagementDelta > 0.05) {
    return {
      title: "Menos distribuição, mais resposta",
      body: `O alcance caiu, mas quem viu respondeu melhor. Use ${formatCopy} para testar abertura e retenção.`,
    };
  }

  if (reachDelta != null && reachDelta >= 0.1) {
    return {
      title: "Alcance expandiu",
      body: `O alcance médio subiu ${formatDelta(reachDelta).label}. Os temas que aparecem nesses posts tendem a ressoar com quem você já alcança.`,
    };
  }

  if (intentDelta != null && intentDelta <= -0.1) {
    return {
      title: "Intenção abaixo do período anterior",
      body: "Inclua um convite claro para salvar, compartilhar ou seguir sem transformar o post em anúncio.",
    };
  }

  if (engagementDelta != null && engagementDelta >= 0.1) {
    return {
      title: "Engajamento reagindo melhor",
      body: "A resposta por post cresceu. Vale priorizar continuidade antes de trocar formato ou assunto.",
    };
  }

  return {
    title: "Base pronta para acompanhar",
    body: `O resumo usa ${metrics.postsAnalyzed} posts dos últimos ${metrics.sampleWindowDays} dias para orientar decisões rápidas.`,
  };
}

function capitalizeLabel(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatCompactNumber(value: number | null): string {
  if (value == null) return "Sem dados";
  const useCompact = value >= 10_000;
  return new Intl.NumberFormat("pt-BR", {
    notation: useCompact ? "compact" : "standard",
    maximumFractionDigits: useCompact ? 1 : 0,
  }).format(value);
}

function formatPercent(value: number | null, digits = 1): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatSeconds(value: number | null): string {
  if (value == null) return "—";
  if (value >= 60) {
    const minutes = Math.floor(value / 60);
    const seconds = Math.round(value % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }
  return `${Math.round(value)}s`;
}

function formatPerPost(value: number | null): string {
  return value == null ? "Sem dados" : `${formatCompactNumber(value)}/post`;
}

function formatShortDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatDelta(value: number | null, options: { compact?: boolean } = {}) {
  if (value == null) {
    return {
      label: options.compact ? "—" : "Sem comparação",
      className: "bg-zinc-100 text-zinc-500",
    };
  }

  const positive = value >= 0;
  const formatted = formatPercent(Math.abs(value), 0);

  return {
    label: `${positive ? "+" : "-"}${formatted}`,
    className: positive ? "bg-sky-100 text-sky-600" : "bg-amber-100 text-amber-700",
  };
}

function FormatIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="white" strokeWidth="2" />
    </svg>
  );
}

function ReachIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EngagementIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 13h4l2-5 4 10 2-5h4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IntentIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 21s-7-4.7-7-10.4A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.6C19 16.3 12 21 12 21Z" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReelsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="16" rx="4" stroke="white" strokeWidth="2" />
      <path d="m10 9 5 3-5 3V9Z" fill="white" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="16" y1="2" x2="16" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="8" y1="2" x2="8" y2="6" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="10" x2="21" y2="10" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function InsightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 13h6l-2 7 12-12h-6l2-6L4 13Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ResonanceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2" />
      <path d="M5.6 5.6a9 9 0 0 0 0 12.8M18.4 5.6a9 9 0 0 1 0 12.8M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
