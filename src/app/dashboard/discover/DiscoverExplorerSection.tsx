"use client";

import { useId } from "react";
import DiscoverChips from "../../discover/components/DiscoverChips";
import DiscoverRails from "../../discover/components/DiscoverRails";

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
};

export default function DiscoverExplorerSection({
  sections,
  primaryKey,
  compactView = false,
  desktopCompactPreview = false,
}: DiscoverExplorerSectionProps) {
  const headingId = useId();
  const stickyOffsetClassName = compactView ? "top-[3.65rem]" : "top-[4.7rem]";

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
              : "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] backdrop-blur-md border-y border-zinc-100/70 px-0 py-3"
          }`}
        >
          <DiscoverChips compactView={compactView} />
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
