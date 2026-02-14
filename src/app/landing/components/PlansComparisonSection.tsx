"use client";

import React from "react";
import ButtonPrimary from "./ButtonPrimary";
import { motion } from "framer-motion";

type PlansComparisonSectionProps = {
  onCreateAccount: () => void;
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
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      whileHover={{ y: -10 }}
      className={`relative flex flex-col overflow-hidden rounded-[3rem] border p-10 transition-all duration-500 shadow-2xl ${isPro
          ? "border-brand-primary/30 bg-white/60 shadow-brand-primary/10 ring-1 ring-brand-primary/20"
          : "border-white/80 bg-white/40 shadow-slate-200/50"
        } backdrop-blur-xl`}
    >
      {isPro && (
        <div className="absolute top-8 right-8">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-brand-primary/30">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
            </span>
            Recomendado
          </span>
        </div>
      )}

      <div className="mb-10">
        <h3 className={`text-2xl font-black tracking-tight ${isPro ? "text-brand-primary" : "text-brand-dark"}`}>
          {title}
        </h3>
        <div className="mt-6 flex items-baseline gap-1">
          <span className="text-5xl font-black text-brand-dark tracking-tighter">{price}</span>
          {price !== "Investimento" && <span className="text-lg font-bold text-slate-400">/ mês</span>}
        </div>
        <p className="mt-4 text-base font-bold text-slate-500/80 leading-relaxed">
          {description}
        </p>
      </div>

      <div className="flex-1">
        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-6">
          O que está incluído:
        </p>
        <ul className="grid gap-4 sm:grid-cols-1">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isPro ? "bg-brand-primary/10 text-brand-primary" : "bg-slate-100 text-slate-400"}`}>
                <CheckIcon />
              </span>
              <span className="text-base font-bold text-brand-dark/90 leading-tight">{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-12 space-y-4">
        <ButtonPrimary
          onClick={onCta}
          variant={isPro ? "brand" : "outline"}
          size="lg"
          className={`w-full py-6 text-lg font-black shadow-xl ring-2 ${isPro ? "ring-brand-primary/10" : "ring-slate-100"}`}
        >
          {ctaText}
        </ButtonPrimary>
        {note && (
          <p className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400">
            {note}
          </p>
        )}
      </div>

      {isPro && (
        <div className="absolute -bottom-24 -right-24 h-48 w-48 bg-brand-primary/10 rounded-full blur-[80px]" />
      )}
    </motion.div>
  );
};

export default function PlansComparisonSection({ onCreateAccount }: PlansComparisonSectionProps) {
  return (
    <section id="planos" className="landing-section relative overflow-hidden bg-[#FBFBFC] py-32">
      {/* Background Ornaments */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <div className="absolute top-[20%] left-[5%] w-[40%] h-[40%] bg-brand-primary/5 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[10%] right-[10%] w-[30%] h-[30%] bg-brand-accent/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="landing-section__inner landing-section__inner--wide relative z-10">
        <header className="mx-auto max-w-2xl text-center mb-12">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 shadow-sm">
            Investimento Estratégico
          </span>
          <h2 className="mt-8 text-4xl md:text-6xl font-black text-brand-dark tracking-tight">
            O seu novo parceiro <br className="hidden md:block" />
            <span className="bg-gradient-to-r from-brand-primary to-brand-accent bg-clip-text text-transparent">estratégico.</span>
          </h2>
        </header>

        <div className="mx-auto grid w-full max-w-3xl gap-8">
          <PlanCard
            title="Plano Pro ⭐"
            price="R$ 49,90"
            isPro
            description="A suíte completa de ferramentas e estratégia para monetizar sua audiência profissionalmente."
            features={[
              "Reuniões Estratégicas Semanais",
              "Mídia Kit Completo (Auditado)",
              "Exposição Hero no Marketplace",
              "Chat IA Estrategista Full Time",
              "Review de Conteúdo (Vereditos)",
              "D2C Flix (Página de Descoberta)",
              "Calculadora de Publis e CRM",
              "Captação Direta de Propostas",
              "50% de Comissão (1ª fatura afiliados)",
              "Dashboard Avançado de Métricas"
            ]}
            ctaText="Assinar Plano Pro"
            onCta={onCreateAccount}
            note="Acelere sua carreira hoje"
          />
        </div>

        <p className="mt-20 text-center text-sm font-bold text-slate-400">
          Precisa de uma solução para empresas ou marcas? <button className="text-brand-primary hover:underline underline-offset-4">Fale com um consultor →</button>
        </p>
      </div>
    </section>
  );
}
