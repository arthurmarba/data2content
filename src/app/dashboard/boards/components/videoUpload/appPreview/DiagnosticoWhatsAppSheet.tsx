"use client";

import WhatsAppConnectInline from "@/app/dashboard/WhatsAppConnectInline";
import { DiagnosticoCloseButton } from "./DiagnosticoCloseButton";

interface Props {
  onClose: () => void;
}

export function DiagnosticoWhatsAppSheet({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[260] flex items-end justify-center ds-scrim"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Vincular WhatsApp"
        className="ds-sheet ds-enter-sheet"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mb-2 flex justify-center pt-3" aria-hidden="true">
          <div className="ds-sheet__handle !m-0" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-2">
          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.25rem] font-bold tracking-[-0.03em] text-zinc-950">
              Receber pautas no WhatsApp
            </p>
            <p className="mt-0.5 text-[12px] text-zinc-400">
              Vincule seu número para receber suas pautas semanais.
            </p>
          </div>
          <DiagnosticoCloseButton onClose={onClose} edgeAlign />
        </div>

        {/* Conteúdo — WhatsAppConnectInline */}
        <div className="px-5 pb-6">
          <WhatsAppConnectInline />
        </div>
      </section>
    </div>
  );
}
