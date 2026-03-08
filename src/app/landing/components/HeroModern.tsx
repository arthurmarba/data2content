"use client";

import React from "react";
import { motion, useScroll, useTransform } from "framer-motion";

import { getLandingPrimaryCtaLabel, LANDING_PRICE_SUPPORT } from "@/app/landing/copy";
import type { LandingCommunityMetrics } from "@/types/landing";

import ButtonPrimary from "./ButtonPrimary";

type HeroModernProps = {
  onCreatorCta: () => void;
  isAuthenticated?: boolean;
  metrics?: LandingCommunityMetrics | null;
};

type AccentVariant = "primary" | "accent" | "sun";

type MobileValuePillar = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

type HighlightCardProps = {
  metricValue: number;
  metricLabel: string;
  mobileLabel?: string;
  prefix?: string;
  index: number;
  accent?: AccentVariant;
};

const MOBILE_VALUE_PILLARS: MobileValuePillar[] = [
  {
    id: "positioning",
    icon: "✦",
    title: "Reunião de Roteiro",
    description: "Toda terça, 19h, para revisar se seu roteiro esta no caminho certo.",
  },
  {
    id: "direction",
    icon: "↗",
    title: "Reunião de Conteúdo",
    description: "Toda quinta, 19h, para revisar sua edição, captação e conteúdo.",
  },
  {
    id: "opportunities",
    icon: "◆",
    title: "Banco de Talentos",
    description: "Nossos criadores são avalidados para representação comercial pela Destaque;",
  },
  {
    id: "platform",
    icon: "⚡",
    title: "Nossa Plataforma",
    description: "Diagnósticos de conteúdo por IA, ferramentas para organizar seu planejamento e notificações de revisão de conteúdo/roteiro.",
  },
  {
    id: "networking",
    icon: "🤝",
    title: "Networking Ativo",
    description: "Conexão com outros criadores para crescer juntos com collab.",
  },
];

const COMPACT_NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

function formatCompactMetric(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0";
  return COMPACT_NUMBER_FORMATTER.format(value);
}

const HeroProofCard: React.FC<HighlightCardProps> = ({
  metricValue,
  metricLabel,
  mobileLabel,
  prefix = "+",
  index,
  accent = "primary",
}) => {
  const formatted = formatCompactMetric(metricValue);

  const accentClasses: Record<AccentVariant, { border: string; value: string; tag: string; bg: string }> = {
    primary: {
      border: "border-brand-primary/15",
      value: "text-brand-primary",
      tag: "text-brand-primary/70",
      bg: "bg-brand-primary/[0.05]",
    },
    accent: {
      border: "border-brand-accent/15",
      value: "text-brand-accent",
      tag: "text-brand-accent/70",
      bg: "bg-brand-accent/[0.05]",
    },
    sun: {
      border: "border-brand-sun/20",
      value: "text-brand-sun-dark",
      tag: "text-brand-sun-dark/70",
      bg: "bg-brand-sun/[0.08]",
    },
  };
  const accentStyle = accentClasses[accent];

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.52 + index * 0.08, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={`rounded-[1.1rem] border ${accentStyle.border} ${accentStyle.bg} px-3 py-2.5 text-left shadow-[0_10px_24px_rgba(20,33,61,0.04)] backdrop-blur-sm md:rounded-[1.6rem] md:px-5 md:py-4 md:shadow-[0_18px_36px_rgba(20,33,61,0.05)]`}
    >
      <p className={`text-[0.52rem] font-black uppercase tracking-[0.12em] ${accentStyle.tag} md:text-[0.68rem] md:tracking-[0.18em]`}>
        {mobileLabel ?? metricLabel}
      </p>
      <p className={`mt-1 text-[1rem] font-black leading-none tracking-[-0.03em] ${accentStyle.value} md:mt-2 md:text-[1.8rem]`}>
        {metricValue > 0 ? `${prefix}${formatted}` : "—"}
      </p>
    </motion.article>
  );
};

