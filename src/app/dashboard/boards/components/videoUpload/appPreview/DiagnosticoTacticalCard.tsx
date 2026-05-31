"use client";

import { useState } from "react";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { HC, CARD_P, CARD_BODY } from "./diagnosticoTokens";
import type { CreatorStrategicProfileTacticalExperiment } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { refineDiagnosticoSignals } from "./diagnosticoDisplayText";

interface Props {
  experiments: CreatorStrategicProfileTacticalExperiment[];
}

export function DiagnosticoTacticalCard({ experiments }: Props) {
  const [expanded, setExpanded] = useState(false);
  const refinedExperiments = refineDiagnosticoSignals(experiments, "experiment");
  if (refinedExperiments.length === 0) return null;
  const firstExperiment = refinedExperiments[0];
  if (!firstExperiment) return null;

  return (
    <DiagnosticoCardShell onClick={() => setExpanded((v) => !v)}>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.tactical.bg}
          iconSlot={<TacticalIcon />}
          category="Experimentos sugeridos"
          catColor={HC.tactical.text}
          chevron
        />

        <p className="text-[20px] font-bold leading-tight tracking-tight text-zinc-950">
          {firstExperiment.label}
        </p>
        {firstExperiment.summary !== firstExperiment.label && (
          <p className={`mt-2 line-clamp-2 ${CARD_BODY}`}>{firstExperiment.summary}</p>
        )}
        {refinedExperiments.length > 1 && (
          <p className="mt-3 inline-flex w-fit rounded-full bg-cyan-50 px-3 py-1 text-[12px] font-bold text-cyan-600">
            +{refinedExperiments.length - 1} {refinedExperiments.length - 1 === 1 ? "outro experimento" : "outros experimentos"}
          </p>
        )}

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? "max-h-[600px]" : "max-h-0"
          }`}
        >
          <div className="mt-4 flex flex-col gap-3 border-t border-zinc-100 pt-4">
            {refinedExperiments.map((e, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-100 text-[11px] font-bold text-cyan-700">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <p className="text-[14px] font-semibold text-zinc-900 leading-snug">{e.label}</p>
                  {e.summary !== e.label && (
                    <p className={`mt-1 ${CARD_BODY}`}>{e.summary}</p>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-400">
                    sugerido em {e.evidenceCount} {e.evidenceCount === 1 ? "leitura" : "leituras"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-4 text-[13px] font-semibold text-cyan-600">
          {expanded ? "Ocultar lista" : "Ver todos os experimentos"}
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function TacticalIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" />
      <circle cx="12" cy="12" r="6" stroke="white" strokeWidth="2" />
      <circle cx="12" cy="12" r="2" fill="white" />
    </svg>
  );
}
