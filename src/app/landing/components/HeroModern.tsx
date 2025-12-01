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
      className={`flex h-full flex-col justify-between gap-3 rounded-[28px] border border-brand-glass bg-white/95 p-6 text-left transition-all duration-200 hover:-translate-y-1 hover:shadow-glass-md ${accentStyle.border} ${accentStyle.shadow}`}
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
      <div className="flex flex-col gap-2">
        <span className="text-[clamp(2.2rem,3.3vw,2.8rem)] font-bold leading-tight text-brand-dark">
          {metricValue > 0 ? `${prefix}${formatted}` : "—"}
        </span>
        <span className={`h-[2px] w-10 rounded-full ${accentStyle.divider}`} />
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
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_-15%,rgba(255,255,255,0.95),transparent_60%),radial-gradient(circle_at_20%_10%,rgba(255,44,126,0.09),transparent_50%),radial-gradient(circle_at_85%_-5%,rgba(36,107,253,0.08),transparent_55%)]" />

      <div className="landing-section__inner relative flex w-full flex-col gap-12 md:gap-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 text-center text-brand-dark">
          <span className="landing-chip border-brand-primary/20 bg-brand-primary/5 text-brand-primary md:text-sm">
            IA viva na creator economy
          </span>

          <div className="flex flex-col items-center gap-6">
            <h1 className="max-w-[24ch] text-[2.4rem] text-balance font-black leading-[1.05] tracking-tight text-brand-dark drop-shadow-sm sm:text-[3.6rem] lg:text-[4.2rem]">
              <span className="block bg-gradient-to-br from-brand-dark to-brand-dark/80 bg-clip-text text-transparent">
                Agência que da suporte aos criadores
              </span>
              <span className="block text-brand-primary">
                com estratégia de imagem e conteúdo.
              </span>
            </h1>

            <p className="max-w-2xl text-body-lg font-medium text-brand-text-secondary md:text-xl">
              E faz o match entre marcas e criadores com IA.
            </p>
          </div>

          <div className="mt-2 flex w-full flex-col items-center gap-4 xs:flex-row xs:justify-center">
            <ButtonPrimary onClick={onCreatorCta} size="lg" variant="brand" className="min-w-[200px] shadow-lg shadow-brand-primary/20 transition-transform hover:scale-105">
              Sou Criador
            </ButtonPrimary>
            <ButtonPrimary
              onClick={onBrandCta}
              size="lg"
              variant="outline"
              className="min-w-[200px] bg-white/50 backdrop-blur-sm hover:bg-white/80"
            >
              Sou Marca
            </ButtonPrimary>
          </div>

          <div className="mt-4 w-full max-w-3xl rounded-3xl border border-white/60 bg-white/40 px-6 py-5 text-center shadow-[0_8px_32px_rgba(0,0,0,0.04)] backdrop-blur-md transition-all hover:bg-white/50 md:px-8 md:py-6">
            <p className="text-lg font-semibold text-brand-dark">
              Crie seu mídia kit conosco
            </p>
            <p className="mt-3 text-sm leading-relaxed text-brand-text-secondary/90">
              É por lá que a marca envia a proposta de publi.
            </p>
            <div className="my-4 h-px w-full bg-gradient-to-r from-transparent via-brand-dark/10 to-transparent" />
            <p className="text-sm leading-relaxed text-brand-text-secondary">
              E se bater insegurança na hora de <strong className="font-semibold text-brand-dark">precificar</strong>, responder um <strong className="font-semibold text-brand-dark">briefing</strong>, entender por que não fecha publis melhores, por que não cresce, ou por que está perdendo seguidores…
            </p>
            <p className="mt-3 font-medium text-brand-primary">
              A D2C está aqui pra te orientar com suporte estratégico de verdade.
            </p>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, index) => (
            <HighlightCard key={item.metricLabel} index={index} {...item} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroModern;
