"use client";

import { useEffect, useState } from "react";
import { DiagnosticoCardShell } from "./DiagnosticoCardShell";
import { HC, CARD_P } from "./diagnosticoTokens";
import { refineDiagnosticoSignals } from "./diagnosticoDisplayText";

interface Signal { label: string; summary: string; evidenceCount: number }

interface Props {
  hypotheses: Signal[];
  /** Labels already endorsed by the creator — pre-loaded from mapConfirmations. */
  endorsedHypotheses?: string[];
  /** Labels the creator rejected ("Não faz sentido") — never shown here. */
  dismissedHypotheses?: string[];
}

export function DiagnosticoHypothesesCard({ hypotheses, endorsedHypotheses = [], dismissedHypotheses = [] }: Props) {
  // A rejected hypothesis is a settled decision — keep it out of "EM OBSERVAÇÃO"
  // so it never re-surfaces here after the creator dismissed it on the map card.
  const dismissedSet = new Set(dismissedHypotheses.map((l) => l.trim().toLowerCase()));
  const visibleHypotheses = hypotheses.filter((h) => !dismissedSet.has(h.label.trim().toLowerCase()));
  const refinedHypotheses = refineDiagnosticoSignals(visibleHypotheses, "hypothesis");
  const endorsedHypothesesKey = endorsedHypotheses.join("\u0000");
  const [endorsed, setEndorsed] = useState<Set<string>>(new Set(endorsedHypotheses));
  const [pending, setPending] = useState<Set<string>>(new Set());

  useEffect(() => {
    setEndorsed(new Set(endorsedHypotheses));
  }, [endorsedHypothesesKey]);

  if (refinedHypotheses.length === 0) return null;

  async function handleEndorse(label: string) {
    if (endorsed.has(label) || pending.has(label)) return;
    setPending((p) => new Set(p).add(label));
    try {
      const response = await fetch("/api/dashboard/mobile-strategic-profile/map/endorse-hypothesis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!response.ok) throw new Error("hypothesis_endorse_failed");
      setEndorsed((e) => new Set(e).add(label));
    } catch {
      // non-fatal
    } finally {
      setPending((p) => { const n = new Set(p); n.delete(label); return n; });
    }
  }

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <div className="mb-4 flex items-center gap-2.5">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${HC.hypothesis.bg} shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)]`}
            aria-hidden="true"
          >
            <HypothesisIcon />
          </div>
          <span className={`min-w-0 truncate text-[15.5px] font-bold leading-none ${HC.hypothesis.text}`}>
            EM OBSERVAÇÃO
          </span>
          <span className="ml-auto rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600">
            {refinedHypotheses.length} em teste
          </span>
        </div>
        <ul className="flex flex-col">
          {refinedHypotheses.map((h, i) => {
            const isEndorsed = endorsed.has(h.label);
            const isPending = pending.has(h.label);
            return (
              <li
                key={h.label}
                className={`py-3 ${i < refinedHypotheses.length - 1 ? "border-b border-zinc-50" : ""}`}
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-zinc-900 leading-snug">{h.label}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-zinc-400">
                        {h.evidenceCount} {h.evidenceCount === 1 ? "sinal" : "sinais"}
                      </span>
                      {isEndorsed ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 px-2.5 py-1 text-[11px] font-semibold text-white">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Confirmado
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleEndorse(h.label)}
                          className="rounded-full bg-zinc-900 px-3 py-1.5 text-[12px] font-semibold text-white transition-opacity active:opacity-70 disabled:opacity-40"
                        >
                          {isPending ? "Salvando…" : "Faz sentido para mim"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </DiagnosticoCardShell>
  );
}

function HypothesisIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
