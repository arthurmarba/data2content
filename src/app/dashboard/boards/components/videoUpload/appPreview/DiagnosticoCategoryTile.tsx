"use client";

import type { ReactNode } from "react";
import { Chevron } from "./DiagnosticoCardShell";

interface Props {
  iconBg: string;
  iconSlot: ReactNode;
  category: string;
  catColor: string;
  metric: string;
  metricUnit?: string;
  subtitle?: string;
  timestamp?: string;
  onClick?: () => void;
  visual?: ReactNode;
  compact?: boolean;
  /** Big number Apple Health treatment (56px for primary numbers) */
  bigNumber?: boolean;
  /** Empty state — bold "Sem Dados" treatment (28px) */
  emphasis?: boolean;
}

/**
 * Apple Health-style category tile — Calm Edition.
 * Generous padding (p-5), rounded-3xl, soft floating shadow.
 * Big typography hierarchy: regular 22px, emphasis 28px, bigNumber 56px.
 */
export function DiagnosticoCategoryTile({
  iconBg,
  iconSlot,
  category,
  catColor,
  metric,
  metricUnit,
  subtitle,
  timestamp,
  onClick,
  visual,
  compact = false,
  bigNumber = false,
  emphasis = false,
}: Props) {
  const isDisabled = !onClick;
  const Wrapper = isDisabled ? "div" : "button";

  const paddingCls = compact ? "p-4" : "p-5";
  const minHeightCls = compact ? "min-h-[112px]" : "min-h-[136px]";
  const metricFontCls = bigNumber
    ? "text-[52px] font-bold leading-none text-zinc-950"
    : emphasis
      ? "text-[28px] font-bold leading-[1.08] text-zinc-950"
      : compact
        ? "text-[19px] font-bold leading-[1.14] text-zinc-950"
        : "text-[24px] font-bold leading-[1.12] text-zinc-950";

  return (
    <Wrapper
      onClick={onClick}
      className={`h-full w-full overflow-hidden rounded-[32px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.025),0_18px_42px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.025] transition-transform duration-200 ${
        isDisabled ? "" : "text-left active:scale-[0.985]"
      }`}
    >
      <div className={`${paddingCls} ${minHeightCls} flex flex-col`}>
        <div className="mb-4 flex min-w-0 items-center gap-2.5">
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
            {timestamp && (
              <span className="text-[15px] font-medium text-zinc-400">
                {timestamp}
              </span>
            )}
            {!isDisabled && !compact ? <Chevron /> : null}
          </div>
        </div>

        <div className={`mt-auto flex gap-3.5 ${bigNumber ? "items-baseline" : "items-end"}`}>
          <div className="min-w-0 flex-1">
            {metricUnit ? (
              <div className="flex flex-wrap items-baseline gap-2">
                <p className={`${metricFontCls} line-clamp-1`}>{metric}</p>
                <p className={`${bigNumber ? "text-[16px]" : "text-[13px]"} font-medium text-zinc-500 leading-none`}>
                  {metricUnit}
                </p>
              </div>
            ) : (
              <p className={`${metricFontCls} ${compact ? "line-clamp-2" : emphasis ? "line-clamp-1" : "line-clamp-2"}`}>
                {metric}
              </p>
            )}
            {subtitle && (
              <p className="mt-1.5 line-clamp-1 text-[15px] font-medium leading-snug text-zinc-500">
                {subtitle}
              </p>
            )}
          </div>
          {visual && <div className={`shrink-0 ${compact ? "self-end pb-0.5" : ""}`}>{visual}</div>}
        </div>
      </div>
    </Wrapper>
  );
}
