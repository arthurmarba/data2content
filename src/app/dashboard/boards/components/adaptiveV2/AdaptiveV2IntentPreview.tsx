import type { PostCreationAdaptiveIntentDetection } from "../../postCreationAdaptiveTypes";

type AdaptiveV2IntentPreviewProps = {
  detection: PostCreationAdaptiveIntentDetection;
};

function compactText(value: string, maxLength = 120) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 3)}...`;
}

export function AdaptiveV2IntentPreview({ detection }: AdaptiveV2IntentPreviewProps) {
  const signals = detection.signals.slice(0, 4);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-zinc-500">Leitura inicial</p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950">Direção detectada</h2>
        </div>
        <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs font-semibold text-zinc-700">
          {detection.mode}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-zinc-500">Relato original</dt>
          <dd className="mt-1 leading-6 text-zinc-800">{compactText(detection.originalInput || "Sem relato informado.")}</dd>
        </div>
        <div>
          <dt className="font-semibold text-zinc-500">Sinais principais</dt>
          <dd className="mt-1 flex flex-wrap gap-2">
            {signals.length > 0 ? (
              signals.map((signal) => (
                <span key={signal} className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                  {signal}
                </span>
              ))
            ) : (
              <span className="text-zinc-600">Sem sinais específicos nesta leitura.</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}