const HeroValuePillarCard: React.FC<{ pillar: MobileValuePillar; index: number }> = ({ pillar, index }) => (
  <motion.article
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.7, delay: 0.58 + index * 0.05, ease: [0.21, 0.47, 0.32, 0.98] }}
    className="rounded-[1.15rem] border border-slate-200/80 bg-white/92 px-3.5 py-3 text-left shadow-[0_10px_18px_rgba(20,33,61,0.04)] transition-all hover:border-brand-primary/20 md:rounded-[1.8rem] md:px-5 md:py-5 md:shadow-[0_18px_36px_rgba(20,33,61,0.05)]"
  >
    <div className="flex items-start gap-3 md:gap-4">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-[0.9rem] bg-brand-primary text-[0.9rem] font-black text-white shadow-lg shadow-brand-primary/20 md:h-11 md:w-11 md:rounded-[1rem] md:text-[1rem]">
        {pillar.icon}
      </span>
      <div>
        <h2 className="text-[0.96rem] font-black leading-[1.1] text-brand-dark md:text-[1.05rem]">{pillar.title}</h2>
        <p className="mt-1.5 text-[12px] leading-[1.55] text-slate-600 md:text-[13px] md:leading-[1.65]">{pillar.description}</p>
      </div>
    </div>
  </motion.article>
);

