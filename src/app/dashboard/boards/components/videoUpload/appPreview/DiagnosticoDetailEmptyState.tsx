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
 * Empty state canônico do app, composto apenas com tokens do design system.
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
    <div className="ds-surface ds-surface--raised flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-full ${iconBg}`}>
        {iconSlot}
      </div>
      <p className="text-[17px] font-bold text-zinc-950 leading-snug max-w-xs">{title}</p>
      <p className="text-[14px] text-zinc-500 leading-relaxed max-w-xs">{description}</p>
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="ds-button ds-button--secondary ds-button--block mt-2 max-w-xs"
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
