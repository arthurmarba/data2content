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
  creatorId?: string | null;
  proposalCopyFeedbackVisible?: boolean;
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
  creatorId,
  proposalCopyFeedbackVisible = false,
  onStepAction,
  onStepShortcut,
}: FlowChecklistProps) {
  const [expandedStepId, setExpandedStepId] = React.useState<string | null>(null);
  const [proposalBioConfirmed, setProposalBioConfirmed] = React.useState(false);

  const proposalBioStorageKey = React.useMemo(() => {
    const userScope = creatorId?.trim() ? creatorId.trim() : "anonymous";
    return `home:proposal-bio-confirmed:${userScope}`;
  }, [creatorId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    setProposalBioConfirmed(window.localStorage.getItem(proposalBioStorageKey) === "1");
  }, [proposalBioStorageKey]);

  const handleConfirmProposalBio = React.useCallback(() => {
    setProposalBioConfirmed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(proposalBioStorageKey, "1");
    }
  }, [proposalBioStorageKey]);

  const handleOpenInstagram = React.useCallback(() => {
    if (typeof window === "undefined") return;
    window.open("https://instagram.com", "_blank", "noopener,noreferrer");
  }, []);

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
          const isProposalFormStep =
            step.id === "share_proposal_form_link" && Boolean(plan?.hasPremiumAccess);
          const proposalStepExpanded = expandedStepId === step.id;
          const showBioGuidance =
            step.id === "share_proposal_form_link" &&
            !proposalBioConfirmed &&
            (proposalCopyFeedbackVisible ||
              (step.status === "done" && step.requiresBioPasteConfirmation));
          const proposalActionLabel =
            isProposalFormStep && proposalCopyFeedbackVisible
              ? "Copiado. Cole na bio"
              : step.actionLabel;

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

              {showBioGuidance ? (
                <div className="mt-4 space-y-3">
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                    {step.status === "done" ? "Feito" : "Copiado"}
                  </span>
                  <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">
                      Link copiado. Agora cole na bio do Instagram.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                        onClick={handleOpenInstagram}
                      >
                        Abrir Instagram
                      </button>
                      <button
                        type="button"
                        className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                        onClick={handleConfirmProposalBio}
                      >
                        Já colei na bio
                      </button>
                      {isProposalFormStep ? (
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                          onClick={() => onStepShortcut(step)}
                        >
                          {step.completedLabel ?? "Copiar novamente"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : step.status === "done" ? (
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
              ) : isProposalFormStep ? (
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                    aria-expanded={proposalStepExpanded}
                    aria-describedby={step.helper ? helperId : undefined}
                    onClick={() =>
                      setExpandedStepId((current) => (current === step.id ? null : step.id))
                    }
                  >
                    {proposalActionLabel}
                  </button>

                  {proposalStepExpanded ? (
                    <div className="rounded-lg border border-sky-100 bg-sky-50/70 p-3 text-sm text-slate-700">
                      <p className="font-medium text-slate-900">
                        3 passos (leva menos de 1 minuto)
                      </p>
                      <p className="mt-1">1. Copie o link do formulário.</p>
                      <p>2. Cole o link na bio do Instagram.</p>
                      <p>3. Acompanhe e responda propostas em Campanhas.</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-lg border border-sky-200 bg-white px-3 py-1.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                          onClick={() => onStepAction(step)}
                        >
                          Copiar link do formulário
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                          onClick={() => setExpandedStepId(null)}
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
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
