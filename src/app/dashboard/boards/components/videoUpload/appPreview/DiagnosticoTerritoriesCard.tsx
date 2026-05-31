"use client";

import { DiagnosticoListCard } from "./DiagnosticoListCard";
import { HC } from "./diagnosticoTokens";
import { refineDiagnosticoSignals } from "./diagnosticoDisplayText";
import {
  DiagnosticoConfirmationRow,
  DiagnosticoConfirmedBadge,
} from "./DiagnosticoConfirmationRow";
import type {
  ConfirmationState,
  ConfirmationResponse,
} from "./diagnosticoConfirmationTypes";

interface Signal { label: string; summary: string; evidenceCount: number }

interface Props {
  territories: Signal[];
  territoriesConfirmationState?: ConfirmationState;
  onConfirmTerritories?: (response: ConfirmationResponse) => void;
}

export function DiagnosticoTerritoriesCard({ territories, territoriesConfirmationState, onConfirmTerritories }: Props) {
  const refined = refineDiagnosticoSignals(territories, "pattern", 4);
  if (refined.length === 0) return null;

  const confirmationFooter =
    territoriesConfirmationState === "pending" && onConfirmTerritories ? (
      <DiagnosticoConfirmationRow
        question="Esses são seus territórios?"
        onConfirm={onConfirmTerritories}
      />
    ) : territoriesConfirmationState === "confirmed" ? (
      <DiagnosticoConfirmedBadge />
    ) : null;

  return (
    <DiagnosticoListCard
      iconBg={HC.territory.bg}
      iconSlot={<TerritoriesIcon />}
      category="TERRITÓRIOS"
      catColor={HC.territory.text}
      badge={`${refined.length} identificado${refined.length !== 1 ? "s" : ""}`}
      items={refined.map((t) => ({ text: t.label, summary: t.summary, count: t.evidenceCount, dot: "bg-purple-400" }))}
      emptyText="Territórios surgem após mais leituras com o mesmo eixo."
      footer={confirmationFooter}
    />
  );
}

function TerritoriesIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="9" r="2.5" stroke="white" strokeWidth="1.8" />
    </svg>
  );
}
