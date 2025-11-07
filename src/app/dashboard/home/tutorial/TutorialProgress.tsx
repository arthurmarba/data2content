"use client";

import React from "react";
import type { HomeJourneyProgress, JourneyStepStatus } from "../types";

export interface TutorialProgressStep {
  id: string;
  title: string;
  description: string;
  helper?: string | null;
  status: JourneyStepStatus;
  icon: React.ReactNode;
}

interface TutorialProgressProps {
  progress: HomeJourneyProgress | null;
  loading: boolean;
  steps: TutorialProgressStep[];
  proActive: boolean;
  onPrimaryAction?: () => void;
  primaryLabel?: string;
  primaryDisabled?: boolean;
}

const STATUS_LABELS: Record<JourneyStepStatus, string> = {
  done: "Concluído",
  in_progress: "Em andamento",
  todo: "Próximo passo",
};

const STATUS_STYLES: Record<JourneyStepStatus, string> = {
  done: "border-emerald-200 bg-emerald-50 text-emerald-800",
  in_progress: "border-rose-200 bg-rose-50 text-rose-800",
  todo: "border-slate-200 bg-slate-50 text-slate-600",
};

function TutorialProgressSkeleton() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_50px_rgba(15,23,42,0.08)]">
      <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-4 w-72 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 h-3 w-full animate-pulse rounded-full bg-slate-200" />
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-100 p-4">
            <div className="h-10 w-10 rounded-2xl bg-slate-200" />
            <div className="mt-4 h-4 w-2/3 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full rounded bg-slate-100" />
            <div className="mt-4 h-9 w-32 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function TutorialProgress({
  progress,
  loading,
  steps,
  proActive,
  onPrimaryAction,
  primaryLabel,
  primaryDisabled,
}: TutorialProgressProps) {
  if (loading && !progress) {
    return <TutorialProgressSkeleton />;
  }

  if (!progress) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 text-center shadow">
        <p className="text-base font-medium text-slate-900">Não foi possível carregar seu progresso agora.</p>
        <p className="mt-2 text-sm text-slate-500">Atualize a página para tentar novamente.</p>
      </section>
    );
  }

  const showProBadge = proActive && !(progress.highlightMessage?.toLowerCase()?.includes("pro ativo") ?? false);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Jornada</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">{progress.headline}</h2>
          <p className="mt-2 text-sm text-slate-600">{progress.subcopy}</p>
          {progress.highlightMessage ? (
            <p className="mt-3 text-sm font-medium text-rose-600">{progress.highlightMessage}</p>
          ) : null}
        </div>
        <div className="flex w-full max-w-sm flex-col items-start gap-2 text-sm font-semibold text-slate-800 lg:items-end">
          <span>{progress.progressLabel}</span>
          {showProBadge ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <span aria-hidden>✅</span>PRO ativo — negocie campanhas com IA
            </span>
          ) : null}
          {onPrimaryAction && primaryLabel ? (
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/40"
              onClick={onPrimaryAction}
              disabled={primaryDisabled}
            >
              {primaryLabel}
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 h-1.5 rounded-full bg-slate-100">
        <div
          className="h-1.5 rounded-full bg-gradient-to-r from-[#F6007B] to-orange-400 transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(0, progress.progressPercent))}%` }}
          aria-hidden
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
        {steps.map((step) => (
          <article
            key={step.id}
            className="rounded-2xl border border-slate-100 bg-white/80 p-4 shadow-sm ring-1 ring-transparent"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                {step.icon}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">{step.title}</h3>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[step.status]}`}
                  >
                    {STATUS_LABELS[step.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{step.description}</p>
                {step.helper ? (
                  <p className="mt-1 text-xs text-slate-400">{step.helper}</p>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>

    </section>
  );
}
