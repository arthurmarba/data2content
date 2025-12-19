"use client";

import React from "react";

type ValuePropsSectionProps = {
  onCta: () => void;
};

type ValueCard = {
  id: string;
  icon: string;
  title: string;
  accent: string;
  description: string;
  badge?: string;
};

const valueCards: ValueCard[] = [
  {
    id: "ia",
    icon: "🤖",
    title: "Alertas no WhatsApp",
    accent: "⚡ Notificações automáticas",
    description: "Alertas curtos com benchmarks que já performaram no seu nicho e link direto para o Chat AI.",
  },
  {
    id: "community",
    icon: "💬",
    title: "Comunidade de Criadores",
    accent: "💬 Mentorias semanais",
    description: "Mentorias semanais e bastidores compartilhados com a comunidade.",
  },
  {
    id: "brands",
    icon: "💼",
    title: "Campanhas com Marcas",
    accent: "💼 Convites diretos",
    description: "Creators do Plano Agência recebem convites com briefing, fee definido e 0% de comissão — fique com 100% do cachê.",
    badge: "Exclusivo para criadores do Plano Agência",
  },
];

const ValuePropsSection: React.FC<ValuePropsSectionProps> = ({ onCta }) => {
  return (
    <section id="por-que" className="bg-brand-light pb-10 pt-10 md:pb-16 md:pt-14">
      <div className="container mx-auto max-w-5xl px-6">
        <div className="mb-8 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-brand-rose-10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-magenta">
            Ecossistema Data2Content
          </p>
          <h2 className="mt-5 text-2xl font-extrabold text-brand-dark md:text-[2.05rem]">
            IA, comunidade e campanhas reunidos no mesmo lugar.
          </h2>
        </div>

        <div className="-mx-6 flex snap-x snap-mandatory overflow-x-auto px-6 pb-6 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 md:snap-none">
          {valueCards.map((card) => (
            <article
              key={card.id}
              className="mr-4 min-w-[78%] snap-center rounded-3xl border border-neutral-200 bg-neutral-0 p-5 shadow-glass-lg transition last:mr-0 md:mr-0 md:min-w-0 md:snap-none"
            >
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-magenta-soft text-2xl">
                {card.icon}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-brand-dark">{card.title}</h3>
              <p className="text-sm font-semibold text-brand-magenta">{card.accent}</p>
              <p className="mt-3 text-sm leading-relaxed text-brand-text-secondary">{card.description}</p>
              {card.badge ? (
                <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-magenta/10 px-3 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-brand-magenta">
                  🟢 {card.badge}
                </span>
              ) : null}
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center gap-4 text-center text-sm text-brand-text-secondary md:flex-row md:justify-center">
          <button
            type="button"
            onClick={onCta}
            className="inline-flex items-center justify-center gap-3 rounded-lg bg-brand-magenta px-8 py-4 text-base font-semibold text-white shadow-brand-magenta transition-colors duration-200 hover:bg-brand-magenta-dark"
          >
            Ativar minha IA gratuita →
          </button>
          <span className="text-brand-text-secondary">Primeiro alerta personalizado em até 10 minutos.</span>
        </div>
      </div>
    </section>
  );
};

export default ValuePropsSection;
