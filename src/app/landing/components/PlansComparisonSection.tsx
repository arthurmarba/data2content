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
                        isPro ? "bg-gray-50 text-[#1F212B]" : "text-[#1F212B]" // Cor cinza claro para PRO
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
                                className={`text-xs font-medium text-[#55586A]`} // Cor da nota escura
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

          {/* ======================================================================== */}
          {/* INÍCIO DA ATUALIZAÇÃO DO CARD PRO */}
          {/* ======================================================================== */}
          <div className="rounded-2xl border border-[#DADDE7] bg-gray-50 p-6 text-center shadow-[0_16px_44px_rgba(24,27,37,0.08)] md:text-left">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#FF5F8B]">
              Plano PRO ⭐
            </p>
            <p className="mt-2 text-2xl font-semibold text-[#171922]">
              R$ 49,90 <span className="text-sm font-medium text-[#5C5F72]">/ mês</span>
            </p>
            <p className="mt-1 text-sm font-medium text-[#5C5F72]">ou R$ 350 / ano</p>
            <p className="mt-3 font-light">
              Para fechar campanhas com estratégia, precificação inteligente e
              suporte humano + IA.
            </p>
            <ButtonPrimary
              onClick={onCreateAccount}
              variant="solid"
              size="lg"
              className="mt-5 w-full justify-center md:w-auto"
            >
              Quero ser PRO
            </ButtonPrimary>
          </div>
          {/* ======================================================================== */}
          {/* FIM DA ATUALIZAÇÃO DO CARD PRO */}
          {/* ======================================================================== */}
        </div>
      </div>
    </section>
  );
};

export default PlansComparisonSection;