"use client";

import React from "react";
import CreatorToolCard, { type CreatorToolCardProps } from "./CreatorToolCard";

interface CreatorToolsGridProps {
  tools: CreatorToolCardProps[];
  loading: boolean;
  disabledReason?: string | null;
  footnote?: string | null;
}

function CreatorToolsGridSkeleton() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_40px_rgba(15,23,42,0.06)]">
      <div className="h-6 w-52 animate-pulse rounded bg-slate-200" />
      <div className="mt-2 h-4 w-80 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-slate-100 p-5">
            <div className="h-10 w-10 rounded-2xl bg-slate-200" />
            <div className="mt-4 h-4 w-32 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full rounded bg-slate-100" />
            <div className="mt-6 h-3 w-1/2 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function CreatorToolsGrid({ tools, loading, disabledReason, footnote }: CreatorToolsGridProps) {
  if (loading && !tools.length) {
    return <CreatorToolsGridSkeleton />;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_24px_40px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-500">Ferramentas</p>
          <h2 className="mt-1 text-2xl font-semibold text-slate-900">Atalhos rápidos para monetizar</h2>
          <p className="mt-2 text-sm text-slate-600">Acesse as ferramentas que ajudam a fechar campanhas.</p>
        </div>
        {disabledReason ? (
          <span className="rounded-full bg-slate-100 px-4 py-1 text-xs font-semibold text-slate-600">
            {disabledReason}
          </span>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((tool) => (
          <CreatorToolCard key={tool.id} {...tool} disabled={Boolean(disabledReason) || tool.disabled} />
        ))}
      </div>

      {footnote ? (
        <p className="mt-6 text-xs text-slate-500">{footnote}</p>
      ) : null}
    </section>
  );
}
