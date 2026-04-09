"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Clock3, Database, Sparkles } from "lucide-react";

type PlanningChartsRecommendationDrawerProps = {
  title: string;
  queueStageClassName: string;
  queueStageLabel: string;
  headline: string;
  description: string;
  metaLine: string;
  sampleBaseText: string;
  confidenceText: string;
  compositeConfidenceText?: string | null;
  metricLabel: string;
  periodLabel: string;
  completedAtText?: string | null;
  impactText?: string | null;
  beforeAfterText?: string | null;
  evidenceItems: string[];
  evidenceOverflowCount: number;
  confidenceFactorsText?: string | null;
  guardrailText?: string | null;
  experimentSuccessSignal?: string | null;
  experimentSampleGoal?: string | null;
  feedbackStatus: "applied" | "not_applied" | null;
  feedbackLoading: boolean;
  onApply: () => void;
  onSkip: () => void;
  onGoToPlanner: () => void;
};

export function PlanningChartsRecommendationDrawer({
  title,
  queueStageClassName,
  queueStageLabel,
  headline,
  description,
  metaLine,
  sampleBaseText,
  confidenceText,
  compositeConfidenceText,
  metricLabel,
  periodLabel,
  completedAtText,
  impactText,
  beforeAfterText,
  evidenceItems,
  evidenceOverflowCount,
  confidenceFactorsText,
  guardrailText,
  experimentSuccessSignal,
  experimentSampleGoal,
  feedbackStatus,
  feedbackLoading,
  onApply,
  onSkip,
  onGoToPlanner,
}: PlanningChartsRecommendationDrawerProps) {
  return (
    <div className="space-y-3 pb-2">
      <div className="space-y-3">
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-950 to-indigo-950 px-3.5 py-3 shadow-lg sm:p-4">
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-indigo-500/20 blur-2xl" />

          <div className="relative space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-200 backdrop-blur-sm">
                <Sparkles className="h-3 w-3" />
                {title}
              </div>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${queueStageClassName}`}>
                {queueStageLabel}
              </span>
            </div>
            <h3 className="text-base font-medium leading-snug text-white sm:text-lg">{headline}</h3>
            <p className="text-sm leading-relaxed text-indigo-100/90">{description}</p>
            <p className="text-xs font-medium text-indigo-100/70">{metaLine}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-100/90 bg-white/78 p-3.5 sm:p-4">
          <div className="mb-2 flex items-center gap-2">
            <Database className="h-4 w-4 text-indigo-500" />
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Por que fazer isso</h4>
          </div>
          <p className="text-sm font-semibold text-slate-900">{sampleBaseText}</p>
          <p className="mt-1 text-[11px] font-medium text-slate-500">{confidenceText}</p>
          {compositeConfidenceText ? <p className="mt-1 text-[11px] font-medium text-slate-500">{compositeConfidenceText}</p> : null}
          <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Métrica</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{metricLabel}</p>
            </div>
            <div className="rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Período</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{periodLabel}</p>
            </div>
          </div>
        </section>

        {completedAtText ? (
          <section className="rounded-2xl border border-zinc-100/90 bg-white/78 p-3.5 sm:p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-100/90 bg-zinc-50/72 text-slate-500">
                <Clock3 className="h-4 w-4" />
              </div>
              <div className="space-y-1">
                <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Depois disso</h4>
                <p className="text-xs font-medium text-slate-500">Você marcou isso em {completedAtText}.</p>
                {impactText ? <p className="text-sm leading-relaxed text-slate-700">{impactText}</p> : null}
                {beforeAfterText ? <p className="text-xs text-slate-500">{beforeAfterText}</p> : null}
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-100/90 bg-white/78 p-3.5 sm:p-4">
          <div className="mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-indigo-400" />
            <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Por que isso faz sentido</h4>
          </div>
          <div className="space-y-3">
            {evidenceItems.length ? (
              <ul className="space-y-2">
                {evidenceItems.map((item, index) => (
                  <li key={`${title}-${index}`} className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-400" />
                    <p className="text-sm leading-relaxed text-slate-700">{item}</p>
                  </li>
                ))}
              </ul>
            ) : null}
            {evidenceOverflowCount > 0 ? (
              <p className="text-xs text-slate-500">+{evidenceOverflowCount} observações a mais no detalhe completo.</p>
            ) : null}
            {confidenceFactorsText ? (
              <div className="border-t border-zinc-100/90 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Também entrou</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{confidenceFactorsText}</p>
              </div>
            ) : null}
            {guardrailText ? (
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/72 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs font-medium leading-relaxed text-amber-800">{guardrailText}</p>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {experimentSuccessSignal || experimentSampleGoal ? (
          <section className="rounded-2xl border border-zinc-100/90 bg-white/78 p-3.5 sm:p-4">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-500" />
              <h4 className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Como validar</h4>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {experimentSuccessSignal ? (
                <div className="rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Sinal de que deu certo</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{experimentSuccessSignal}</p>
                </div>
              ) : null}
              {experimentSampleGoal ? (
                <div className="rounded-xl border border-zinc-100/90 bg-zinc-50/72 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Quantos posts</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{experimentSampleGoal}</p>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-10 -mx-1 border-t border-zinc-100 bg-white px-1 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-3">
        <div className="mx-auto max-w-lg space-y-2">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Marcar</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={feedbackLoading}
              onClick={onApply}
              className={`flex min-h-[38px] flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition ${
                feedbackStatus === "applied"
                  ? "border-emerald-300 bg-emerald-50/78 text-emerald-700"
                  : "border-zinc-200/80 bg-white/82 text-slate-700 hover:border-zinc-300 hover:bg-zinc-50/82"
              } ${feedbackLoading ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="mr-1.5 text-base leading-none">{feedbackStatus === "applied" ? "✅" : "👍"}</span>
              Fazer isso
            </button>
            <button
              type="button"
              disabled={feedbackLoading}
              onClick={onSkip}
              className={`flex min-h-[38px] flex-1 items-center justify-center rounded-xl border text-sm font-semibold transition ${
                feedbackStatus === "not_applied"
                  ? "border-amber-300 bg-amber-50/78 text-amber-700"
                  : "border-zinc-200/80 bg-white/82 text-slate-700 hover:border-zinc-300 hover:bg-zinc-50/82"
              } ${feedbackLoading ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <span className="mr-1.5 text-base leading-none">{feedbackStatus === "not_applied" ? "❌" : "👎"}</span>
              Não fazer agora
            </button>
          </div>
          <button
            type="button"
            onClick={onGoToPlanner}
            className="flex min-h-[36px] w-full items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white transition hover:bg-black"
          >
            Ir para roteiros
          </button>
        </div>
      </div>
    </div>
  );
}
