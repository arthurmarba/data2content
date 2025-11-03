"use client";

import React from "react";
import ButtonPrimary from "./ButtonPrimary";

type BrandsSectionProps = {
  onCreateCampaign: () => void;
};

type BrandBenefit = {
  icon: string;
  title: string;
  description: string;
};

const benefits: BrandBenefit[] = [
  {
    icon: "👁️",
    title: "Visão em tempo real",
    description: "Acompanhe dados de alcance e performance antes de enviar propostas.",
  },
  {
    icon: "🧠",
    title: "IA de afinidade",
    description: "Receba recomendações automáticas de criadores com base em dados.",
  },
  {
    icon: "📈",
    title: "Comparativo inteligente",
    description: "Avalie custo e resultado estimado com segurança.",
  },
];

const BrandsSection: React.FC<BrandsSectionProps> = ({ onCreateCampaign }) => {
  return (
    <section id="marcas" className="relative overflow-hidden bg-white py-20 md:py-28">
      <div className="container mx-auto max-w-5xl px-6 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#E2E4EC] bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#2F3140]">
          Para marcas
        </span>
        <h2 className="mt-6 text-3xl font-semibold tracking-tight text-[#161821] md:text-4xl">
          Encontre os criadores ideais para sua próxima campanha.
        </h2>
        <p className="mt-4 text-base font-light leading-relaxed text-[#3A3C48] md:text-lg">
          A mesma IA que orienta os creators ajuda marcas a planejar com precisão. Compare audiência, engajamento e custo antes mesmo de enviar sua proposta.
        </p>

        <div className="mt-16 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ icon, title, description }) => (
            <article
              key={title}
              className="group flex flex-col gap-4 rounded-[28px] border border-[#E7E9F1] bg-white p-8 shadow-[0_28px_60px_rgba(19,22,31,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-[#FF1E56]/35 hover:shadow-[0_32px_80px_rgba(255,30,86,0.12)]"
            >
              <span aria-hidden="true" className="text-2xl">{icon}</span>
              <h3 className="text-xl font-semibold text-[#171922]">{title}</h3>
              <p className="text-sm font-light leading-relaxed text-[#3F4250]">{description}</p>
            </article>
          ))}
        </div>

        <p className="mt-16 text-base font-light text-[#2B2D37] md:text-lg">
          Mais que dados — inteligência para cada decisão de marca.
        </p>

        <ButtonPrimary
          onClick={onCreateCampaign}
          size="lg"
          className="mt-8 px-10"
        >
          Criar campanha com IA →
        </ButtonPrimary>
      </div>
    </section>
  );
};

export default BrandsSection;
