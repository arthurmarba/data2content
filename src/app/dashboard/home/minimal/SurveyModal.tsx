"use client";

import React from "react";
import { X } from "lucide-react";
import OnboardingSurveyStepper from "@/app/landing/components/OnboardingSurveyStepper";
import { d2cFontVariables } from "@/app/fonts/d2cFonts";

type SurveyModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export default function SurveyModal({ open, onClose, onSaved }: SurveyModalProps) {
  React.useEffect(() => {
    if (!open) return undefined;
    const { style } = document.body;
    const previousOverflow = style.overflow;
    style.overflow = "hidden";
    return () => {
      style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className={`d2c-mobile-app ds-notebook ds-scrim fixed inset-0 z-[300] flex items-end justify-center overflow-y-auto sm:items-center sm:px-4 sm:py-6 ${d2cFontVariables}`}
      role="dialog"
      aria-modal="true"
      aria-label="Pesquisa de personalização"
      onClick={onClose}
    >
      <div
        className="relative z-[310] mx-auto flex max-h-[calc(100dvh-env(safe-area-inset-top,0px)-0.75rem)] w-full max-w-5xl flex-col overflow-hidden rounded-t-[var(--ds-radius-xl)] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] text-base shadow-[var(--ds-shadow-overlay)] sm:max-h-[90dvh] sm:rounded-[var(--ds-radius-xl)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 z-10 flex min-h-[60px] items-center gap-3 border-b border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]/95 px-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <p className="ds-notebook-label">Configurações do Perfil</p>
            <h2 className="font-display text-[1.2rem] font-bold tracking-[-0.03em] text-[var(--ds-color-ink)]">Completar meu perfil</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ds-icon-button ds-icon-button--ghost"
            aria-label="Fechar pesquisa"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="ds-profile-survey dashboard-scrollbar flex-1 overflow-y-auto bg-[var(--ds-color-neutral)] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4 sm:px-8 sm:pt-6">
          <OnboardingSurveyStepper
            metrics={null}
            presentation="profile"
            onSaved={() => {
              onSaved?.();
              onClose();
            }}
          />
        </div>
      </div>
    </div>
  );
}
