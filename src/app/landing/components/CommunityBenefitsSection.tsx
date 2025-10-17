"use client";

import React from "react";

const BENEFITS = [
  {
    title: "Mentorias semanais ao vivo",
    description:
      "Estudo de casos reais, hotseats e tempo para tirar dúvidas com criadores que já estão performando.",
  },
  {
    title: "Biblioteca de referências curadas",
    description:
      "A “Netflix do Instagram”: conteúdos filtrados por formato, objetivo e contexto para você nunca ficar sem ideia.",
  },
  {
    title: "Planner orientado por IA",
    description:
      "Você conecta o Instagram, a IA entende seu contexto e entrega slots com previsões de performance.",
  },
  {
    title: "Alertas proativos no WhatsApp",
    description:
      "O Mobi avisa quando surge uma oportunidade ou quando você precisa aparecer novamente para manter o ritmo.",
  },
];

export const CommunityBenefitsSection: React.FC = () => (
  <section id="beneficios" className="bg-white py-20 text-gray-900">
    <div className="container mx-auto px-6">
      <div className="max-w-3xl">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Por dentro da comunidade</h2>
        <p className="mt-3 text-lg text-gray-600">
          Na comunidade você aprende com os outros, ganha clareza com dados e recebe suporte para executar.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {BENEFITS.map((benefit) => (
          <div
            key={benefit.title}
            className="flex flex-col gap-3 rounded-3xl border border-black/10 bg-gray-50 p-6 transition hover:border-brand-purple/40 hover:shadow-lg"
          >
            <h3 className="text-xl font-semibold text-gray-900">{benefit.title}</h3>
            <p className="text-sm text-gray-600">{benefit.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default CommunityBenefitsSection;
