"use client";

import type { ReactNode } from "react";

interface Props {
  iconBg?: string;     // Tailwind bg class — defaults to neutral
  iconSlot: ReactNode; // SVG icon
  title: string;
  description: string;
  ctaLabel?: string;
  onCta?: () => void;
}

/**
 * Apple Health-style empty state inside a category detail view.
 * Unified treatment across the 7 detail views.
 */
export function DiagnosticoDetailEmptyState({
  iconBg = "bg-zinc-100",
  iconSlot,
  title,
  description,
  ctaLabel,
  onCta,
}: Props) {
  return (
    <div className="rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] px-6 py-10 flex flex-col items-center gap-3 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${iconBg}`}>
        {iconSlot}
      </div>
      <p className="text-[17px] font-bold text-zinc-950 leading-snug max-w-xs">{title}</p>
      <p className="text-[14px] text-zinc-500 leading-relaxed max-w-xs">{description}</p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="mt-2 w-full max-w-xs rounded-full bg-zinc-950 py-3.5 text-[14px] font-semibold text-white"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
