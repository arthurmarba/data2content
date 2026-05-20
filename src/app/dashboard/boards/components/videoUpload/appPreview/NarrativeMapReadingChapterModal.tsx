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
    <div className="absolute inset-0 z-20 flex items-end bg-zinc-950/35 px-3 pb-3" role="dialog" aria-modal="true" aria-label={chapter.title}>
      <section className="max-h-[88%] w-full overflow-y-auto rounded-[1.75rem] bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            {chapter.badgeLabel ? (
              <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-600">
                {chapter.badgeLabel}
              </span>
            ) : null}
            <h2 className="mt-3 text-xl font-semibold text-zinc-950">{chapter.title}</h2>
          </div>
          <button
            type="button"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-zinc-200 bg-white text-sm font-semibold text-zinc-700"
            onClick={onClose}
            aria-label="Fechar capítulo"
          >
            ×
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
                <li key={item} className="rounded-2xl border border-zinc-100 bg-white px-3 py-2 text-sm leading-5 text-zinc-700">
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
