"use client";

/**
 * Apple Health-style delta chip — "↑ +12%" or "↓ -8%".
 * Auto-hides when delta is negligible (< 1%).
 */
export function DiagnosticoDeltaChip({
  deltaPct,
  inverse = false,
}: {
  /** Percentage delta as decimal: 0.12 = +12% */
  deltaPct: number;
  /** When true, negative is good (e.g., reaction time) */
  inverse?: boolean;
}) {
  const absPct = Math.abs(Math.round(deltaPct * 100));
  if (absPct < 1) return null;

  const isUp = deltaPct > 0;
  const isPositive = inverse ? !isUp : isUp;

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none ${
        isPositive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
      }`}
    >
      <span aria-hidden="true">{isUp ? "↑" : "↓"}</span>
      {absPct}%
    </span>
  );
}
