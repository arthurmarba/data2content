"use client";

import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { CARD_P } from "./diagnosticoTokens";

interface Props {
  analyzedReadingsCount: number;
  mainNarrativeLabel: string | null;
  nextMoveLabel: string | null;
  confidence?: "low" | "medium" | "high" | null;
  evidenceCount?: number | null;
}

/** Apple Health-style "Summary" tile — TL;DR de toda a página */
export function DiagnosticoExecutiveSummaryCard({
  analyzedReadingsCount,
  mainNarrativeLabel,
  nextMoveLabel,
  confidence,
  evidenceCount,
}: Props) {
  const confidenceLabel = confidenceText(confidence);
  const narrativeMeta =
    mainNarrativeLabel && confidenceLabel
      ? `${confidenceLabel}${evidenceCount ? ` · ${evidenceCount} ${evidenceCount === 1 ? "sinal" : "sinais"}` : ""}`
      : null;

  return (
    <DiagnosticoCardShell>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg="bg-zinc-800"
          iconSlot={<SummaryIcon />}
          category="RESUMO"
          catColor="text-zinc-700"
        />

        <div className="flex flex-col gap-3">
          {/* Reading count */}
          <SummaryRow
            label="Análises"
            value={`${analyzedReadingsCount} ${analyzedReadingsCount === 1 ? "vídeo analisado" : "vídeos analisados"}`}
          />

          {/* Main narrative */}
          {mainNarrativeLabel ? (
            <SummaryRow
              label="Sua narrativa"
              value={mainNarrativeLabel}
              accent="text-orange-600"
              meta={narrativeMeta}
            />
          ) : (
            <SummaryRow
              label="Sua narrativa"
              value="Em formação — analise mais vídeos"
              accent="text-zinc-400"
            />
          )}

          {/* Next move */}
          {nextMoveLabel && (
            <SummaryRow label="Foco agora" value={nextMoveLabel} accent="text-emerald-700" />
          )}
        </div>
      </div>
    </DiagnosticoCardShell>
  );
}

function confidenceText(c: Props["confidence"]): string | null {
  if (!c) return null;
  if (c === "high") return "Confiança alta";
  if (c === "medium") return "Confiança média";
  return "Confiança baixa";
}

function SummaryRow({
  label,
  value,
  accent,
  meta,
}: {
  label: string;
  value: string;
  accent?: string;
  meta?: string | null;
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`mt-0.5 text-[15px] font-semibold leading-snug ${accent ?? "text-zinc-900"}`}>
        {value}
      </p>
      {meta && (
        <p className="mt-0.5 text-[12px] font-medium text-zinc-500">{meta}</p>
      )}
    </div>
  );
}

function SummaryIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 12h6M9 16h4"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
