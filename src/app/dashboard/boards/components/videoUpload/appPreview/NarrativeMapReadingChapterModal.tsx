import type { CreatorNarrativeMapReadingChapter } from "../../../videoUpload/creatorNarrativeMapReadingChapters";

export function NarrativeMapReadingChapterModal({
  chapter,
  onClose,
}: {
  chapter: CreatorNarrativeMapReadingChapter | null;
  onClose: () => void;
}) {
  if (!chapter) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/35 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-8"
      role="presentation"
      onClick={onClose}
    >
      <section
        className="max-h-[min(88dvh,760px)] w-full max-w-md overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chapter-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex justify-center" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            {chapter.badgeLabel ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {chapter.badgeLabel}
              </span>
            ) : null}
            <h2 id="chapter-modal-title" className="mt-3 text-xl font-semibold text-zinc-950">{chapter.title}</h2>
          </div>
          <button
            type="button"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500"
            onClick={onClose}
            aria-label="Fechar capítulo"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="mt-4 rounded-[1.25rem] bg-zinc-50 px-4 py-3">
          <p className="text-sm leading-6 text-zinc-700">{chapter.fullReading}</p>
        </div>

        {chapter.evidence.length > 0 ? (
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Onde isso aparece</h3>
            <ul className="mt-2 grid gap-2">
              {chapter.evidence.map((item) => (
                <li key={item} className="rounded-2xl bg-zinc-50 px-3 py-2 text-sm leading-5 text-zinc-700">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {chapter.action ? (
          <div className="mt-5 rounded-2xl bg-zinc-950 px-4 py-3 text-white">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-white/60">Como usar agora</h3>
            <p className="mt-1 text-sm leading-5">{chapter.action}</p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
