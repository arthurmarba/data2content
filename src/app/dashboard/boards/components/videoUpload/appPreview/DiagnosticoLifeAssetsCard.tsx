"use client";

import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { HC, CARD_P } from "./diagnosticoTokens";
import type { CreatorStrategicProfileSynthesisSignal } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";

interface Props {
  confirmedLifeAssets: CreatorStrategicProfileSynthesisSignal[];
  topPerformingPattern: string | null;
}

/**
 * Surfaces the creator's "life fingerprint" — contextual signals accumulated
 * across all readings: setting, social presence, emotional register, production
 * style, and explicit life signals detected by the AI.
 *
 * Confirmed = appeared in 2+ readings (consistent pattern).
 * Emerging  = appeared in 1 reading (under observation).
 */
export function DiagnosticoLifeAssetsCard({ confirmedLifeAssets, topPerformingPattern }: Props) {
  if (confirmedLifeAssets.length === 0) return null;

  const confirmed = confirmedLifeAssets.filter((a) => a.evidenceCount >= 2);
  const emerging = confirmedLifeAssets.filter((a) => a.evidenceCount === 1);

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.pattern.bg}
          iconSlot={<LifeIcon />}
          category="Impressão Digital"
          catColor={HC.pattern.text}
        />

        {confirmed.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[1px] text-zinc-400">
              Confirmados em múltiplas leituras
            </p>
            <div className="flex flex-wrap gap-1.5">
              {confirmed.map((asset) => (
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

        {emerging.length > 0 && (
          <div className={confirmed.length > 0 ? "mt-3" : ""}>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[1px] text-zinc-400">
              Em observação
            </p>
            <div className="flex flex-wrap gap-1.5">
              {emerging.map((asset) => (
                <span
                  key={asset.label}
                  className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-1 text-[12px] font-medium text-zinc-500"
                >
                  {asset.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {topPerformingPattern && confirmed.length > 0 && (
          <p className="mt-4 text-[12px] leading-snug text-zinc-400">
            <span className="font-semibold text-teal-600">{topPerformingPattern}</span>
            {" "}é o sinal que aparece com mais frequência nas análises
          </p>
        )}

        <p className={`text-[12px] font-medium leading-snug text-zinc-400 ${topPerformingPattern && confirmed.length > 0 ? "mt-1" : "mt-4"}`}>
          Atributos de vida e contexto observados pela D2C
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function LifeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="7" r="3.5" stroke="white" strokeWidth="1.8" />
      <path d="M5 20.5c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
