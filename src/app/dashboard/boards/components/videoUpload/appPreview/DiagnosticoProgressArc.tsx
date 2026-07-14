import { DIAG_STATUS_EVOLUTION } from "./diagnosticoTokens";
import { Chevron } from "./DiagnosticoCardShell";

const RING_TARGET = 5;
const RING_R = 26;
const RING_CX = 36;
const RING_CY = 36;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_R;

function relativeUpdated(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  if (diffDays <= 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays <= 7) return `Há ${diffDays}d`;
  if (diffDays <= 30) return `Há ${Math.floor(diffDays / 7)}sem`;
  const month = date.toLocaleString("pt-BR", { month: "short", timeZone: "UTC" });
  return `${String(date.getUTCDate()).padStart(2, "0")} ${month}`;
}

/**
 * Apple Health-style activity ring card.
 * Calm edition: drops hint text — phase label + ring carry the meaning alone.
 */
export function DiagnosticoProgressArc({
  status,
  readingCount = 0,
  mainNarrativeLabel = null,
  generatedAt = null,
  onClick,
}: {
  status: string | null;
  readingCount?: number;
  narrativeEvidenceCount?: number;
  mainNarrativeLabel?: string | null;
  generatedAt?: string | null;
  onClick?: () => void;
}) {
  const evolutionLabel = status ? (DIAG_STATUS_EVOLUTION[status] ?? null) : null;
  const freshness = relativeUpdated(generatedAt);

  const ringPct = Math.min((readingCount / RING_TARGET) * 100, 100);
  const dashFill = (ringPct / 100) * RING_CIRCUMFERENCE;
  const dashGap = RING_CIRCUMFERENCE - dashFill;
  const headline = readingCount > 0 ? (evolutionLabel ?? "Diagnóstico ativo") : "Sem análises ainda";
  const countLabel = readingCount === 1 ? "análise" : "análises";

  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`relative w-full rounded-[32px] bg-white p-5 text-left shadow-[0_1px_2px_rgba(15,23,42,0.025),0_18px_42px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.025] ${
        onClick ? "transition-transform duration-200 active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/45" : ""
      }`}
      aria-label="Abrir detalhes do diagnóstico"
    >
      <div className="mb-5 flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)]" aria-hidden="true">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path d="M4 13h4l3-7 4 12 2-5h3" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="text-[15.5px] font-bold leading-none text-orange-500">
          Diagnóstico
        </span>
        <span className="ml-auto text-[15px] font-medium text-zinc-400">
          {freshness}
        </span>
        <Chevron />
      </div>

      <div className="flex items-center justify-between gap-5">
        <div className="min-w-0 flex-1">
          <p className="text-[25px] font-bold leading-[1.1] text-zinc-950">
            {headline}
          </p>
          <p className="mt-1 text-[16px] font-semibold leading-tight text-zinc-500">
            {readingCount > 0 ? `${readingCount} ${countLabel}` : "Envie um vídeo para começar"}
          </p>
          {mainNarrativeLabel && (
            <p className="mt-1.5 text-[13px] font-medium leading-snug text-zinc-400 line-clamp-1">
              &quot;{mainNarrativeLabel}&quot;
            </p>
          )}
        </div>

        <div className="shrink-0">
          <svg width="66" height="66" viewBox="0 0 72 72" aria-hidden="true">
            <circle cx={RING_CX} cy={RING_CY} r={RING_R} fill="none" stroke="#f1f1f4" strokeWidth="7" />
            {readingCount > 0 && (
              <circle
                cx={RING_CX}
                cy={RING_CY}
                r={RING_R}
                fill="none"
                stroke="#f97316"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${dashFill} ${dashGap}`}
                transform={`rotate(-90 ${RING_CX} ${RING_CY})`}
                style={{ transition: "stroke-dasharray 0.5s ease" }}
              />
            )}
            <text
              x={RING_CX}
              y="36"
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="23"
              fontWeight="700"
              fill="var(--ds-color-ink)"
            >
              {readingCount}
            </text>
          </svg>
        </div>
      </div>
    </Wrapper>
  );
}
