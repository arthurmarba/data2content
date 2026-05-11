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
  const hasLockedAnswer = Boolean(viewModel.selectedOptionId);
  const progressPercent = `${Math.round(viewModel.progressValue * 100)}%`;
  const shouldShowFeedback = viewModel.shouldRevealFeedback && viewModel.selectedIsCorrect !== null;
  const feedbackTitle =
    viewModel.feedbackTitle || (viewModel.selectedIsCorrect ? "Boa aposta" : "Quase");
  const feedbackMessage =
    viewModel.feedbackMessage
    || (viewModel.selectedIsCorrect
      ? "Esse caminho está bem alinhado com a estratégia dessa pauta."
      : "Essa opção pode funcionar, mas eu iria por outro caminho para essa pauta.");

  function handleNext() {
    if (nextDisabled) return;
    onNext();
  }

  function handleSelectOption(optionId: string) {
    if (interactionDisabled || hasLockedAnswer) return;
    onSelectOption(optionId);
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-white/90 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fc_100%)] p-4 text-zinc-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.98),0_24px_70px_rgba(15,23,42,0.06)] sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(247,248,252,0)_100%)]" />
      <div className="relative">
        <div className="space-y-3.5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-zinc-400">{viewModel.visualStep}</p>
              <p className="mt-1 text-[13px] font-medium leading-5 text-zinc-500">
                Tente acertar o caminho mais forte para essa pauta.
              </p>
            </div>
            <p className="inline-flex w-fit shrink-0 rounded-full border border-zinc-200/80 bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-zinc-600 shadow-[0_6px_16px_rgba(15,23,42,0.03)]">
              {viewModel.progressLabel}
            </p>
          </div>
          <div
            className="h-1.5 overflow-hidden rounded-full bg-zinc-100/80 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
            role="progressbar"
            aria-label={viewModel.progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(viewModel.progressValue * 100)}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#38bdf8] via-[#60a5fa] to-[#818cf8] shadow-[0_0_8px_rgba(56,189,248,0.34)] transition-[width] duration-500 ease-out"
              style={{ width: progressPercent }}
            />
          </div>
        </div>

        <div className="mt-6 sm:mt-7">
          <h2 className="max-w-[15ch] text-[1.9rem] font-semibold leading-[1.02] tracking-[-0.045em] text-zinc-950 sm:max-w-[18ch] sm:text-[2.28rem]">
            {viewModel.title}
          </h2>
          {viewModel.helper ? (
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-zinc-500 sm:text-[15px]">
              {viewModel.helper}
            </p>
          ) : null}
        </div>

        <div className="mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2">
          {viewModel.options.map((option, optionIndex) => {
            const isLockedUnselected = hasLockedAnswer && !option.selected;

            return (
              <button
                key={option.id}
                type="button"
                className={[
                  "group relative min-h-28 overflow-hidden rounded-[22px] border px-4 py-3.5 text-left outline-none transition-all duration-300 ease-out active:scale-[0.985] focus-visible:ring-2 focus-visible:ring-sky-300/60 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed sm:min-h-32",
                  option.selected
                    ? "border-sky-200 bg-white ring-1 ring-sky-100/80 shadow-[0_14px_34px_rgba(56,189,248,0.08)]"
                    : isLockedUnselected
                      ? "border-zinc-200/70 bg-zinc-50/75 text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                      : "border-zinc-200/80 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.025)] hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_18px_34px_rgba(15,23,42,0.07)]",
                ].join(" ")}
                aria-pressed={option.selected}
                aria-disabled={hasLockedAnswer || interactionDisabled}
                disabled={hasLockedAnswer || interactionDisabled}
                onClick={() => handleSelectOption(option.id)}
              >
                {option.selected ? (
                  <span className="pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full bg-sky-400/80" />
                ) : null}
                <span
                  className={[
                    "pointer-events-none absolute inset-0 transition duration-500",
                    option.selected
                      ? "bg-[linear-gradient(180deg,rgba(240,249,255,0.58)_0%,rgba(255,255,255,0.08)_100%)] opacity-100"
                      : "opacity-0",
                  ].join(" ")}
                />
                <span className="relative flex h-full flex-col gap-3">
                  <span className="flex items-start justify-between gap-3">
                    <span
                      className={[
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition",
                        isLockedUnselected
                          ? "border-zinc-200/70 bg-white/70 text-zinc-400"
                          : "border-zinc-100 bg-zinc-50 text-zinc-500 group-hover:bg-white",
                      ].join(" ")}
                    >
                      {String(optionIndex + 1).padStart(2, "0")}
                    </span>
                    {viewModel.shouldRevealFeedback && option.isIncorrectSelection ? (
                      <span className="shrink-0 rounded-full border border-zinc-200/80 bg-white/85 px-2 py-1 text-[10px] font-semibold text-zinc-500 shadow-[0_4px_10px_rgba(15,23,42,0.03)]">
                        Sua aposta
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={[
                      "block text-[0.98rem] font-semibold leading-[1.16] tracking-[-0.025em]",
                      isLockedUnselected ? "text-zinc-500" : "text-zinc-950",
                    ].join(" ")}
                  >
                    {option.label}
                  </span>
                  {option.reason ? (
                    <span
                      className={[
                        "mt-auto block border-t border-zinc-100/80 pt-3 text-xs font-medium leading-5",
                        isLockedUnselected ? "text-zinc-400" : "text-zinc-500",
                      ].join(" ")}
                    >
                      {option.reason}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>

        {shouldShowFeedback ? (
          <div
            className="mt-5 overflow-hidden rounded-[24px] border border-white/90 bg-white/92 shadow-[0_18px_45px_rgba(15,23,42,0.055)] sm:mt-6"
            role="status"
            aria-live="polite"
          >
            <div className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] sm:p-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-zinc-400">
                  {viewModel.selectedIsCorrect ? "Caminho estratégico" : "Ajuste fino"}
                </p>
                <p className="mt-1.5 text-base font-semibold tracking-[-0.025em] text-zinc-950">{feedbackTitle}</p>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{feedbackMessage}</p>
                {viewModel.feedbackRationale ? (
                  <p className="mt-3 rounded-[16px] border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-xs font-medium leading-5 text-zinc-500">
                    {viewModel.feedbackRationale}
                  </p>
                ) : null}
                {viewModel.feedbackMode === "correct" && viewModel.correctReason ? (
                  <div className="mt-3 rounded-[16px] border border-sky-100 bg-sky-50/45 px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-sky-700">Por que essa resposta venceu</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-zinc-600">{viewModel.correctReason}</p>
                  </div>
                ) : null}
                {viewModel.feedbackMode === "incorrect" && viewModel.selectedIncorrectReason ? (
                  <div className="mt-3 rounded-[16px] border border-zinc-100 bg-zinc-50/80 px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-zinc-600">Por que sua aposta perdeu força</p>
                    <p className="mt-1 text-xs font-medium leading-5 text-zinc-500">
                      {viewModel.selectedIncorrectReason}
                    </p>
                  </div>
                ) : null}
                {viewModel.feedbackMode === "incorrect" && (viewModel.correctOptionLabel || viewModel.correctReason) ? (
                  <div className="mt-3 rounded-[16px] border border-sky-100 bg-sky-50/45 px-3 py-2.5">
                    <p className="text-[11px] font-semibold text-sky-700">Resposta mais forte</p>
                    {viewModel.correctOptionLabel ? (
                      <p className="mt-1 text-sm font-semibold leading-5 text-zinc-950">{viewModel.correctOptionLabel}</p>
                    ) : null}
                    {viewModel.correctReason ? (
                      <p className="mt-1.5 text-xs font-medium leading-5 text-zinc-600">{viewModel.correctReason}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {viewModel.feedbackEvidence.length > 0 ? (
                <div className="rounded-[18px] border border-zinc-200/70 bg-zinc-50/92 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.96)]">
                  <p className="text-[11px] font-semibold text-zinc-500">Base da análise</p>
                  <ul className="mt-2.5 flex flex-wrap gap-2 text-xs font-medium leading-5 text-zinc-600">
                    {viewModel.feedbackEvidence.map((item) => (
                      <li
                        key={item}
                        className="rounded-full border border-white bg-white px-2.5 py-1 shadow-[0_3px_10px_rgba(15,23,42,0.03)]"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 pb-1 sm:flex-row sm:items-center sm:justify-between sm:pb-0">
          {onBack ? (
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center rounded-full border border-zinc-200/80 bg-white px-5 text-sm font-semibold text-zinc-700 shadow-[0_8px_20px_rgba(15,23,42,0.035)] transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-60"
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
            className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_16px_28px_rgba(15,23,42,0.16)] transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-white sm:min-w-40"
            disabled={nextDisabled}
            onClick={handleNext}
          >
            {loading ? "Avançando..." : viewModel.nextLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
