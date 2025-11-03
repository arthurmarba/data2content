"use client";

import React from "react";

const COMMUNITY_BENEFITS = [
  {
    title: "Planner orientado pela IA Mobi",
    description:
      "O Mobi analisa seus conteúdos, detecta padrões da comunidade e sugere slots prontos com previsões de alcance.",
  },
  {
    title: "Biblioteca inteligente de referências",
    description:
      "A IA categoriza posts reais por formato, objetivo e contexto para você criar sem travar — sempre com novos exemplos.",
  },
  {
    title: "Trocas com criadores + insights coletivos",
    description:
      "Discussões abertas, métricas comunitárias e desafios guiados para manter a constância sugerida pelo Mobi.",
  },
];

const VIP_BENEFITS = [
  {
    title: "Mentorias estratégicas semanais (Grupo VIP)",
    description:
      "Hotseats ao vivo combinando as leituras da IA com especialistas humanos para ajustar sua estratégia em tempo real.",
  },
  {
    title: "Sala reservada com acompanhamento do Mobi",
    description:
      "Calendários personalizados, checkpoints e planos de ação guiados pelo estrategista de bolso e time PRO.",
  },
  {
    title: "Alertas premium e nudges de consistência",
    description:
      "O Mobi monitora seu ritmo e envia lembretes criativos via WhatsApp quando surge uma oportunidade ou você fica sem postar.",
  },
];

export const CommunityBenefitsSection: React.FC = () => (
  <section id="beneficios" className="border-t border-[#E6EAFB] bg-white py-16 text-brand-dark md:py-20">
    <div className="container mx-auto px-6">
      <div className="max-w-3xl space-y-3">
        <div className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-text-secondary md:text-sm">
          Comunidade + VIP
        </div>
        <h2 className="text-[2rem] font-semibold leading-tight md:text-[2.5rem]">
          A comunidade impulsionada pela IA — e o salto que o Grupo VIP oferece
        </h2>
        <p className="text-base leading-relaxed text-brand-text-secondary md:text-lg">
          A comunidade aberta usa a IA Mobi para direcionar sua rotina de criação. No Grupo VIP (Plano PRO), a mesma IA se
          une a mentorias estratégicas semanais para acelerar seus resultados com acompanhamento de perto.
        </p>
      </div>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4 rounded-3xl border border-black/10 bg-gray-50 p-6 transition hover:border-brand-purple/40 hover:shadow-lg">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-text-secondary md:text-sm">
            Comunidade aberta (grátis)
          </p>
          {COMMUNITY_BENEFITS.map((benefit) => (
            <div key={benefit.title}>
              <h3 className="text-lg font-semibold leading-snug text-brand-dark md:text-xl">{benefit.title}</h3>
              <p className="mt-1 text-sm leading-normal text-brand-text-secondary md:text-base">{benefit.description}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-3xl border border-brand-red/20 bg-gradient-to-br from-brand-pink/10 via-brand-purple/5 to-white p-6 shadow-sm transition hover:border-brand-red/40 hover:shadow-xl">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-purple md:text-sm">
            Grupo VIP (Plano PRO)
          </p>
          {VIP_BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-2xl border border-white/20 bg-white/60/20 p-4 backdrop-blur-sm"
            >
              <h3 className="text-lg font-semibold leading-snug text-brand-purple md:text-xl">{benefit.title}</h3>
              <p className="mt-1 text-sm leading-normal text-brand-purple/80 md:text-base">{benefit.description}</p>
            </div>
          ))}
          <div className="mt-2 text-sm text-brand-purple/70 md:text-base">
            *Disponível para assinantes PRO ou durante o trial. Inclui acesso prioritário às mentorias semanais e materiais de apoio exclusivos.
          </div>
        </div>
      </div>
    </div>
  </section>
);

export default CommunityBenefitsSection;
