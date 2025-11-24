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
};

export default function DiscoverExplorerSection({ sections, primaryKey }: DiscoverExplorerSectionProps) {
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="px-0 py-4">
        <header className="space-y-1 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Explorar ideias</p>
          <h2 id={headingId} className="text-lg font-semibold text-slate-900 sm:text-xl">
            Filtre e veja só o que importa
          </h2>
          <p className="text-xs text-slate-500">
            Combine formatos, propostas e contextos antes de aplicar para carregar um feed mais enxuto.
          </p>
        </header>
        <div className="sticky top-[var(--header-h,3.5rem)] z-20 mt-4 -mx-4 px-4 py-2 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b border-slate-100/50 transition-all">
          <DiscoverChips />
        </div>
      </div>

      <DiscoverRails sections={sections} primaryKey={primaryKey} />
    </section>
  );
}
