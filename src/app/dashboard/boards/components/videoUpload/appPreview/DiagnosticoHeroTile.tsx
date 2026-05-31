"use client";

import type { ReactNode } from "react";
import { Chevron } from "./DiagnosticoCardShell";

interface Props {
  iconBg: string;
  iconSlot: ReactNode;
  category: string;
  catColor: string;
  metric: string;
  meta?: ReactNode;
  timestamp?: string;
  onClick: () => void;
}

/**
 * Hero tile — Calm edition.
 * No "DESTAQUE" badge (its position in "Para você hoje" already implies highlight).
 * Generous padding (p-7), big metric (32px), soft floating shadow.
 */
export function DiagnosticoHeroTile({
  iconBg,
  iconSlot,
  category,
  catColor,
  metric,
  meta,
  timestamp,
  onClick,
}: Props) {
  return (
    <button
      onClick={onClick}
      className="w-full overflow-hidden rounded-[32px] bg-white text-left shadow-[0_1px_2px_rgba(15,23,42,0.025),0_18px_42px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.025] transition-transform duration-200 active:scale-[0.985]"
    >
      <div className="p-5">
        <div className="mb-5 flex min-w-0 items-center gap-2.5">
          <div
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconBg} shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.35)]`}
            aria-hidden="true"
          >
            {iconSlot}
          </div>
          <span className={`min-w-0 truncate text-[15.5px] font-bold leading-none ${catColor}`}>
            {category}
          </span>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
            {timestamp ? (
              <span className="text-[15px] font-medium text-zinc-400">{timestamp}</span>
            ) : null}
            <Chevron />
          </div>
        </div>

        <p className="line-clamp-3 text-[25px] font-bold leading-[1.12] text-zinc-950">
          {metric}
        </p>

        {meta && <div className="mt-4">{meta}</div>}
      </div>
    </button>
  );
}
