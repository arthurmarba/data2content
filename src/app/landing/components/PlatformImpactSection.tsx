"use client";

import React from "react";
import type { LandingCommunityMetrics } from "@/types/landing";

type PlatformImpactSectionProps = {
  metrics?: LandingCommunityMetrics | null;
};

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}

function useCountUp(targetValue: number, duration = 1200) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    let frame: number;
    const start = performance.now();
    const animate = (timestamp: number) => {
      const elapsed = timestamp - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      setValue(Math.round(targetValue * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [targetValue, duration]);

  return value;
}

type StatConfig = {
  key: string;
  label: string;
  description: string;
  value: number;
  prefix?: string;
};

function ImpactStat({ item, index }: { item: StatConfig; index: number }) {
  const countedValue = useCountUp(item.value, 900 + index * 140);
  return (
    <div className="flex flex-col justify-between rounded-3xl border border-[#ECEFF4] bg-white p-6 shadow-[0_24px_40px_rgba(15,23,42,0.12)]">
      <div className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#EEF2FF] px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand-text-secondary">
          {item.label}
        </span>
        <p className="text-4xl font-black text-brand-dark md:text-5xl">
          {item.prefix}
          {numberFormatter.format(countedValue || 0)}
        </p>
        <p className="mt-2 text-sm text-brand-text-secondary">{item.description}</p>
      </div>
    </div>
  );
}

const PlatformImpactSection: React.FC<PlatformImpactSectionProps> = ({ metrics }) => {
  const data: StatConfig[] = React.useMemo(() => {
    const activeCreators = metrics?.activeCreators ?? 130;
    const totalPosts = metrics?.totalPostsAnalyzed ?? 25000;
    const reach = metrics?.reachLast30Days ?? 2_500_000;
    const totalCommunityFollowers = metrics?.combinedFollowers ?? 2_400_000;

    return [
      {
        key: "creators",
        label: "criadores ativos",
        description: "Crescendo com dados, mentoria e IA.",
        value: activeCreators,
        prefix: "+",
      },
      {
        key: "posts",
        label: "conteúdos analisados",
        description: "Cada insight nasce de métricas reais.",
        value: totalPosts,
        prefix: "+",
      },
      {
        key: "reach",
        label: "contas alcançadas",
        description: "Audiência validada para negociar com segurança.",
        value: reach,
        prefix: "+",
      },
      {
        key: "community_followers",
        label: "seguidores na comunidade",
        description: "Somatório de seguidores das contas conectadas ao Instagram.",
        value: totalCommunityFollowers,
        prefix: "",
      },
    ];
  }, [metrics]);

  return (
    <section id="impacto" className="bg-[#F5F6FA] py-14 text-brand-dark md:py-20">
      <div className="container mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:items-start md:justify-between md:text-left">
          <div className="max-w-xl space-y-4">
            <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-dark shadow-[0_10px_24px_rgba(15,23,42,0.08)]">
              Impacto em números
            </span>
            <h2 className="text-3xl font-bold md:text-4xl">
              A inteligência coletiva que movimenta o mercado criativo.
            </h2>
            <p className="text-base text-brand-text-secondary md:text-lg">
              Dados reais, criadores reais, oportunidades reais.
            </p>
          </div>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {data.map((item, index) => (
            <ImpactStat key={item.key} item={item} index={index} />
          ))}
        </div>

        <p className="mt-10 text-center text-sm font-medium uppercase tracking-[0.2em] text-brand-text-secondary md:text-base">
          Cada número representa criadores crescendo com dados, estratégia e IA.
        </p>
      </div>
    </section>
  );
};

export default PlatformImpactSection;
