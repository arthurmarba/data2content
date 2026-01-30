// src/app/dashboard/home/minimal/FlowChecklist.tsx

"use client";

import React from "react";
import type {
  DashboardChecklistStep,
  DashboardFlowChecklist,
  HomePlanSummary,
} from "../types";

interface FlowChecklistProps {
  checklist: DashboardFlowChecklist | null;
  loading: boolean;
  plan: HomePlanSummary | null;
  onStepAction: (step: DashboardChecklistStep) => void;
  onStepShortcut: (step: DashboardChecklistStep) => void;
}

const STATUS_EMOJIS: Record<DashboardChecklistStep["status"], string> = {
  done: "✅",
  in_progress: "🟡",
  todo: "⚪",
};

const STATUS_BADGE_CLASSES: Record<DashboardChecklistStep["status"], string> = {
  done: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  in_progress: "bg-amber-50 text-amber-700 border border-amber-100",
  todo: "bg-slate-100 text-slate-600 border border-slate-200",
};

function FlowChecklistSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="h-6 w-60 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-4 w-96 max-w-full animate-pulse rounded bg-slate-200" />
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-xl border border-slate-100 p-4">
            <div className="h-5 w-16 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-4 w-40 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-9 w-28 animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FlowChecklist({
  checklist,
  loading,
  plan,
  onStepAction,
  onStepShortcut,
}: FlowChecklistProps) {
  if (loading && !checklist) {
    return <FlowChecklistSkeleton />;
  }

  if (!checklist || !checklist.steps?.length) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Seu progresso para fechar campanhas</h2>
        <p className="mt-3 text-sm text-slate-500">
          Não foi possível carregar o checklist agora. Atualize a página para tentar novamente.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Seu progresso para fechar campanhas</h2>
          <p className="text-sm text-slate-500">
            Complete os passos abaixo para acelerar suas negociações com marcas.
          </p>
        </div>
        {plan?.hasPremiumAccess ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
            Plano Pro ativo
          </span>
        ) : null}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {checklist.steps.map((step) => {
          const statusEmoji = STATUS_EMOJIS[step.status] ?? "⚪";
          const badgeClass = STATUS_BADGE_CLASSES[step.status] ?? STATUS_BADGE_CLASSES.todo;
          const isHighlighted = checklist.firstPendingStepId === step.id;
          const helperId = `flow-step-helper-${step.id}`;

          return (
            <div
              key={step.id}
              className={`rounded-xl border p-4 transition-shadow ${
                isHighlighted ? "border-sky-200 shadow-sm" : "border-slate-100"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                  <span>{statusEmoji}</span>
                  <span>{step.title}</span>
                </div>
                {typeof step.badgeCount === "number" && step.badgeCount > 0 ? (
                  <span className="inline-flex min-w-[2.25rem] justify-center rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
                    {step.badgeCount}
                  </span>
                ) : null}
              </div>

              {step.helper ? (
                <p id={helperId} className="mt-2 text-sm text-slate-500">
                  {step.helper}
                </p>
              ) : null}

              {step.status === "done" ? (
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                    Feito
                  </span>
                  {step.completedLabel && step.completedHref ? (
                    <button
                      type="button"
                      className="text-sm font-medium text-sky-600 transition hover:text-sky-700 hover:underline"
                      onClick={() => onStepShortcut(step)}
                    >
                      {step.completedLabel}
                    </button>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  className="mt-4 inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                  aria-describedby={step.helper ? helperId : undefined}
                  onClick={() => onStepAction(step)}
                >
                  {step.actionLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
