"use client";

import React from "react";

import ButtonPrimary from "./ButtonPrimary";

type Props = {
  onPrimaryCta: () => void;
};

export const FinalCTASection: React.FC<Props> = ({ onPrimaryCta }) => (
  <section id="cta-final" className="border-t border-[#E3D9FF] bg-brand-yellow py-16 text-gray-900 md:py-20">
    <div className="container mx-auto px-6 text-center">
      <h2 className="text-[2rem] font-semibold leading-tight md:text-[2.5rem]">
        Bora entrar e planejar com clareza?
      </h2>
      <p className="mt-3 text-base leading-normal text-gray-700 md:text-lg">
        Conecte o Instagram, receba seu planner guiado por IA e entre no grupo para a mentoria da semana.
      </p>

      <div className="mt-6 flex flex-col items-center gap-4 md:mt-8 lg:mt-10">
        <ButtonPrimary onClick={onPrimaryCta} className="px-10 py-4 text-base lg:text-lg">
          Entrar na comunidade gratuita
        </ButtonPrimary>
        <p className="text-sm text-gray-600 md:text-base">
          Login via Google • Nenhum cartão necessário • Segurança com API oficial do Instagram
        </p>
      </div>
    </div>
  </section>
);

export default FinalCTASection;
