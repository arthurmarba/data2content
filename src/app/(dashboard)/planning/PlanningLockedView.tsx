"use client";

import React, { useEffect } from "react";
import { Compass as CompassIcon, MessageCircle, Wand2, Sparkles } from "lucide-react";
import { emptyStates } from "@/constants/emptyStates";
import { track } from "@/lib/track";

const planningEmptyState = emptyStates.planning;
const features = [
  { icon: <CompassIcon className="h-5 w-5 text-brand-purple" />, label: planningEmptyState.bullets[0] },
  { icon: <Wand2 className="h-5 w-5 text-brand-purple" />, label: planningEmptyState.bullets[1] },
  { icon: <MessageCircle className="h-5 w-5 text-brand-purple" />, label: planningEmptyState.bullets[2] },
];

export default function PlanningLockedView() {
  const handleUpgrade = () => {
    try {
      track("paywall_viewed", { creator_id: null, context: "planning", plan: null });
      window.dispatchEvent(
        new CustomEvent("open-subscribe-modal", {
          detail: { context: "planning", source: "planning_locked_cta", returnTo: "/dashboard/planning" },
        })
      );
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    try {
      track("paywall_viewed", { creator_id: null, context: "planning", plan: null });
      window.dispatchEvent(
        new CustomEvent("open-subscribe-modal", {
          detail: { context: "planning", source: "planning_locked_auto", returnTo: "/dashboard/planning" },
        })
      );
    } catch {
      /* ignore */
    }
  }, []); // Dispara modal assim que o usuário tenta acessar a área Plano Agência

  return (
    <main className="w-full max-w-none pb-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm sm:px-10">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full bg-brand-magenta/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand-magenta">
            <Sparkles className="h-4 w-4" aria-hidden="true" /> Planejamento Plano Agência
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-slate-900 sm:text-3xl">
            {planningEmptyState.title}
          </h1>
          <p className="mt-3 text-sm text-slate-600 sm:text-base">
            Planejamento faz parte do Plano Agência: gere horários com IA e mantenha constância para fechar melhor.
          </p>

          <ul className="mt-8 grid gap-3 text-sm text-slate-700 sm:grid-cols-3">
            {features.map((feature) => (
              <li
                key={feature.label}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:justify-start"
              >
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm">
                  {feature.icon}
                </span>
                <span className="font-medium leading-tight">{feature.label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <button
              type="button"
              onClick={handleUpgrade}
              className="inline-flex w-full items-center justify-center rounded-xl bg-brand-magenta px-6 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-brand-magenta/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta sm:w-auto"
            >
              {planningEmptyState.ctaLabel}
            </button>
            <p className="text-xs text-slate-500">
              Pagamento seguro via Stripe • Cancelamento simples
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
