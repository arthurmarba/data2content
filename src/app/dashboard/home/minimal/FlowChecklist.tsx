// src/app/dashboard/home/minimal/FlowChecklist.tsx

"use client";

import React from "react";
import { ArrowRight, CheckCircle2, Circle, Clock3, Sparkles } from "lucide-react";
import type {
  DashboardChecklistStep,
  DashboardFlowChecklist,
  HomeJourneyProgress,
  HomePlanSummary,
} from "../types";

interface FlowChecklistProps {
  checklist: DashboardFlowChecklist | null;
  loading: boolean;
  plan: HomePlanSummary | null;
  journeyProgress?: HomeJourneyProgress | null;
  onStepAction: (step: DashboardChecklistStep) => void;
  onStepShortcut: (step: DashboardChecklistStep) => void;
}

const STATUS_META: Record<
  DashboardChecklistStep["status"],
  {
    label: string;
    badgeClassName: string;
    icon: React.ComponentType<{ className?: string }>;
    panelClassName: string;
  }
> = {
  done: {
    label: "Concluído",
    badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
    panelClassName: "border-emerald-200/80 bg-emerald-50/60",
  },
  in_progress: {
    label: "Em andamento",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3,
    panelClassName: "border-rose-200/80 bg-rose-50/70 shadow-[0_16px_40px_rgba(244,63,94,0.10)]",
  },
  todo: {
    label: "Próxima etapa",
    badgeClassName: "border-zinc-200 bg-zinc-100 text-zinc-600",
    icon: Circle,
    panelClassName: "border-zinc-200 bg-white/90",
  },
};

