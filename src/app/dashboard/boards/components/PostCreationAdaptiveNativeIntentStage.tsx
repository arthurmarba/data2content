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
  "Quero validar uma pauta",
  "Não sei o que postar essa semana",
  "Quero atrair marcas",
  "Quero transformar um comentário em post",
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
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Primeira decisão</p>
        <div>
          <h2 className="text-xl font-semibold leading-tight text-slate-950">
            O que você quer criar, validar ou resolver hoje?
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Escreva uma pauta, objetivo, dúvida, comentário da audiência, marca ou collab. A partir disso, eu monto
            o caminho estratégico.
          </p>
        </div>
      </div>

      <div className="mt-5">
        <textarea
          aria-label="Intenção estratégica"
          className="min-h-36 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
          disabled={isInputDisabled}
          placeholder="Ex.: quero transformar um comentário recorrente em um post com mais chance de salvar e comentar..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((example) => (
          <button
            key={example}
            type="button"
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isInputDisabled}
            onClick={() => onChange(example)}
          >
            {example}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          className="rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-white"
          disabled={submitDisabled}
          onClick={handleSubmit}
        >
          {loading ? "Lendo sua intenção..." : "Começar estratégia"}
        </button>
      </div>
    </section>
  );
}
