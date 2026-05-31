"use client";

import { useEffect, type ReactNode } from "react";

interface Props {
  title: string;
  iconBg: string;
  iconSlot: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Full-screen overlay for category detail — mirrors ReadingDetailView pattern */
export function DiagnosticoCategoryDetailView({
  title,
  iconBg,
  iconSlot,
  onClose,
  children,
}: Props) {
  // Esc to close (a11y)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#F2F2F7] animate-in slide-in-from-right duration-300"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="relative grid h-[64px] shrink-0 grid-cols-[56px_1fr_56px] items-center px-3">
        <button
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-zinc-950 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur transition-transform duration-200 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          aria-label="Voltar"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15.5 19l-7-7 7-7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <div className="flex min-w-0 items-center justify-center gap-2">
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${iconBg}`}
            aria-hidden="true"
          >
            {iconSlot}
          </span>
          <p className="truncate text-[18px] font-bold tracking-tight text-zinc-950">{title}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-10 pt-1">
        <div className="mx-auto flex w-full max-w-[430px] flex-col gap-3.5">{children}</div>
      </div>
    </div>
  );
}
