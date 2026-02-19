"use client";

import React from "react";
import type { LandingCommunityMetrics } from "@/types/landing";
import ButtonPrimary from "./ButtonPrimary";
import { motion, useScroll, useTransform } from "framer-motion";

type HeroModernProps = {
  onCreatorCta: () => void;
  isAuthenticated?: boolean;
  metrics?: LandingCommunityMetrics | null;
};

function easeOutCubic(x: number) {
  return 1 - Math.pow(1 - x, 3);
}

function useCountUp(targetValue: number, duration = 1100) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    if (targetValue <= 0) {
      setValue(0);
      return;
    }

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

function useClientNumberFormatter() {
  const [formatter, setFormatter] = React.useState<Intl.NumberFormat | null>(null);

  React.useEffect(() => {
    setFormatter(
      new Intl.NumberFormat("pt-BR", {
        notation: "compact",
        maximumFractionDigits: 1,
      }),
    );
  }, []);

  return formatter;
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
  const formatter = useClientNumberFormatter();
  const countedValue = useCountUp(metricValue, 900 + index * 120);
  const formatted = formatter
    ? formatter.format(countedValue || 0)
    : `${Math.round(countedValue || 0)}`;

  const accentClasses: Record<
    AccentVariant,
    { border: string; shadow: string; tag: string; divider: string; iconBg: string; glow: string }
  > = {
    primary: {
      border: "border-brand-primary/20",
      shadow: "shadow-[20px_20px_40px_-15px_rgba(255,44,126,0.15)]",
      tag: "text-brand-primary",
      divider: "bg-brand-primary/20",
      iconBg: "bg-brand-primary/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(255,44,126,0.2)]",
    },
    accent: {
      border: "border-brand-accent/20",
      shadow: "shadow-[20px_20px_40px_-15px_rgba(36,107,253,0.15)]",
      tag: "text-brand-accent",
      divider: "bg-brand-accent/20",
      iconBg: "bg-brand-accent/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(36,107,253,0.2)]",
    },
    sun: {
      border: "border-brand-sun/20",
      shadow: "shadow-[20px_20px_40px_-15px_rgba(255,179,71,0.15)]",
      tag: "text-brand-sun-dark",
      divider: "bg-brand-sun/25",
      iconBg: "bg-brand-sun/10",
      glow: "group-hover:shadow-[0_0_20px_rgba(255,179,71,0.2)]",
    },
  };
  const accentStyle = accentClasses[accent];

  return (
    <motion.article
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "circOut" }}
      className={`group flex h-full flex-col justify-between gap-3 rounded-[2rem] border ${accentStyle.border} bg-white/40 p-4 text-left backdrop-blur-md transition-all duration-500 hover:-translate-y-2 hover:bg-white/60 sm:gap-4 sm:rounded-[2.5rem] sm:p-6 lg:p-7 ${accentStyle.shadow} ${accentStyle.glow}`}
    >
      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-xl text-base font-semibold text-brand-dark transition-transform duration-300 group-hover:rotate-12 sm:h-10 sm:w-10 sm:rounded-2xl sm:text-lg ${accentStyle.iconBg}`}
        >
          ✦
        </span>
        <span className={`text-[0.55rem] font-black uppercase tracking-[0.18em] sm:text-[0.75rem] sm:tracking-[0.2em] ${accentStyle.tag}`}>
          {metricLabel}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[clamp(1.7rem,6vw,2.4rem)] font-black leading-none tracking-tight text-brand-dark sm:text-[clamp(2.4rem,4vw,3.2rem)]">
          {metricValue > 0 ? `${prefix}${formatted}` : "—"}
        </span>
        <span className={`mt-2 h-0.5 w-8 rounded-full transition-all duration-300 group-hover:w-14 sm:h-1 sm:w-12 sm:group-hover:w-20 ${accentStyle.divider}`} />
      </div>
    </motion.article>
  );
};

const HeroModern: React.FC<HeroModernProps> = ({ onCreatorCta, isAuthenticated = false, metrics }) => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 100]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);
  const [isInfoExpanded, setIsInfoExpanded] = React.useState(false);

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
        metricLabel: "seguidores totais",
        prefix: "+",
        accent: "sun" as AccentVariant,
      },
    ],
    [metrics],
  );
  const heroCtaLabel = isAuthenticated ? "Acessar minha conta" : "Quero entrar na D2C";

  return (
    <section
      id="inicio"
      className="landing-section relative overflow-visible bg-white pb-6 pt-5 sm:min-h-[88vh] sm:pb-12 sm:pt-6 md:min-h-[90vh] md:pb-16 md:pt-0"
      style={{
        paddingTop: `calc(var(--space-fluid-4, 5.5rem) + var(--sat, 0px) + var(--landing-header-h, 4.5rem))`,
      }}
    >
      {/* Premium Mesh Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, #000 52%, transparent 100%)",
          maskImage: "linear-gradient(180deg, #000 0%, #000 52%, transparent 100%)",
        }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#FF2C7E22_0%,transparent_50%),radial-gradient(circle_at_80%_20%,#246BFD22_0%,transparent_50%),radial-gradient(circle_at_50%_80%,#FFB34722_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <motion.div style={{ y: y1, opacity }} className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-brand-primary/5 rounded-full blur-[140px]" />
      <motion.div style={{ y: y2, opacity }} className="absolute top-40 -right-20 w-[500px] h-[500px] bg-brand-accent/5 rounded-full blur-[120px]" />

      <div className="landing-section__inner relative z-10 flex w-full flex-col gap-7 sm:gap-14 md:gap-24">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center sm:gap-8 md:gap-10">

          <div className="relative z-10 mb-3 mx-auto group flex items-center justify-center gap-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-3.5 py-2 text-center transition-all hover:bg-brand-primary/15 sm:mb-0 sm:gap-2 sm:px-5 sm:py-2.5">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-brand-primary sm:text-xs sm:tracking-[0.25em]">
              IA na Creator Economy
            </span>
          </div>

          <div className="flex flex-col items-center gap-6 px-4 sm:gap-4 sm:px-6 md:gap-10 md:px-4">
            <h1 className="font-black tracking-[-0.04em] text-brand-dark">
              <span className="mx-auto flex max-w-[13ch] flex-col items-center text-[3.85rem] leading-[1.03] sm:hidden">
                <span className="block pb-[0.07em] text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800">
                  Agência
                </span>
                <span className="mt-0.5 block pb-[0.07em] text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800">
                  estratégica
                </span>
                <span className="mt-0.5 block bg-gradient-to-br from-brand-primary via-[#FF4080] to-brand-accent bg-clip-text text-transparent drop-shadow-[0_0_32px_rgba(255,44,126,0.28)]">
                  para creators
                </span>
                <span className="mt-0.5 block bg-gradient-to-br from-brand-primary via-[#FF4080] to-brand-accent bg-clip-text text-transparent drop-shadow-[0_0_32px_rgba(255,44,126,0.28)]">
                  via IA.
                </span>
              </span>

              <span className="hidden max-w-[14ch] text-balance text-[3rem] leading-[1.03] sm:block md:max-w-[15.5ch] md:text-[5.4rem] md:leading-[0.96] lg:text-[6.3rem]">
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800">
                  Agência estratégica
                </span>
                <span className="mt-2.5 block bg-gradient-to-br from-brand-primary via-[#FF4080] to-brand-accent bg-clip-text text-transparent drop-shadow-[0_0_32px_rgba(255,44,126,0.28)] md:mt-3 md:drop-shadow-[0_0_40px_rgba(255,44,126,0.3)]">
                  para creators via IA.
                </span>
              </span>
            </h1>

            <p className="mt-2 max-w-[34ch] px-1 text-[0.95rem] font-medium leading-[1.5] text-slate-600 text-balance sm:mt-0 sm:max-w-2xl sm:px-2 sm:text-base sm:leading-[1.48] md:max-w-3xl md:px-0 md:text-2xl md:leading-[1.4]">
              Revisão de posts em reuniões semanais. Plataforma para gestão de conteúdo e publicidade para <span className="font-bold text-slate-700">negociar com marcas.</span>
            </p>
          </div>

          <div className="mt-4 flex w-full flex-row items-center justify-center gap-2.5 px-4 sm:mt-3 sm:gap-3 sm:px-6 sm:justify-center md:mt-2 md:px-0">
            <ButtonPrimary
              onClick={onCreatorCta}
              size="lg"
              variant="brand"
              className="group relative w-auto min-w-[220px] overflow-hidden rounded-2xl px-4 py-3.5 text-[0.95rem] shadow-2xl shadow-brand-primary/30 transition-all hover:scale-[1.03] active:scale-[0.98] sm:min-w-[260px] sm:px-8 sm:py-5 sm:text-lg"
            >
              <span className="relative z-10 flex items-center justify-center gap-1.5 whitespace-nowrap text-[0.95rem] font-black sm:gap-2 sm:text-lg">
                {heroCtaLabel} <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </ButtonPrimary>
          </div>

          {/* New Integrated Media Kit Info Card */}
          <div className="relative mt-4 hidden w-full max-w-3xl overflow-hidden rounded-[1.75rem] border border-white/80 bg-gradient-to-b from-white/60 to-white/20 p-px shadow-2xl backdrop-blur-2xl group sm:mt-8 sm:block sm:rounded-[2.5rem] md:mt-8 md:rounded-[3rem]">
            <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/40 to-transparent" />
            <div className="relative bg-white/40 p-3.5 transition-all group-hover:bg-white/50 sm:p-6 md:p-10">
              <div className="mb-2 inline-flex rounded-2xl bg-[#141C2F] px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.2em] text-white sm:mb-6 sm:px-4 sm:py-2 sm:text-[9px] md:text-[10px] md:tracking-[0.3em]">
                Networking & Curadoria
              </div>
              <h3 className="text-[1.15rem] font-black tracking-tight text-brand-dark sm:text-[1.45rem] md:text-3xl">
                Seu portal direto para o mercado.
              </h3>
              <p className="mt-2 text-[13px] font-bold leading-[1.45] text-slate-500/80 sm:mt-4 sm:text-[0.98rem] md:mt-6 md:text-lg md:leading-relaxed">
                <span className="sm:hidden">
                  {isInfoExpanded
                    ? "Crie seu mídia kit auditado para fechar publis melhores. Se bater insegurança na hora de precificar ou entender por que não cresce, a D2C te orienta com suporte estratégico humano e via IA."
                    : "Crie seu mídia kit auditado e receba suporte para fechar publis melhores."}
                </span>
                <span className="hidden sm:inline">
                  Crie seu mídia kit auditado para fechar publis melhores. Se bater insegurança na hora de <span className="text-brand-dark">precificar</span> ou entender por que não cresce, a D2C te orienta com suporte estratégico humano e via IA.
                </span>
              </p>
              <button
                type="button"
                onClick={() => setIsInfoExpanded((value) => !value)}
                className="mt-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-brand-primary sm:hidden"
              >
                {isInfoExpanded ? "Ver menos" : "Saiba mais"}
              </button>

              <div className="mt-3.5 grid grid-cols-3 gap-2.5 border-t border-brand-dark/5 pt-3.5 sm:mt-8 sm:gap-4 sm:pt-8 md:mt-12 md:flex md:flex-wrap md:justify-center md:gap-10 md:pt-12">
                {[
                  { label: "Mídia Kit Vivo", icon: "💎" },
                  { label: "Suporte 1:1", icon: "🤝" },
                  { label: "Jobs Auditados", icon: "🛡️" }
                ].map(item => (
                  <div key={item.label} className="group/item flex flex-col items-center gap-1.5 md:flex-row md:gap-3">
                    <span className="text-base transition-transform duration-300 group-hover/item:scale-125 sm:text-xl md:text-2xl">{item.icon}</span>
                    <span className="text-center text-[8px] font-black uppercase tracking-[0.1em] text-brand-dark sm:text-[10px] sm:tracking-[0.15em] md:text-left md:text-xs md:tracking-[0.2em]">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden md:grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {highlights.map((item, index) => (
            <HighlightCard key={item.metricLabel} index={index} {...item} />
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </section>
  );
};

export default HeroModern;
