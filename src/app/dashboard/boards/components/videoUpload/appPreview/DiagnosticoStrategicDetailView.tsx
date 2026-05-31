"use client";

import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { DiagnosticoCategoryDetailView } from "./DiagnosticoCategoryDetailView";
import { DiagnosticoDetailEmptyState } from "./DiagnosticoDetailEmptyState";
import { DiagnosticoNextMoveCard } from "./DiagnosticoNextMoveCard";
import { CATEGORY_META } from "./DiagnosticoCategoryMeta";

interface Props {
  synthesis: CreatorStrategicProfileSynthesis;
  onClose: () => void;
}

export function DiagnosticoStrategicDetailView({
  synthesis: s,
  onClose,
}: Props) {
  const meta = CATEGORY_META.strategic;
  const hasAnything = s.nextStrategicMove != null;

  return (
    <DiagnosticoCategoryDetailView
      title={meta.title}
      iconBg={meta.iconBg}
      iconSlot={meta.icon}
      onClose={onClose}
    >
      {!hasAnything ? (
        <DiagnosticoDetailEmptyState
          iconBg="bg-emerald-50"
          iconSlot={
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          title="Foco estratégico em formação"
          description="Após sua primeira análise, a D2C sugere o próximo movimento concreto baseado no que viu."
        />
      ) : (
        <>
          {s.nextStrategicMove && (
            <DiagnosticoNextMoveCard
              label={s.nextStrategicMove.label}
              description={s.nextStrategicMove.description}
              successSignal={s.nextStrategicMove.reason ?? null}
            />
          )}

        </>
      )}
    </DiagnosticoCategoryDetailView>
  );
}
