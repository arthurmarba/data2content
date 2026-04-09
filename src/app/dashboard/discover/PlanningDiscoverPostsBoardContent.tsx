"use client";

import React from "react";
import NextDynamic from "next/dynamic";
import type { DiscoverSection } from "./discoverFeedUtils";

const DiscoverExplorerSection = NextDynamic(() => import("./DiscoverExplorerSection"), {
  loading: () => <DiscoverExplorerSectionLoading />,
});

type PlanningDiscoverPostsBoardContentProps = {
  sections: DiscoverSection[];
  primaryKey?: string | null;
  compactView?: boolean;
  desktopCompactPreview?: boolean;
};

function DiscoverExplorerSectionLoading({
  compactView = false,
  desktopCompactPreview = false,
}: {
  compactView?: boolean;
  desktopCompactPreview?: boolean;
}) {
  const containerClassName = desktopCompactPreview
    ? "space-y-5 px-5 pb-5 pt-1"
    : compactView
      ? "space-y-5 px-2 pb-6 pt-2"
      : "space-y-4.5 p-4 sm:p-5";

  return (
    <section className={containerClassName} aria-hidden="true">
      <div className={compactView ? "space-y-4" : "space-y-4"}>
        <div className={compactView ? "px-0 pt-0 pb-3" : "px-0 py-2"}>
          <div
            className={`animate-pulse rounded-full bg-zinc-100/90 ${
              compactView ? "h-10 w-full" : "h-[3.25rem] w-full"
            }`}
          />
        </div>
        <div className={compactView ? "space-y-3.5" : "space-y-3 sm:space-y-4"}>
          {Array.from({ length: compactView ? 2 : 3 }).map((_, sectionIndex) => (
            <section
              key={`planning-discover-loading-${sectionIndex}`}
              className={`w-full ${sectionIndex > 0 ? "border-t border-zinc-100/90 pt-3.5 sm:pt-5" : ""}`}
            >
              <div className={compactView ? "space-y-2 py-0.5" : "space-y-2.5 py-1 sm:py-2"}>
                <div className="h-5 w-44 animate-pulse rounded-full bg-zinc-200/90" />
                <div
                  className={`flex overflow-hidden ${
                    desktopCompactPreview ? "gap-1.5" : compactView ? "gap-1.5" : "gap-3 sm:gap-4"
                  }`}
                >
                  {Array.from({ length: compactView ? 2 : 3 }).map((__, cardIndex) => (
                    <div
                      key={`planning-discover-loading-card-${sectionIndex}-${cardIndex}`}
                      className={`animate-pulse rounded-[1.35rem] bg-zinc-100 ${
                        compactView ? "h-[190px] w-[132px]" : "h-[248px] w-[180px]"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function PlanningDiscoverPostsBoardContent({
  sections,
  primaryKey,
  compactView = false,
  desktopCompactPreview = false,
}: PlanningDiscoverPostsBoardContentProps) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return (
      <div className={desktopCompactPreview ? "px-5 pb-5 pt-1" : compactView ? "p-4" : "p-4 sm:p-5"}>
        <div className="dashboard-empty-state rounded-[1.35rem] border border-dashed border-zinc-200/80 px-4 py-6 text-sm text-zinc-500">
          Nenhuma coleção disponível para exibir agora. Tente novamente em instantes ou ajuste os filtros.
        </div>
      </div>
    );
  }

  return (
    <div className={desktopCompactPreview ? "space-y-5 px-5 pb-5 pt-1" : compactView ? "space-y-5 px-2 pb-6 pt-2" : "space-y-4.5 p-4 sm:p-5"}>
      <DiscoverExplorerSection
        sections={sections}
        primaryKey={primaryKey}
        compactView={compactView}
        desktopCompactPreview={desktopCompactPreview}
        deferFilters
      />
    </div>
  );
}
