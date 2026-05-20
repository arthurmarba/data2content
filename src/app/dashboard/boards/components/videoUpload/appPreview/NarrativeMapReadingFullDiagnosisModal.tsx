import type { CreatorNarrativeMapReadingPresentation } from "../../../videoUpload/creatorNarrativeMapReadingChapters";

export function NarrativeMapReadingFullDiagnosisModal({
  presentation,
  open,
  onClose,
}: {
  presentation: CreatorNarrativeMapReadingPresentation;
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 bg-white" role="dialog" aria-modal="true" aria-label="Diagnóstico completo">
      <section className="flex h-full flex-col">
        <header className="border-b border-zinc-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-zinc-500">{presentation.statusLabel}</p>
              <h2 className="mt-1 text-xl font-semibold text-zinc-950">Diagnóstico completo</h2>
              <p className="mt-2 text-sm leading-5 text-zinc-600">
                Capítulos em sequência para ler com calma, sem substituir a síntese futura do Perfil.
              </p>
            </div>
            <button
              type="button"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-sm font-semibold text-zinc-700"
              onClick={onClose}
              aria-label="Fechar diagnóstico completo"
            >
              ×
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-5">
            {presentation.chapters.map((chapter) => (
              <article key={chapter.id} className="border-b border-zinc-200 pb-5 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-zinc-950">{chapter.title}</h3>
                  {chapter.badgeLabel ? (
                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
                      {chapter.badgeLabel}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-sm leading-6 text-zinc-700">{chapter.fullReading}</p>
                {chapter.evidence.length > 0 ? (
                  <ul className="mt-3 grid gap-1.5">
                    {chapter.evidence.slice(0, 2).map((item) => (
                      <li key={item} className="text-xs leading-5 text-zinc-500">
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {chapter.action ? (
                  <p className="mt-3 rounded-2xl bg-zinc-50 px-3 py-2 text-xs font-medium leading-5 text-zinc-700">
                    {chapter.action}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
