"use client";

import { useEffect, type ReactNode } from "react";
import { DiagnosticoNavHeader } from "./DiagnosticoNavHeader";
import { SAFE_TOP } from "./diagnosticoTokens";

interface Props {
  title: string;
  iconBg: string;
  iconSlot: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** Slot opcional no canto direito do header — ex: botão Comunidade na tela de Collabs. */
  actionSlot?: ReactNode;
  /** Faz o detalhe continuar o caderno editorial do Perfil. */
  presentation?: "default" | "notebook";
}

/** Full-screen overlay for category detail — mirrors ReadingDetailView pattern */
export function DiagnosticoCategoryDetailView({
  title,
  onClose,
  children,
  actionSlot,
  presentation = "default",
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
      className="ds-screen fixed inset-0 z-50 flex flex-col overflow-hidden animate-in slide-in-from-right duration-300"
      style={{ paddingTop: SAFE_TOP }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <DiagnosticoNavHeader title={title} onBack={onClose} actionSlot={actionSlot} />

      <div className={`flex-1 overflow-y-auto overscroll-contain ${presentation === "notebook" ? "bg-[var(--ds-color-neutral)]" : "px-3 pb-10 pt-5"}`}>
        <div className={presentation === "notebook"
          ? "ds-notebook-page ds-analysis-editorial !max-w-[32rem] !pb-10 !pt-5"
          : "mx-auto flex w-full max-w-[430px] flex-col gap-3.5"}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
