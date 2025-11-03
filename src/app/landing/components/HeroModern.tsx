"use client";

import React from "react";
import ButtonPrimary from "./ButtonPrimary";

type HeroModernProps = {
  onCreatorCta: () => void;
  onBrandCta: () => void;
};

const highlightItems = [
  {
    title: "IA estratégica em linguagem humana",
    description: "Receba diagnósticos acionáveis da Mobi no WhatsApp em minutos.",
  },
  {
    title: "Mídia kit premium sem esforço manual",
    description: "Sua vitrine sempre atualizada com métricas reais e copy profissional.",
  },
  {
    title: "Match inteligente com marcas",
    description: "Campanhas sugeridas conforme nicho, volume e consistência de entrega.",
  },
];

const HeroModern: React.FC<HeroModernProps> = ({ onCreatorCta, onBrandCta }) => {
  return (
    <section
      id="inicio"
      className="relative overflow-hidden bg-[radial-gradient(140%_120%_at_50%_-20%,rgba(231,75,111,0.12)_0%,rgba(231,75,111,0)_68%)] px-5 pb-[var(--space-fluid-4)] pt-[calc(var(--space-fluid-3)+var(--sat,0px)+var(--landing-header-h,4.5rem))]"
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/90 via-white to-[#F6F8FB]" />
      <div className="relative container mx-auto flex w-full max-w-6xl flex-col gap-12">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 text-center text-brand-dark">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#E2E6F2] bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-text-secondary">
            IA viva no mercado criativo
          </span>
          <h1 className="max-w-[24ch] text-display-lg text-balance md:text-display-xl">
            Feche mais campanhas com dados claros e um mídia kit inteligente.
          </h1>
          <p className="max-w-2xl text-base font-medium text-brand-text-secondary md:text-lg">
            Conecte seu Instagram, receba diagnósticos da Mobi e apresente tudo em um mídia kit premium que marcas confiam.
          </p>
          <div className="flex w-full flex-col items-center gap-3 xs:flex-row xs:justify-center">
            <ButtonPrimary onClick={onCreatorCta} size="lg" variant="solid">
              Sou Criador
            </ButtonPrimary>
            <ButtonPrimary onClick={onBrandCta} size="lg" variant="outline">
              Sou Marca
            </ButtonPrimary>
          </div>
          <p className="text-sm font-medium text-brand-text-secondary">
            Crie seu mídia kit gratuitamente e comece a atrair oportunidades reais.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {highlightItems.map((item) => (
            <article
              key={item.title}
              className="rounded-3xl border border-[#E3E8F4] bg-white p-6 text-left shadow-[0_14px_38px_rgba(15,23,42,0.08)] transition-transform duration-200 hover:-translate-y-1"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-[#F4F7FF] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-text-secondary">
                Destaque
              </span>
              <h2 className="mt-4 text-lg font-semibold text-brand-dark">{item.title}</h2>
              <p className="mt-2 text-sm text-brand-text-secondary">{item.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HeroModern;
