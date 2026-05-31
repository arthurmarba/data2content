"use client";

import { useState } from "react";

export function ReadingDetailAccordion({
  title,
  preview,
  defaultOpen = false,
  children,
}: {
  title: string;
  preview?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-zinc-100 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 py-4 text-left"
      >
        <span className="text-[14px] font-semibold text-zinc-800">{title}</span>
        <span
          className={`text-zinc-400 text-[18px] leading-none transition-transform duration-200 ${open ? "rotate-45" : ""}`}
          aria-hidden="true"
        >
          +
        </span>
      </button>

      {!open && preview && (
        <p className="pb-3 text-[12px] text-zinc-400 line-clamp-2 leading-[1.45] pr-6">
          {preview}
        </p>
      )}

      {open && (
        <div className="pb-4 flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
