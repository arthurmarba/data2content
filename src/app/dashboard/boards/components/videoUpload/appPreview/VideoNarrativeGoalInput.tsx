"use client";

import { useState } from "react";
import { sanitizeVideoNarrativeInteractivePreviewText } from "./useVideoNarrativeInteractivePreviewState";

type VideoNarrativeGoalInputProps = {
  initialValue?: string;
  onSubmit: (goal: string) => void;
};

const QUICK_PROMPTS = [
  "Vale postar?",
  "Melhorar gancho",
  "Virar publi",
  "Entender narrativa",
  "Encontrar marcas",
  "Criar próximos conteúdos",
];

export function VideoNarrativeGoalInput({ initialValue = "", onSubmit }: VideoNarrativeGoalInputProps) {
  const [value, setValue] = useState(() => sanitizeVideoNarrativeInteractivePreviewText(initialValue));
  const safeValue = sanitizeVideoNarrativeInteractivePreviewText(value);

  function updateValue(nextValue: string) {
    setValue(sanitizeVideoNarrativeInteractivePreviewText(nextValue));
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!safeValue) return;
        onSubmit(safeValue);
      }}
    >
      <label className="grid gap-2">
        <span className="text-sm font-semibold text-zinc-900">Sua dúvida ou objetivo</span>
        <textarea
          value={value}
          onChange={(event) => updateValue(event.currentTarget.value)}
          rows={4}
          placeholder="Ex: quero saber se vale postar, se o gancho está bom ou se pode virar publi."
          className="min-h-32 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-950 outline-none transition focus:border-zinc-500"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => updateValue(prompt)}
            className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-100"
          >
            {prompt}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={!safeValue}
        className="inline-flex w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        Continuar
      </button>
    </form>
  );
}
