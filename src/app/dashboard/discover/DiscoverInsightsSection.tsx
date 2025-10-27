"use client";

import { Sparkles } from "lucide-react";

type DiscoverInsightsSectionProps = {
  avgViews?: number | null;
  avgInteractions?: number | null;
  totalPosts: number;
  topHourLabel?: string | null;
  heatmapBuckets?: Array<{ label: string; count: number }>;
};

function openSubscribeModal() {
  try {
    window.dispatchEvent(new Event("open-subscribe-modal"));
  } catch {
    // ignore SSR
  }
}

function formatMetric(value?: number | null, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return "—";
  try {
    return `${value.toLocaleString("pt-BR", { notation: "compact", maximumFractionDigits: 1 })}${suffix}`;
  } catch {
    return `${value}${suffix}`;
  }
}

export default function DiscoverInsightsSection({
  avgViews,
  avgInteractions,
  totalPosts,
  topHourLabel,
  heatmapBuckets = [],
}: DiscoverInsightsSectionProps) {
  const totalHeat = heatmapBuckets.reduce((sum, bucket) => sum + bucket.count, 0) || 1;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-4 py-5 shadow-sm sm:px-6">
      <header className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Insights rápidos</p>
          <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            O que a IA enxergou no seu segmento esta semana
          </h2>
        </div>
        <span className="text-xs font-medium text-slate-500">
          Amostra com {totalPosts} {totalPosts === 1 ? "post" : "posts"} das últimas 48h.
        </span>
      </header>

      <div className="grid gap-4 pt-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Views médias</p>
          <p className="text-2xl font-semibold text-slate-900">{formatMetric(avgViews)}</p>
          <p className="mt-1 text-xs text-slate-500">Por conteúdo destacado na curadoria</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Interações médias</p>
          <p className="text-2xl font-semibold text-slate-900">{formatMetric(avgInteractions)}</p>
          <p className="mt-1 text-xs text-slate-500">Curtidas, comentários e compartilhamentos</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Horário mais quente</p>
          <span className="text-sm font-semibold text-slate-900">{topHourLabel || "—"}</span>
        </div>
        <div className="mt-3 flex h-10 overflow-hidden rounded-full border border-slate-200">
          {heatmapBuckets.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-xs text-slate-400">Sem dados suficientes ainda.</div>
          ) : (
            heatmapBuckets.map((bucket) => {
              const ratio = bucket.count / totalHeat;
              const widthPercent = `${Math.max(ratio * 100, 8)}%`;
              return (
                <div
                  key={bucket.label}
                  className="relative flex items-center justify-center bg-gradient-to-r from-brand-magenta/15 to-brand-magenta/35 text-[10px] font-semibold text-brand-magenta"
                  style={{ width: widthPercent }}
                >
                  <span className="px-2 text-center leading-none">{bucket.label}</span>
                </div>
              );
            })
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Distribuição das postagens com melhor performance nas últimas 48h.
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-brand-magenta/40 bg-brand-magenta/5 px-4 py-4 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-white p-2 text-brand-magenta shadow">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <p className="text-sm text-slate-700">
            Gere um relatório completo com horários ideais, formatos vencedores e benchmarks exclusivos do seu nicho.
          </p>
        </div>
        <button
          type="button"
          onClick={openSubscribeModal}
          className="inline-flex items-center gap-2 rounded-full bg-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
        >
          Quero meu relatório completo com IA
        </button>
      </div>
    </section>
  );
}
