"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { Lock } from "lucide-react";
import { emptyStates } from "@/constants/emptyStates";
import { track } from "@/lib/track";
import { usePaywallOpener } from "@/app/dashboard/components/sidebar/hooks";

type PlanningLockedVariant = "planner" | "discover" | "whatsapp";

type VariantContent = {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  ctaLabel: string;
};

const planningEmptyState = emptyStates.planning;

const VARIANT_COPY: Record<PlanningLockedVariant, VariantContent> = {
  planner: {
    eyebrow: "Calendário com IA",
    title: planningEmptyState.title,
    description: "Planejamento faz parte do Plano Agência: gere horários com IA e mantenha constância para fechar melhor.",
    bullets: [
      "Slots inteligentes por dia e horário",
      "Alertas no WhatsApp (dúvidas no Chat AI)",
      "Roteiros e benchmarks do seu segmento",
    ],
    ctaLabel: planningEmptyState.ctaLabel,
  },
  discover: {
    eyebrow: "Descoberta da Comunidade",
    title: "Biblioteca de referências exclusiva do Plano Agência",
    description: "Ideias prontas, roteiros e benchmarks da comunidade ficam disponíveis somente para assinantes ativos.",
    bullets: [
      "Posts e formatos que estão performando agora",
      "Insights filtrados por nicho e objetivo",
      "Atualizações semanais direto da comunidade",
    ],
    ctaLabel: "Desbloquear Descoberta",
  },
  whatsapp: {
    eyebrow: "Alertas no WhatsApp",
    title: "Ative os alertas direto no WhatsApp",
    description: "Receba avisos de horários quentes e campanhas no app que você já usa. Para conversar com a IA, use o Chat AI no painel.",
    bullets: ["Alertas diários personalizados", "Diagnósticos da sua performance", "Link direto para o Chat AI"],
    ctaLabel: "Ativar alertas no WhatsApp",
  },
};

const trackingContextMap: Record<PlanningLockedVariant, "planning" | "discover" | "whatsapp_ai"> = {
  planner: "planning",
  discover: "discover",
  whatsapp: "whatsapp_ai",
};

type PlanningLockedViewProps = {
  variant?: PlanningLockedVariant;
  returnTo?: string;
};

export default function PlanningLockedView({ variant = "planner", returnTo = "/dashboard/planning" }: PlanningLockedViewProps) {
  const openPaywall = usePaywallOpener();
  const content = useMemo(() => VARIANT_COPY[variant] ?? VARIANT_COPY.planner, [variant]);

  useEffect(() => {
    track("paywall_viewed", { creator_id: null, context: trackingContextMap[variant], plan: null });
  }, [variant]);

  const handleUpgrade = useCallback(() => {
    const source = variant === "discover" ? "planning_locked_discover_cta" : variant === "whatsapp" ? "planning_locked_whatsapp_cta" : "planning_locked_planner_cta";
    openPaywall("planning", { source, returnTo });
  }, [openPaywall, returnTo, variant]);

  return (
    <main className="w-full pb-12 pt-16 sm:pt-24">
      <div className="dashboard-page-shell">
        <div className="w-full max-w-3xl mx-auto">
          <section className="rounded-3xl border border-dashed border-pink-200 bg-white px-5 py-6 text-sm text-slate-600 shadow-sm sm:px-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="rounded-full bg-pink-50 p-2 text-pink-600">
                <Lock className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-pink-600">{content.eyebrow}</p>
                <h1 className="mt-1 text-2xl font-semibold text-slate-900 sm:text-3xl">{content.title}</h1>
                <p className="mt-2 text-sm text-slate-600 sm:text-base">{content.description}</p>
              </div>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
              <button
                type="button"
                onClick={handleUpgrade}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-magenta px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-magenta/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
              >
                {content.ctaLabel}
              </button>
              <p className="text-xs text-slate-500 text-left sm:text-right">Pagamento seguro via Stripe · Cancelamento simples</p>
            </div>
          </div>
          <ul className="mt-6 flex flex-wrap items-center justify-start gap-2">
            {content.bullets.map((feature) => (
              <li
                key={feature}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700"
              >
                <span aria-hidden className="text-lg leading-none text-brand-purple">•</span>
                {feature}
              </li>
            ))}
          </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
