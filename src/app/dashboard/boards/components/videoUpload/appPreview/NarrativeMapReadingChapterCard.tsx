import type { CreatorNarrativeMapReadingChapter } from "../../../videoUpload/creatorNarrativeMapReadingChapters";

const TONE_STRIP: Record<string, string> = {
  mirror: "bg-stone-500",
  attention: "bg-amber-600",
  action: "bg-zinc-950",
  opportunity: "bg-emerald-600",
  neutral: "bg-zinc-400",
};

// All tones use a uniform neutral border — the tone strip provides the color signal.
const TONE_CLASS: Record<CreatorNarrativeMapReadingChapter["tone"], string> = {
  mirror: "border-zinc-100/80 bg-white",
  attention: "border-zinc-100/80 bg-white",
  action: "border-zinc-100/80 bg-white",
  opportunity: "border-zinc-100/80 bg-white",
  neutral: "border-zinc-100/80 bg-white",
};

const ACTION_TONE_CLASS: Record<CreatorNarrativeMapReadingChapter["tone"], string> = {
  mirror: "bg-zinc-50 text-zinc-700",
  attention: "bg-amber-50 text-amber-900",
  action: "bg-zinc-950 text-white",
  opportunity: "bg-emerald-50 text-emerald-900",
  neutral: "bg-zinc-50 text-zinc-700",
};

export function NarrativeMapReadingChapterCard({
  chapter,
  onOpen,
}: {
  chapter: CreatorNarrativeMapReadingChapter;
  onOpen: (chapter: CreatorNarrativeMapReadingChapter) => void;
}) {
  return (
    <article className={`relative rounded-[1.25rem] border p-4 pl-[22px] shadow-[0_2px_10px_rgba(9,9,11,0.06)] ${TONE_CLASS[chapter.tone]}`}>
      <div className={`absolute bottom-3.5 left-0 top-3.5 w-[5px] rounded-full ${TONE_STRIP[chapter.tone] ?? TONE_STRIP["neutral"]}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-950">{chapter.title}</h3>
        {chapter.badgeLabel ? (
          <span className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-600">
            {chapter.badgeLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-700">{chapter.preview}</p>
      {chapter.action ? (
        <p className={`mt-3 rounded-2xl px-3 py-2 text-xs font-medium leading-5 ${ACTION_TONE_CLASS[chapter.tone]}`}>
          {chapter.action}
        </p>
      ) : null}
      <button
        type="button"
        className="mt-4 text-sm font-semibold text-zinc-950 underline decoration-zinc-300 underline-offset-4"
        onClick={() => onOpen(chapter)}
      >
        Ler capítulo
      </button>
    </article>
  );
}
