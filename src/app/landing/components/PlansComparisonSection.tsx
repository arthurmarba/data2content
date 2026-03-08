"use client";

import React, { useRef, useState } from "react";
import ButtonPrimary from "./ButtonPrimary";
import { motion, useMotionValue, useSpring, useMotionTemplate, useTransform } from "framer-motion";
import { getLandingPrimaryCtaLabel } from "@/app/landing/copy";

type PlansComparisonSectionProps = {
  onCreateAccount: () => void;
  isAuthenticated?: boolean;
};

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
    <path
      d="m4.5 10.5 3.5 3.5 7.5-8"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const PlanCard = ({
  title,
  price,
  description,
  features,
  isPro = false,
  ctaText,
  onCta,
  note
}: {
  title: string;
  price: string;
  description: string;
  features: string[];
  isPro?: boolean;
  ctaText: string;
  onCta: () => void;
  note?: string;
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Mouse positions
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Perspective rotations
  const rotateX = useSpring(useTransform(y, [0.5, -0.5], [10, -10]), { stiffness: 100, damping: 20 });
  const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [10, -10]), { stiffness: 100, damping: 20 });

  // Glow position
  const glowX = useMotionValue(0);
  const glowY = useMotionValue(0);

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    // Normalized position (-0.5 to 0.5)
    const normalizedX = (event.clientX - rect.left) / width - 0.5;
    const normalizedY = (event.clientY - rect.top) / height - 0.5;

    x.set(normalizedX);
    y.set(normalizedY);
    glowX.set(event.clientX - rect.left);
    glowY.set(event.clientY - rect.top);
  }

  function onMouseLeave() {
    x.set(0);
    y.set(0);
  }

  const glowStyle = useMotionTemplate`
    radial-gradient(
      450px circle at ${glowX}px ${glowY}px,
      rgba(255, 64, 128, 0.08),
      transparent 80%
    )
  `;

  return (
    <div
      className="perspective-1000"
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
    >
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className={`relative flex flex-col overflow-hidden rounded-[2.15rem] border p-5 sm:p-10 transition-shadow duration-500 shadow-2xl ${isPro
          ? "border-brand-primary/30 bg-white shadow-brand-primary/10 ring-1 ring-brand-primary/20"
          : "border-white bg-white shadow-slate-200/50"
          } backdrop-blur-xl`}
      >
        {/* Glow Layer */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{ background: glowStyle }}
        />

        {isPro && (
          <div className="absolute right-5 top-5 sm:right-8 sm:top-8" style={{ transform: "translateZ(40px)" }}>
            <span className="relative inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-1 text-[8px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-brand-primary/30 sm:px-4 sm:py-1.5 sm:text-[10px] sm:tracking-[0.2em]">
              <span className="absolute -inset-1 rounded-full bg-brand-primary/20 animate-pulse" />
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              Recomendado
            </span>
          </div>
        )}

        <div className="mb-8 sm:mb-10" style={{ transform: "translateZ(50px)" }}>
          <h3 className={`text-[1.65rem] font-black tracking-tight ${isPro ? "text-brand-primary" : "text-brand-dark"} sm:text-2xl`}>
            {title}
          </h3>
          <div className="mt-4 flex items-baseline gap-1 sm:mt-6">
            <span className="text-[2.6rem] font-black tracking-tighter text-brand-dark sm:text-5xl">{price}</span>
            {price !== "Investimento" && <span className="text-[0.95rem] font-bold text-slate-400 sm:text-lg">/ mês</span>}
          </div>
          <p className="mt-3 text-[14px] font-semibold leading-[1.6] text-slate-500/85 sm:mt-4 sm:text-base sm:font-bold">
            {description}
          </p>
        </div>

        <div className="flex-1" style={{ transform: "translateZ(30px)" }}>
          <p className="mb-4 text-[9px] font-black uppercase tracking-[0.22em] text-slate-400 sm:mb-6 sm:text-[10px] sm:tracking-[0.25em]">
            O que está incluído:
          </p>
          <ul className="grid gap-2.5 sm:grid-cols-1 sm:gap-3">
            {features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5 rounded-[1rem] border border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:gap-3 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
                <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${isPro ? "bg-brand-primary/10 text-brand-primary" : "bg-slate-100 text-slate-400"}`}>
                  <CheckIcon />
                </span>
                <span className="text-[13px] font-bold leading-[1.35] text-brand-dark/90 sm:text-sm">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 space-y-3 sm:mt-12 sm:space-y-4" style={{ transform: "translateZ(60px)" }}>
          <div className="relative group">
            <div className="absolute -inset-1 rounded-[1.25rem] bg-gradient-to-r from-brand-primary/40 via-brand-accent/40 to-brand-primary/40 opacity-70 blur-md group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-pulse-slow"></div>
            <ButtonPrimary
              onClick={onCta}
              variant={isPro ? "brand" : "outline"}
              size="lg"
              className={`relative w-full py-4 text-[1rem] font-black shadow-xl ring-2 sm:py-6 sm:text-lg ${isPro ? "ring-brand-primary/10" : "ring-slate-100"} overflow-hidden`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
              {ctaText}
            </ButtonPrimary>
          </div>

          {isPro && (
            <div className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-rose-50/50 py-2 sm:mt-4 sm:bg-transparent sm:py-0">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-600"></span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-600 sm:text-[10px] sm:tracking-[0.2em]">
                Só restam 4 vagas p/ mentoria de Terça
              </span>
            </div>
          )}

          {note && (
            <p className="text-center text-[9px] font-black uppercase tracking-[0.16em] text-slate-400 sm:text-[10px] sm:tracking-widest">
              {note}
            </p>
          )}
        </div>

        {isPro && (
          <div className="absolute -bottom-24 -right-24 h-48 w-48 bg-brand-primary/10 rounded-full blur-[80px]" />
        )}
      </motion.div>
    </div>
  );
};

export default function PlansComparisonSection({
  onCreateAccount,
  isAuthenticated = false,
}: PlansComparisonSectionProps) {
  const primaryCtaLabel = getLandingPrimaryCtaLabel(isAuthenticated);

  return (
    <section id="planos" className="landing-section relative overflow-hidden bg-[#FBFBFC] py-8 sm:py-20 lg:py-24">
      {/* Background Ornaments */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="absolute top-[20%] left-[5%] w-[40%] h-[40%] bg-brand-primary/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-brand-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="landing-section__inner landing-section__inner--wide relative z-10">
        <header className="mx-auto mb-8 max-w-[21rem] text-center sm:mb-10 sm:max-w-2xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[9px] font-black uppercase tracking-[0.26em] text-slate-400 shadow-sm sm:px-4 sm:py-2 sm:text-[10px] sm:tracking-[0.3em]">
            Investimento Estratégico
          </span>
          <h2 className="mt-4 text-[2rem] font-black leading-[1.02] tracking-tight text-brand-dark sm:mt-8 sm:text-4xl md:text-6xl">
            O método que te leva <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">à representação comercial.</span>
          </h2>
        </header>

        <div className="mx-auto grid w-full max-w-3xl gap-5 sm:gap-6">
          <PlanCard
            title="Plano Consultivo"
            price="R$ 49,90"
            isPro
            description="Mentorias estratégicas e tecnologia para acelerar sua representação comercial."
            features={[
              "3 Mentorias Semanais de Conteúdo e Roteiro",
              "Anotações Inteligentes d2c",
              "Calculadora de Precificação Comercial",
              "Radar de Faturamento p/ Representação",
              "Mídia Kit Auditado em Tempo Real"
            ]}
            ctaText={primaryCtaLabel}
            onCta={onCreateAccount}
            note="Valor sofre reajuste nos próximos meses."
          />
        </div>

        <p className="mt-7 text-center text-[13px] font-semibold leading-relaxed text-slate-400 sm:mt-12 sm:text-sm sm:font-bold">
          Você foca 100% na criação e nós te direcionamos. <button className="text-brand-primary hover:underline underline-offset-4">Fale no WhatsApp se tiver dúvidas →</button>
        </p>
      </div>
      <style jsx global>{`
        .perspective-1000 {
          perspective: 1000px;
        }
      `}</style>
    </section>
  );
}
