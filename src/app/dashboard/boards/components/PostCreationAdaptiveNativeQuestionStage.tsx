"use client";

import type { PostCreationAdaptiveDecisionViewModel } from "../postCreationAdaptiveDecisionViewModel";

export type PostCreationAdaptiveNativeQuestionStageProps = {
  viewModel: PostCreationAdaptiveDecisionViewModel;
  onSelectOption: (optionId: string) => void;
  onNext: () => void;
  onBack?: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export default function PostCreationAdaptiveNativeQuestionStage({
  viewModel,
  onSelectOption,
  onNext,
  onBack,
  loading = false,
  disabled = false,
}: PostCreationAdaptiveNativeQuestionStageProps) {
  const interactionDisabled = disabled || loading;
  const nextDisabled = interactionDisabled || !viewModel.canAdvance;
  const progressPercent = `${Math.round(viewModel.progressValue * 100)}%`;

  function handleNext() {
    if (nextDisabled) return;
    onNext();
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{viewModel.visualStep}</p>
          <p className="text-sm font-medium text-slate-600">{viewModel.progressLabel}</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
          <div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: progressPercent }} />
        </div>
      </div>

      <div className="mt-5">
        <h2 className="text-xl font-semibold leading-tight text-slate-950">{viewModel.title}</h2>
        {viewModel.helper ? <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{viewModel.helper}</p> : null}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {viewModel.options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={[
              "min-h-24 rounded-xl border px-4 py-3 text-left shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60",
              option.selected
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:bg-slate-50",
            ].join(" ")}
            aria-pressed={option.selected}
            disabled={interactionDisabled}
            onClick={() => onSelectOption(option.id)}
          >
            <span className="block text-sm font-semibold leading-5">{option.label}</span>
            {option.reason ? (
              <span className={option.selected ? "mt-2 block text-xs leading-5 text-slate-200" : "mt-2 block text-xs leading-5 text-slate-500"}>
                {option.reason}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        {onBack ? (
          <button
            type="button"
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={interactionDisabled}
            onClick={onBack}
          >
            Voltar
          </button>
        ) : (
          <span aria-hidden="true" />
        )}

        <button
          type="button"
          className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
          disabled={nextDisabled}
          onClick={handleNext}
        >
          {loading ? "Avançando..." : viewModel.nextLabel}
        </button>
      </div>
    </section>
  );
}
