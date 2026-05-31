"use client";

import { useState } from "react";
import type { ConfirmationResponse } from "./diagnosticoConfirmationTypes";

interface Props {
  /** Short question shown above the buttons. */
  question?: string;
  onConfirm: (response: ConfirmationResponse) => void;
}

/**
 * A calm, minimal confirmation bar used at the bottom of narrative map cards.
 *
 * Shows three options — "Sim", "Quase", "Não é isso" — and calls onConfirm
 * with the creator's response. Buttons use e.stopPropagation() so they don't
 * accidentally trigger parent card click handlers (expand/collapse toggles).
 */
export function DiagnosticoConfirmationRow({
  question = "Faz parte do seu mapa?",
  onConfirm,
}: Props) {
  const [activePrompt, setActivePrompt] = useState<"almost" | "no" | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="mt-3 pt-3 border-t border-zinc-100">
        <p className="text-[12px] font-medium text-zinc-600">
          Entendido. Vamos recalibrar seu mapa a partir disso.
        </p>
      </div>
    );
  }

  if (activePrompt) {
    return (
      <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-col gap-3">
        <p className="text-[12px] font-semibold text-zinc-800">
          O que ficou fora?
        </p>
        <div className="flex flex-wrap gap-2">
          {["Tema", "Tom", "Intenção", "Meu momento de vida"].map((opt) => (
             <button
               key={opt}
               type="button"
               onClick={(e) => { e.stopPropagation(); setSelectedOption(opt); }}
               className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                 selectedOption === opt 
                   ? "bg-amber-100 text-amber-800" 
                   : "bg-zinc-100 text-zinc-600 active:bg-zinc-200"
               }`}
             >
               {opt}
             </button>
          ))}
        </div>
        <input 
          type="text" 
          placeholder="Escreva em uma frase (opcional)"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-[12px] text-zinc-800 placeholder:text-zinc-400 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
        />
        <button
          type="button"
          disabled={!selectedOption && !textValue.trim()}
          onClick={(e) => {
            e.stopPropagation();
            setSubmitted(true);
            setTimeout(() => {
              onConfirm(activePrompt);
            }, 1500);
          }}
          className="self-end rounded-full bg-zinc-900 px-4 py-1.5 text-[12px] font-semibold text-white transition-opacity disabled:opacity-30 active:bg-zinc-700"
        >
          Enviar
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100 flex flex-col gap-2.5">
      {/* Sentence case + neutral color — distinct from ALL CAPS category headers */}
      <p className="text-[13px] font-medium text-zinc-500">
        {question}
      </p>
      <div className="flex gap-2">
        {/* Primary: solid dark — clearly the "yes" action */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onConfirm("yes");
          }}
          className="rounded-full bg-zinc-900 px-4 py-2 text-[12px] font-semibold text-white transition-opacity active:opacity-70"
        >
          Sim
        </button>
        {/* Secondary: outlined — visible but not dominant */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActivePrompt("almost");
          }}
          className="rounded-full border border-zinc-300 bg-white px-4 py-2 text-[12px] font-semibold text-zinc-700 transition-colors active:bg-zinc-50"
        >
          Quase
        </button>
        {/* Tertiary: ghost — least important option */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setActivePrompt("no");
          }}
          className="rounded-full bg-zinc-100 px-4 py-2 text-[12px] font-semibold text-zinc-500 transition-colors active:bg-zinc-200"
        >
          Não é isso
        </button>
      </div>
    </div>
  );
}

/** Confirmed state badge — shown in place of the row after the creator responds "yes". */
export function DiagnosticoConfirmedBadge() {
  return (
    <div className="mt-3 pt-3 border-t border-zinc-100">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1.5 text-[11px] font-semibold text-teal-700">
        <span aria-hidden="true">✓</span> No seu mapa
      </span>
    </div>
  );
}
