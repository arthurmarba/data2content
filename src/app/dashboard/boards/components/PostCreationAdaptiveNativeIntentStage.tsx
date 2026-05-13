"use client";

import type { KeyboardEvent } from "react";

export type PostCreationAdaptiveNativeIntentStageProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  canSubmit?: boolean;
  error?: string | null;
  examples?: string[];
};

const DEFAULT_EXAMPLES = [
  "Tenho uma pauta e quero validar",
  "Não sei o que postar essa semana",
  "Quero saber qual formato usar",
  "Quero transformar um comentário em post",
  "Quero abrir espaço para marcas",
  "Quero uma ideia de collab",
];

export default function PostCreationAdaptiveNativeIntentStage({
  value,
  onChange,
  onSubmit,
  loading = false,
  disabled = false,
  canSubmit = true,
  error = null,
  examples = DEFAULT_EXAMPLES,
}: PostCreationAdaptiveNativeIntentStageProps) {
  const isInputDisabled = disabled || loading;
  const submitDisabled = isInputDisabled || !canSubmit;

  function handleSubmit() {
    if (submitDisabled) return;
    onSubmit();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || (!event.metaKey && !event.ctrlKey) || submitDisabled) return;

    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:px-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">IA estratégica da D2C</p>
        <h2 className="mt-2 text-2xl font-semibold leading-tight text-slate-950 sm:text-3xl">
          Transforme sua dúvida em direção estratégica
        </h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
          Escreva uma ideia, dúvida ou objetivo. A D2C cruza seu relato com os sinais do seu Instagram e conduz uma rodada
          de decisões para encontrar o caminho mais coerente.
        </p>
      </div>

      <div className="space-y-5 p-4 sm:p-6">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-500">Pode escrever do seu jeito. Conte o que você está tentando resolver agora.</p>
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_40px_rgba(15,23,42,0.06)] transition focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-200">
            <textarea
              aria-label="Intenção estratégica"
              className="min-h-[7.5rem] w-full resize-y border-0 bg-transparent px-1 py-1 text-sm leading-6 text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:text-slate-500 sm:min-h-36"
              disabled={isInputDisabled}
              placeholder="Ex.: quero validar uma pauta sobre minha rotina, entender qual formato usar, transformar um comentário em post ou descobrir o que postar essa semana..."
              value={value}
              onChange={(event) => onChange(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <div className="mt-3 flex min-w-0 flex-col gap-3 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="min-w-0 text-xs leading-5 text-slate-500">
                A análise usa sinais do seu conteúdo, como formatos, narrativas, horários e posts de referência.
              </p>
              <button
                type="button"
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white sm:w-auto sm:shrink-0"
                disabled={submitDisabled}
                onClick={handleSubmit}
              >
                {loading ? "Preparando sua análise..." : "Começar minha análise estratégica"}
              </button>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Comece por aqui</p>
          <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-left text-xs font-semibold leading-5 text-slate-700 transition hover:border-slate-300 hover:bg-white hover:text-slate-950 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isInputDisabled}
                onClick={() => onChange(example)}
              >
                <span className="break-words">{example}</span>
              </button>
            ))}
          </div>
        </div>

        {error ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
