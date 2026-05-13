import type { PostCreationAdaptiveAnswerKeyResult } from "../../postCreationAdaptiveTypes";

type AdaptiveV2AnswerKeyPreviewProps = {
  answerKey: PostCreationAdaptiveAnswerKeyResult;
};

export function AdaptiveV2AnswerKeyPreview({ answerKey }: AdaptiveV2AnswerKeyPreviewProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">Leitura da rodada</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Recomendação consultiva</h2>
      </div>

      <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm leading-6 text-zinc-800">{answerKey.summary}</p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Pontos fortes</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">
            {answerKey.strengths.length > 0 ? (
              answerKey.strengths.map((strength) => <li key={strength}>{strength}</li>)
            ) : (
              <li>Há espaço para consolidar pontos fortes depois das próximas escolhas.</li>
            )}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-zinc-950">Ajustes recomendados</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">
            {answerKey.adjustments.length > 0 ? (
              answerKey.adjustments.map((adjustment) => <li key={adjustment}>{adjustment}</li>)
            ) : (
              <li>O caminho escolhido já está coerente para transformar em plano.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="text-sm font-semibold text-zinc-950">Leitura por pergunta</h3>
        <div className="mt-2 grid gap-2">
          {answerKey.evaluations.map((evaluation) => (
            <article key={evaluation.questionId} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-zinc-500">
                <span>{evaluation.key}</span>
                {evaluation.selectedLabel ? <span>Escolha: {evaluation.selectedLabel}</span> : null}
                {evaluation.recommendedLabel ? <span>Referência: {evaluation.recommendedLabel}</span> : null}
              </div>
              <p className="mt-1.5 text-sm leading-6 text-zinc-700">{evaluation.reason}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
