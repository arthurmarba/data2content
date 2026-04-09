"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";

import { limitCategoryBars } from "@/app/lib/planning/categoryRankingUtils";

type CompactMetricRow = { name: string; value: number; postsCount?: number };

export type CompactMetricVisualKey =
  | "proposal"
  | "context"
  | "tone"
  | "references"
  | "content-intent"
  | "narrative-form"
  | "content-signals"
  | "stance"
  | "proof-style"
  | "commercial-mode";

export type CompactMetricSectionItem = {
  key: string;
  title: string;
  rows: CompactMetricRow[];
  loading: boolean;
  visualKey: CompactMetricVisualKey;
  icon: React.ReactNode;
  emptyText: string;
  onSelect?: (row: CompactMetricRow) => void;
  valueFormatter?: (value: number) => string;
};

type CompactCategoryVisual = {
  accentClassName: string;
  iconClassName: string;
  iconContainerClassName: string;
  rankBadgeClassName: string;
  trackClassName: string;
  buttonClassName: string;
  arrowClassName: string;
};

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatPostsCount(count: number) {
  const rounded = Math.max(0, Math.round(count));
  return `${numberFormatter.format(rounded)} post${rounded === 1 ? "" : "s"}`;
}

const COMPACT_CATEGORY_VISUALS = {
  proposal: {
    accentClassName: "bg-indigo-500",
    iconClassName: "text-indigo-600",
    iconContainerClassName: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/90",
    rankBadgeClassName: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100/90",
    trackClassName: "bg-indigo-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-indigo-100 hover:bg-indigo-50/45 focus:outline-none focus-visible:border-indigo-200 focus-visible:bg-indigo-50/60",
    arrowClassName:
      "text-indigo-300 group-hover:text-indigo-500 group-focus-visible:text-indigo-500",
  },
  context: {
    accentClassName: "bg-sky-500",
    iconClassName: "text-sky-600",
    iconContainerClassName: "bg-sky-50 text-sky-600 ring-1 ring-sky-100/90",
    rankBadgeClassName: "bg-sky-50 text-sky-600 ring-1 ring-sky-100/90",
    trackClassName: "bg-sky-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-sky-100 hover:bg-sky-50/45 focus:outline-none focus-visible:border-sky-200 focus-visible:bg-sky-50/60",
    arrowClassName:
      "text-sky-300 group-hover:text-sky-500 group-focus-visible:text-sky-500",
  },
  tone: {
    accentClassName: "bg-emerald-500",
    iconClassName: "text-emerald-600",
    iconContainerClassName: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90",
    rankBadgeClassName: "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100/90",
    trackClassName: "bg-emerald-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-emerald-100 hover:bg-emerald-50/45 focus:outline-none focus-visible:border-emerald-200 focus-visible:bg-emerald-50/60",
    arrowClassName:
      "text-emerald-300 group-hover:text-emerald-500 group-focus-visible:text-emerald-500",
  },
  references: {
    accentClassName: "bg-amber-500",
    iconClassName: "text-amber-600",
    iconContainerClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
    rankBadgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
    trackClassName: "bg-amber-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-amber-100 hover:bg-amber-50/45 focus:outline-none focus-visible:border-amber-200 focus-visible:bg-amber-50/60",
    arrowClassName:
      "text-amber-300 group-hover:text-amber-500 group-focus-visible:text-amber-500",
  },
  "content-intent": {
    accentClassName: "bg-blue-600",
    iconClassName: "text-blue-600",
    iconContainerClassName: "bg-blue-50 text-blue-600 ring-1 ring-blue-100/90",
    rankBadgeClassName: "bg-blue-50 text-blue-600 ring-1 ring-blue-100/90",
    trackClassName: "bg-blue-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-blue-100 hover:bg-blue-50/45 focus:outline-none focus-visible:border-blue-200 focus-visible:bg-blue-50/60",
    arrowClassName:
      "text-blue-300 group-hover:text-blue-500 group-focus-visible:text-blue-500",
  },
  "narrative-form": {
    accentClassName: "bg-violet-600",
    iconClassName: "text-violet-600",
    iconContainerClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100/90",
    rankBadgeClassName: "bg-violet-50 text-violet-600 ring-1 ring-violet-100/90",
    trackClassName: "bg-violet-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-violet-100 hover:bg-violet-50/45 focus:outline-none focus-visible:border-violet-200 focus-visible:bg-violet-50/60",
    arrowClassName:
      "text-violet-300 group-hover:text-violet-500 group-focus-visible:text-violet-500",
  },
  "content-signals": {
    accentClassName: "bg-teal-600",
    iconClassName: "text-teal-600",
    iconContainerClassName: "bg-teal-50 text-teal-600 ring-1 ring-teal-100/90",
    rankBadgeClassName: "bg-teal-50 text-teal-600 ring-1 ring-teal-100/90",
    trackClassName: "bg-teal-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-teal-100 hover:bg-teal-50/45 focus:outline-none focus-visible:border-teal-200 focus-visible:bg-teal-50/60",
    arrowClassName:
      "text-teal-300 group-hover:text-teal-500 group-focus-visible:text-teal-500",
  },
  stance: {
    accentClassName: "bg-rose-500",
    iconClassName: "text-rose-600",
    iconContainerClassName: "bg-rose-50 text-rose-600 ring-1 ring-rose-100/90",
    rankBadgeClassName: "bg-rose-50 text-rose-600 ring-1 ring-rose-100/90",
    trackClassName: "bg-rose-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-rose-100 hover:bg-rose-50/45 focus:outline-none focus-visible:border-rose-200 focus-visible:bg-rose-50/60",
    arrowClassName:
      "text-rose-300 group-hover:text-rose-500 group-focus-visible:text-rose-500",
  },
  "proof-style": {
    accentClassName: "bg-amber-700",
    iconClassName: "text-amber-700",
    iconContainerClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
    rankBadgeClassName: "bg-amber-50 text-amber-700 ring-1 ring-amber-100/90",
    trackClassName: "bg-amber-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-amber-100 hover:bg-amber-50/45 focus:outline-none focus-visible:border-amber-200 focus-visible:bg-amber-50/60",
    arrowClassName:
      "text-amber-300 group-hover:text-amber-600 group-focus-visible:text-amber-600",
  },
  "commercial-mode": {
    accentClassName: "bg-pink-600",
    iconClassName: "text-pink-600",
    iconContainerClassName: "bg-pink-50 text-pink-600 ring-1 ring-pink-100/90",
    rankBadgeClassName: "bg-pink-50 text-pink-600 ring-1 ring-pink-100/90",
    trackClassName: "bg-pink-100/80",
    buttonClassName:
      "rounded-[1.15rem] border border-transparent px-2 py-2 transition hover:border-pink-100 hover:bg-pink-50/45 focus:outline-none focus-visible:border-pink-200 focus-visible:bg-pink-50/60",
    arrowClassName:
      "text-pink-300 group-hover:text-pink-500 group-focus-visible:text-pink-500",
  },
} satisfies Record<CompactMetricVisualKey, CompactCategoryVisual>;

