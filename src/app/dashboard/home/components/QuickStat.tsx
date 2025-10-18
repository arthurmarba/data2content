"use client";

import React from "react";

interface QuickStatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "alert" | "success";
  className?: string;
}

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

function toneClasses(tone: QuickStatProps["tone"]) {
  switch (tone) {
    case "alert":
      return "bg-amber-50 text-amber-900 border-amber-100";
    case "success":
      return "bg-emerald-50 text-emerald-900 border-emerald-100";
    default:
      return "bg-slate-50 text-slate-900 border-slate-100";
  }
}

function labelToneClasses(tone: QuickStatProps["tone"]) {
  switch (tone) {
    case "alert":
      return "text-amber-600";
    case "success":
      return "text-emerald-600";
    default:
      return "text-slate-500";
  }
}

function valueToneClasses(tone: QuickStatProps["tone"]) {
  switch (tone) {
    case "alert":
      return "text-amber-900";
    case "success":
      return "text-emerald-900";
    default:
      return "text-slate-900";
  }
}

export default function QuickStat({
  label,
  value,
  helper,
  icon,
  tone = "default",
  className,
}: QuickStatProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-2xl border px-4 py-3",
        toneClasses(tone),
        className
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 text-xs font-semibold uppercase tracking-wide",
          labelToneClasses(tone)
        )}
      >
        {icon ? <span className="text-base">{icon}</span> : null}
        <div className="truncate">{label}</div>
      </div>
      <div className={cn("text-xl font-semibold", valueToneClasses(tone))}>{value}</div>
      {helper ? <div className="text-xs font-medium text-slate-500">{helper}</div> : null}
    </div>
  );
}
