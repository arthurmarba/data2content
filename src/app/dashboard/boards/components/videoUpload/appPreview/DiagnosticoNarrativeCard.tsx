"use client";

import { useState } from "react";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { DiagnosticoConfidenceDots } from "./DiagnosticoConfidenceDots";
import { HC, CARD_P, CARD_METRIC, CARD_BODY } from "./diagnosticoTokens";
import { refineDiagnosticoSignal } from "./diagnosticoDisplayText";
import {
  DiagnosticoConfirmationRow,
  DiagnosticoConfirmedBadge,
} from "./DiagnosticoConfirmationRow";
import type {
  ConfirmationState,
  ConfirmationResponse,
} from "./diagnosticoConfirmationTypes";

interface Props {
  label: string;
  summary: string;
  confidence: "low" | "medium" | "high";
  evidenceCount: number;
  igEnriched?: boolean;
  timestamp?: string | null;
  /** Whether the creator has responded to this narrative signal. */
  narrativeConfirmationState?: ConfirmationState;
  /** Called when the creator taps a confirmation option. */
  onConfirmNarrative?: (response: ConfirmationResponse) => void;
}

export function DiagnosticoNarrativeCard({
  label,
  summary,
  confidence,
  evidenceCount,
  igEnriched,
  timestamp,
  narrativeConfirmationState,
  onConfirmNarrative,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const copy = refineDiagnosticoSignal({ label, summary, evidenceCount }, "narrative");
  const toggleExpanded = () => setExpanded((v) => !v);

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <button
          type="button"
          onClick={toggleExpanded}
          className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          <DiagCardHeader
            iconBg={HC.narrative.bg}
            iconSlot={<NarrativeIcon />}
            category="SUA NARRATIVA"
            catColor={HC.narrative.text}
            timestamp={timestamp}
          />

          {/* Always-visible metric */}
          <p className={CARD_METRIC}>{copy.label}</p>
        </button>

        {/* Expandable analysis — hidden by default */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? "max-h-[32rem]" : "max-h-0"
          }`}
        >
          <div className="mt-3 flex flex-col gap-2.5">
            <DiagnosticoConfidenceDots confidence={confidence} evidenceCount={evidenceCount} />
            {igEnriched && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-600 self-start">
                ◉ Enriquecido com Instagram
              </span>
            )}
            <p className={CARD_BODY}>{copy.summary}</p>

            {/* Confirmation row — only while pending */}
            {narrativeConfirmationState === "pending" && onConfirmNarrative && (
              <DiagnosticoConfirmationRow onConfirm={onConfirmNarrative} />
            )}
            {narrativeConfirmationState === "confirmed" && (
              <DiagnosticoConfirmedBadge />
            )}
          </div>
        </div>

        {/* Toggle cue */}
        <button
          type="button"
          onClick={toggleExpanded}
          className="mt-2.5 block w-full text-right text-[12px] font-medium text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        >
          {expanded ? "Ver menos ↑" : "Ver análise ↓"}
        </button>
      </div>
    </DiagnosticoCardShell>
  );
}

function NarrativeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" />
      <circle cx="12" cy="12" r="4" fill="white" />
    </svg>
  );
}
