"use client";

import React from "react";
import ButtonPrimary from "./ButtonPrimary";

type BrandsSectionProps = {
  onCreateCampaign: () => void;
};

type BrandBenefit = {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: "magenta" | "blue" | "violet";
};

const badgeTokens: Record<BrandBenefit["accent"], string> = {
  magenta: "bg-brand-primary/12 text-brand-primary",
  blue: "bg-brand-accent/12 text-brand-accent",
  violet: "bg-brand-violet-light/25 text-brand-violet",
};

const IconBadge: React.FC<{ accent: BrandBenefit["accent"]; children: React.ReactNode }> = ({
  accent,
  children,
}) => (
  <span
    aria-hidden="true"
    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${badgeTokens[accent]} shadow-[0_4px_12px_rgba(15,23,42,0.1)] transition-transform duration-300 group-hover:-translate-y-0.5`}
  >
    {children}
  </span>
);

const EyeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
    <path
      d="M2.036 12.322a1.012 1.012 0 0 1 0-.644C3.423 7.51 7.36 4.5 12 4.5s8.577 3.01 9.964 7.178c.07.202.07.422 0 .644C20.577 16.49 16.64 19.5 12 19.5S3.423 16.49 2.036 12.322z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const SparkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
    <path
      d="M12 3.5v3m0 11v3m6.364-10.864-2.121 2.121M7.757 16.243l-2.121 2.121m0-13.728 2.12 2.12m8.486 8.486 2.12 2.121M3.5 12h3m11 0h3"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 8.75a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ChartIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
    <path
      d="M5 19V9.5M12 19V5M19 19v-7.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M4 19h16"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />
  </svg>
);

const benefits: BrandBenefit[] = [
  {
    icon: <EyeIcon />,
    accent: "magenta",
    title: "Visão em tempo real",
    description: "Acompanhe dados de alcance e performance antes de enviar propostas.",
  },
  {
    icon: <SparkIcon />,
    accent: "blue",
    title: "IA de afinidade",
    description: "Receba recomendações automáticas de criadores com base em dados.",
  },
  {
    icon: <ChartIcon />,
    accent: "violet",
    title: "Comparativo inteligente",
    description: "Avalie custo e resultado estimado com segurança.",
  },
];

const BrandsSection: React.FC<BrandsSectionProps> = ({ onCreateCampaign }) => {
  return (
    <section id="marcas" className="landing-section landing-section--plain text-brand-dark">
      <div className="landing-section__inner landing-section__inner--wide text-center">
        <span className="landing-chip mx-auto md:text-sm">Para marcas</span>
        <h2 className="mt-6 text-display-lg text-brand-dark">
          Encontre os criadores ideais para sua próxima campanha.
        </h2>
        <p className="mt-4 text-body-lg font-normal text-brand-text-secondary">
          A mesma IA que orienta os creators ajuda marcas a planejar com precisão. Compare audiência, engajamento e custo antes mesmo de enviar sua proposta.
        </p>

        <div className="mt-14 grid gap-6 text-left sm:grid-cols-2 lg:grid-cols-3">
          {benefits.map(({ icon, title, description, accent }) => (
            <article
              key={title}
              className="group flex flex-col gap-5 rounded-[28px] border border-brand-glass bg-white p-8 shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-all duration-300 hover:-translate-y-1"
            >
              <IconBadge accent={accent}>{icon}</IconBadge>
              <h3 className="text-lg font-semibold leading-snug text-brand-dark md:text-xl">{title}</h3>
              <p className="text-sm leading-normal text-brand-text-secondary md:text-base">{description}</p>
            </article>
          ))}
        </div>

        <p className="mt-16 text-body-md text-brand-text-secondary">
          Mais que dados — inteligência para cada decisão de marca.
        </p>

        <ButtonPrimary
          onClick={onCreateCampaign}
          size="lg"
          className="mt-10 inline-flex items-center gap-2 px-10"
        >
          <span>Criar campanha com IA</span>
          <span aria-hidden="true" className="text-xl leading-none">→</span>
        </ButtonPrimary>
      </div>
    </section>
  );
};

export default BrandsSection;
