"use client";

import type { NarrativeMapMobileReadingItem } from "@/app/dashboard/boards/videoUpload/narrativeMapMobileViewModel";
import type {
  NarrativeMapAccessState,
  NarrativeMapReadingQuotaSnapshot,
} from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { DiagnosticoDetailEmptyState } from "./DiagnosticoDetailEmptyState";
import { DiagnosticoReadingsSection } from "./DiagnosticoReadingsSection";
import { CATEGORY_META } from "./DiagnosticoCategoryMeta";

interface Props {
  readings: NarrativeMapMobileReadingItem[];
  mainNarrativeLabel: string | null;
  accessState: NarrativeMapAccessState;
  readingQuota: NarrativeMapReadingQuotaSnapshot | null;
  canStartReading: boolean;
  onNewReading: () => void;
  onOpenReading: (diagnosisId: string) => void;
  onClose: () => void;
}

export function DiagnosticoReadingsDetailView({
  readings,
  mainNarrativeLabel,
  accessState,
  readingQuota,
  canStartReading,
  onNewReading,
  onOpenReading,
  onClose,
}: Props) {
  const meta = CATEGORY_META.readings;

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
    >
      {readings.length === 0 ? (
        <DiagnosticoDetailEmptyState
          iconSlot={
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.89L15 14M3 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" stroke="#71717a" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          title="Nenhuma análise ainda"
          description="Cada vídeo analisado vira uma leitura documentada com narrativa, fala, produção e potencial comercial."
          ctaLabel="Analisar primeiro vídeo"
          onCta={onNewReading}
        />
      ) : (
        <DiagnosticoReadingsSection
          readings={readings}
          mainNarrativeLabel={mainNarrativeLabel}
          accessState={accessState}
          readingQuota={readingQuota}
          canStartReading={canStartReading}
          onNewReading={onNewReading}
          onOpenReading={onOpenReading}
        />
      )}
    </DiagnosticoCategoryDetailView>
  );
}

