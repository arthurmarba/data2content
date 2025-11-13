"use client";

import React from "react";
import Link from "next/link";
import {
  CalendarClock,
  Lightbulb,
  PenTool,
  Sparkles,
  Wand2,
} from "lucide-react";
import { track } from "@/lib/track";
import { PRO_PLAN_FLEXIBILITY_COPY } from "@/app/constants/trustCopy";

interface PlannerUpgradePanelProps {
  status?: string | null;
  lockedReason?: string | null;
  onSubscribe?: () => void;
  billingHref?: string;
}

const highlights = [
  {
    icon: Sparkles,
    title: "Sugestões prontas toda semana",
    description: "Receba uma grade completa com temas, formatos e âncoras alinhadas à sua audiência.",
  },
  {
    icon: CalendarClock,
    title: "Melhores horários validados",
    description: "Descubra os blocos com mais alcance com base na performance dos seus últimos 90 dias.",
  },
  {
    icon: PenTool,
    title: "Roteiros com IA em 1 clique",
    description: "Gere legendas e pontos-chave personalizados para cada slot sem sair do planner.",
  },
];

const steps = [
  {
    label: "1",
    title: "Escolha o objetivo da semana",
    description: "Defina quantos conteúdos quer publicar e o foco da campanha.",
  },
  {
    label: "2",
    title: "Ajuste os slots sugeridos",
    description: "Personalize temas, formatos e categorias com base nas recomendações geradas.",
  },
  {
    label: "3",
    title: "Gere roteiro e publique",
    description: "Use o assistente de IA para criar legendas e reúna tudo no seu calendário.",
  },
];

function resolveStatusMessage(status?: string | null, lockedReason?: string | null) {
  if (lockedReason) return lockedReason;
  const norm = typeof status === "string" ? status.toLowerCase() : "";
  switch (norm) {
    case "past_due":
    case "pending":
    case "incomplete":
      return "Pagamento pendente. Assim que for confirmado, o planner é liberado automaticamente.";
    case "incomplete_expired":
    case "inactive":
    case "expired":
    case "canceled":
    case "unpaid":
      return "Sua assinatura está inativa. Escolha um plano para desbloquear o planner completo.";
    case "non_renewing":
      return "Seu plano atual segue ativo até o fim do período. Reative para manter o planner sem interrupções.";
    default:
      return "Assine um plano premium e transforme o planner em sua central de conteúdo semanal.";
  }
}

const PlannerUpgradePanel: React.FC<PlannerUpgradePanelProps> = ({
  status,
  lockedReason,
  onSubscribe,
  billingHref = "/dashboard/billing",
}) => {
  const statusMessage = resolveStatusMessage(status, lockedReason);
  const samplePeek = [
    { label: "Seg · 19h", badge: "+18% alcance" },
    { label: "Reels • Tutoriais", badge: "+22% engaj." },
    { label: "Qui · 21h", badge: "+14% salvamentos" },
  ];

  const handlePrimaryClick = () => {
    track("planner_upsell_cta_click", { cta: "open_paywall" });
    onSubscribe?.();
  };

  const handleSecondaryClick = () => {
    track("planner_upsell_cta_click", { cta: "view_plans" });
  };

  return (
    <section className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-white p-6 sm:p-8 shadow-sm">
      <div className="space-y-6">
        <header className="space-y-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pink-700">
            <Wand2 size={14} aria-hidden /> Planner Premium
          </span>
          <div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
              Gere um plano semanal com IA em menos de 30 segundos
            </h3>
            <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">
              Bloqueie os melhores horários com base nos seus dados reais, receba temas e formatos prontos e gere roteiros com um clique.
            </p>
          </div>
          <p className="inline-flex items-center gap-2 rounded-md border border-pink-200 bg-pink-50 px-3 py-2 text-sm font-medium text-pink-700">
            <Lightbulb size={14} className="text-pink-500" aria-hidden />
            <span>{statusMessage}</span>
          </p>
        </header>

        <div className="grid gap-3 sm:grid-cols-3">
          {highlights.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col gap-2 rounded-lg border border-pink-100 bg-white/80 px-4 py-3 shadow-sm"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                <Icon size={18} aria-hidden />
              </div>
              <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
              <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
            </div>
          ))}
        </div>

        <div className="rounded-2xl border border-pink-100 bg-white/90 px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-pink-600">
            <span aria-hidden>👀</span> Peek do Modo Agência
          </div>
          <p className="mt-2 text-sm font-semibold text-gray-900">
            Slots sugeridos para a sua semana (prévia borrada — desbloqueie para editar)
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {samplePeek.map(({ label, badge }) => (
              <span
                key={label}
                className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-800 shadow-sm blur-[2px]"
                aria-hidden="true"
              >
                {label} · {badge}
              </span>
            ))}
          </div>
          <p className="sr-only">
            Prévia borrada dos horários e formatos sugeridos pelo Planner; disponível ao ativar o Modo Agência.
          </p>
          <p className="mt-3 text-xs text-gray-500">
            O planner cruza categorias, engajamento e frequência para sugerir slots com maior probabilidade de resultado.
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white/80 px-4 py-4">
          <h5 className="mb-3 text-sm font-semibold text-gray-800">Como funciona</h5>
          <div className="grid gap-3 sm:grid-cols-3">
            {steps.map((step) => (
              <div key={step.label} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-pink-600 text-xs font-bold text-white">
                  {step.label}
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-gray-900">{step.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={handlePrimaryClick}
            className="inline-flex items-center justify-center rounded-md bg-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700"
          >
            Gerar meu plano com o Plano Agência
          </button>
          <Link
            href={billingHref}
            onClick={handleSecondaryClick}
            className="text-sm font-semibold text-pink-600 hover:text-pink-700"
          >
            Ver planos completos
          </Link>
        </div>
        <p className="text-[11px] text-gray-500">{PRO_PLAN_FLEXIBILITY_COPY}</p>
      </div>
    </section>
  );
};

export default PlannerUpgradePanel;
