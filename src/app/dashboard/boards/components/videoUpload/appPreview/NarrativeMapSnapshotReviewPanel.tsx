"use client";

import type { VideoNarrativeSynthesisSnapshotWriteSummary } from "../../../videoUpload/videoNarrativeSafeResponseBuilder";

export function NarrativeMapSnapshotReviewPanel({
  review,
  internal,
}: {
  review?: VideoNarrativeSynthesisSnapshotWriteSummary | null;
  internal?: boolean;
}) {
  if (!internal || !review) return null;

  const rows = [
    ["attempted", String(review.attempted)],
    ["written", String(review.written)],
    ["skippedReason", review.skippedReason ?? "none"],
    ["synthesisStatus", review.synthesisStatus ?? "none"],
    ["analyzedReadingsCount", String(review.analyzedReadingsCount ?? 0)],
    ["updatedAt", review.updatedAt ?? "none"],
    ["snapshotId", review.snapshotId ?? "none"],
  ];

  return (
    <section className="mx-5 mb-4 rounded-[1.25rem] border border-zinc-200 bg-white p-4 shadow-sm" aria-label="Snapshot write review">
      <p className="text-xs font-semibold uppercase text-zinc-500">Snapshot review interno</p>
      <h3 className="mt-1 text-base font-semibold text-zinc-950">Escrita controlada do Perfil</h3>
      <dl className="mt-3 grid gap-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2">
            <dt className="text-xs font-semibold text-zinc-500">{label}</dt>
            <dd className="max-w-[10rem] truncate text-right text-xs font-semibold text-zinc-800">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
