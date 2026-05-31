import { DiagnosticoListCard } from "./DiagnosticoListCard";
import { HC } from "./diagnosticoTokens";
import { refineDiagnosticoSignals } from "./diagnosticoDisplayText";

interface Signal { label: string; summary: string; evidenceCount: number }

export function DiagnosticoPatternsCard({ patterns }: { patterns: Signal[] }) {
  const refinedPatterns = refineDiagnosticoSignals(patterns, "pattern");
  if (refinedPatterns.length === 0) return null;
  return (
    <DiagnosticoListCard
      iconBg={HC.pattern.bg}
      iconSlot={<PatternIcon />}
      category="SEUS PADRÕES"
      catColor={HC.pattern.text}
      badge={`${refinedPatterns.length} ${refinedPatterns.length === 1 ? "ativo" : "ativos"}`}
      items={refinedPatterns.map((p) => ({ text: p.label, summary: p.summary, count: p.evidenceCount, dot: "bg-teal-400" }))}
    />
  );
}

function PatternIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M17 2l4 4-4 4M3 12h18M7 22l-4-4 4-4" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
