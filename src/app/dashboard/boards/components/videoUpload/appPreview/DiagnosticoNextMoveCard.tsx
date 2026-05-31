"use client";

import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { HC, CARD_P, CARD_METRIC } from "./diagnosticoTokens";
import { refineDiagnosticoNextMove } from "./diagnosticoDisplayText";

interface Props {
  label: string;
  description: string;
  reason?: string | null;
  successSignal?: string | null;
}

export function DiagnosticoNextMoveCard({ label, description, successSignal }: Props) {
  const copy = refineDiagnosticoNextMove({ label, description, reason: successSignal });

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.nextMove.bg}
          iconSlot={<NextMoveIcon />}
          category="Foco agora"
          catColor={HC.nextMove.text}
        />

        <p className={CARD_METRIC}>{copy.label}</p>
        <p className="mt-2 text-[16px] font-semibold leading-snug text-zinc-500">
          {copy.description}
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function NextMoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
