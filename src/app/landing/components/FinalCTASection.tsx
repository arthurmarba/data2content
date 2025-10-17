"use client";

import React from "react";

type Props = {
  onPrimaryCta: () => void;
};

export const FinalCTASection: React.FC<Props> = ({ onPrimaryCta }) => (
  <section id="cta-final" className="bg-brand-yellow py-16 text-gray-900 md:py-20 lg:py-24 xl:py-28">
    <div className="container mx-auto px-6 text-center">
      <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl lg:text-[2.7rem]">
        Bora entrar e planejar com clareza?
      </h2>
      <p className="mt-3 text-lg text-gray-700 lg:text-xl">
        Conecte o Instagram, receba seu planner guiado por IA e entre no grupo para a mentoria da semana.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4 md:mt-8 lg:mt-10">
        <button
          onClick={onPrimaryCta}
          className="rounded-lg bg-black px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:scale-[1.01] hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40 lg:px-10 lg:py-5 lg:text-lg"
        >
          Entrar na Comunidade agora
        </button>
        <p className="text-xs text-gray-600 lg:text-sm">
          Login via Google • Nenhum cartão necessário • Segurança com API oficial do Instagram
        </p>
      </div>
    </div>
  </section>
);

export default FinalCTASection;
