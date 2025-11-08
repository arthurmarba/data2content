"use client";

import React from "react";
import ButtonPrimary from "./ButtonPrimary";

type PlansComparisonSectionProps = {
  onCreateAccount: () => void;
};

type PlanStatus = "yes" | "no" | "limited";

type FeatureRow = {
  feature: string;
  free: {
    status: PlanStatus;
    label: string;
    note?: string;
  };
  pro: {
    status: PlanStatus;
    label: string;
    note?: string;
  };
};

const features: FeatureRow[] = [
  {
    feature: "Criar e compartilhar o Mídia Kit",
    free: { status: "yes", label: "Sim" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Receber propostas de marcas",
    free: { status: "yes", label: "Sim" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Comunidade gratuita de networking",
    free: { status: "yes", label: "Sim" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Planejar e precificar com IA",
    free: { status: "no", label: "Não disponível" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Responder propostas pela plataforma",
    free: { status: "no", label: "Não disponível" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Participar das reuniões estratégicas semanais (VIP PRO)",
    free: { status: "no", label: "Não disponível" },
    pro: { status: "yes", label: "Sim" },
  },
];

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
    <path
      d="m4.5 10.5 3.5 3.5 7.5-8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CrossIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
    <path
      d="m5.5 5.5 9 9m0-9-9 9"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const MinusIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4">
    <path d="M5 10h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

const STATUS_TOKENS: Record<PlanStatus, { icon: React.ReactNode; chip: string; iconWrapper: string }> = {
  yes: {
    icon: <CheckIcon />,
    chip: "bg-emerald-500/12 text-emerald-600 ring-1 ring-inset ring-emerald-500/30",
    iconWrapper: "bg-emerald-500/20",
  },
  no: {
    icon: <CrossIcon />,
    chip: "bg-rose-500/12 text-rose-600 ring-1 ring-inset ring-rose-500/25",
    iconWrapper: "bg-rose-500/20",
  },
  limited: {
    icon: <MinusIcon />,
    chip: "bg-amber-500/15 text-amber-600 ring-1 ring-inset ring-amber-500/25",
    iconWrapper: "bg-amber-500/20",
  },
};

const StatusBadge: React.FC<{ status: PlanStatus; label: string }> = ({ status, label }) => {
  const tokens = STATUS_TOKENS[status];
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${tokens.chip}`}
    >
      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-current ${tokens.iconWrapper}`}>
        {tokens.icon}
      </span>
      <span className="text-sm font-semibold leading-none">{label}</span>
    </span>
  );
};

const FREE_PLAN_BENEFITS = features.filter(
  (row) => row.free.status === "yes" || row.free.status === "limited",
);

const PRO_PLAN_BENEFITS = features.filter(
  (row) => row.pro.status === "yes" && row.free.status !== "yes",
);

const PLAN_PRICING = {
  free: {
    label: "Plano Gratuito",
    price: "R$ 0",
    cadence: "/ mês",
    note: "Sem cartão • Sem compromisso",
    description: "Para entrar na comunidade e ganhar visibilidade com dados reais.",
  },
  pro: {
    label: "Plano PRO ⭐",
    price: "R$ 49,90",
    cadence: "/ mês",
    secondary: "ou R$ 350 / ano",
    note: "Primeiro insight pago em minutos.",
    description: "Para fechar campanhas com estratégia, precificação inteligente e suporte humano + IA.",
  },
};

const PlansComparisonSection: React.FC<PlansComparisonSectionProps> = ({ onCreateAccount }) => {
  return (
    <section
      id="planos"
      className="relative overflow-hidden border-t border-white/40 bg-landing-data py-16 text-brand-dark md:py-20"
    >
      <div className="absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-white/85 via-white/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-neutral-100 via-white/70 to-transparent" />
      <div className="relative container mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-chip-border bg-neutral-0/75 px-4 py-1 text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-text-secondary md:text-sm">
            Planos D2C
          </span>
          <h2 className="mt-6 text-[2rem] font-semibold leading-tight md:text-[2.5rem]">
            Evolua no seu ritmo com o ecossistema D2C.
          </h2>
        </div>

        <div className="mt-14 grid gap-6 md:hidden">
          <div className="rounded-2xl border border-white/40 bg-neutral-0/70 p-5 shadow-glass-lg backdrop-blur-glass">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-text-secondary md:text-sm">
              O que o plano gratuito inclui
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-normal text-brand-dark md:text-base">
              {FREE_PLAN_BENEFITS.map((item) => {
                return (
                  <li key={`free-${item.feature}`} className="flex items-start gap-3">
                    <div className="flex flex-1 flex-col gap-2">
                      <p className="text-base font-semibold leading-snug md:text-lg">{item.feature}</p>
                      <StatusBadge status={item.free.status} label={item.free.label} />
                      {item.free.note ? (
                        <p className="text-sm font-medium leading-normal text-neutral-500">
                          {item.free.note}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 border-t border-white/40 pt-4 text-center md:text-left">
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.25em] text-brand-text-secondary">
                Investimento
              </p>
              <p className="text-2xl font-semibold text-brand-dark">
                {PLAN_PRICING.free.price}
                <span className="text-sm font-medium text-brand-text-secondary"> {PLAN_PRICING.free.cadence}</span>
              </p>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.25em] text-brand-text-secondary">
                {PLAN_PRICING.free.note}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-white/40 bg-neutral-0/70 p-5 shadow-glass-lg backdrop-blur-glass">
            <p className="text-[0.75rem] font-semibold uppercase tracking-[0.2em] text-brand-magenta-bright md:text-sm">
              Benefícios exclusivos do PRO ⭐
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-normal text-brand-dark md:text-base">
              {PRO_PLAN_BENEFITS.map((item) => {
                return (
                  <li key={`pro-${item.feature}`} className="flex items-start gap-3">
                    <div className="flex flex-1 flex-col gap-2">
                      <p className="text-base font-semibold leading-snug md:text-lg">{item.feature}</p>
                      <StatusBadge status={item.pro.status} label={item.pro.label} />
                      {item.pro.note ? (
                        <p className="text-sm font-medium leading-normal text-neutral-500">
                          {item.pro.note}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="mt-6 border-t border-white/40 pt-4 text-center md:text-left">
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.25em] text-brand-magenta-bright">
                Investimento
              </p>
              <p className="text-2xl font-semibold text-brand-dark">
                {PLAN_PRICING.pro.price}
                <span className="text-sm font-medium text-brand-text-secondary"> {PLAN_PRICING.pro.cadence}</span>
              </p>
              <p className="text-sm font-medium text-brand-text-secondary">{PLAN_PRICING.pro.secondary}</p>
            </div>
          </div>
        </div>

        <div className="mt-16 hidden overflow-hidden rounded-[28px] border border-white/40 bg-neutral-0/70 shadow-glass-lg backdrop-blur-glass md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto divide-y divide-neutral-200 text-left">
              <thead className="bg-white/75 text-sm font-semibold uppercase tracking-[0.2em] text-brand-text-secondary">
                <tr>
                  <th scope="col" className="px-6 py-5 md:px-8">
                    Recurso
                  </th>
                  <th scope="col" className="px-6 py-5 text-center md:px-8">
                    Gratuito
                  </th>
                  <th scope="col" className="px-6 py-5 text-center text-brand-magenta-bright md:px-8">
                    PRO ⭐ (pago)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/60 text-base text-brand-dark">
                {features.map((item) => (
                  <tr key={item.feature} className="bg-neutral-0/60">
                    <th
                      scope="row"
                      className="max-w-[240px] px-6 py-5 text-base font-semibold leading-snug text-brand-dark md:px-8"
                    >
                      {item.feature}
                    </th>
                    {[item.free, item.pro].map((cell, idx) => {
                      const isPro = idx === 1;
                      return (
                        <td
                          key={`${item.feature}-${isPro ? "pro" : "free"}`}
                          className={`px-6 py-5 text-center align-top text-base leading-normal text-brand-dark md:px-8 ${
                            isPro ? "bg-white/50" : ""
                          }`}
                        >
                          <div className="flex flex-col items-center gap-3">
                            <StatusBadge status={cell.status} label={cell.label} />
                            {cell.note && (
                              <span className="text-sm font-medium leading-normal text-brand-text-secondary">
                                {cell.note}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-white/80 text-brand-dark">
                <tr>
                  <th
                    scope="row"
                    className="px-6 py-5 text-base font-semibold leading-snug text-brand-dark md:px-8"
                  >
                    Investimento mensal
                  </th>
                  <td className="px-6 py-5 text-center align-top text-base md:px-8">
                    <div className="space-y-1">
                      <p className="text-2xl font-semibold">
                        {PLAN_PRICING.free.price}
                        <span className="text-sm font-medium text-brand-text-secondary">
                          {" "}
                          {PLAN_PRICING.free.cadence}
                        </span>
                      </p>
                      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-brand-text-secondary">
                        {PLAN_PRICING.free.note}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center align-top text-base text-brand-magenta-bright md:px-8">
                    <div className="space-y-1">
                      <p className="text-2xl font-semibold text-brand-dark">
                        {PLAN_PRICING.pro.price}
                        <span className="text-sm font-medium text-brand-text-secondary">
                          {" "}
                          {PLAN_PRICING.pro.cadence}
                        </span>
                      </p>
                      <p className="text-sm font-medium text-brand-text-secondary">{PLAN_PRICING.pro.secondary}</p>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/40 bg-neutral-0/85 p-6 shadow-glass-md backdrop-blur-glass">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[0.75rem] font-semibold uppercase tracking-[0.25em] text-brand-text-secondary">
                {PLAN_PRICING.free.label}
              </p>
              <p className="text-2xl font-semibold text-brand-dark">
                {PLAN_PRICING.free.price}
                <span className="text-sm font-medium text-brand-text-secondary"> {PLAN_PRICING.free.cadence}</span>
              </p>
              <p className="text-sm text-brand-text-secondary">{PLAN_PRICING.free.description}</p>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.25em] text-brand-text-secondary">
                {PLAN_PRICING.free.note}
              </p>
            </div>
            <ButtonPrimary
              onClick={onCreateAccount}
              variant="brand"
              size="lg"
              className="w-full justify-center md:w-auto"
            >
              Criar conta gratuita
            </ButtonPrimary>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlansComparisonSection;
