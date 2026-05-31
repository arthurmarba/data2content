"use client";

import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { HC, CARD_P } from "./diagnosticoTokens";
import type { CreatorStrategicProfileSynthesisSignal } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import {
  DiagnosticoConfirmationRow,
  DiagnosticoConfirmedBadge,
} from "./DiagnosticoConfirmationRow";
import type {
  ConfirmationState,
  ConfirmationResponse,
  AssetConfirmationResponse,
} from "./diagnosticoConfirmationTypes";

interface Props {
  dominantTone: string | null;
  toneSignals: CreatorStrategicProfileSynthesisSignal[];
  confirmedLifeAssets: CreatorStrategicProfileSynthesisSignal[];
  topPerformingPattern: string | null;
  /** Whether the creator has responded to the dominant tone signal. */
  toneConfirmationState?: ConfirmationState;
  onConfirmTone?: (response: ConfirmationResponse) => void;
  /** Called when the creator responds to an individual emerging asset chip. */
  onConfirmAsset?: (assetLabel: string, response: AssetConfirmationResponse) => void;
  /** Current per-asset confirmation states from the shell — used to hide already-decided chips. */
  assetConfirmations?: Map<string, "confirmed" | "dismissed">;
}

export function DiagnosticoToneCard({ dominantTone, toneSignals, confirmedLifeAssets, toneConfirmationState, onConfirmTone }: Props) {
  const hasTone = dominantTone || toneSignals.length > 0;
  // Only show assets seen 2+ times — single-occurrence signals are noise at this stage
  const confirmedAssets = confirmedLifeAssets.filter((a) => a.evidenceCount >= 2);
  const hasConfirmedAssets = confirmedAssets.length > 0;
  if (!hasTone && !hasConfirmedAssets) return null;

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.pattern.bg}
          iconSlot={<ToneIcon />}
          category="COMO VOCÊ SE COMUNICA"
          catColor={HC.pattern.text}
        />

        {/* ── Bloco 1: Tom narrativo ─────────────────────────────────────── */}
        {hasTone && (
          <div className="mt-3">
            <p className="text-[10px] font-bold uppercase tracking-[1px] text-zinc-400 mb-2">
              Tom dominante
            </p>
            <div className="flex flex-wrap gap-1.5">
              {dominantTone && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-3 py-1.5 text-[13px] font-semibold text-teal-700">
                  {dominantTone}
                  {toneSignals[0] && (
                    <span className="text-[10px] font-bold text-teal-400">{toneSignals[0].evidenceCount}×</span>
                  )}
                </span>
              )}
              {toneSignals.slice(1).map((t) => (
                <span
                  key={t.label}
                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-500"
                >
                  {t.label}
                  <span className="text-[10px] font-bold text-zinc-400">{t.evidenceCount}×</span>
                </span>
              ))}
            </div>

            {/* Tone confirmation — shown while pending */}
            {toneConfirmationState === "pending" && onConfirmTone && (
              <DiagnosticoConfirmationRow
                question="Esse é o seu tom?"
                onConfirm={onConfirmTone}
              />
            )}
            {toneConfirmationState === "confirmed" && (
              <DiagnosticoConfirmedBadge />
            )}
          </div>
        )}

        {/* ── Bloco 2: De onde você cria (assets de vida confirmados) ─────── */}
        {confirmedAssets.length > 0 && (
          <div className={hasTone ? "mt-5 pt-4 border-t border-zinc-100" : "mt-3"}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[1px] text-zinc-400">
              De onde você cria
            </p>
            <div className="flex flex-wrap gap-1.5">
              {confirmedAssets.map((asset) => (
                <span
                  key={asset.label}
                  className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-1 text-[12px] font-medium text-teal-700"
                >
                  {asset.label}
                  <span className="text-[10px] font-bold text-teal-400">{asset.evidenceCount}×</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </DiagnosticoCardShell>
  );
}

function ToneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 0 18A9 9 0 0 0 12 3z" stroke="white" strokeWidth="1.8" />
      <path d="M8 12s1.5 2 4 2 4-2 4-2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9" y1="9" x2="9.01" y2="9" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="15" y1="9" x2="15.01" y2="9" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