function FlowChecklistSkeleton() {
  return (
    <div className="dashboard-panel overflow-hidden rounded-[2rem] p-5 sm:p-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.9fr)]">
        <div className="dashboard-soft-accent-card rounded-[1.75rem] p-6">
          <div className="h-6 w-28 animate-pulse rounded-full bg-zinc-200" />
          <div className="mt-4 h-10 w-64 max-w-full animate-pulse rounded-2xl bg-zinc-200" />
          <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded-xl bg-zinc-200" />
          <div className="dashboard-progress-track mt-6 h-2.5 w-full animate-pulse rounded-full bg-zinc-200" />
          <div className="mt-6 h-28 animate-pulse rounded-[1.5rem] bg-white" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="dashboard-stat-card rounded-[1.5rem] p-4">
              <div className="h-4 w-20 animate-pulse rounded bg-zinc-200" />
              <div className="mt-3 h-8 w-24 animate-pulse rounded bg-zinc-200" />
              <div className="mt-2 h-4 w-28 animate-pulse rounded bg-zinc-200" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="dashboard-panel-subtle rounded-[1.5rem] p-4">
            <div className="h-4 w-12 animate-pulse rounded bg-zinc-200" />
            <div className="mt-3 h-5 w-32 animate-pulse rounded bg-zinc-200" />
            <div className="mt-2 h-4 w-full animate-pulse rounded bg-zinc-200" />
            <div className="mt-5 h-10 w-28 animate-pulse rounded-2xl bg-zinc-200" />
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChecklistState() {
  return (
    <div className="dashboard-empty-state rounded-[2rem] p-6">
      <h2 className="dashboard-type-section-title">Seu progresso para fechar campanhas</h2>
      <p className="dashboard-type-body mt-3">
        Não foi possível carregar o checklist agora. Atualize a página para tentar novamente.
      </p>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  footnote,
  tone = "neutral",
}: {
  label: string;
  value: string;
  footnote: string;
  tone?: "neutral" | "success" | "attention";
}) {
  const toneClassName =
    tone === "success"
      ? "text-emerald-600"
      : tone === "attention"
      ? "text-rose-600"
      : "text-zinc-900";

  return (
    <div className="px-4 py-3.5">
      <p className="dashboard-muted-label">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className={`dashboard-type-kpi-md text-[1.45rem] ${toneClassName}`}>{value}</p>
      </div>
      <p className="dashboard-type-meta mt-1 leading-5">{footnote}</p>
    </div>
  );
}

function formatStageLabel(current: number, total: number) {
  return `Etapa ${current} de ${total}`;
}

function deriveProgressPercent(checklist: DashboardFlowChecklist, journeyProgress?: HomeJourneyProgress | null) {
  if (typeof journeyProgress?.progressPercent === "number") {
    return Math.max(0, Math.min(100, journeyProgress.progressPercent));
  }

  const totalSteps = checklist.steps.length || 1;
  const completedCount = checklist.steps.filter((step) => step.status === "done").length;
  return Math.round((completedCount / totalSteps) * 100);
}

export default function FlowChecklist({
  checklist,
  loading,
  plan,
  journeyProgress,
  onStepAction,
  onStepShortcut,
}: FlowChecklistProps) {
  if (loading && !checklist) {
    return <FlowChecklistSkeleton />;
  }

  if (!checklist || !checklist.steps?.length) {
    return <EmptyChecklistState />;
  }

  const totalSteps = checklist.steps.length;
  const completedCount = checklist.steps.filter((step) => step.status === "done").length;
  const nextStep =
    checklist.steps.find((step) => step.id === checklist.firstPendingStepId) ??
    checklist.steps.find((step) => step.status !== "done") ??
    null;
  const completionShortcutStep =
    [...checklist.steps].reverse().find((step) => step.completedHref && step.completedLabel) ?? null;
  const progressPercent = deriveProgressPercent(checklist, journeyProgress);
  const currentStage = nextStep ? checklist.steps.findIndex((step) => step.id === nextStep.id) + 1 : totalSteps;
  const headline = journeyProgress?.headline ?? "Seu progresso para fechar campanhas";
  const subcopy =
    journeyProgress?.subcopy ??
    "Complete os passos abaixo para acelerar suas negociações com marcas.";
  const highlightMessage =
    journeyProgress?.highlightMessage ??
    (nextStep ? "Priorize a próxima etapa para liberar o fluxo comercial." : "Tudo em dia. Continue respondendo rápido às campanhas.");
  const hasPending = Boolean(nextStep);

  return (
    <div className="dashboard-panel overflow-hidden rounded-[2rem] p-4 sm:p-5">
      <div className="grid gap-4">
        <section className="dashboard-soft-accent-card relative overflow-hidden rounded-[1.75rem] p-6">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-pink-200/50 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <span className="dashboard-muted-label inline-flex items-center rounded-full border border-pink-200 bg-white/82 px-3 py-1 text-pink-600">
                  {formatStageLabel(currentStage, totalSteps)}
                </span>
                <h2 className="dashboard-type-board-title mt-4 text-[clamp(1.5rem,2vw,2rem)]">
                  {headline}
                </h2>
                <p className="dashboard-type-body mt-2 max-w-2xl">{subcopy}</p>
              </div>
              <span
                className={`dashboard-type-control inline-flex items-center self-start rounded-full border px-3 py-1 ${
                  plan?.hasPremiumAccess
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-zinc-200 bg-white/85 text-zinc-600"
                }`}
              >
                {plan?.hasPremiumAccess ? "Plano Pro ativo" : "Plano atual"}
              </span>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <span className="dashboard-muted-label text-zinc-400">
                  {journeyProgress?.progressLabel ?? `${completedCount}/${totalSteps} etapas concluídas`}
                </span>
                <span className="dashboard-type-kpi-sm text-zinc-600">{progressPercent}%</span>
              </div>
              <div className="dashboard-progress-track mt-3 h-2.5 rounded-full bg-white/80 ring-1 ring-pink-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-400 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="dashboard-type-body mt-3 inline-flex items-center gap-2 rounded-full bg-white/82 px-3 py-1.5 text-zinc-700 ring-1 ring-zinc-200/70">
                <Sparkles className="h-4 w-4 text-rose-500" />
                {highlightMessage}
              </p>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-white/80 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.08),transparent_28%),rgba(255,255,255,0.78)] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.05)] backdrop-blur-sm">
              {hasPending && nextStep ? (
                <>
                  <p className="dashboard-muted-label text-pink-500">
                    Próxima ação
                  </p>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="dashboard-type-section-title">
                        {nextStep.title}
                      </h3>
                      <p className="dashboard-type-body mt-2">
                        {nextStep.helper ?? "Conclua esta etapa para destravar o próximo avanço da jornada."}
                      </p>
                    </div>
                    {typeof nextStep.badgeCount === "number" && nextStep.badgeCount > 0 ? (
                      <span className="inline-flex min-w-[2.5rem] justify-center rounded-full bg-rose-100 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        {nextStep.badgeCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-4.5 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      className="dashboard-primary-button dashboard-type-control inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
                      aria-describedby={nextStep.helper ? `flow-step-helper-${nextStep.id}` : undefined}
                      onClick={() => onStepAction(nextStep)}
                    >
                      {nextStep.actionLabel}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <p className="dashboard-type-body">
                      Etapa atual para acelerar seu fluxo comercial.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="dashboard-muted-label text-emerald-600">
                    Jornada em dia
                  </p>
                  <h3 className="dashboard-type-section-title mt-3">
                    Tudo pronto para negociar campanhas com contexto completo
                  </h3>
                  <p className="dashboard-type-body mt-2">
                    Seu setup principal está concluído. Agora o foco é manter o kit atualizado e responder com rapidez.
                  </p>
                  {completionShortcutStep ? (
                    <button
                      type="button"
                      className="dashboard-secondary-button dashboard-type-control mt-4.5 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2"
                      onClick={() => onStepShortcut(completionShortcutStep)}
                    >
                      {completionShortcutStep.completedLabel}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </section>

        <aside className="overflow-hidden rounded-[1.5rem] border border-zinc-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.8),rgba(250,250,250,0.72))] sm:grid sm:grid-cols-2">
          <div className="border-b border-zinc-100/90 sm:border-b-0 sm:border-r">
            <SummaryStat
              label="Instagram"
              value={checklist.summary.instagramConnected ? "Conectado" : "Pendente"}
              footnote={checklist.summary.instagramConnected ? "Métricas e automações liberadas." : "Conecte para liberar diagnóstico."}
              tone={checklist.summary.instagramConnected ? "success" : "attention"}
            />
          </div>
          <div className="border-b border-zinc-100/90 sm:border-b-0">
            <SummaryStat
              label="Mídia Kit"
              value={checklist.summary.hasMediaKit ? "Pronto" : "Em aberto"}
              footnote={
                checklist.summary.hasMediaKit
                  ? "Seu link já pode receber marcas."
                  : "Monte sua vitrine comercial."
              }
              tone={checklist.summary.hasMediaKit ? "success" : "neutral"}
            />
          </div>
          <div className="border-b border-zinc-100/90 sm:border-b-0 sm:border-r sm:border-t">
            <SummaryStat
              label="Propostas novas"
              value={String(checklist.summary.newProposals)}
              footnote={
                checklist.summary.newProposals > 0
                  ? "Existem campanhas aguardando resposta."
                  : "Nenhuma proposta nova agora."
              }
              tone={checklist.summary.newProposals > 0 ? "attention" : "neutral"}
            />
          </div>
          <div className="sm:border-t sm:border-zinc-100/90">
            <SummaryStat
              label="Pendências"
              value={String(checklist.summary.pendingProposals)}
              footnote={
                checklist.summary.pendingProposals > 0
                  ? "Priorize respostas com IA."
                  : "Caixa de entrada em ordem."
              }
              tone={checklist.summary.pendingProposals > 0 ? "attention" : "success"}
            />
          </div>
        </aside>
      </div>

      <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.86),rgba(250,250,250,0.8))]">
        {checklist.steps.map((step, index) => {
          const statusMeta = STATUS_META[step.status] ?? STATUS_META.todo;
          const StatusIcon = statusMeta.icon;
          const helperId = `flow-step-helper-${step.id}`;
          const isCurrent = nextStep?.id === step.id;

          return (
            <article
              key={step.id}
              className={`p-4 transition-colors ${index > 0 ? "border-t border-zinc-100/90" : ""} ${
                isCurrent
                  ? "bg-[linear-gradient(180deg,rgba(253,242,248,0.74),rgba(255,255,255,0.92))]"
                  : step.status === "done"
                    ? "bg-white/88"
                    : "bg-transparent"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="dashboard-muted-label text-zinc-400">
                    Passo {index + 1}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <StatusIcon className={`h-4 w-4 ${step.status === "done" ? "text-emerald-600" : step.status === "in_progress" ? "text-rose-500" : "text-zinc-400"}`} />
                    <h3 className="dashboard-type-item-title min-w-0 text-base">
                      {step.title}
                    </h3>
                  </div>
                </div>
                <span className={`dashboard-type-control inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 ${statusMeta.badgeClassName}`}>
                  {statusMeta.label}
                </span>
              </div>

              <p id={helperId} className="dashboard-type-body mt-3">
                {step.helper ?? "Etapa concluída e pronta para consulta rápida."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                {step.status === "done" ? (
                  <>
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Feito
                    </span>
                    {step.completedLabel && step.completedHref ? (
                      <button
                        type="button"
                        className="dashboard-type-control inline-flex items-center gap-1 text-zinc-700 transition hover:text-zinc-900"
                        onClick={() => onStepShortcut(step)}
                      >
                        {step.completedLabel}
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    ) : null}
                  </>
                ) : (
                  <button
                    type="button"
                    className={`dashboard-type-control inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                      isCurrent
                        ? "bg-zinc-900 text-white hover:bg-zinc-800 focus-visible:ring-zinc-500"
                        : "border border-zinc-200 bg-white/90 text-zinc-700 hover:border-zinc-300 hover:text-zinc-900 focus-visible:ring-zinc-400"
                    }`}
                    aria-describedby={step.helper ? helperId : undefined}
                    onClick={() => onStepAction(step)}
                  >
                    {step.actionLabel}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}

                {typeof step.badgeCount === "number" && step.badgeCount > 0 ? (
                  <span className="inline-flex min-w-[2.25rem] justify-center rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold text-rose-700">
                    {step.badgeCount}
                  </span>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
