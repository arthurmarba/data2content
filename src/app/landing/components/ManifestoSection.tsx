"use client";

import React from "react";

const ManifestoSection: React.FC = () => (
  <section className="relative overflow-hidden bg-[#FAFAFA] py-12 text-gray-900">
    <div className="container mx-auto px-6">
      <div className="relative mx-auto max-w-[640px] space-y-5 text-center animate-fade-in">
        <h2 className="text-[1.75rem] font-semibold text-[#F6007B] md:text-[2rem]">
          💭 Criar conteúdo é humano.
        </h2>
        <p className="text-base leading-relaxed text-[#333333] md:text-lg">
          <strong className="font-semibold text-[#1A1A1A]">Constância, dúvidas, bloqueios</strong> — e a vontade de continuar.
        </p>
        <p className="text-base leading-relaxed text-[#333333] md:text-lg">
          A Data2Content te conecta com quem entende e <strong className="font-semibold text-[#1A1A1A]">transforma isso em estratégia</strong>.
        </p>
      </div>
    </div>
  </section>
);

export default ManifestoSection;
