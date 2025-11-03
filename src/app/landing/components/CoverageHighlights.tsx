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

const loadingShimmer =
  "relative overflow-hidden before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.5s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/30 before:to-transparent";

const skeletonSharedClasses = `rounded-2xl border border-white/30 bg-white/80 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm ${loadingShimmer}`;

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
  const [activeTab, setActiveTab] = React.useState<"segments" | "regions">("segments");

  const hasSegments = (segments?.length ?? 0) > 0;
  const hasRegions = (regions?.length ?? 0) > 0;
  const hasContent = hasSegments || hasRegions;

  if (!loading && !hasContent) return null;

  const totalReach = segments.reduce((sum, segment) => sum + (segment.reach ?? 0), 0);
  const totalFollowers = regions.reduce((sum, region) => sum + (region.followers ?? 0), 0);

  return (
    <section className="relative overflow-hidden bg-[#F9FAFD] pb-[clamp(3rem,8vw,5rem)] pt-[clamp(2.5rem,7vw,4.5rem)]">
      <style>{shimmerKeyframes}</style>
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_20%_0%,rgba(11,87,208,0.12)_0%,rgba(11,87,208,0)_55%)]" />
      <div className="relative container mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 md:px-6">
        <header className="max-w-3xl space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#D8E1F5] bg-white px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#2F3B5C]">
            Cobertura ativa
          </span>
          <h2 className="text-xl font-semibold text-brand-dark md:text-2xl">
            Onde a comunidade D2C gera mais alcance agora.
          </h2>
          <p className="text-sm text-brand-text-secondary md:text-[0.95rem]">
            Atualizamos as métricas semanalmente a partir das contas de Instagram conectadas para
            você planejar campanhas com precisão.
          </p>
        </header>

        <div className="rounded-2xl border border-white/60 bg-white/95 p-4 shadow-[0_14px_36px_rgba(15,23,42,0.1)]">
          <div className="grid gap-2 md:grid-cols-2 md:gap-3">
            <div className="flex items-center gap-3 rounded-full bg-[#F0F4FF] px-3 py-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#0B57D0]">
                Nichos
              </span>
              <span className="text-[0.7rem] text-[#214072]">
                Alcance total {formatNumber(totalReach)}
              </span>
            </div>
            <div className="flex items-center gap-2 rounded-full bg-[#F7F1FF] px-3 py-1">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6C2DB5]">
                Estados
              </span>
              <span className="text-[0.7rem] text-[#453068]">
                Seguidores {formatNumber(totalFollowers)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 rounded-full bg-[#F4F7FB] p-1 text-xs font-semibold text-[#32456A]">
            <button
              type="button"
              onClick={() => setActiveTab("segments")}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                activeTab === "segments"
                  ? "bg-white shadow-[0_6px_20px_rgba(15,23,42,0.1)]"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              Nichos em destaque
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("regions")}
              className={`flex-1 rounded-full px-4 py-2 transition ${
                activeTab === "regions"
                  ? "bg-white shadow-[0_6px_20px_rgba(15,23,42,0.1)]"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              Estados com maior presença
            </button>
          </div>

          {activeTab === "segments" ? (
            <div className="mt-4 flex flex-col gap-2">
              {loading
                ? Array.from({ length: 4 }, (_, index) => (
                    <div
                      key={`segment-skeleton-${index}`}
                      className={`${skeletonSharedClasses} h-20`}
                    />
                  ))
                : segments.slice(0, 4).map((segment, index) => {
                    const sharePercent = Math.min(Math.max(segment.share * 100, 0), 100);
                    return (
                      <article
                        key={segment.id ?? `segment-${index}`}
                        className="group flex flex-col gap-2 rounded-2xl border border-[#E6EEFF] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="truncate text-sm font-semibold text-brand-dark group-hover:text-brand-primary"
                            title={segment.label}
                          >
                            {segment.label}
                          </span>
                          <span className="rounded-full bg-[#EEF3FF] px-2 py-0.5 text-[0.7rem] font-semibold text-[#0B57D0]">
                            {formatPercent(segment.share)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 text-sm text-brand-dark">
                          <span className="font-semibold">{formatNumber(segment.reach)}</span>
                          <span className="text-[0.7rem] uppercase tracking-[0.18em] text-brand-text-secondary">
                            alcance
                          </span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#E6EEFF]">
                          <span
                            className="absolute inset-0 rounded-full bg-gradient-to-r from-[#0B57D0] to-[#2C7BFF]"
                            style={{ width: `${sharePercent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[0.7rem] text-brand-text-secondary">
                          <span>
                            Interações{" "}
                            <strong className="font-semibold text-brand-dark/80">
                              {formatNumber(segment.interactions)}
                            </strong>
                          </span>
                          <span>
                            Engajamento{" "}
                            <strong className="font-semibold text-brand-dark/80">
                              {segment.engagementRate != null
                                ? `${segment.engagementRate.toFixed(1)}%`
                                : "—"}
                            </strong>
                          </span>
                        </div>
                      </article>
                    );
                  })}
            </div>
          ) : (
            <div className="mt-4 flex flex-col gap-2">
              {loading
                ? Array.from({ length: 5 }, (_, index) => (
                    <div
                      key={`region-skeleton-${index}`}
                      className={`${skeletonSharedClasses} h-16`}
                    />
                  ))
                : regions.slice(0, 5).map((region, index) => {
                    const sharePercent = Math.min(Math.max(region.share * 100, 0), 100);
                    return (
                      <article
                        key={`${region.code}-${index}`}
                        className="flex flex-col gap-2 rounded-2xl border border-[#E6EEFF] bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_18px_36px_rgba(15,23,42,0.12)]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-col">
                            <span
                              className="truncate text-sm font-semibold text-brand-dark"
                              title={region.label}
                            >
                              {region.label}
                            </span>
                            <span className="text-[0.7rem] text-brand-text-secondary">
                              {region.region ?? "Brasil"} • {formatPercent(region.share)}
                            </span>
                          </div>
                          <div className="text-right text-sm text-brand-dark">
                            <span className="font-semibold">
                              {formatNumber(region.followers)}
                            </span>
                            <span className="block text-[0.65rem] uppercase tracking-[0.18em] text-brand-text-secondary">
                              seguidores
                            </span>
                          </div>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#F2E9FF]">
                          <span
                            className="absolute inset-0 rounded-full bg-gradient-to-r from-[#6C2DB5] to-[#9346EB]"
                            style={{ width: `${sharePercent}%` }}
                          />
                        </div>
                        {region.engagedFollowers ? (
                          <div className="flex justify-between text-[0.7rem] text-brand-text-secondary">
                            <span>
                              Engajados{" "}
                              <strong className="font-semibold text-brand-dark/80">
                                {formatNumber(region.engagedFollowers)}
                              </strong>
                            </span>
                            <span>
                              {formatPercent(region.engagedShare ?? 0)} de share engajado
                            </span>
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
