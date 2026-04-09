"use client";

import React from "react";
import { Sparkles } from "lucide-react";

export type PlanningChartsStrategicHeroCardProps = {
  variant?: "default" | "compact" | "inline";
  eyebrow: string;
  headline: string;
  reading?: string | null;
  bulletPoints?: string[];
  action?: string | null;
  supportingNote?: string | null;
  statusChip?: string | null;
  children?: React.ReactNode;
  footer?: React.ReactNode;
};

export function PlanningChartsStrategicHeroCard({
  variant = "default",
  eyebrow,
  headline,
  reading,
  bulletPoints,
  action,
  supportingNote,
  statusChip,
  children,
  footer,
}: PlanningChartsStrategicHeroCardProps) {
  const isCompact = variant === "compact";
  const isInline = variant === "inline";

  if (isInline) {
    return (
      <article className="dashboard-dark-spotlight relative overflow-hidden rounded-[1.2rem] border border-white/5 px-3 py-2 shadow-[0_18px_30px_rgba(15,23,42,0.18)]">
        <div className="relative flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2 py-0.5">
            <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-pink-500/10">
              <Sparkles className="h-2.5 w-2.5 text-pink-300" />
            </div>
            <h2 className="text-[11px] font-semibold leading-tight text-white/95">{headline}</h2>
          </div>
          {statusChip ? (
            <span className="dashboard-glass-pill shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white/70">
              {statusChip}
            </span>
          ) : null}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`dashboard-dark-spotlight relative overflow-hidden rounded-[1.75rem] ${
        isCompact ? "px-3.5 py-3 shadow-lg sm:px-4 sm:py-3.5" : "px-4 py-3.5 shadow-xl"
      }`}
    >
      <div
        className={`absolute rounded-full bg-pink-500/20 ${
          isCompact ? "-right-6 -top-6 h-28 w-28 blur-2xl" : "-right-10 -top-10 h-40 w-40 blur-3xl"
        }`}
      />
      <div
        className={`absolute rounded-full bg-amber-400/10 ${
          isCompact ? "-bottom-8 -left-8 h-28 w-28 blur-2xl" : "-bottom-10 -left-10 h-40 w-40 blur-3xl"
        }`}
      />

      <div className={`relative ${isCompact ? "space-y-2.5" : "space-y-1.5"}`}>
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2">
              <Sparkles className={`text-pink-300 ${isCompact ? "h-3.5 w-3.5" : "h-4 w-4"}`} />
              <span className="text-[11px] font-bold uppercase tracking-widest text-pink-200">{eyebrow}</span>
            </div>
            {statusChip ? (
              <span
                className={`dashboard-glass-pill inline-flex items-center rounded-full font-semibold text-white/80 ${
                  isCompact ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-0.5 text-[10px]"
                }`}
              >
                {statusChip}
              </span>
            ) : null}
          </div>
          <h2
            className={`font-semibold leading-tight text-white ${
              isCompact ? "max-w-4xl text-[1.05rem] sm:text-[1.2rem]" : "max-w-3xl text-xl sm:text-2xl"
            }`}
          >
            {headline}
          </h2>
        </div>

        {isCompact && bulletPoints && bulletPoints.length > 0 ? (
          <ul className="space-y-1.5">
            {bulletPoints.slice(0, 2).map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] leading-relaxed text-white sm:text-sm">
                <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full bg-pink-300" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : reading ? (
          <p className={`leading-relaxed text-white ${isCompact ? "max-w-4xl text-[13px] sm:text-sm" : "text-sm"}`}>
            {reading}
          </p>
        ) : null}

        {children}

        {action || supportingNote ? (
          isCompact ? (
            <div className="border-t border-white/10 pt-2">
              {action ? (
                <p className="text-sm font-medium leading-relaxed text-white">
                  <span className="mr-1 text-[10px] font-bold uppercase tracking-[0.14em] text-pink-100">Faça agora</span>
                  {action}
                </p>
              ) : null}
              {supportingNote ? (
                <p className={`${action ? "mt-1" : ""} text-[11px] leading-relaxed text-white/80`}>{supportingNote}</p>
              ) : null}
            </div>
          ) : (
            <div className="pt-1">
              {action ? (
                <>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-pink-100">Faça agora</p>
                  <p className="mt-1 text-sm font-medium leading-relaxed text-white">{action}</p>
                </>
              ) : null}
              {supportingNote ? (
                <p className={`${action ? "mt-1.5" : ""} text-xs leading-relaxed text-white/80`}>{supportingNote}</p>
              ) : null}
            </div>
          )
        ) : null}

        {footer}
      </div>
    </article>
  );
}
