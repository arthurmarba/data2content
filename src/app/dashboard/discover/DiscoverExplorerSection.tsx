"use client";

import { useEffect, useId, useState } from "react";
import dynamic from "next/dynamic";

type PostCard = {
  id: string;
};

type Section = {
  key: string;
  title: string;
  items: PostCard[];
};

type DiscoverExplorerSectionProps = {
  sections: Section[];
  primaryKey?: string | null;
  compactView?: boolean;
  desktopCompactPreview?: boolean;
  deferFilters?: boolean;
};

function DiscoverChipsLoading({ compactView = false }: { compactView?: boolean }) {
  return (
    <div
      className={`animate-pulse rounded-full bg-zinc-100/90 ${
        compactView ? "h-10 w-full" : "h-[3.25rem] w-full"
      }`}
      aria-hidden="true"
    />
  );
}

function DiscoverRailsLoading({
  compactView = false,
  desktopCompactPreview = false,
}: {
  compactView?: boolean;
  desktopCompactPreview?: boolean;
}) {
  return (
    <div
      className={compactView ? "space-y-3.5" : "space-y-3 sm:space-y-4"}
      aria-hidden="true"
    >
      {Array.from({ length: compactView ? 2 : 3 }).map((_, sectionIndex) => (
        <section
          key={`discover-rails-loading-${sectionIndex}`}
          className={`w-full ${sectionIndex > 0 ? "border-t border-zinc-100/90 pt-3.5 sm:pt-5" : ""}`}
        >
          <div className={compactView ? "space-y-2 py-0.5" : "space-y-2.5 py-1 sm:py-2"}>
            <div className="h-5 w-44 animate-pulse rounded-full bg-zinc-200/90" />
            <div
              className={`flex overflow-hidden ${
                desktopCompactPreview
                  ? "gap-1.5"
                  : compactView
                    ? "gap-1.5"
                    : "gap-3 sm:gap-4"
              }`}
            >
              {Array.from({ length: compactView ? 2 : 3 }).map((__, cardIndex) => (
                <div
                  key={`discover-rails-loading-card-${sectionIndex}-${cardIndex}`}
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
  );
}

const DiscoverChips = dynamic(
  () => import("../../discover/components/DiscoverChips"),
  {
    ssr: false,
    loading: () => <DiscoverChipsLoading />,
  },
);

const DiscoverRails = dynamic(
  () => import("../../discover/components/DiscoverRails"),
  {
    ssr: false,
    loading: () => <DiscoverRailsLoading />,
  },
);

export default function DiscoverExplorerSection({
  sections,
  primaryKey,
  compactView = false,
  desktopCompactPreview = false,
  deferFilters = false,
}: DiscoverExplorerSectionProps) {
  const headingId = useId();
  const stickyOffsetClassName = compactView ? "top-[3.65rem]" : "top-[4.7rem]";
  const [filtersReady, setFiltersReady] = useState(!deferFilters);

  useEffect(() => {
    if (!deferFilters) {
      setFiltersReady(true);
      return;
    }

    setFiltersReady(false);
    const frame = window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        setFiltersReady(true);
      }, 120);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [deferFilters]);

  return (
    <section aria-labelledby={headingId} className={compactView ? "space-y-4" : "space-y-4"}>
      <header className={compactView ? "" : "space-y-2"}>
        <div className={`flex ${compactView ? "items-end justify-between gap-3" : "flex-col gap-1 sm:flex-row sm:items-end sm:justify-between"}`}>
          <div>
            {!compactView ? (
              <p id={headingId} className="dashboard-muted-label text-zinc-400">
                Explorar agora
              </p>
            ) : null}
            {!compactView ? (
              <h3 className="text-lg font-semibold tracking-tight text-zinc-900">
                Coleções em movimento
              </h3>
            ) : null}
          </div>
          {!compactView ? (
            <p className="text-sm text-zinc-500">
              Filtros por formato, intenção e contexto sem sair do board.
            </p>
          ) : null}
        </div>
      </header>

      <div className={compactView ? "px-0 pt-0 pb-3" : "px-0 py-2"}>
        <div
          className={`sticky ${stickyOffsetClassName} z-20 transition-all ${
            compactView
              ? "px-0"
              : "bg-white border-y border-zinc-100 px-0 py-3"
          }`}
        >
          {filtersReady ? <DiscoverChips compactView={compactView} /> : <DiscoverChipsLoading compactView={compactView} />}
        </div>
      </div>

      <DiscoverRails
        sections={sections}
        primaryKey={primaryKey}
        compactView={compactView}
        desktopCompactPreview={desktopCompactPreview}
      />
    </section>
  );
}
