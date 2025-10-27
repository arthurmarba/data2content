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
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-6">
        <header className="space-y-1 text-left">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Explorar ideias por formato</p>
          <h2 id={headingId} className="text-lg font-semibold text-slate-900 sm:text-xl">
            Explore o que está performando em cada tipo de ideia
          </h2>
          <p className="text-xs text-slate-500">
            Use os filtros para navegar rapidamente por formatos, propostas e contextos. A IA já selecionou os destaques mais recentes para você.
          </p>
        </header>
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
          <DiscoverChips />
        </div>
      </div>

      <DiscoverRails sections={sections} primaryKey={primaryKey} />
    </section>
  );
}
