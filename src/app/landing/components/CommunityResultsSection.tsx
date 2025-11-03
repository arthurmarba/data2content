"use client";

import React from "react";
import { formatCompactNumber } from "@/app/landing/utils/format";
import type { LandingCommunityMetrics } from "@/types/landing";

type CommunityResultsSectionProps = {
  metrics: LandingCommunityMetrics;
  lastUpdatedIso?: string | null;
  loading?: boolean;
};

type StatConfig = {
  id: string;
  label: string;
  field: keyof LandingCommunityMetrics;
  fallback: string;
  prefix?: string;
  icon: string;
};

const statConfig: StatConfig[] = [
  {
    id: "followers",
    label: "Seguidores conquistados em 30 dias",
    field: "followersGainedLast30Days",
    fallback: "35k",
    prefix: "+",
    icon: "👥",
  },
  {
    id: "views",
    label: "Views geradas no mês",
    field: "viewsLast30Days",
    fallback: "15M",
    icon: "📈",
  },
  {
    id: "interactions",
    label: "Interações reais analisadas",
    field: "interactionsLast30Days",
    fallback: "1.3M",
    icon: "💬",
  },
];

const formatStatValue = (
  metrics: LandingCommunityMetrics,
  config: StatConfig
): string => {
  const raw = metrics?.[config.field];
  if (typeof raw !== "number" || Number.isNaN(raw)) {
    return config.fallback;
  }

  const formatted = formatCompactNumber(raw);
  return `${config.prefix ?? ""}${formatted}`;
};

const CommunityResultsSection: React.FC<CommunityResultsSectionProps> = ({ metrics }) => {
  return (
    <section id="resultados" className="bg-brand-light py-10 text-brand-dark md:py-16">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#E7E7E7] px-4 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-brand-text-secondary">
            Resultados reais da comunidade
          </p>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E7E7E7] px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-brand-text-secondary">
            🔄 Atualizado diariamente via Meta Creator Marketplace
          </span>
        </div>

        <div className="-mx-3 flex snap-x snap-mandatory overflow-x-auto px-3 pb-6 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 md:snap-none">
          {statConfig.map((stat) => (
            <div
              key={stat.id}
              className="mr-4 min-w-[70%] snap-center rounded-3xl border border-[#EFEFEF] bg-white p-6 shadow-[0_18px_38px_rgba(28,28,30,0.08)] last:mr-0 md:mr-0 md:min-w-0 md:snap-none"
            >
              <span className="text-3xl" aria-hidden="true">
                {stat.icon}
              </span>
              <p className="mt-4 text-3xl font-black text-brand-dark md:text-[2.4rem]">
                {formatStatValue(metrics, stat)}
              </p>
              <p className="mt-2 text-sm font-medium uppercase tracking-[0.18em] text-brand-text-secondary">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CommunityResultsSection;
