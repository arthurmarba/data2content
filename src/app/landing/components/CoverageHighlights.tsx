import React from "react";
import type { LandingCoverageRegion, LandingCoverageSegment } from "@/types/landing";

type CoverageHighlightsProps = {
  segments: LandingCoverageSegment[];
  regions: LandingCoverageRegion[];
  loading?: boolean;
};

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatPercent(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) return "—";
  return percentFormatter.format(Math.max(0, value));
}

function formatNumber(value: number | null | undefined) {
  if (!value || Number.isNaN(value)) return "—";
  return numberFormatter.format(value);
}

const shimmerKeyframes = `
@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}
`;

export default function CoverageHighlights({
  segments,
  regions,
  loading,
}: CoverageHighlightsProps) {
  const hasSegments = (segments?.length ?? 0) > 0;
  const hasRegions = (regions?.length ?? 0) > 0;
  const hasContent = hasSegments || hasRegions;

  if (!loading && !hasContent) return null;

  const topSegments = segments.slice(0, 5);
  const topRegions = regions.slice(0, 5);

  const cardTokens = {
    primary: {
      border: "border-brand-glass",
      icon: "text-brand-primary",
      pill: "bg-brand-primary/10 text-brand-primary",
      bar: "bg-brand-primary/65",
    },
    neutral: {
      border: "border-brand-glass",
      icon: "text-brand-dark",
      pill: "bg-brand-dark/10 text-brand-dark/80",
      bar: "bg-brand-dark/30",
    },
  } as const;

  return (
    <section id="impacto" className="landing-section landing-section--muted landing-section--compact-bottom">
      <style>{shimmerKeyframes}</style>
      <div className="landing-section__inner landing-section__inner--wide flex w-full flex-col gap-6 md:gap-8">
        <header className="flex flex-col items-center gap-3 text-center">
          <span className="landing-chip">
            Cobertura ativa
          </span>
          <h2 className="text-display-lg text-brand-dark">
            Onde focar agora
          </h2>
          <p className="text-body-md font-normal text-brand-text-secondary">
            Dados semanais das contas conectadas.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] ${cardTokens.primary.border}`}>
            <div className="flex items-center justify-between text-sm font-semibold text-brand-dark">
              <span className={cardTokens.primary.icon}>Nichos em destaque</span>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand-text-secondary/80">Atualizado</span>
            </div>
            <div className="flex flex-col gap-2">
              {loading
                ? Array.from({ length: 5 }, (_, index) => (
                    <div key={`segment-skeleton-${index}`} className="h-12 rounded-xl bg-neutral-100" />
                  ))
                : topSegments.map((segment, index) => {
                    const sharePercent = Math.min(Math.max((segment.share ?? 0) * 100, 0), 100);
                    const metrics = `Alc ${formatNumber(segment.reach)} · Int ${formatNumber(
                      segment.interactions,
                    )} · Eng ${
                      segment.engagementRate != null ? `${segment.engagementRate.toFixed(1)}%` : "—"
                    }`;
                    return (
                      <article
                        key={segment.id ?? `segment-${index}`}
                        className="rounded-2xl border border-brand-glass bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-brand-dark">{segment.label}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cardTokens.primary.pill}`}>
                            {formatPercent(segment.share)}
                          </span>
                        </div>
                        <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${sharePercent}%`, backgroundColor: "rgba(255,44,126,0.85)" }}
                          />
                        </div>
                        <p className="mt-2 text-sm text-neutral-600">{metrics}</p>
                      </article>
                    );
                  })}
            </div>
          </section>

          <section className={`flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] ${cardTokens.neutral.border}`}>
            <div className="flex items-center justify-between text-sm font-semibold text-brand-dark">
              <span className={cardTokens.neutral.icon}>Estados com maior share</span>
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-brand-text-secondary/80">Top 5</span>
            </div>
            <div className="flex flex-col gap-2">
              {loading
                ? Array.from({ length: 5 }, (_, index) => (
                    <div key={`region-skeleton-${index}`} className="h-12 rounded-xl bg-neutral-100" />
                  ))
                : topRegions.map((region, index) => {
                    const sharePercent = Math.min(Math.max((region.share ?? 0) * 100, 0), 100);
                    const metrics = `Seg ${formatNumber(region.followers)}${
                      region.engagedFollowers
                        ? ` · Eng ${formatNumber(region.engagedFollowers)} (${formatPercent(
                            region.engagedShare ?? 0,
                          )})`
                        : ""
                    }`;
                    return (
                      <article
                        key={`${region.code}-${index}`}
                        className="rounded-2xl border border-brand-glass bg-white px-4 py-3 shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-brand-dark">{region.label}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cardTokens.neutral.pill}`}>
                            {formatPercent(region.share)}
                          </span>
                        </div>
                        <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-neutral-100">
                          <span
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${sharePercent}%`, backgroundColor: "rgba(28,35,52,0.35)" }}
                          />
                        </div>
                        <p className="mt-2 text-sm text-neutral-600">{metrics}</p>
                      </article>
                    );
                  })}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
