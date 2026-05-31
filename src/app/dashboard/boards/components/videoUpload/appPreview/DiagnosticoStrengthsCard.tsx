import { DiagnosticoListCard } from "./DiagnosticoListCard";
import { HC } from "./diagnosticoTokens";
import { refineDiagnosticoSignals } from "./diagnosticoDisplayText";

interface Signal { label: string; summary: string; evidenceCount: number }

export function DiagnosticoStrengthsCard({ strengths }: { strengths: Signal[] }) {
  const refinedStrengths = refineDiagnosticoSignals(strengths, "strength");
  if (refinedStrengths.length === 0) return null;
  return (
    <DiagnosticoListCard
      iconBg={HC.strength.bg}
      iconSlot={<StrengthIcon />}
      category="SEU PONTO FORTE"
      catColor={HC.strength.text}
      badge="consistente"
      items={refinedStrengths.map((s) => ({ text: s.label, summary: s.summary, count: s.evidenceCount, dot: "bg-blue-400" }))}
    />
  );
}

function StrengthIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="white" />
    </svg>
  );
}
