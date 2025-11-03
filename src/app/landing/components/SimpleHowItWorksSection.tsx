"use client";

import React from "react";

type SimpleHowItWorksSectionProps = {
  onStepCta: () => void;
};

const steps = [
  {
    id: 1,
    icon: "1️⃣",
    title: "Entrar com Google",
  },
  {
    id: 2,
    icon: "2️⃣",
    title: "Conectar Instagram",
  },
  {
    id: 3,
    icon: "3️⃣",
    title: "Entrar na comunidade",
  },
];

const SimpleHowItWorksSection: React.FC<SimpleHowItWorksSectionProps> = ({ onStepCta }) => {
  return (
    <section id="como-funciona" className="bg-brand-light py-10 md:py-16">
      <div className="container mx-auto max-w-5xl px-6">
        <div className="mb-8 text-center">
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-magenta">
            Como funciona
          </p>
          <h2 className="mt-4 text-2xl font-extrabold text-[#0F172A] md:text-[2.05rem]">
            Três passos para começar agora.
          </h2>
        </div>

        <div className="-mx-4 flex snap-x snap-mandatory overflow-x-auto px-4 pb-6 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0 md:snap-none">
          {steps.map((step) => (
            <article
              key={step.id}
              className="mr-4 flex min-w-[68%] snap-center flex-col rounded-3xl border border-[#EFEFEF] bg-white p-6 shadow-[0_18px_38px_rgba(28,28,30,0.08)] last:mr-0 md:mr-0 md:min-w-0 md:snap-none"
            >
              <div className="space-y-3 text-left">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#FFE9EE] text-lg font-bold text-brand-magenta">
                  {step.icon}
                </div>
                <h3 className="text-lg font-semibold text-brand-dark">{step.title}</h3>
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={onStepCta}
            className="inline-flex items-center justify-center gap-3 rounded-lg bg-brand-magenta px-8 py-4 text-base font-semibold text-white shadow-[0_18px_32px_rgba(231,75,111,0.25)] transition-colors duration-200 hover:bg-brand-magenta-hover"
          >
            Ativar IA e entrar →
          </button>
        </div>
      </div>
    </section>
  );
};

export default SimpleHowItWorksSection;
