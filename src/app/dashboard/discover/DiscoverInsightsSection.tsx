"use client";

import GlassCard from "@/components/GlassCard";

type DiscoverInsightsSectionProps = {
  viewsP50?: number | null;
  viewsP75?: number | null;
  interactionsP50?: number | null;
  interactionsP75?: number | null;
  totalPosts: number;
  topHourLabel?: string | null;
  heatmapBuckets?: Array<{ label: string; count: number }>;
  sampleWindowDays?: number;
  sectionsCount?: number;
  className?: string;
};

const compactFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatMetric(value?: number | null, suffix = "") {
  if (typeof value !== "number" || Number.isNaN(value) || value <= 0) return "—";
  try {
    return `${compactFormatter.format(value)}${suffix}`;
  } catch {
    return `${value}${suffix}`;
  }
}

type StatTileProps = {
  label: string;
  primary: string;
  secondary?: string;
  helper?: string;
};

function StatTile({ label, primary, secondary, helper }: StatTileProps) {
  return (
    <div className="rounded-2xl border border-brand-chip bg-brand-glass-100/80 p-4 text-[#0F172A] shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-text-secondary/70">{label}</p>
      <p className="mt-3 text-[clamp(2rem,2.6vw,2.5rem)] font-semibold text-[#0F172A]">
        {primary}
        {secondary && <span className="text-base font-medium text-brand-text-secondary/80"> · {secondary}</span>}
      </p>
      {helper && <p className="mt-2 text-sm text-brand-text-secondary/90">{helper}</p>}
    </div>
  );
}

export default function DiscoverInsightsSection({
  viewsP50,
  viewsP75,
  interactionsP50,
  interactionsP75,
  totalPosts,
  topHourLabel,
  heatmapBuckets = [],
  sampleWindowDays,
  sectionsCount,
  className,
}: DiscoverInsightsSectionProps) {
  const totalHeat = heatmapBuckets.reduce((sum, bucket) => sum + bucket.count, 0) || 1;
  const windowLabel = sampleWindowDays ? `últimos ${sampleWindowDays} dias` : "janela recente";
  const sectionChipValue = typeof sectionsCount === "number" && sectionsCount > 0 ? String(sectionsCount) : null;
  const formattedViewsP50 = formatMetric(viewsP50);
  const formattedViewsP75 = formatMetric(viewsP75);
  const formattedInteractionsP50 = formatMetric(interactionsP50);
  const formattedInteractionsP75 = formatMetric(interactionsP75);
  const summaryChips = [
    { label: "Posts analisados", value: `${totalPosts}` },
    { label: "Janela", value: windowLabel },
    sectionChipValue ? { label: "Coleções", value: sectionChipValue } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  const tips: string[] = [];
  if (topHourLabel) tips.push(`Poste perto de ${topHourLabel.toLowerCase()}. É quando o público está mais ligado.`);
  if (formattedViewsP50 !== "—") {
    const label = formattedViewsP75 !== "—" ? `${formattedViewsP50}–${formattedViewsP75}` : formattedViewsP50;
    tips.push(`Mire em ${label} views: abra com um gancho rápido e mostre o benefício logo.`);
  }
  if (formattedInteractionsP50 !== "—") {
    const label = formattedInteractionsP75 !== "—" ? `${formattedInteractionsP50}–${formattedInteractionsP75}` : formattedInteractionsP50;
    tips.push(`Peça ações diretas (salvar, comentar) para chegar em ${label} interações.`);
  }
  const hasTips = tips.length > 0;
  const topBuckets = heatmapBuckets.slice(0, 4);
  const hasHeatmap = topBuckets.length > 0;

  return (
    <GlassCard
      className={["space-y-6 border border-brand-glass shadow-[0_35px_90px_rgba(15,23,42,0.08)]", className]
        .filter(Boolean)
        .join(" ")}
      showGlow
    >
      <header className="space-y-4 border-b border-white/40 pb-5 text-[#0F172A]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <span className="landing-chip text-brand-primary/80">Panorama da comunidade</span>
            <h2 className="text-[clamp(1.9rem,3vw,2.4rem)] font-semibold leading-tight text-brand-dark">
              Benchmarks vivos do seu segmento
            </h2>
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-text-secondary/70">
            Atualizado automaticamente
          </p>
        </div>
        {summaryChips.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-3">
            {summaryChips.map((chip) => (
              <div
                key={chip.label}
                className="rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-sm text-brand-text-secondary/80 shadow-[0_10px_30px_rgba(15,23,42,0.05)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em]">{chip.label}</p>
                <p className="mt-1 text-xl font-semibold text-brand-dark">{chip.value}</p>
              </div>
            ))}
          </div>
        )}
      </header>

      <div className="grid gap-4 pt-2 sm:grid-cols-2">
        <StatTile
          label="Views típicas"
          primary={formattedViewsP50}
          secondary={formattedViewsP75 !== "—" ? formattedViewsP75 : undefined}
          helper="P50 é o valor mediano; P75 é quando começa a viralizar."
        />
        <StatTile
          label="Interações típicas"
          primary={formattedInteractionsP50}
          secondary={formattedInteractionsP75 !== "—" ? formattedInteractionsP75 : undefined}
          helper="Curtidas, comentários, envios e salvamentos combinados."
        />
      </div>

      <div className="rounded-2xl border border-white/60 bg-white/80 px-5 py-5 shadow-[0_12px_32px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-brand-text-secondary/70">
              Horário mais quente
            </p>
            <p className="text-2xl font-semibold text-brand-dark">{topHourLabel || "—"}</p>
          </div>
          <p className="text-xs text-brand-text-secondary/80">Base: slots de maior tração na amostra.</p>
        </div>
        {hasHeatmap ? (
          <div className="mt-5 space-y-3">
            {topBuckets.map((bucket) => {
              const ratio = bucket.count / totalHeat;
              const widthPercent = `${Math.max(ratio * 100, 8)}%`;
              return (
                <div key={bucket.label} className="flex items-center gap-3">
                  <span className="w-32 text-sm font-medium text-brand-text-secondary/90">{bucket.label}</span>
                  <div className="h-2 flex-1 rounded-full bg-brand-glass-200/70">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-brand-magenta to-brand-purple transition-[width]"
                      style={{ width: widthPercent }}
                    />
                  </div>
                  <span className="text-xs font-semibold text-brand-text-secondary/80">{Math.round(ratio * 100)}%</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-brand-chip/80 px-4 py-3 text-sm text-brand-text-secondary">
            Sem dados suficientes ainda. Assim que os primeiros slots aparecerem, mostramos aqui.
          </div>
        )}
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-[#0F172A] via-[#1B1B3A] to-[#6E1F93] px-5 py-5 text-white shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/70">Movimentos sugeridos</p>
        {hasTips ? (
          <div className="mt-4 space-y-3 text-sm">
            {tips.map((tip) => (
              <div key={tip} className="flex items-start gap-3 text-white/90">
                <span className="mt-0.5 text-base text-brand-sun">✦</span>
                <p>{tip}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-white/80">Ainda não temos recomendações suficientes para o segmento.</p>
        )}
      </div>
    </GlassCard>
  );
}
