"use client";

import React from "react";
import { ArrowUpRight, Target } from "lucide-react";

type DirectioningFeedbackStatus = "applied" | "not_applied" | null;

export type DirectioningSectionItem = {
  id: string;
  key: string;
  title: string;
  nextStepOrAction: string;
  metaLine: string;
  queueStageClassName: string;
  queueStageLabel: string;
  feedbackStatus: DirectioningFeedbackStatus;
  isFeedbackUpdating: boolean;
};

type PlanningChartsDirectioningSectionProps = {
  recommendationsFeatureEnabled: boolean;
  directioningNoGoLine: string;
  loadingBatch: boolean;
  items: DirectioningSectionItem[];
  onApply: (itemId: string) => void;
  onSkip: (itemId: string) => void;
  onOpenEvidence: (itemId: string) => void;
};

export function PlanningChartsDirectioningSection({
  recommendationsFeatureEnabled,
  directioningNoGoLine,
  loadingBatch,
  items,
  onApply,
  onSkip,
  onOpenEvidence,
}: PlanningChartsDirectioningSectionProps) {
  if (!recommendationsFeatureEnabled) {
    return (
      <div className="space-y-3.5">
        <div className="rounded-[1.25rem] border border-zinc-100/90 bg-zinc-50/62 p-6 text-center">
          <p className="text-sm text-slate-500">Sem próximo passo claro por enquanto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      <section className="space-y-2">
        <div className="dashboard-section-panel flex items-center gap-2 rounded-[1rem] px-3 py-2">
          <Target className="h-2.5 w-2.5 text-pink-500" />
          <h3 className="dashboard-muted-label text-pink-500">Antes de agir</h3>
          <p className="dashboard-type-meta italic text-zinc-600">{directioningNoGoLine}</p>
        </div>

        <div className="dashboard-section-stack overflow-hidden rounded-[1.35rem]">
          {loadingBatch ? (
            <p className="px-4 py-4 text-sm text-zinc-500">Carregando plano de ação...</p>
          ) : items.length === 0 ? (
            <p className="px-4 py-4 text-sm text-zinc-500">Sem ação aberta agora. Volte quando entrar post novo.</p>
          ) : (
            items.map((item, index) => (
              <article
                key={item.key}
                className="bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.05),transparent_30%),rgba(250,250,250,0.56)] px-4 py-4 transition hover:bg-white/72"
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl font-bold text-xs ${
                      index === 0
                        ? "bg-zinc-900 text-white"
                        : "bg-white/86 text-zinc-500 ring-1 ring-zinc-100/90"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span
                        className={`dashboard-type-control inline-flex items-center rounded-full border px-2.5 py-1 text-[9px] ${item.queueStageClassName}`}
                      >
                        {item.queueStageLabel}
                      </span>
                      <p className="dashboard-muted-label text-zinc-400">{item.title}</p>
                    </div>
                    <h4 className="dashboard-type-item-title mb-1 text-base">{item.nextStepOrAction}</h4>
                    <p className="dashboard-type-meta text-zinc-500">{item.metaLine}</p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={item.isFeedbackUpdating}
                        onClick={() => onApply(item.id)}
                        className={`inline-flex h-8 items-center justify-center rounded-2xl px-3 text-[11px] font-bold transition-all ${
                          item.feedbackStatus === "applied"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "dashboard-secondary-button text-zinc-600"
                        } ${item.isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        {item.feedbackStatus === "applied" ? "Feito" : "Concluir"}
                      </button>
                      <button
                        type="button"
                        disabled={item.isFeedbackUpdating}
                        onClick={() => onSkip(item.id)}
                        className={`inline-flex h-8 items-center justify-center rounded-2xl px-3 text-[11px] font-bold transition-all ${
                          item.feedbackStatus === "not_applied"
                            ? "bg-pink-50 text-pink-600 ring-1 ring-pink-200"
                            : "dashboard-secondary-button text-zinc-600"
                        } ${item.isFeedbackUpdating ? "cursor-not-allowed opacity-60" : ""}`}
                      >
                        {item.feedbackStatus === "not_applied" ? "Ignorado" : "Pular"}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenEvidence(item.id)}
                      className="flex items-center gap-1.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-pink-500 transition-colors hover:text-pink-600"
                    >
                      Ver por que
                      <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
