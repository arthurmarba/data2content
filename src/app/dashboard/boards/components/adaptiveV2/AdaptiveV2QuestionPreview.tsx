import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveQuestion,
} from "../../postCreationAdaptiveTypes";

type AdaptiveV2QuestionPreviewProps = {
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
};

export function AdaptiveV2QuestionPreview({ questions, answers }: AdaptiveV2QuestionPreviewProps) {
  const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer]));

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">Caminhos de decisão</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Perguntas da rodada</h2>
      </div>

      <div className="mt-4 space-y-3">
        {questions.map((question, index) => {
          const selectedOptionId = answerByQuestionId.get(question.id)?.optionId || null;

          return (
            <article key={question.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-zinc-500">Decisão {index + 1}</p>
                  <h3 className="mt-1 text-sm font-semibold leading-6 text-zinc-950">{question.title}</h3>
                </div>
                <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-zinc-600 ring-1 ring-zinc-200">
                  {question.mapKey}
                </span>
              </div>

              {question.helper ? <p className="mt-2 text-sm leading-6 text-zinc-600">{question.helper}</p> : null}

              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {question.options.map((option) => {
                  const isSelected = option.id === selectedOptionId;
                  const isRecommended = option.recommended === true;

                  return (
                    <li
                      key={option.id}
                      className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-800"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{option.label}</span>
                        {isSelected ? (
                          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-[11px] font-semibold text-white">
                            Escolha selecionada
                          </span>
                        ) : null}
                        {isRecommended ? (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                            Sugestão estratégica
                          </span>
                        ) : null}
                      </div>
                      {option.reason ? <p className="mt-1.5 leading-5 text-zinc-600">{option.reason}</p> : null}
                    </li>
                  );
                })}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
