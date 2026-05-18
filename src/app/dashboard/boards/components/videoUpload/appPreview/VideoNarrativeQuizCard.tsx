import type { VideoNarrativeDiagnosisQuizQuestion } from "../../../videoUpload/videoNarrativeDiagnosisQuizBuilder";
import { formatSignalLabel } from "./VideoNarrativeAppPreviewPrimitives";

type VideoNarrativeQuizCardProps = {
  questions: VideoNarrativeDiagnosisQuizQuestion[];
};

export function VideoNarrativeQuizCard({ questions }: VideoNarrativeQuizCardProps) {
  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm leading-6 text-zinc-600">Sem perguntas para este cenário.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {questions.map((question, index) => (
        <article key={question.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-xs font-semibold uppercase text-zinc-500">Pergunta {index + 1}</p>
          <h3 className="mt-1 text-base font-semibold text-zinc-950">{question.title}</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-600">{question.helper ?? question.reason}</p>
          <div className="mt-4 grid gap-2">
            {question.options.map((option) => (
              <div key={option.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                <p className="text-sm font-semibold text-zinc-800">{option.label}</p>
                {option.description ? <p className="mt-1 text-xs leading-5 text-zinc-500">{option.description}</p> : null}
                {option.learningSignalType ? (
                  <span className="mt-2 inline-flex rounded-full bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-white">
                    sinal: {formatSignalLabel(option.learningSignalType)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
