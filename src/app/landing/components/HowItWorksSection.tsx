"use client";

import React from "react";

const STEPS = [
  {
    title: "Entrar com Google (grátis)",
    description: "Você já chega com um Media Kit vivo pronto para compartilhar.",
  },
  {
    title: "Conectar o Instagram",
    description: "A IA entende seu contexto e destrava o planner com previsões personalizadas.",
  },
  {
    title: "Acessar a Comunidade",
    description:
      "O link do grupo e o convite para a mentoria da semana aparecem no painel após o login.",
  },
];

export const HowItWorksSection: React.FC = () => (
  <section id="como-funciona" className="bg-brand-purple/5 py-20 text-gray-900">
    <div className="container mx-auto px-6">
      <div className="max-w-3xl">
        <h2 className="text-3xl font-extrabold tracking-tight md:text-4xl">Como funciona</h2>
        <p className="mt-3 text-lg text-gray-600">
          O acesso à comunidade é imediato; a IA e os dados mantêm tudo funcionando no piloto assistido.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <div
            key={step.title}
            className="flex flex-col gap-3 rounded-3xl border border-brand-purple/10 bg-white p-6 text-sm shadow-sm transition hover:border-brand-purple/40 hover:shadow-lg"
          >
            <div className="text-xs font-semibold uppercase tracking-wide text-brand-purple/80">
              Passo {index + 1}
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
            <p className="text-gray-600">{step.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
