"use client";

import type {
  PostCreationAdaptiveAnswer,
  PostCreationAdaptiveQuestion,
} from "../postCreationAdaptiveTypes";

export type PostCreationAdaptiveQuizProps = {
  questions: PostCreationAdaptiveQuestion[];
  answers: PostCreationAdaptiveAnswer[];
  onSelectAnswer: (questionId: string, optionId: string) => void;
  onGeneratePlan: () => void;
  canGeneratePlan?: boolean;
  loading?: boolean;
};

function isOptionSelected(answers: PostCreationAdaptiveAnswer[], questionId: string, optionId: string) {
  return answers.some((answer) => answer.questionId === questionId && answer.optionId === optionId);
}

export default function PostCreationAdaptiveQuiz({
  questions,
  answers,
  onSelectAnswer,
  onGeneratePlan,
  canGeneratePlan = false,
  loading = false,
}: PostCreationAdaptiveQuizProps) {
  if (questions.length === 0) return null;

  const answeredQuestionIds = new Set(answers.map((answer) => answer.questionId));
  const answeredCount = questions.filter((question) => answeredQuestionIds.has(question.id)).length;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quiz estratégico</p>
          <h3 className="mt-1 text-lg font-semibold text-slate-950">Quiz estratégico</h3>
        </div>
        <p className="text-sm font-medium text-slate-600">
          {answeredCount} de {questions.length} decisões respondidas
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {questions.map((question, questionIndex) => (
          <fieldset key={question.id} className="rounded-lg border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-950">
              {questionIndex + 1}. {question.title}
            </legend>
            {question.helper ? <p className="mt-1 text-sm text-slate-600">{question.helper}</p> : null}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {question.options.map((option) => {
                const selected = isOptionSelected(answers, question.id, option.id);

                return (
                  <button
                    key={option.id}
                    type="button"
                    className={[
                      "rounded-lg border px-3 py-3 text-left text-sm transition",
                      selected
                        ? "border-slate-950 bg-slate-950 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-800 hover:border-indigo-200 hover:bg-indigo-50",
                    ].join(" ")}
                    aria-pressed={selected}
                    onClick={() => onSelectAnswer(question.id, option.id)}
                  >
                    <span className="block font-semibold">{option.label}</span>
                    {option.reason ? (
                      <span className={selected ? "mt-1 block text-xs text-slate-200" : "mt-1 block text-xs text-slate-500"}>
                        {option.reason}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          disabled={!canGeneratePlan || loading}
          onClick={onGeneratePlan}
        >
          {loading ? "Montando plano..." : "Gerar plano 5W2H"}
        </button>
      </div>
    </section>
  );
}
