"use client";

import React from "react";
import { Lock } from "lucide-react";

export interface CreatorToolCardProps {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  cta?: "open" | "activate";
  badge?: string | null;
  onClick?: () => void;
  locked?: boolean;
  disabled?: boolean;
}

export default function CreatorToolCard({
  title,
  description,
  icon,
  cta = "open",
  badge,
  onClick,
  locked,
  disabled,
}: CreatorToolCardProps) {
  const isDisabled = Boolean(disabled);

  const content = (
    <div className="flex h-full flex-col items-start text-left">
      <div className="flex w-full items-center justify-between gap-3">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-rose-500">
          {icon}
        </span>
        {badge ? (
          <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-600">
            {badge}
          </span>
        ) : null}
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 text-sm text-slate-600 flex-1">{description}</p>
      <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
        {locked ? <Lock className="h-4 w-4 text-rose-500" aria-hidden /> : null}
        <span>{cta === "activate" ? "Ativar PRO" : "Abrir"}</span>
      </div>
    </div>
  );

  if (isDisabled) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5 opacity-70" title={locked ? "Disponível no PRO" : undefined}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="h-full w-full rounded-2xl border border-slate-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200"
      onClick={onClick}
      disabled={isDisabled}
      title={locked ? "Disponível no PRO. Clique para assinar." : undefined}
    >
      {content}
    </button>
  );
}
