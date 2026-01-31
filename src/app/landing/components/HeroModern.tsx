"use client";

import React from "react";
import type { LandingCommunityMetrics } from "@/types/landing";
import ButtonPrimary from "./ButtonPrimary";
import { motion, useScroll, useTransform } from "framer-motion";

type HeroModernProps = {
  onCreatorCta: () => void;
  onBrandCta: () => void;
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

const HeroModern: React.FC<HeroModernProps> = ({ onCreatorCta, onBrandCta, metrics }) => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 100]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

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

  return (
    <section
      id="inicio"
      className="landing-section relative min-h-[90vh] overflow-hidden bg-white pt-8 md:pt-0"
      style={{
        paddingTop: `calc(var(--space-fluid-4, 5rem) + var(--sat, 0px) + var(--landing-header-h, 4.5rem) + 1rem)`,
      }}
    >
      {/* Premium Mesh Background */}
      <div className="absolute inset-0 pointer-events-none opacity-40">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#FF2C7E22_0%,transparent_50%),radial-gradient(circle_at_80%_20%,#246BFD22_0%,transparent_50%),radial-gradient(circle_at_50%_80%,#FFB34722_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay" />
      </div>

      <motion.div style={{ y: y1, opacity }} className="absolute -top-20 -left-20 w-[600px] h-[600px] bg-brand-primary/5 rounded-full blur-[140px]" />
      <motion.div style={{ y: y2, opacity }} className="absolute top-40 -right-20 w-[500px] h-[500px] bg-brand-accent/5 rounded-full blur-[120px]" />

      <div className="landing-section__inner relative z-10 flex w-full flex-col gap-16 md:gap-24">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 text-center">

          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 group flex items-center gap-2 rounded-full border border-brand-primary/20 bg-brand-primary/10 px-5 py-2.5 transition-all hover:bg-brand-primary/15"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
            </span>
            <span className="text-xs font-black uppercase tracking-[0.25em] text-brand-primary">
              IA Viva na Creator Economy
            </span>
          </motion.div>

          <div className="flex flex-col items-center gap-4 md:gap-10 px-6 md:px-4">
            <h1 className="max-w-[15ch] text-[3.5rem] md:text-[5.5rem] lg:text-[6.5rem] font-black leading-[1.1] md:leading-[0.9] tracking-tighter text-brand-dark text-balance pb-6">
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800">
                Revisão estratégica
              </span>
              <span className="block mt-3 md:mt-4 bg-gradient-to-br from-brand-primary via-[#FF4080] to-brand-accent bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(255,44,126,0.3)]">
                via IA em reuniões semanais.
              </span>
            </h1>

            <p className="max-w-3xl px-2 md:px-0 text-[1.2rem] md:text-3xl font-medium text-slate-600 leading-[1.4] text-balance">
              Plataforma que <span className="text-brand-dark font-bold">analisa cada post seu</span>, te coloca na vitrine para marcas e organiza sua rotina de forma estratégica.
            </p>
          </div>

          <div className="mt-5 md:mt-2 flex w-full flex-row items-center gap-3 px-6 md:px-0 sm:justify-center">
            <ButtonPrimary
              onClick={onCreatorCta}
              size="lg"
              variant="brand"
              className="group relative w-[46%] sm:w-auto sm:min-w-[260px] overflow-hidden rounded-2xl px-6 py-4 text-base sm:px-8 sm:py-5 sm:text-lg shadow-2xl shadow-brand-primary/30 transition-all hover:scale-[1.03] active:scale-[0.98]"
            >
              <span className="relative z-10 flex items-center justify-center gap-2 font-black text-lg">
                Sou Criador <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            </ButtonPrimary>

            <button
              onClick={onBrandCta}
              className="w-[46%] sm:w-auto sm:min-w-[200px] rounded-2xl border-2 border-slate-200 bg-white/50 px-6 py-4 text-base sm:px-8 sm:py-5 sm:text-lg font-black text-brand-dark shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-all hover:border-brand-dark hover:bg-white hover:shadow-xl hover:shadow-slate-300/50"
            >
              Sou Marca
            </button>
          </div>

          {/* New Integrated Media Kit Info Card */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative mt-16 md:mt-8 group w-full max-w-3xl overflow-hidden rounded-[3rem] border border-white/80 bg-gradient-to-b from-white/60 to-white/20 p-px shadow-2xl backdrop-blur-2xl"
          >
            <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/40 to-transparent" />
            <div className="relative bg-white/40 p-6 md:p-10 transition-all group-hover:bg-white/50">
              <div className="mb-6 inline-flex rounded-2xl bg-[#141C2F] px-4 py-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.3em] text-white">
                Networking & Curadoria
              </div>
              <h3 className="text-xl md:text-3xl font-black text-brand-dark tracking-tight">
                Seu portal direto para o mercado.
              </h3>
              <p className="mt-6 text-base font-bold text-slate-500/80 leading-relaxed md:text-lg">
                Crie seu mídia kit auditado para fechar publis melhores. Se bater insegurança na hora de <span className="text-brand-dark">precificar</span> ou entender por que não cresce, a D2C te orienta com suporte estratégico humano e via IA.
              </p>

              <div className="mt-8 md:mt-12 grid grid-cols-3 gap-4 border-t border-brand-dark/5 pt-8 md:flex md:flex-wrap md:justify-center md:gap-10 md:pt-12">
                {[
                  { label: "Mídia Kit Vivo", icon: "💎" },
                  { label: "Suporte 1:1", icon: "🤝" },
                  { label: "Jobs Auditados", icon: "🛡️" }
                ].map(item => (
                  <div key={item.label} className="flex flex-col md:flex-row items-center gap-2 md:gap-3 group/item">
                    <span className="text-xl md:text-2xl transition-transform group-hover/item:scale-125 duration-300">{item.icon}</span>
                    <span className="text-[10px] md:text-xs font-black text-brand-dark uppercase tracking-[0.15em] md:tracking-[0.2em] text-center md:text-left">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
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
