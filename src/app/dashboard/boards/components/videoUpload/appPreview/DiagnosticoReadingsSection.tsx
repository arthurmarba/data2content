"use client";

import { useState } from "react";
import type { NarrativeMapMobileReadingItem } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModel";
import type { NarrativeMapReadingQuotaSnapshot, NarrativeMapAccessState } from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import { DiagnosticoReadingCard } from "./DiagnosticoReadingCard";

const PAGE_SIZE = 5;

function quotaBadgeText(
  accessState: NarrativeMapAccessState,
  quota: NarrativeMapReadingQuotaSnapshot | null,
): string | null {
  if (!quota) return null;
  if (accessState === "free_unused" || accessState === "free_preview_used") {
    return `${quota.usedTotal}/${quota.freeTotalLimit} leitura gratuita`;
  }
  if (accessState === "pro_quota_reached") return "limite mensal atingido";
  if (accessState === "pro_instagram_connected" || accessState === "admin") {
    return `${quota.usedThisMonth}/${quota.proMonthlyLimit} este mês`;
  }
  return null;
}

export function DiagnosticoReadingsSection({
  readings,
  mainNarrativeLabel,
  accessState,
  readingQuota,
  canStartReading: _canStartReading,
  onNewReading: _onNewReading,
  onOpenReading,
}: {
  readings: NarrativeMapMobileReadingItem[];
  mainNarrativeLabel?: string | null;
  accessState: NarrativeMapAccessState;
  readingQuota: NarrativeMapReadingQuotaSnapshot | null;
  canStartReading: boolean;
  onNewReading: () => void;
  onOpenReading: (diagnosisId: string) => void;
}) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = readings.slice(0, visible);
  const hasMore = visible < readings.length;
  const badge = quotaBadgeText(accessState, readingQuota);

  return (
    <section className="flex flex-col gap-3">
      {/* ── Section header — só título + quota badge ─────────────────────── */}
      <div className="flex items-center justify-between px-1">
        <h2 className="text-[17px] font-bold text-zinc-950">Histórico de leituras</h2>
        {badge && (
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-500">
            {badge}
          </span>
        )}
      </div>

      {/* Reading cards */}
      {shown.length > 0 ? (
        <div className="flex flex-col gap-3">
          {shown.map((reading) => (
            <DiagnosticoReadingCard
              key={reading.id}
              reading={reading}
              mainNarrativeLabel={mainNarrativeLabel}
              onTap={() => onOpenReading(reading.diagnosisId)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-4 py-8 text-center">
          <p className="text-[15px] font-semibold text-zinc-800">Ainda não há leituras</p>
          <p className="text-[13px] text-zinc-400">
            Use o botão <strong>Analisar</strong> para começar.
          </p>
        </div>
      )}

      {/* Paginator */}
      {hasMore && (
        <button
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="w-full rounded-2xl bg-white py-3.5 text-[14px] font-semibold text-blue-500 shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
        >
          Ver mais ({readings.length - visible} restantes)
        </button>
      )}
    </section>
  );
}