function CompactCategoryRankingSummary({
  title,
  rows,
  loading,
  visual,
  icon,
  emptyText,
  onSelect,
  valueFormatter,
}: {
  title: string;
  rows: CompactMetricRow[];
  loading: boolean;
  visual: CompactCategoryVisual;
  icon: React.ReactNode;
  emptyText: string;
  onSelect?: (row: CompactMetricRow) => void;
  valueFormatter?: (value: number) => string;
}) {
  if (loading || !rows.length) {
    return (
      <div className="py-3.5">
        <p className="dashboard-type-section-title">{title}</p>
        <p className="dashboard-type-body mt-2">{emptyText}</p>
      </div>
    );
  }

  const visibleRows = limitCategoryBars(rows);
  const maxValue = Math.max(...visibleRows.map((row) => row.value), 0);

  return (
    <div className="border-t border-zinc-100/75 pt-4 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[0.85rem] ${visual.iconContainerClassName}`}
          >
            <span className={visual.iconClassName}>{icon}</span>
          </div>
          <div className="min-w-0">
            <p className="dashboard-type-section-title text-zinc-950">{title}</p>
          </div>
        </div>
      </div>

      <div className="mt-3.5 space-y-3">
        {visibleRows.map((row, index) => {
          const width = maxValue > 0 ? Math.max(12, Math.min(100, (row.value / maxValue) * 100)) : 0;
          const content = (
            <div className="flex items-start gap-3.5">
              <span
                className={`dashboard-type-control inline-flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full ${visual.rankBadgeClassName}`}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="dashboard-type-item-title line-clamp-2 pr-2 leading-snug text-zinc-900">
                      {row.name}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="dashboard-type-meta text-zinc-400">
                        {typeof row.postsCount === "number" && row.postsCount > 0
                          ? formatPostsCount(row.postsCount)
                          : "Sem posts suficientes"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="dashboard-type-kpi-sm block tabular-nums text-zinc-900">
                      {valueFormatter
                        ? valueFormatter(row.value)
                        : numberFormatter.format(Math.round(row.value))}
                    </span>
                  </div>
                </div>
                <div className={`dashboard-progress-track mt-3 h-1.5 rounded-full ${visual.trackClassName}`}>
                  <div className={`h-full rounded-full ${visual.accentClassName}`} style={{ width: `${width}%` }} />
                </div>
              </div>
            </div>
          );

          if (!onSelect) {
            return (
              <div key={`${title}-${row.name}-${index}`} className="rounded-[1.15rem] px-2 py-2">
                {content}
              </div>
            );
          }

          return (
            <button
              key={`${title}-${row.name}-${index}`}
              type="button"
              onClick={() => onSelect(row)}
              className={`group w-full cursor-pointer text-left ${visual.buttonClassName}`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">{content}</div>
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-full p-1 transition ${visual.arrowClassName}`}
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PlanningChartsCompactMetricSection({
  items,
}: {
  items: CompactMetricSectionItem[];
}) {
  return (
    <div className="space-y-3.5">
      <section className="space-y-4">
        {items.map((item) => (
          <CompactCategoryRankingSummary
            key={item.key}
            title={item.title}
            rows={item.rows}
            loading={item.loading}
            visual={COMPACT_CATEGORY_VISUALS[item.visualKey]}
            icon={item.icon}
            emptyText={item.emptyText}
            onSelect={item.onSelect}
            valueFormatter={item.valueFormatter}
          />
        ))}
      </section>
    </div>
  );
}