const HeroModern: React.FC<HeroModernProps> = ({ onCreatorCta, isAuthenticated = false, metrics }) => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 90]);
  const y2 = useTransform(scrollY, [0, 500], [0, -120]);
  const opacity = useTransform(scrollY, [0, 280], [1, 0]);
  const primaryLabel = getLandingPrimaryCtaLabel(isAuthenticated);

  const highlights = React.useMemo(
    () => [
      {
        metricValue: metrics?.activeCreators ?? 0,
        metricLabel: "criadores ativos",
        mobileLabel: "Criadores",
        prefix: "+",
        accent: "primary" as AccentVariant,
      },
      {
        metricValue: metrics?.reachLast30Days ?? 0,
        metricLabel: "contas alcançadas",
        mobileLabel: "Alcance 30d",
        prefix: "+",
        accent: "accent" as AccentVariant,
      },
      {
        metricValue: metrics?.combinedFollowers ?? 0,
        metricLabel: "seguidores totais",
        mobileLabel: "Seguidores",
        prefix: "+",
        accent: "sun" as AccentVariant,
      },
    ],
    [metrics],
  );

  return (
    <section
      id="inicio"
      className="landing-section relative overflow-x-clip overflow-y-visible bg-white pb-6 md:pb-4 md:!pt-[calc(var(--space-fluid-1,2rem)+var(--sat,0px)+var(--landing-header-h,4rem)+clamp(1.75rem,4vw,3.5rem))]"
      style={{
        paddingTop: `calc(var(--sat, 0px) + var(--landing-header-h, 4rem) + 0.1rem)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-35"
        style={{
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 52%, transparent 100%)",
          maskImage: "linear-gradient(180deg, #000 0%, #000 52%, transparent 100%)",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_24%,#FF2C7E16_0%,transparent_42%),radial-gradient(circle_at_84%_18%,#246BFD16_0%,transparent_44%),radial-gradient(circle_at_50%_78%,#FFB34714_0%,transparent_54%)]" />
        <div className="absolute inset-0 hidden bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay sm:block" />
      </div>

      <div className="absolute -top-14 -left-10 h-48 w-48 rounded-full bg-brand-primary/10 blur-[60px] sm:hidden" />
      <div className="absolute top-28 -right-10 h-44 w-44 rounded-full bg-brand-accent/10 blur-[54px] sm:hidden" />

      <motion.div
        style={{ y: y1, opacity, willChange: "transform, opacity" }}
        animate={{ scale: [1, 1.08, 1], rotate: [0, 4, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
        className="absolute -top-20 -left-20 hidden h-[600px] w-[600px] rounded-full bg-brand-primary/10 blur-[140px] sm:block"
      />
      <motion.div
        style={{ y: y2, opacity, willChange: "transform, opacity" }}
        animate={{ scale: [1, 1.12, 1], rotate: [0, -4, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "linear", delay: 2 }}
        className="absolute top-40 -right-20 hidden h-[500px] w-[500px] rounded-full bg-brand-accent/10 blur-[120px] sm:block"
      />

      <div className="landing-section__inner relative z-10 flex w-full flex-col gap-5 sm:gap-8 md:gap-9">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 text-center sm:gap-7 md:gap-9">
          <div className="relative z-10 mx-auto flex items-center justify-center gap-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-2 py-0.5 text-center sm:gap-2 sm:px-5 sm:py-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-brand-primary" />
            </span>
            <span className="text-[7.5px] font-black uppercase tracking-[0.1em] text-brand-primary sm:text-xs sm:tracking-[0.25em]">
              Banco de Talentos da Agência Destaque
            </span>
          </div>

          <div className="mt-2 flex flex-col items-center gap-2.5 px-2.5 sm:mt-1 sm:gap-4 sm:px-6 md:mt-2 md:gap-6 md:px-4">
            <h1 className="font-black tracking-[-0.04em] text-brand-dark">
              <span className="mx-auto flex max-w-[12ch] flex-col items-center text-[clamp(2.65rem,11.8vw,3rem)] leading-[0.93] sm:hidden">
                <motion.span
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="block pb-[0.05em] text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800"
                >
                  Direção
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="mt-0.5 block pb-[0.05em] text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800"
                >
                  estratégica de
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, delay: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="mt-0.5 block bg-gradient-to-br from-brand-primary via-[#FF4080] to-brand-accent bg-clip-text text-transparent"
                >
                  conteúdo.
                </motion.span>
              </span>

              <span className="hidden max-w-[14ch] text-balance text-[3rem] leading-[1.03] sm:block md:max-w-[16.5ch] md:text-[5rem] md:leading-[0.96] lg:text-[5.5rem]">
                <motion.span
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="block text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800"
                >
                  Direção estratégica
                </motion.span>
                <motion.span
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.15, ease: [0.21, 0.47, 0.32, 0.98] }}
                  className="mt-2.5 block bg-gradient-to-br from-brand-primary via-[#FF4080] to-brand-accent bg-clip-text text-transparent md:mt-3"
                >
                  de conteúdo.
                </motion.span>
              </span>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.35, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="max-w-[34ch] text-[0.95rem] font-medium leading-[1.5] text-slate-600 text-balance sm:max-w-2xl sm:px-2 sm:text-base sm:leading-[1.48] md:max-w-[44ch] md:px-0 md:text-[1.18rem] md:leading-[1.5] lg:max-w-[48ch]"
            >
              <span
                data-testid="hero-mobile-subtitle"
                className="mx-auto block max-w-[18.2rem] text-[14px] leading-[1.58] tracking-[-0.012em] text-slate-600 sm:hidden"
              >
                Estratégia para você focar na criação. Pare de caçar marcas e{" "}
                <span className="font-bold text-slate-900">comece a ser encontrado pela oportunidade ideal.</span>
              </span>
              <span className="hidden sm:inline">
                Focamos na estratégia para você focar em criar. Não se desvalorize indo atrás de marcas.{" "}
                <span className="font-bold text-slate-700">
                  Se posicione para que a oportunidade ideal venha ate a sua narrativa.
                </span>
              </span>
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="mt-1 flex w-full flex-col items-center justify-center gap-2 px-4 sm:mt-2 sm:gap-3 sm:px-6 md:mt-1 md:px-0"
          >
            <div className="relative group">
              <div className="absolute -inset-1 rounded-[1.35rem] bg-gradient-to-r from-brand-primary/30 via-brand-accent/30 to-brand-primary/30 opacity-70 blur-md transition duration-700 group-hover:opacity-100" />
              <ButtonPrimary
                onClick={onCreatorCta}
                size="lg"
                variant="brand"
                magnetic={false}
                className="relative min-w-[14.75rem] overflow-hidden rounded-[1.25rem] px-5 py-3.5 text-[0.98rem] shadow-[0_16px_30px_rgba(245,43,106,0.22)] transition-transform hover:scale-[1.01] active:scale-[0.98] sm:min-w-[280px] sm:rounded-2xl sm:px-8 sm:py-5 sm:text-lg"
              >
                <span className="relative z-10 flex items-center justify-center gap-2 whitespace-nowrap text-[0.98rem] font-black sm:text-lg">
                  {primaryLabel}
                  <span className="transition-transform group-hover:translate-x-1">→</span>
                </span>
              </ButtonPrimary>
            </div>

            {!isAuthenticated ? (
              <p className="mt-3 text-center text-[11px] font-semibold leading-tight text-slate-500 md:mt-3.5">
                {LANDING_PRICE_SUPPORT}
              </p>
            ) : null}
          </motion.div>

          <div
            data-testid="hero-mobile-proof"
            className="mt-4 grid w-full max-w-[22rem] grid-cols-3 gap-2 sm:mt-5 sm:max-w-[34rem] sm:gap-3 md:mt-6 md:max-w-5xl md:gap-5"
          >
            {highlights.map((item, index) => (
              <HeroProofCard key={item.metricLabel} index={index} {...item} />
            ))}
          </div>

          <div
            data-testid="hero-mobile-value-pillars"
            className="mt-4 grid w-full gap-2.5 md:mt-5 md:grid-cols-2 md:gap-3.5 lg:grid-cols-3"
          >
            {MOBILE_VALUE_PILLARS.map((pillar, index) => (
              <HeroValuePillarCard key={pillar.id} pillar={pillar} index={index} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroModern;
