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

type AccentVariant = "primary" | "accent" | "sun";

type HighlightCardProps = {
  metricValue: number;
  metricLabel: string;
  prefix?: string;
  index: number;
  accent?: AccentVariant;
};

const HighlightCard: React.FC<HighlightCardProps> = ({
  metricValue,
  metricLabel,
  prefix = "+",
  index,
  accent = "primary",
}) => {
  const countedValue = useCountUp(metricValue, 900 + index * 120);
  const formatted = numberFormatter.format(countedValue || 0);
  const accentClasses: Record<
    AccentVariant,
    { border: string; shadow: string; tag: string; divider: string; iconBg: string }
  > = {
    primary: {
      border: "border-l-brand-primary/40",
      shadow: "shadow-[0_12px_28px_rgba(255,44,126,0.16)]",
      tag: "text-brand-primary",
      divider: "bg-brand-primary/20",
      iconBg: "bg-brand-primary/12",
    },
    accent: {
      border: "border-l-brand-accent/40",
      shadow: "shadow-[0_12px_28px_rgba(36,107,253,0.14)]",
      tag: "text-brand-accent",
      divider: "bg-brand-accent/20",
      iconBg: "bg-brand-accent/12",
    },
    sun: {
      border: "border-l-brand-sun/40",
      shadow: "shadow-[0_12px_28px_rgba(255,179,71,0.16)]",
      tag: "text-brand-sun-dark",
      divider: "bg-brand-sun/25",
      iconBg: "bg-brand-sun/15",
    },
  };
  const accentStyle = accentClasses[accent];

  return (
    <article
      className={`flex flex-col gap-3 rounded-[28px] border border-brand-glass bg-white/95 p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-glass-md ${accentStyle.border} ${accentStyle.shadow}`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-2xl text-sm font-semibold text-brand-dark ${accentStyle.iconBg}`}
        >
          ✦
        </span>
        <span className={`text-[0.72rem] font-semibold uppercase tracking-[0.18em] ${accentStyle.tag}`}>
          {metricLabel}
        </span>
      </div>
      <span className="text-[clamp(2.2rem,3.3vw,2.8rem)] font-bold leading-tight text-brand-dark">
        {metricValue > 0 ? `${prefix}${formatted}` : "—"}
      </span>
      <span className={`h-[2px] w-10 rounded-full ${accentStyle.divider}`} />
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
        accent: "primary" as AccentVariant,
      },
      {
        metricValue: metrics?.reachLast30Days ?? 0,
        metricLabel: "contas alcançadas",
        prefix: "+",
        accent: "accent" as AccentVariant,
      },
      {
        metricValue: metrics?.combinedFollowers ?? 0,
        metricLabel: "seguidores na comunidade",
        prefix: "+",
        accent: "sun" as AccentVariant,
      },
    ],
    [metrics],
  );

  return (
    <section
      id="inicio"
      className="landing-section landing-section--sunrise relative overflow-hidden"
      style={{
        paddingTop: `calc(var(--space-fluid-3) + var(--sat, 0px) + var(--landing-header-h, 4.5rem))`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-15%,rgba(255,255,255,0.9),transparent_60%),radial-gradient(circle_at_20%_10%,rgba(255,44,126,0.07),transparent_50%),radial-gradient(circle_at_85%_-5%,rgba(36,107,253,0.05),transparent_55%)]" />
      <div className="landing-section__inner relative flex w-full flex-col gap-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center text-brand-dark">
          <span className="landing-chip md:text-sm">
            IA viva no mercado criativo
          </span>
          <h1 className="max-w-[22ch] text-[2.6rem] text-balance font-black leading-[1.03] tracking-tight text-brand-dark drop-shadow-[0_6px_20px_rgba(12,12,16,0.12)] sm:text-[3.2rem] lg:text-[3.8rem]">
            <span className="block">Feche mais campanhas.</span>
            <span className="block">Valorize seu trabalho.</span>
          </h1>
          <div className="h-1.5 w-32 rounded-full bg-black" />
          <p className="max-w-2xl text-body-lg font-normal text-brand-text-secondary md:mt-3">
            A D2C usa IA pra analisar seus posts, precificar suas publis e te conectar com marcas.
          </p>
          <div className="flex w-full flex-col items-center gap-3 xs:flex-row xs:justify-center">
            <ButtonPrimary onClick={onCreatorCta} size="lg" variant="brand" className="min-w-[200px]">
              Sou Criador
            </ButtonPrimary>
            <ButtonPrimary
              onClick={onBrandCta}
              size="lg"
              variant="outline"
              className="min-w-[200px] shadow-none"
            >
              Sou Marca
            </ButtonPrimary>
          </div>
          <p className="text-body-md font-normal text-brand-text-secondary/90">
            Crie seu midia kit conosco - é por lá que marca envia proposta de publi
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
