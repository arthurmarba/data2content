"use client";

import type { KeyboardEvent } from "react";

export type PostCreationIntentComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  disabled?: boolean;
  canSubmit?: boolean;
  error?: string | null;
};

const INTENT_EXAMPLES = [
  "Quero validar uma pauta",
  "Não sei o que postar",
  "Quero atrair uma marca",
  "Quero transformar um comentário em post",
];

export default function PostCreationIntentComposer({
  value,
  onChange,
  onSubmit,
  loading = false,
  disabled = false,
  canSubmit = true,
  error = null,
}: PostCreationIntentComposerProps) {
  const submitDisabled = disabled || !canSubmit || loading;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !submitDisabled) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-600">Estratégia adaptativa</p>
        <div>
          <h2 className="text-xl font-semibold text-slate-950">
            O que você quer criar, validar ou resolver hoje?
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Escreva uma ideia, objetivo, dúvida, comentário da audiência, marca ou collab.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <textarea
          className="min-h-32 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:bg-slate-50"
          disabled={disabled || loading}
          placeholder="Ex.: Quero gravar um POV sobre minha família fazendo barulho..."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {INTENT_EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || loading}
            onClick={() => onChange(example)}
          >
            {example}
          </button>
        ))}
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="mt-4 flex justify-end">
        <button
          type="button"
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={submitDisabled}
          onClick={onSubmit}
        >
          {loading ? "Analisando..." : "Transformar em estratégia"}
        </button>
      </div>
    </section>
  );
}
