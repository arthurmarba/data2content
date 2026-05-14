import type { NarrativeSourceIntentDetection } from "../../narrativeSource/narrativeSourceTypes";

type NarrativeSourceIntentPreviewProps = {
  sourceIntent: NarrativeSourceIntentDetection;
};

function confidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "alta";
  if (confidence >= 0.5) return "média";
  return "inicial";
}

export function NarrativeSourceIntentPreview({ sourceIntent }: NarrativeSourceIntentPreviewProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">Intenção da fonte</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Leitura estratégica inicial</h2>
      </div>

      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <dt className="text-xs font-semibold uppercase text-zinc-500">Intenção</dt>
          <dd className="mt-1 text-sm leading-6 text-zinc-800">{sourceIntent.intent}</dd>
        </div>
        <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
          <dt className="text-xs font-semibold uppercase text-zinc-500">Confiança da leitura</dt>
          <dd className="mt-1 text-sm leading-6 text-zinc-800">{confidenceLabel(sourceIntent.confidence)}</dd>
        </div>
      </dl>

      {sourceIntent.signals.length ? (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-zinc-950">Sinais encontrados</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {sourceIntent.signals.map((signal) => (
              <span key={signal} className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                {signal}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
