"use client";

import React from "react";

const STEPS = [
  {
    title: "Entrar com Google (grátis)",
    highlight: "Receba um Media Kit automático",
    rest: " com os indicadores principais do seu perfil.",
    icon: "🔐",
  },
  {
    title: "Conectar o Instagram",
    highlight: "Deixe a IA analisar o que performa melhor",
    rest: ", identificar tendências e sugerir próximos movimentos.",
    icon: "📈",
  },
  {
    title: "Entrar na Comunidade",
    highlight: "Participe da mentoria aberta",
    rest: ", compartilhe bastidores e execute com acompanhamento ao vivo.",
    icon: "💬",
  },
] as const;

export const HowItWorksSection: React.FC = () => (
  <section id="como-funciona" className="bg-white py-14 text-[#1A1A1A] md:py-20 lg:py-24 xl:py-28">
    <div className="container mx-auto px-6">
      <div className="max-w-3xl lg:max-w-4xl">
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#777777]">Como funciona</div>
        <h2 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl lg:text-[2.6rem]">
          Comece em minutos — sem cartão, sem burocracia.
        </h2>
        <p className="mt-3 text-lg text-[#555555] lg:text-xl">
          Login rápido, dados vivos para orientar sua estratégia e uma comunidade disponível para tirar dúvidas enquanto você executa.
        </p>
      </div>

      <div className="relative mt-12 md:mt-16">
        <div className="pointer-events-none absolute inset-x-12 top-[58px] hidden h-[2px] rounded-full bg-[#EAEAEA] md:block" />
        <div className="grid gap-10 md:grid-cols-3 md:items-start">
          {STEPS.map((step, index) => {
            const isLast = index === STEPS.length - 1;
            return (
              <div key={step.title} className="relative flex flex-col items-center text-center md:items-stretch">
                <div className="relative flex items-center justify-center">
                  <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full border-2 border-[#F6007B] bg-white text-[#1A1A1A] shadow-[0_10px_28px_rgba(0,0,0,0.05)]">
                    <span className="text-xl font-semibold">{index + 1}</span>
                    <span className="text-2xl" aria-hidden="true">{step.icon}</span>
                  </div>
                  {!isLast ? (
                    <span
                      className="pointer-events-none absolute right-[-64px] top-1/2 hidden h-[2px] w-[120px] -translate-y-1/2 rounded-full bg-[#EAEAEA] md:block"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
                <div className="mt-6 w-full rounded-3xl border border-[#EAEAEA] bg-white px-6 py-8 text-sm text-[#555555] shadow-[0_12px_32px_rgba(0,0,0,0.05)]">
                  <h3 className="text-lg font-semibold text-[#1A1A1A]">{step.title}</h3>
                  <p className="mt-3">
                    <strong className="font-semibold text-[#1A1A1A]">{step.highlight}</strong>
                    {step.rest}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-12 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        <button
          onClick={() => {
            if (typeof window !== "undefined") window.dispatchEvent(new Event("open-subscribe-modal"));
          }}
          className="inline-flex items-center justify-center rounded-lg bg-[#F6007B] px-8 py-4 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(246,0,123,0.22)] transition hover:-translate-y-0.5 hover:bg-[#d40068] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/30 md:text-base"
        >
          Entrar na comunidade gratuita
        </button>
        <p className="text-xs text-[#777777] sm:text-sm">
          Login via Google. Nenhum cartão necessário. Conexão segura com a API oficial do Instagram.
        </p>
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
