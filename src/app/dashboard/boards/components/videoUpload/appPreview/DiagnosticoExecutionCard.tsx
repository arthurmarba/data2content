"use client";

import { useState } from "react";
import { DiagnosticoCardShell, DiagCardHeader } from "./DiagnosticoCardShell";
import { HC, CARD_P, CARD_BODY } from "./diagnosticoTokens";
import type { CreatorStrategicProfileExecutionPattern } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { refineDiagnosticoSignals } from "./diagnosticoDisplayText";

interface Props {
  patterns: CreatorStrategicProfileExecutionPattern[];
}

const AREA_LABEL: Record<"speech" | "production", string> = {
  speech: "Fala",
  production: "Produção",
};

export function DiagnosticoExecutionCard({ patterns }: Props) {
  const [expanded, setExpanded] = useState(false);
  const refinedPatterns = refineDiagnosticoSignals(patterns, "execution");
  if (refinedPatterns.length === 0) return null;

  return (
    <DiagnosticoCardShell onClick={() => setExpanded((v) => !v)}>
      <div className={CARD_P}>
        <DiagCardHeader
          iconBg={HC.execution.bg}
          iconSlot={<ExecutionIcon />}
          category="COMO VOCÊ EXECUTA"
          catColor={HC.execution.text}
        />

        {/* Always-visible — show top 2 patterns as compact rows */}
        <ul className="flex flex-col gap-2">
          {refinedPatterns.slice(0, 2).map((p, i) => (
            <li key={i} className="flex items-baseline gap-2">
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${HC.execution.light} ${HC.execution.text}`}>
                {AREA_LABEL[p.area]}
              </span>
              <span className="text-[14px] font-semibold text-zinc-900 leading-snug line-clamp-2">
                {p.label}
              </span>
            </li>
          ))}
        </ul>

        {/* Expandable analysis */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            expanded ? "max-h-[600px]" : "max-h-0"
          }`}
        >
          <div className="mt-3 flex flex-col gap-3 border-t border-zinc-50 pt-3">
            {refinedPatterns.map((p, i) => (
              <div key={i}>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${HC.execution.light} ${HC.execution.text}`}>
                    {AREA_LABEL[p.area]}
                  </span>
                  <span className="text-[11px] font-semibold text-zinc-400">
                    em {p.evidenceCount} {p.evidenceCount === 1 ? "leitura" : "leituras"}
                  </span>
                </div>
                <p className={CARD_BODY}>{p.summary}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Toggle */}
        <p className="mt-2.5 text-right text-[12px] font-medium text-zinc-400">
          {expanded ? "Ver menos ↑" : "Ver análise ↓"}
        </p>
      </div>
    </DiagnosticoCardShell>
  );
}

function ExecutionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12h3l3-9 4 18 3-12 2 6h3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
