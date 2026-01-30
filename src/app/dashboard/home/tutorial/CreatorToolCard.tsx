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



  if (isDisabled) {
    return (
      <div className="flex h-full w-full flex-col items-start justify-between gap-4 rounded-3xl border border-slate-100 bg-slate-50/60 p-6 text-left opacity-70" title={locked ? "Disponível no Plano Pro" : undefined}>
        <div className="w-full space-y-4">
          <div className="flex w-full items-center justify-between gap-3">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl text-slate-400">
              {icon}
            </span>
            {badge ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {badge}
              </span>
            ) : null}
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-700">{title}</h3>
            <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="mt-2 w-full">
          <span className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-400">
            {locked ? <Lock className="h-3.5 w-3.5" aria-hidden /> : null}
            {cta === "activate" ? "Ativar Plano Pro" : "Abrir ferramenta"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="group relative flex h-full w-full flex-col items-start justify-between gap-4 rounded-3xl border border-slate-100 bg-white p-6 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6007B]/30 focus-visible:ring-offset-2"
      onClick={onClick}
      disabled={isDisabled}
      title={locked ? "Disponível no Plano Pro. Clique para assinar." : undefined}
    >
      <div className="w-full space-y-4">
        <div className="flex w-full items-center justify-between gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-xl text-[#F6007B] transition-colors group-hover:bg-[#F6007B]/10">
            {icon}
          </span>
          {badge ? (
            <span className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-rose-600">
              {badge}
            </span>
          ) : null}
        </div>
        <div className="space-y-1">
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="mt-2 w-full">
        <span className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors group-hover:bg-slate-100 group-hover:text-slate-900">
          {locked ? <Lock className="h-3.5 w-3.5 text-rose-500" aria-hidden /> : null}
          {cta === "activate" ? "Ativar Plano Pro" : "Abrir ferramenta"}
        </span>
      </div>
    </button>
  );
}
