import type { CreatorNarrativeMapReadingPresentation } from "../../../videoUpload/creatorNarrativeMapReadingChapters";

const TONE_STRIP: Record<string, string> = {
  mirror: "bg-stone-500",
  attention: "bg-amber-600",
  action: "bg-zinc-950",
  opportunity: "bg-emerald-600",
  neutral: "bg-zinc-400",
};

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
    <div
      className="fixed inset-0 z-[100] flex justify-center bg-[var(--ds-color-neutral)]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="full-diagnosis-title"
    >
      <section className="flex h-dvh w-full max-w-md flex-col">
        <header className="border-b border-zinc-200 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase text-zinc-500">{presentation.statusLabel}</p>
              <h2 id="full-diagnosis-title" className="mt-1 text-xl font-semibold text-zinc-950">Diagnóstico completo</h2>
              <p className="mt-2 text-sm leading-5 text-zinc-600">
                Sua leitura desmontada em capítulos — cada um revela um sinal diferente do vídeo.
              </p>
            </div>
            <button
              type="button"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500"
              onClick={onClose}
              aria-label="Fechar diagnóstico completo"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-5">
            {presentation.evidenceSummaryItems.length > 0 ? (
              <section className="border-b border-zinc-200 pb-5" aria-label="Onde a D2C percebeu isso">
                <h3 className="text-sm font-semibold text-zinc-950">O que a D2C observou</h3>
                <ul className="mt-3 grid gap-2">
                  {presentation.evidenceSummaryItems.map((item) => (
                    <li key={item} className="rounded-lg bg-zinc-50 px-3 py-2 text-xs leading-5 text-zinc-700">
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {presentation.chapters.map((chapter) => (
              <article key={chapter.id} className="relative border-b border-zinc-200 pb-5 pl-[22px] last:border-b-0">
                <div className={`absolute bottom-5 left-0 top-0 w-[5px] rounded-full ${TONE_STRIP[chapter.tone] ?? TONE_STRIP["neutral"]}`} aria-hidden="true" />
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
                  <p className="mt-3 rounded-2xl bg-zinc-950 px-3 py-2 text-xs font-semibold leading-5 text-white">
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
