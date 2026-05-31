type Confidence = "low" | "medium" | "high";

const DOT_COUNT: Record<Confidence, number> = { low: 2, medium: 3, high: 4 };
const LABEL: Record<Confidence, string> = { low: "Baixa", medium: "Média", high: "Alta" };

export function DiagnosticoConfidenceDots({
  confidence,
  evidenceCount,
}: {
  confidence: Confidence;
  evidenceCount?: number;
}) {
  const filled = DOT_COUNT[confidence];
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-[3px]" aria-label={`Confiança ${LABEL[confidence]}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <span
            key={i}
            className={`inline-block h-[7px] w-[7px] rounded-full ${
              i < filled ? "bg-zinc-950" : "bg-zinc-200"
            }`}
            aria-hidden="true"
          />
        ))}
      </div>
      <span className="text-[12px] font-semibold text-zinc-500">
        {LABEL[confidence]}
        {evidenceCount != null ? ` · ${evidenceCount} ${evidenceCount === 1 ? "sinal" : "sinais"}` : ""}
      </span>
    </div>
  );
}
