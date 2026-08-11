"use client";

import React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";

import type { RecordedMeeting } from "@/app/lib/community/recordedMeetingsService";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function formatMeetingDate(value: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data não informada" : DATE_FORMATTER.format(date);
}

export default function RecordedMeetingPlayerDialog({
  meeting,
  onClose,
}: {
  meeting: RecordedMeeting | null;
  onClose: () => void;
}) {
  const dialogRef = React.useRef<HTMLElement | null>(null);
  const closeButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!meeting) return undefined;

    const previousOverflow = document.body.style.overflow;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;

    // Sem prender o foco, quem navega por teclado continuava andando pela
    // página atrás do vídeo, sem saber onde estava.
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], iframe, input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    closeButtonRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [meeting, onClose]);

  if (!meeting || typeof document === "undefined") return null;

  return createPortal(
    // No celular o vídeo ficava com 24% da altura da tela, flutuando no meio do
    // preto. Aqui ele encosta nas bordas e sobe para o topo; a moldura de
    // diálogo centralizado volta só a partir do desktop.
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      {/* Fora do fluxo: assim o conjunto vídeo + título fica centrado na tela
          em vez de encostar no topo com um vazio embaixo. */}
      <button
        ref={closeButtonRef}
        type="button"
        onClick={onClose}
        className="absolute right-3 z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-9 sm:top-9"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 0.75rem)" }}
        aria-label="Fechar vídeo"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Assistir ${meeting.title}`}
        className="w-full bg-zinc-950 text-white sm:max-w-6xl sm:overflow-hidden sm:rounded-[28px] sm:shadow-2xl"
      >
        <iframe
          key={meeting.youtubeVideoId}
          className="block w-full bg-black"
          style={{ aspectRatio: "16 / 9" }}
          // playsinline evita que o iPhone assuma o player nativo em tela cheia
          // sem a pessoa pedir.
          src={`https://www.youtube.com/embed/${meeting.youtubeVideoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`}
          title={meeting.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />

        {/* Título abaixo do vídeo: no celular ele deixa de disputar o topo com a
            imagem, que é o que a pessoa veio ver. */}
        <div className="min-w-0 px-4 pb-6 pt-4 sm:px-6">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-400">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatMeetingDate(meeting.publishedAt)}
          </p>
          <h2 className="mt-2 text-[17px] font-semibold leading-[1.35] sm:text-xl">{meeting.title}</h2>
        </div>
      </section>
    </div>,
    document.body,
  );
}
