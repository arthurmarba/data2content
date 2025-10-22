// src/app/dashboard/home/components/QuickActionCard.tsx
// Card compacto utilizado na seção "Ações rápidas".

"use client";

import React from "react";

import ActionButton from "./ActionButton";

interface QuickActionCardProps {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  highlight?: React.ReactNode;
  footnote?: string;
  disabled?: boolean;
  tone?: "default" | "muted";
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
}

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

export default function QuickActionCard({
  icon,
  title,
  description,
  highlight,
  footnote,
  disabled,
  tone = "default",
  primaryAction,
  secondaryAction,
}: QuickActionCardProps) {
  const surface =
    tone === "muted"
      ? "bg-[#FAFAFA] border-transparent"
      : "bg-white border-slate-200/80";

  return (
    <section
      className={cn(
        "flex h-full flex-col justify-between gap-4 rounded-2xl border p-5 shadow-sm transition",
        surface,
        disabled
          ? "cursor-not-allowed opacity-60"
          : "hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(15,23,42,0.08)]"
      )}
    >
      <div className="space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-purple/10 text-brand-purple">
            {icon}
          </span>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {highlight ? (
              <div className="text-lg font-semibold text-slate-900">{highlight}</div>
            ) : null}
            <p className="text-sm text-slate-600">{description}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {primaryAction ? (
          <ActionButton
            label={primaryAction.label}
            icon={primaryAction.icon}
            onClick={primaryAction.onClick}
            disabled={disabled}
            className="w-full justify-center px-4 py-2 text-sm"
          />
        ) : null}
        {secondaryAction ? (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            disabled={disabled}
            className="w-full text-sm font-semibold text-brand-purple underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-purple/30 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60"
          >
            {secondaryAction.label}
          </button>
        ) : null}
        {footnote ? (
          <p className="text-xs text-slate-500">{footnote}</p>
        ) : null}
      </div>
    </section>
  );
}
