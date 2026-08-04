"use client";

import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

import Board from "@/app/dashboard/components/Board";

type PreviewTone = "rose" | "violet" | "emerald" | "amber";

type PreviewStat = {
  label: string;
  value: string;
};

const TONE_STYLES: Record<PreviewTone, { icon: string; eyebrow: string; glow: string }> = {
  rose: {
    icon: "bg-rose-50 text-rose-600 ring-rose-100",
    eyebrow: "text-rose-600",
    glow: "from-rose-100/75",
  },
  violet: {
    icon: "bg-violet-50 text-violet-700 ring-violet-100",
    eyebrow: "text-violet-700",
    glow: "from-violet-100/75",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    eyebrow: "text-emerald-700",
    glow: "from-emerald-100/75",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700 ring-amber-100",
    eyebrow: "text-amber-700",
    glow: "from-amber-100/75",
  },
};

export default function DashboardOverviewBoard({
  title,
  eyebrow,
  headline,
  description,
  icon: Icon,
  tone = "rose",
  tags = [],
  stats = [],
  actionLabel,
  onAction,
  isHighlighted = false,
  loading = false,
}: {
  title: string;
  eyebrow: string;
  headline: string;
  description: string;
  icon: LucideIcon;
  tone?: PreviewTone;
  tags?: string[];
  stats?: PreviewStat[];
  actionLabel: string;
  onAction: () => void;
  isHighlighted?: boolean;
  loading?: boolean;
}) {
  const toneStyle = TONE_STYLES[tone];

  return (
    <Board
      title={title}
      showTitleMarker={false}
      variant="card"
      showChevron={false}
      showOptions={false}
      contentClassName="bg-white"
      contentScrollable={false}
      titleClassName="text-zinc-950"
      isHighlighted={isHighlighted}
    >
      <div className="relative flex h-full min-h-[450px] flex-col overflow-hidden px-6 pb-6 pt-7">
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b ${toneStyle.glow} to-transparent opacity-70`}
        />

        {loading ? (
          <OverviewSkeleton />
        ) : (
          <>
            <div className="relative flex items-center justify-between gap-4">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${toneStyle.icon}`}>
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className={`text-[11px] font-bold uppercase tracking-[0.16em] ${toneStyle.eyebrow}`}>
                {eyebrow}
              </span>
            </div>

            <div className="relative mt-8">
              <h3 className="max-w-[19ch] text-[1.7rem] font-semibold leading-[1.08] tracking-[-0.045em] text-zinc-950">
                {headline}
              </h3>
              <p className="mt-4 line-clamp-3 text-[14px] leading-6 text-zinc-600">
                {description}
              </p>
            </div>

            {tags.length > 0 ? (
              <ul className="relative mt-6 flex flex-wrap gap-2" aria-label="Destaques">
                {tags.slice(0, 3).map((tag) => (
                  <li
                    key={tag}
                    className="max-w-full truncate rounded-full border border-zinc-200/90 bg-zinc-50 px-3 py-1.5 text-[12px] font-medium text-zinc-700"
                  >
                    {tag}
                  </li>
                ))}
              </ul>
            ) : null}

            {stats.length > 0 ? (
              <dl className="relative mt-auto grid grid-cols-2 gap-5 border-y border-zinc-200/80 py-5">
                {stats.slice(0, 2).map((stat) => (
                  <div key={stat.label} className="min-w-0">
                    <dt className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-400">
                      {stat.label}
                    </dt>
                    <dd className="mt-1 truncate text-[15px] font-semibold text-zinc-900">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <div className="mt-auto" />
            )}

            <button
              type="button"
              onClick={onAction}
              className="relative mt-5 inline-flex min-h-11 w-full items-center justify-between rounded-full bg-zinc-950 px-5 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(24,24,27,0.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-black hover:shadow-[0_18px_34px_rgba(24,24,27,0.2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
            >
              {actionLabel}
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </Board>
  );
}

function OverviewSkeleton() {
  return (
    <div className="relative flex h-full animate-pulse flex-col" aria-busy="true" aria-label="Carregando resumo">
      <div className="flex items-center justify-between">
        <div className="h-11 w-11 rounded-2xl bg-zinc-100" />
        <div className="h-3 w-24 rounded bg-zinc-100" />
      </div>
      <div className="mt-9 h-7 w-4/5 rounded bg-zinc-100" />
      <div className="mt-3 h-7 w-3/5 rounded bg-zinc-100" />
      <div className="mt-6 h-4 w-full rounded bg-zinc-100" />
      <div className="mt-2 h-4 w-5/6 rounded bg-zinc-100" />
      <div className="mt-auto border-y border-zinc-100 py-5">
        <div className="h-5 w-1/2 rounded bg-zinc-100" />
      </div>
      <div className="mt-5 h-11 rounded-full bg-zinc-100" />
    </div>
  );
}
