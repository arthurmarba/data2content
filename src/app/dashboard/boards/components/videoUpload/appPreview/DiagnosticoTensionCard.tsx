"use client";

import { useState } from "react";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { HC, CARD_P, CARD_METRIC, CARD_BODY } from "./diagnosticoTokens";
import { refineDiagnosticoSignal } from "./diagnosticoDisplayText";

interface Props {
  label: string;
  summary: string;
  evidenceCount: number;
  timestamp?: string | null;
}

export function DiagnosticoTensionCard({ label, summary, evidenceCount, timestamp }: Props) {
  const [expanded, setExpanded] = useState(false);
  const copy = refineDiagnosticoSignal({ label, summary, evidenceCount }, "tension");

  return (
    <DiagnosticoCardShell onClick={() => setExpanded((v) => !v)}>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.tension.bg}
          iconSlot={<TensionIcon />}
          category="Ponto de atenção"
          catColor={HC.tension.text}
          timestamp={timestamp}
          chevron
        />

        <p className={CARD_METRIC}>{copy.label}</p>
        <p className={`mt-2 line-clamp-2 ${CARD_BODY}`}>{copy.summary}</p>
        <p className="mt-3 inline-flex w-fit rounded-full bg-amber-50 px-3 py-1 text-[12px] font-bold text-amber-600">
          {evidenceCount} {evidenceCount === 1 ? "leitura" : "leituras"}
        </p>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? "max-h-96" : "max-h-0"
          }`}
        >
          <div className="mt-4 border-t border-zinc-100 pt-4">
            <p className="text-[13px] font-medium leading-snug text-zinc-500">
              Quando esse ponto aparecer em outra leitura, a D2C vai mapear se é um padrão que vale explorar com intenção.
            </p>
          </div>
        </div>

        <p className="mt-4 text-[13px] font-semibold text-amber-600">
          {expanded ? "Ocultar detalhe" : "Ver contexto"}
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function TensionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="2" />
      <line x1="12" y1="8" x2="12" y2="13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="1.1" fill="white" />
    </svg>
  );
}
