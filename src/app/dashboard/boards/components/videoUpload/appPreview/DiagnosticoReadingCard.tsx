"use client";

import Image from "next/image";
import type { NarrativeMapMobileReadingItem } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModel";
import { HC_READING } from "./diagnosticoTokens";
import { Chevron } from "./DiagnosticoCardShell";
import {
  refineDiagnosticoCardText,
  refineDiagnosticoRememberedAs,
} from "./diagnosticoDisplayText";

const CONTRIBUTION_LABEL: Record<string, string> = {
  confirms_existing_pattern: "CONFIRMOU",
  opens_new_hypothesis:      "NOVO TERRITÓRIO",
  isolated_strong_video:     "VÍDEO FORTE",
  creative_deviation:        "FORA DO PADRÃO",
  commercial_signal:         "SINAL COMERCIAL",
};

const DEFAULT_READING_COLORS = { bg: "bg-zinc-400", text: "text-zinc-400" };

function relativeDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return "hoje";
  if (diffDays === 1) return "ontem";
  if (diffDays <= 7) return `${diffDays} dias atrás`;
  if (diffDays <= 30) return `há ${Math.floor(diffDays / 7)} sem.`;
  return `${String(date.getUTCDate()).padStart(2, "0")} ${date.toLocaleString("pt-BR", { month: "short", timeZone: "UTC" })}`;
}

export function DiagnosticoReadingCard({
  reading,
  mainNarrativeLabel,
  onTap,
}: {
  reading: NarrativeMapMobileReadingItem;
  mainNarrativeLabel?: string | null;
  onTap: () => void;
}) {
  const contribType = reading.contributionType ?? "";
  const colors = HC_READING[contribType] ?? DEFAULT_READING_COLORS;
  const catLabel = CONTRIBUTION_LABEL[contribType] ?? "LEITURA";

  const displayLabel =
    contribType === "confirms_existing_pattern" && mainNarrativeLabel
      ? `Reforçou · ${mainNarrativeLabel}`
      : reading.contributionLabel;
  const refinedRememberedAs = refineDiagnosticoRememberedAs(reading.rememberedAs, mainNarrativeLabel);
  const refinedDisplayLabel = displayLabel
    ? refineDiagnosticoCardText(displayLabel, "narrative", "Sinal em observação")
    : null;

  const timestamp = relativeDate(reading.createdAt) || reading.dateLabel;

  return (
    <button
      onClick={onTap}
      className="w-full text-left rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden active:opacity-80"
    >
      <div className="p-4">
        {/* Header row */}
        <div className="mb-3 flex items-center gap-2">
          {/* colored icon bubble */}
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl ${colors.bg}`}
            aria-hidden="true"
          >
            <ReadingIcon type={contribType} />
          </div>
          <span className={`text-[12px] font-semibold tracking-tight ${colors.text}`}>
            {catLabel}
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {timestamp && (
              <span className="text-[12px] text-zinc-400">{timestamp}</span>
            )}
            <Chevron />
          </div>
        </div>

        {/* Thumbnail + title row */}
        <div className="flex gap-3">
          {/* Thumbnail 16:9 */}
          <div className="relative shrink-0 h-[54px] w-[96px] rounded-xl bg-zinc-100 overflow-hidden">
            {reading.thumbnailUrl ? (
              <Image
                src={reading.thumbnailUrl}
                alt=""
                fill
                sizes="96px"
                quality={65}
                loading="lazy"
                unoptimized={reading.thumbnailUrl.startsWith("data:") || reading.thumbnailUrl.startsWith("blob:")}
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <circle cx="12" cy="12" r="10" stroke="var(--ds-color-line)" strokeWidth="1.5" />
                  <polygon points="10,8 17,12 10,16" fill="var(--ds-color-text-muted)" />
                </svg>
              </div>
            )}
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-semibold text-zinc-900 leading-snug line-clamp-2">
              {refinedRememberedAs}
            </p>
            {refinedDisplayLabel && (
              <p className="mt-1 text-[12px] text-zinc-500 truncate">{refinedDisplayLabel}</p>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

function ReadingIcon({ type }: { type: string }) {
  if (type === "confirms_existing_pattern") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "creative_deviation") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 9v4M12 17h.01" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "opens_new_hypothesis") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
        <line x1="12" y1="8" x2="12" y2="16" stroke="white" strokeWidth="2" strokeLinecap="round" />
        <line x1="8" y1="12" x2="16" y2="12" stroke="white" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "commercial_signal") {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke="white" strokeWidth="1.8" fill="white" />
      </svg>
    );
  }
  // isolated_strong_video / default
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="white" />
    </svg>
  );
}
