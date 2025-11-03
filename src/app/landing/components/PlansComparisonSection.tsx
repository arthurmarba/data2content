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
    feature: "Criação de Mídia Kit público",
    free: { status: "yes", label: "Sim" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Receber propostas de marcas",
    free: { status: "yes", label: "Sim" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Comunidade de criadores (WhatsApp)",
    free: { status: "yes", label: "Sim" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Acesso ao Mobi (IA no WhatsApp)",
    free: { status: "limited", label: "Limitado", note: "Alertas básicos" },
    pro: {
      status: "yes",
      label: "Completo",
      note: "Análises e relatórios detalhados",
    },
  },
  {
    feature: "Análises automáticas de conteúdo (IA)",
    free: { status: "no", label: "Não disponível" },
    pro: { status: "yes", label: "Incluído" },
  },
  {
    feature: "Calculadora de Publi com IA",
    free: { status: "no", label: "Não disponível" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Reuniões estratégicas semanais",
    free: { status: "no", label: "Não disponível" },
    pro: { status: "yes", label: "Sim", note: "Grupo VIP PRO" },
  },
  {
    feature: "Responder propostas dentro da plataforma",
    free: { status: "no", label: "Não disponível" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Mentoria com especialistas",
    free: { status: "no", label: "Não disponível" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Histórico de campanhas e precificações anteriores",
    free: { status: "no", label: "Não disponível" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Insights de tendências e marcas que buscam creators",
    free: { status: "limited", label: "Limitado" },
    pro: { status: "yes", label: "Completo" },
  },
  {
    feature: "Suporte prioritário e atendimento personalizado",
    free: { status: "no", label: "Não" },
    pro: { status: "yes", label: "Sim" },
  },
  {
    feature: "Selo “Creator PRO” no Mídia Kit público",
    free: { status: "no", label: "Não" },
    pro: {
      status: "yes",
      label: "Sim",
      note: "Destaque visual automático",
    },
  },
];

const STATUS_MAP: Record<PlanStatus, { icon: string; color: string }> = {
  yes: {
    icon: "✅",
    color: "text-emerald-500",
  },
  no: {
    icon: "🚫",
    color: "text-rose-500",
  },
  limited: {
    icon: "⚠️",
    color: "text-amber-500",
  },
};

const PlansComparisonSection: React.FC<PlansComparisonSectionProps> = ({ onCreateAccount }) => {
  return (
    <section id="planos" className="relative overflow-hidden bg-[#F5F6FA] py-20 md:py-28">
      <div className="absolute inset-x-0 top-0 -z-10 h-1/2 bg-gradient-to-b from-white/70 via-white/30 to-transparent" />
      <div className="container mx-auto max-w-6xl px-6">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#D4D7E1] bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[#2F3140]">
            Planos D2C
          </span>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-[#181A20] md:text-4xl">
            Evolua no seu ritmo com o ecossistema D2C.
          </h2>
        </div>

        <div className="mt-16 overflow-hidden rounded-[28px] border border-[#D7DAE6] bg-white shadow-[0_26px_72px_rgba(24,27,37,0.08)]">
          <div className="overflow-x-auto">
            <table className="min-w-full table-auto divide-y divide-[#E6E9F3] text-left">
              <thead className="bg-white/90 text-xs font-semibold uppercase tracking-[0.24em] text-[#4D5060]">
                <tr>
                  <th scope="col" className="px-6 py-5 md:px-8">
                    Recurso
                  </th>
                  <th scope="col" className="px-6 py-5 text-center md:px-8">
                    Gratuito
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-5 text-center text-[#FF5F8B] md:px-8"
                  >
                    PRO ⭐ (pago)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E9EBF4] text-sm md:text-base">
                {features.map((item) => (
                  <tr key={item.feature} className="bg-white/80">
                    <th
                      scope="row"
                      className="max-w-[240px] px-6 py-5 text-sm font-semibold text-[#181A20] md:px-8 md:text-base"
                    >
                      {item.feature}
                    </th>
                    {[item.free, item.pro].map((cell, idx) => {
                      const status = STATUS_MAP[cell.status];
                      const isPro = idx === 1;
                      return (
                        <td
                          key={`${item.feature}-${isPro ? "pro" : "free"}`}
                          className={`px-6 py-5 text-center align-top md:px-8 ${
                            isPro ? "bg-[#0F0C18] text-white/90" : "text-[#1F212B]"
                          }`}
                        >
                          <div className="inline-flex flex-col items-center gap-2 text-sm md:text-base">
                            <span
                              aria-hidden="true"
                              className={`text-lg leading-none ${status.color}`}
                            >
                              {status.icon}
                            </span>
                            <span className="font-semibold">
                              {cell.label}
                            </span>
                            {cell.note && (
                              <span
                                className={`text-xs font-medium ${
                                  isPro ? "text-white/70" : "text-[#55586A]"
                                }`}
                              >
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
            </table>
          </div>
        </div>

        <div className="mt-12 grid gap-6 text-sm text-[#3A3C48] md:grid-cols-2 md:text-base">
          <div className="rounded-2xl border border-[#DADDE7] bg-white p-6 text-center shadow-[0_16px_44px_rgba(24,27,37,0.08)] md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#4B4D5A]">
              Plano Gratuito
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#171922]">
              R$ 0 <span className="text-sm font-medium text-[#5C5F72]">/ mês</span>
            </p>
            <p className="mt-3 font-light">
              Para entrar na comunidade e ganhar visibilidade com dados reais.
            </p>
            <ButtonPrimary
              onClick={onCreateAccount}
              variant="solid"
              size="lg"
              className="mt-5 w-full justify-center md:w-auto"
            >
              Criar conta gratuita
            </ButtonPrimary>
            <p className="mt-3 text-xs font-medium uppercase tracking-[0.22em] text-[#5C5F72]">
              Sem cartão • Sem compromisso
            </p>
          </div>
          <div className="rounded-2xl border border-[#FF1E56]/50 bg-gradient-to-br from-[#1A1422] via-[#0F0C18] to-[#07060B] p-6 text-center text-white shadow-[0_22px_62px_rgba(12,10,25,0.6)] md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FF8AAE]">
              Plano PRO ⭐
            </p>
            <p className="mt-2 text-2xl font-semibold">
              R$ 49,90 <span className="text-sm font-medium text-white/70">/ mês</span>
            </p>
            <p className="mt-1 text-sm font-medium text-white/70">ou R$ 350 / ano</p>
            <p className="mt-3 font-light text-white/80">
              Para fechar campanhas com estratégia, precificação inteligente e
              suporte humano + IA.
            </p>
            <ButtonPrimary
              onClick={onCreateAccount}
              variant="ghost"
              size="lg"
              className="mt-5 w-full justify-center border border-white/20 bg-white/5 text-white hover:border-white/30 hover:bg-white/10 md:w-auto"
            >
              Quero ser PRO
            </ButtonPrimary>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PlansComparisonSection;
