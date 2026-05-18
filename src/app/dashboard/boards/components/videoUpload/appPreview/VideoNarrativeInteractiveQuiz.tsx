"use client";

import type { VideoNarrativeDiagnosisQuizQuestion } from "../../../videoUpload/videoNarrativeDiagnosisQuizBuilder";
import { formatSignalLabel } from "./VideoNarrativeAppPreviewPrimitives";
import type { VideoNarrativeInteractiveQuizAnswers } from "./useVideoNarrativeInteractivePreviewState";

type VideoNarrativeInteractiveQuizProps = {
  questions: VideoNarrativeDiagnosisQuizQuestion[];
  selectedAnswers: VideoNarrativeInteractiveQuizAnswers;
  onAnswer: (questionId: string, optionId: string) => void;
  onComplete: () => void;
};

function countAnswered(questions: VideoNarrativeDiagnosisQuizQuestion[], selectedAnswers: VideoNarrativeInteractiveQuizAnswers) {
  return questions.filter((question) => Boolean(selectedAnswers[question.id])).length;
}

function requiredComplete(questions: VideoNarrativeDiagnosisQuizQuestion[], selectedAnswers: VideoNarrativeInteractiveQuizAnswers) {
  return questions.filter((question) => question.required).every((question) => Boolean(selectedAnswers[question.id]));
}

export function VideoNarrativeInteractiveQuiz({
  questions,
  selectedAnswers,
  onAnswer,
  onComplete,
}: VideoNarrativeInteractiveQuizProps) {
  const answered = countAnswered(questions, selectedAnswers);
  const canComplete = questions.length > 0 && requiredComplete(questions, selectedAnswers);

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm leading-6 text-zinc-600">Sem perguntas para este cenário.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <p className="text-sm font-semibold text-zinc-700" data-testid="quiz-local-state-note">
        {answered}/{questions.length} respondidas. Respostas salvas apenas nesta preview.
      </p>
      <div className="grid gap-3">
        {questions.map((question, index) => (
          <article key={question.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Pergunta {index + 1} de {questions.length}
            </p>
            <h3 className="mt-1 text-base font-semibold text-zinc-950">{question.title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600">{question.reason}</p>
            <div className="mt-4 grid gap-2">
              {question.options.map((option) => {
                const selected = selectedAnswers[question.id] === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onAnswer(question.id, option.id)}
                    className={
                      selected
                        ? "rounded-xl border border-zinc-950 bg-white p-4 text-left shadow-sm ring-2 ring-zinc-950/10"
                        : "rounded-xl border border-zinc-200 bg-white p-4 text-left hover:border-zinc-400"
                    }
                    aria-pressed={selected}
                  >
                    <span className="block text-sm font-semibold text-zinc-800">{option.label}</span>
                    {option.description ? (
                      <span className="mt-1 block text-xs leading-5 text-zinc-500">{option.description}</span>
                    ) : null}
                    {option.learningSignalType ? (
                      <span className="mt-2 inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
                        aprende: {formatSignalLabel(option.learningSignalType)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>
      <button
        type="button"
        disabled={!canComplete}
        onClick={onComplete}
        className="inline-flex w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-zinc-300"
      >
        Concluir quiz
      </button>
    </div>
  );
}
