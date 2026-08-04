"use client";

import React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, X } from "lucide-react";

import type { RecordedMeeting } from "@/app/lib/community/recordedMeetingsService";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
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
  React.useEffect(() => {
    if (!meeting) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [meeting, onClose]);

  if (!meeting || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Assistir ${meeting.title}`}
        className="w-full max-w-6xl overflow-hidden rounded-2xl bg-zinc-950 text-white shadow-2xl sm:rounded-[28px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {formatMeetingDate(meeting.publishedAt)}
            </p>
            <h2 className="mt-1.5 line-clamp-2 text-base font-semibold leading-6 sm:text-xl">
              {meeting.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
            aria-label="Fechar vídeo"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <iframe
          key={meeting.youtubeVideoId}
          className="block w-full bg-black"
          style={{ aspectRatio: "16 / 9" }}
          src={`https://www.youtube.com/embed/${meeting.youtubeVideoId}?autoplay=1&rel=0&modestbranding=1`}
          title={meeting.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </section>
    </div>,
    document.body,
  );
}
