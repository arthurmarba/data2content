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

  return (
    <section className="rounded-2xl border border-pink-200 bg-gradient-to-br from-pink-50 via-white to-white p-6 sm:p-8 shadow-sm">
      <div className="space-y-6">
          <header className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-pink-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-pink-700">
              <Wand2 size={14} /> Planner Premium
            </span>
            <div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-gray-900">Organize suas postagens com o Planner IA</h3>
              <p className="mt-2 text-sm sm:text-base text-gray-600 max-w-2xl">
                Transforme análises reais em um calendário de conteúdo pronto para execução. Bloqueie seus melhores horários, gere temas em segundos e acompanhe tudo em um só lugar.
              </p>
            </div>
            <p className="text-sm font-medium text-pink-700 bg-pink-50 border border-pink-200 rounded-md px-3 py-2 inline-flex items-center gap-2">
              <Lightbulb size={14} className="text-pink-500" />
              <span>{statusMessage}</span>
            </p>
          </header>

          <div className="grid gap-3 sm:grid-cols-3">
            {highlights.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="rounded-lg border border-pink-100 bg-white/70 px-4 py-3 shadow-sm flex flex-col gap-2"
              >
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-pink-600">
                  <Icon size={18} />
                </div>
                <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
                <p className="text-xs text-gray-600 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-white/80 px-4 py-4">
            <h5 className="text-sm font-semibold text-gray-800 mb-3">Como funciona</h5>
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

          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button
              type="button"
              onClick={onSubscribe}
              className="inline-flex items-center justify-center rounded-md bg-pink-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-pink-700"
            >
              Assinar agora
            </button>
            <Link
              href={billingHref}
              className="text-sm font-semibold text-pink-600 hover:text-pink-700"
            >
              Ver planos e preços
            </Link>
          </div>
      </div>
    </section>
  );
};

export default PlannerUpgradePanel;
