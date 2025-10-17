"use client";

import React from "react";

type Props = {
  onPrimaryCta: () => void;
};

export const FinalCTASection: React.FC<Props> = ({ onPrimaryCta }) => (
  <section id="cta-final" className="bg-brand-yellow py-20 text-gray-900">
    <div className="container mx-auto px-6 text-center">
      <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">
        Bora entrar e planejar com clareza?
      </h2>
      <p className="mt-3 text-lg text-gray-700">
        Conecte o Instagram, receba seu planner guiado por IA e entre no grupo para a mentoria da semana.
      </p>

      <div className="mt-8 flex flex-col items-center gap-4">
        <button
          onClick={onPrimaryCta}
          className="rounded-lg bg-black px-8 py-4 text-base font-semibold text-white shadow-lg transition hover:scale-[1.01] hover:bg-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/40"
        >
          Entrar na Comunidade agora
        </button>
        <p className="text-xs text-gray-600">
          Login via Google • Nenhum cartão necessário • Segurança com API oficial do Instagram
        </p>
      </div>
    </div>
  </section>
);

export default FinalCTASection;
