"use client";

import React from "react";
import { X } from "lucide-react";
import OnboardingSurveyStepper from "@/app/landing/components/OnboardingSurveyStepper";

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
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-slate-900/75 py-6 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pesquisa de personalização"
      onClick={onClose}
    >
      <div
        className="relative z-[210] mx-auto flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white text-base shadow-[0_24px_80px_rgba(15,23,42,0.2)] max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-end border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            aria-label="Fechar pesquisa"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6 sm:px-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          <OnboardingSurveyStepper
            metrics={null}
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
