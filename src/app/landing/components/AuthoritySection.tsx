"use client";

import React from "react";

type AuthoritySectionProps = {
  onPrimaryCta: () => void;
  onBrandsCta: () => void;
};

const AuthoritySection: React.FC<AuthoritySectionProps> = ({ onPrimaryCta, onBrandsCta }) => {
  return (
    <section id="sobre" className="bg-[#0F172A] py-10 text-white md:py-16">
      <div className="container mx-auto max-w-5xl px-6">
        <div className="space-y-6 text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-white/70">
            Sobre a Data2Content
          </p>
          <h2 className="text-2xl font-extrabold leading-tight md:text-[2rem]">
            40 anos conectando talentos, agora com IA para creators digitais.
          </h2>
          <p className="mx-auto max-w-3xl text-base text-white/70 md:text-lg">
            A Data2Content nasce do Grupo Marbá, unindo relacionamento com marcas, dados de mercado e mentoria para transformar criadores em parceiros recorrentes.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 md:flex-row">
            <button
              type="button"
              onClick={onBrandsCta}
              className="inline-flex items-center justify-center rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-white/10"
            >
              Sou marca
            </button>
            <button
              type="button"
              onClick={onPrimaryCta}
              className="inline-flex items-center justify-center rounded-lg bg-brand-magenta px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(231,75,111,0.25)] transition hover:-translate-y-0.5 hover:bg-brand-magenta-hover"
            >
              Entrar gratuitamente
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AuthoritySection;
