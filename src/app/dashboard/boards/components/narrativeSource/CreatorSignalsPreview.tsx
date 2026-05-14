import type { CreatorNarrativeSignal } from "../../narrativeSource/narrativeSourceTypes";

type CreatorSignalsPreviewProps = {
  profileSignals: CreatorNarrativeSignal[];
};

export function CreatorSignalsPreview({ profileSignals }: CreatorSignalsPreviewProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase text-zinc-500">Sinais para entender a conta</p>
        <h2 className="mt-1 text-lg font-semibold text-zinc-950">Pistas de perfil narrativo</h2>
      </div>

      {profileSignals.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {profileSignals.map((signal) => (
            <article key={signal.id} className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-zinc-950">{signal.signalType}</h3>
                {signal.shouldPersistLater ? (
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900">
                    pode enriquecer o perfil depois
                  </span>
                ) : null}
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-800">{signal.value}</p>
              {signal.evidence ? <p className="mt-1 text-sm leading-6 text-zinc-600">{signal.evidence}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-lg bg-zinc-50 p-3 text-sm leading-6 text-zinc-700">
          Nenhum sinal de perfil foi separado nesta prévia.
        </p>
      )}
    </section>
  );
}
