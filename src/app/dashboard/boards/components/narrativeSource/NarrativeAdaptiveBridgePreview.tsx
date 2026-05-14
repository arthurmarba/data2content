import type {
  PostCreationAdaptiveIntentDetection,
  PostCreationAdaptiveQuestion,
} from "../../postCreationAdaptiveTypes";
import type { NarrativeSourceAdaptiveInput } from "../../narrativeSource/narrativeSourceAdaptiveAdapter";

type NarrativeAdaptiveBridgePreviewProps = {
  adaptiveInput: NarrativeSourceAdaptiveInput;
  adaptiveDetection?: PostCreationAdaptiveIntentDetection | null;
  questions?: PostCreationAdaptiveQuestion[];
  answerKey?: { summary: string } | null;
};

export function NarrativeAdaptiveBridgePreview({
  adaptiveInput,
  adaptiveDetection = null,
  questions = [],
  answerKey = null,
}: NarrativeAdaptiveBridgePreviewProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">Entrada estratégica para o Adaptive V2</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Ponte narrativa para o board</h2>
      </div>

      <div className="mt-4 rounded-lg bg-zinc-50 p-3">
        <p className="text-sm font-medium text-zinc-950">{adaptiveInput.input}</p>
        <p className="mt-2 text-sm leading-6 text-zinc-700">{adaptiveInput.sourceSummary}</p>
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <dt className="text-xs font-semibold uppercase text-zinc-500">Modo sugerido</dt>
          <dd className="mt-1 text-sm leading-6 text-zinc-800">{adaptiveInput.modeHint || "sem sugestão"}</dd>
        </div>
        {adaptiveDetection ? (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
            <dt className="text-xs font-semibold uppercase text-zinc-500">Modo detectado</dt>
            <dd className="mt-1 text-sm leading-6 text-zinc-800">{adaptiveDetection.mode}</dd>
          </div>
        ) : null}
        {answerKey ? (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
            <dt className="text-xs font-semibold uppercase text-zinc-500">Leitura da rodada</dt>
            <dd className="mt-1 text-sm leading-6 text-zinc-800">{answerKey.summary}</dd>
          </div>
        ) : null}
      </dl>

      {adaptiveInput.signals.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-zinc-950">Sinais enviados</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {adaptiveInput.signals.map((signal) => (
              <span key={signal} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                {signal}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {questions.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-zinc-950">Perguntas disponíveis</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-zinc-700">
            {questions.map((question) => (
              <li key={question.id}>{question.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
