import type {
  PostCreationAdaptiveAnswerEvaluation,
  PostCreationAdaptiveScore,
} from "../postCreationAdaptiveAnswerKey";

type PostCreationAdaptiveScoreCardProps = {
  score: PostCreationAdaptiveScore;
  evaluations: PostCreationAdaptiveAnswerEvaluation[];
};

const MAX_CORRECT_ITEMS = 3;
const MAX_ADJUSTMENT_ITEMS = 2;

function cleanVisibleText(value: string | null | undefined): string | null {
  const trimmed = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!trimmed) return null;

  return trimmed
    .replace(/\berr(?:o|os|ada|adas|ado|ados)\b/gi, "ajuste")
    .replace(/\bincorret(?:a|as|o|os)\b/gi, "a ajustar")
    .replace(/\bfalh\w*\b/gi, "precisa de ajuste");
}

function formatEvaluationTitle(evaluation: PostCreationAdaptiveAnswerEvaluation): string {
  return cleanVisibleText(evaluation.feedbackTitle) || "Decisão estratégica";
}

function formatEvaluationDetail(evaluation: PostCreationAdaptiveAnswerEvaluation): string {
  return cleanVisibleText(evaluation.rationale)
    || cleanVisibleText(evaluation.feedbackMessage)
    || "Caminho estratégico ajustado para fortalecer a pauta.";
}

function clampPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export default function PostCreationAdaptiveScoreCard({
  score,
  evaluations,
}: PostCreationAdaptiveScoreCardProps) {
  const percentage = clampPercentage(score.percentage);
  const correctEvaluations = evaluations.filter((evaluation) => evaluation.isCorrect);
  const adjustmentEvaluations = evaluations.filter((evaluation) => !evaluation.isCorrect);
  const visibleCorrectEvaluations = correctEvaluations.slice(0, MAX_CORRECT_ITEMS);
  const visibleAdjustmentEvaluations = adjustmentEvaluations.slice(0, MAX_ADJUSTMENT_ITEMS);
  const visibleCount = visibleCorrectEvaluations.length + visibleAdjustmentEvaluations.length;
  const hiddenCount = Math.max(0, evaluations.length - visibleCount);

  return (
    <section className="w-full rounded-[28px] border border-zinc-200/80 bg-white p-4 shadow-[0_18px_44px_rgba(15,23,42,0.08)] sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400">
            Alinhamento da rodada
          </p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-zinc-950">
            {cleanVisibleText(score.label) || "Direção estratégica encontrada"}
          </h3>
          <p className="mt-1 text-sm leading-6 text-zinc-500">
            {cleanVisibleText(score.summary) || "Essa leitura mostra o quanto suas escolhas se aproximaram do caminho recomendado para a pauta."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2.5">
          <div className="h-2 w-24 overflow-hidden rounded-full bg-zinc-200">
            <div
              className="h-full rounded-full bg-zinc-950 transition-[width] duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex flex-col items-end leading-none">
            <span className="text-sm font-semibold tabular-nums text-zinc-950">{percentage}%</span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-400">alinhamento</span>
          </div>
        </div>
      </div>

      {evaluations.length > 0 ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {visibleCorrectEvaluations.length > 0 ? (
            <div className="rounded-[22px] border border-zinc-200/80 bg-zinc-50/80 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Pontos fortes da sua leitura
              </p>
              <ul className="mt-3 space-y-3">
                {visibleCorrectEvaluations.map((evaluation) => (
                  <li key={`correct-${evaluation.questionId}`} className="text-sm leading-5">
                    <p className="font-semibold text-zinc-900">{formatEvaluationTitle(evaluation)}</p>
                    <p className="mt-1 text-zinc-500">{formatEvaluationDetail(evaluation)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {visibleAdjustmentEvaluations.length > 0 ? (
            <div className="rounded-[22px] border border-zinc-200/80 bg-zinc-50/80 p-3.5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
                Ajustes recomendados
              </p>
              <ul className="mt-3 space-y-3">
                {visibleAdjustmentEvaluations.map((evaluation) => (
                  <li key={`adjustment-${evaluation.questionId}`} className="text-sm leading-5">
                    <p className="font-semibold text-zinc-900">{formatEvaluationTitle(evaluation)}</p>
                    <p className="mt-1 text-zinc-500">{formatEvaluationDetail(evaluation)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 rounded-[22px] border border-zinc-200/80 bg-zinc-50/80 p-3.5 text-sm leading-6 text-zinc-500">
          Sem pontos analisados nesta rodada.
        </p>
      )}

      {hiddenCount > 0 ? (
        <p className="mt-3 text-xs font-semibold text-zinc-400">
          + {hiddenCount} pontos analisados
        </p>
      ) : null}
    </section>
  );
}
