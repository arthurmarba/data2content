"use client";

import React from "react";

type Module = {
  icon: string;
  title: string;
  description: string;
};

const modules: Module[] = [
  {
    icon: "🧠",
    title: "IA Mobi",
    description: "Sua inteligência pessoal que analisa métricas e te orienta.",
  },
  {
    icon: "📊",
    title: "Mídia Kit",
    description: "Sua vitrine viva, sempre atualizada com métricas reais.",
  },
  {
    icon: "🗓️",
    title: "Planner",
    description: "Planeje e otimize conteúdos com base em dados reais.",
  },
  {
    icon: "💰",
    title: "Calculadora",
    description: "Descubra o valor justo de cada publi com IA.",
  },
  {
    icon: "💡",
    title: "Descoberta",
    description: "Explore criadores e referências com dados comparativos.",
  },
  {
    icon: "🤝",
    title: "Campanhas",
    description: "Marcas encontram criadores ideais com base em afinidade real.",
  },
];

const ModuleCell: React.FC<Module> = ({ icon, title, description }) => (
  <article
    role="cell"
    className="group grid gap-4 p-8 text-left transition-colors duration-300 hover:bg-white/[0.04]"
  >
    <div className="flex items-start gap-4">
      <span
        aria-hidden="true"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-xl text-white transition-colors duration-300 group-hover:border-[#FF1E56]/70"
      >
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          Módulo
        </span>
        <h3 className="text-xl font-light tracking-tight text-white md:text-2xl">{title}</h3>
      </div>
    </div>
    <p className="text-base font-light leading-relaxed text-white/70">
      {description}
    </p>
  </article>
);

const EcosystemModulesSection: React.FC = () => {
  return (
    <section
      id="ecossistema"
      className="relative overflow-hidden bg-[#050506] py-24 md:py-28"
    >
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-[#141418] via-[#09090B] to-[#040405]" />
      <div className="absolute -top-56 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(255,30,86,0.24),_transparent_65%)] blur-[140px]" aria-hidden="true" />
      <div className="container mx-auto flex max-w-6xl flex-col items-center px-6 text-center">
        <span className="text-xs font-medium uppercase tracking-[0.28em] text-white/40">
          Ecossistema integrado
        </span>
        <h2 className="mt-6 text-3xl font-light tracking-tight text-white md:text-4xl">
          Tudo o que uma agência oferece — agora, em um só lugar.
        </h2>
        <p className="mt-4 max-w-2xl text-base font-light leading-relaxed text-white/70 md:text-lg">
          Um ecossistema completo que conecta inteligência, dados e criatividade para gerar resultados reais.
        </p>
      </div>

      <div className="container mx-auto mt-20 max-w-6xl px-6">
        <div
          role="table"
          className="overflow-hidden rounded-[32px] border border-white/15 bg-white/[0.02] backdrop-blur-sm"
        >
          <div role="rowgroup" className="grid divide-y divide-white/10">
            {Array.from({ length: Math.ceil(modules.length / 3) }).map((_, rowIndex) => (
              <div
                key={String(rowIndex)}
                role="row"
                className="grid divide-x divide-white/10 sm:grid-cols-2 lg:grid-cols-3"
              >
                {modules.slice(rowIndex * 3, rowIndex * 3 + 3).map((module) => (
                  <ModuleCell key={module.title} {...module} />
                ))}
                {modules.length - rowIndex * 3 < 3 &&
                  Array.from({ length: 3 - (modules.length - rowIndex * 3) }).map((_, idx) => (
                    <div key={`placeholder-${rowIndex}-${idx}`} className="hidden lg:block" />
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default EcosystemModulesSection;
