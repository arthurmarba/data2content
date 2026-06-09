"use client";

import WhatsAppConnectInline from "@/app/dashboard/WhatsAppConnectInline";
import { DiagnosticoCloseButton } from "./DiagnosticoCloseButton";

interface Props {
  onClose: () => void;
}

export function DiagnosticoWhatsAppSheet({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-[260] flex items-end bg-zinc-950/35 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]"
      role="presentation"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Vincular WhatsApp"
        className="w-full max-w-md rounded-[1.5rem] border border-zinc-200 bg-white shadow-[0_28px_80px_rgba(24,24,27,0.18)] animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="mb-2 flex justify-center pt-3" aria-hidden="true">
          <div className="h-1 w-10 rounded-full bg-zinc-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-2">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-tight text-zinc-950">
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
