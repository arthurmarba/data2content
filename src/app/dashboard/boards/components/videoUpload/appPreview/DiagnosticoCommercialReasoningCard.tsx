"use client";

import { useState } from "react";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { HC, CARD_P, CARD_BODY } from "./diagnosticoTokens";
import type { CreatorStrategicProfileCommercialReasoning } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { refineDiagnosticoSignals } from "./diagnosticoDisplayText";

interface Props {
  reasoning: CreatorStrategicProfileCommercialReasoning[];
}

export function DiagnosticoCommercialReasoningCard({ reasoning }: Props) {
  const [expanded, setExpanded] = useState(false);
  const refinedReasoning = refineDiagnosticoSignals(reasoning, "commercial");
  if (refinedReasoning.length === 0) return null;

  // The top reasoning is shown as the headline (truncated)
  const top = refinedReasoning[0];
  if (!top) return null;

  return (
    <DiagnosticoCardShell onClick={() => setExpanded((v) => !v)}>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.reasoning.bg}
          iconSlot={<ReasoningIcon />}
          category="POR QUE MARCAS SE INTERESSARIAM"
          catColor={HC.reasoning.text}
        />

        <p className="text-[15px] font-semibold text-zinc-900 leading-snug line-clamp-3">
          {top.label}
        </p>
        <p className="mt-1.5 text-[11px] font-semibold text-rose-500">
          {refinedReasoning.length} {refinedReasoning.length === 1 ? "ângulo" : "ângulos"} detectado{refinedReasoning.length === 1 ? "" : "s"}
        </p>

        {/* Expandable */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? "max-h-[600px]" : "max-h-0"
          }`}
        >
          <div className="mt-3 flex flex-col gap-3 border-t border-zinc-50 pt-3">
            {refinedReasoning.map((r, i) => (
              <div key={i}>
                <p className="text-[11px] font-semibold text-zinc-400 mb-0.5">
                  Ângulo {i + 1} · {r.evidenceCount} {r.evidenceCount === 1 ? "leitura" : "leituras"}
                </p>
                <p className={CARD_BODY}>{r.summary}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Toggle */}
        <p className="mt-2.5 text-right text-[12px] font-medium text-zinc-400">
          {expanded ? "Ver menos ↑" : "Ver todos os ângulos ↓"}
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function ReasoningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
