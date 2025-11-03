"use client";

import React from "react";
import type { LandingCommunityMetrics } from "@/types/landing";
import ButtonPrimary from "./ButtonPrimary";

type HeroModernProps = {
  onCreatorCta: () => void;
  onBrandCta: () => void;
  metrics?: LandingCommunityMetrics | null;
};

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}

function useCountUp(targetValue: number, duration = 1100) {
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

type HighlightCardProps = {
  metricValue: number;
  metricLabel: string;
  prefix?: string;
  index: number;
};

const HighlightCard: React.FC<HighlightCardProps> = ({
  metricValue,
  metricLabel,
  prefix = "+",
  index,
}) => {
  const countedValue = useCountUp(metricValue, 900 + index * 120);
  const formatted = numberFormatter.format(countedValue || 0);

  return (
    <article className="flex flex-col items-start justify-center rounded-3xl border border-[#E3E8F4] bg-white p-6 text-left shadow-[0_14px_38px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-1">
      <div className="flex w-full flex-col gap-2">
        <span className="text-3xl font-semibold leading-tight text-brand-dark md:text-[2.5rem] lg:text-[2.75rem]">
          {metricValue > 0 ? `${prefix}${formatted}` : "—"}
        </span>
        <span className="break-words text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-brand-text-secondary md:text-sm">
          {metricLabel}
        </span>
      </div>
    </article>
  );
};

const HeroModern: React.FC<HeroModernProps> = ({ onCreatorCta, onBrandCta, metrics }) => {
  const highlights = React.useMemo(
    () => [
      {
        metricValue: metrics?.activeCreators ?? 0,
        metricLabel: "criadores ativos",
        prefix: "+",
      },
      {
        metricValue: metrics?.reachLast30Days ?? 0,
        metricLabel: "contas alcançadas",
        prefix: "+",
      },
      {
        metricValue: metrics?.combinedFollowers ?? 0,
        metricLabel: "seguidores na comunidade",
        prefix: "+",
      },
    ],
    [metrics],
  );

  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-[radial-gradient(140%_120%_at_50%_-20%,rgba(231,75,111,0.12)_0%,rgba(231,75,111,0)_68%)] px-5 pb-[var(--space-fluid-4)] pt-[calc(var(--space-fluid-3)+var(--sat,0px)+var(--landing-header-h,4.5rem))]"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white to-[#F6F8FB]" />
      <div className="relative container mx-auto flex w-full max-w-6xl flex-col gap-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center text-brand-dark">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E2E6F2] bg-white px-4 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-text-secondary md:text-sm">
            IA viva no mercado criativo
          </span>
          <h1 className="max-w-[24ch] text-[2.25rem] text-balance font-semibold leading-tight sm:text-[2.5rem] md:text-[3rem] lg:text-[3.5rem]">
            Feche mais campanhas. Valorize seu trabalho.
          </h1>
          <p className="max-w-2xl text-base font-medium leading-normal text-brand-text-secondary md:mt-3 md:text-lg">
            A Data2Content usa IA para analisar suas métricas, precificar suas entregas e conectar você com marcas de forma estratégica.
          </p>
          <div className="flex w-full flex-col items-center gap-3 xs:flex-row xs:justify-center">
            <ButtonPrimary onClick={onCreatorCta} size="lg" variant="solid">
              Sou Criador
            </ButtonPrimary>
            <ButtonPrimary onClick={onBrandCta} size="lg" variant="outline">
              Sou Marca
            </ButtonPrimary>
          </div>
          <p className="text-sm font-medium text-brand-text-secondary md:text-base">
            Crie seu mídia kit gratuitamente e comece a atrair oportunidades reais.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, index) => (
            <HighlightCard key={item.metricLabel} index={index} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroModern;
