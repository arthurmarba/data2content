"use client";

import { useRouter } from "next/navigation";
import React from "react";
import { ArrowRight, CalendarDays, Film, Play } from "lucide-react";

import Board from "@/app/dashboard/components/Board";
import RecordedMeetingPlayerDialog from "@/app/dashboard/recorded-meetings/RecordedMeetingPlayerDialog";
import RecordedMeetingThumbnail from "@/app/dashboard/recorded-meetings/RecordedMeetingThumbnail";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import type {
  RecordedMeetingCatalogItem,
  RecordedMeetingPlayback,
} from "@/app/lib/community/recordedMeetingsService";
import { RECORDED_MEETINGS_ROUTE } from "@/constants/routes";
import { openPaywallModal } from "@/utils/paywallModal";

type LoadState = "idle" | "loading" | "ready" | "error";

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function formatMeetingDate(value: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data não informada" : DATE_FORMATTER.format(date);
}

function getMeetingSummary(description: string) {
  const summary = description
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .find(Boolean);
  return summary || "Análises e direcionamentos práticos da reunião semanal da D2C.";
}

export default function RecordedMeetingsPinnedBoard({
  isHighlighted = false,
}: {
  isHighlighted?: boolean;
}) {
  const router = useRouter();
  const billing = useBillingStatus();
  const hasPremiumAccess = Boolean(billing.hasPremiumAccess);
  const [loadState, setLoadState] = React.useState<LoadState>("idle");
  const [meetings, setMeetings] = React.useState<RecordedMeetingCatalogItem[]>([]);
  const [playingMeeting, setPlayingMeeting] = React.useState<RecordedMeetingPlayback | null>(null);

  React.useEffect(() => {
    if (!billing.hasResolvedOnce) return;
    const controller = new AbortController();
    setLoadState("loading");

    void fetch("/api/dashboard/recorded-meetings", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) throw new Error("recorded_meetings_unavailable");
        setMeetings(Array.isArray(payload.meetings) ? payload.meetings : []);
        setLoadState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("[recorded-meetings-board] Falha ao carregar:", error);
        setLoadState("error");
      });

    return () => controller.abort();
  }, [billing.hasResolvedOnce]);

  const latestMeeting = meetings[0] ?? null;
  const openMeeting = React.useCallback(async (meeting: RecordedMeetingCatalogItem) => {
    if (!hasPremiumAccess) {
      openPaywallModal({
        context: "recorded_meetings",
        source: "recorded_meetings_board",
        returnTo: `${RECORDED_MEETINGS_ROUTE}?meeting=${encodeURIComponent(meeting.id)}`,
        postCheckoutIntent: "watch_recorded_meeting",
      });
      return;
    }

    try {
      const response = await fetch(
        `/api/dashboard/recorded-meetings/${encodeURIComponent(meeting.id)}/playback`,
        { cache: "no-store", credentials: "include" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.meeting?.youtubeVideoId) {
        throw new Error("recorded_meeting_playback_unavailable");
      }
      setPlayingMeeting(payload.meeting as RecordedMeetingPlayback);
    } catch {
      router.push(`${RECORDED_MEETINGS_ROUTE}?meeting=${encodeURIComponent(meeting.id)}`);
    }
  }, [hasPremiumAccess, router]);

  return (
    <>
      <Board
        title="Reuniões gravadas"
        showTitleMarker={false}
        variant="card"
        showChevron={false}
        showOptions={false}
        contentClassName="bg-white"
        titleClassName="text-zinc-950"
        isHighlighted={isHighlighted}
      >
        {!billing.hasResolvedOnce ? (
          <BoardSkeleton />
        ) : loadState === "loading" || loadState === "idle" ? (
          <BoardSkeleton />
        ) : loadState === "error" ? (
          <BoardMessage
            title="Não foi possível carregar agora"
            description="A biblioteca continua disponível na página completa."
            onOpen={() => router.push(RECORDED_MEETINGS_ROUTE)}
          />
        ) : latestMeeting ? (
          <RecordedMeetingCardContent
            meeting={latestMeeting}
            onPlay={() => void openMeeting(latestMeeting)}
            onOpenLibrary={() => router.push(RECORDED_MEETINGS_ROUTE)}
          />
        ) : (
          <BoardMessage
            title="Biblioteca sendo preparada"
            description="As gravações aparecerão aqui assim que forem publicadas."
            onOpen={() => router.push(RECORDED_MEETINGS_ROUTE)}
          />
        )}
      </Board>
      <RecordedMeetingPlayerDialog
        meeting={playingMeeting}
        onClose={() => setPlayingMeeting(null)}
      />
    </>
  );
}

export function RecordedMeetingCardContent({
  meeting,
  onPlay,
  onOpenLibrary,
}: {
  meeting: RecordedMeetingCatalogItem;
  onPlay: () => void;
  onOpenLibrary: () => void;
}) {
  return (
    <div className="flex h-full min-h-[420px] flex-col bg-zinc-950 text-white">
      <button
        type="button"
        onClick={onPlay}
        className="group relative block w-full flex-none overflow-hidden bg-zinc-900 text-left"
        style={{ aspectRatio: "16 / 9" }}
        aria-label={`Assistir ${meeting.title}`}
      >
        <RecordedMeetingThumbnail
          meeting={meeting}
          sizes="(max-width: 1280px) 450px, 470px"
          className="opacity-90 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-100"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/10" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-zinc-950 shadow-xl transition group-hover:scale-110">
            <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
          </span>
        </span>
      </button>
      <div className="flex min-h-0 flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-violet-300">
            Última reunião
          </p>
          <p className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-zinc-400">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
            {formatMeetingDate(meeting.publishedAt)}
          </p>
        </div>
        <h3 className="mt-3 line-clamp-3 text-xl font-semibold leading-6 tracking-[-0.02em] text-white">
          {meeting.title}
        </h3>
        <p className="mt-3 line-clamp-2 text-sm leading-5 text-zinc-400">
          {getMeetingSummary(meeting.description)}
        </p>
        <div className="mt-auto flex items-center gap-3 pt-5">
          <button
            type="button"
            onClick={onPlay}
            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-zinc-950 transition hover:bg-violet-100"
          >
            <Play className="h-4 w-4 fill-current" aria-hidden="true" /> Assistir
          </button>
          <button
            type="button"
            onClick={onOpenLibrary}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border border-white/15 px-4 text-xs font-bold text-white transition hover:bg-white/10"
          >
            Biblioteca <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}

function BoardSkeleton() {
  return (
    <div className="min-h-[420px] animate-pulse p-5" aria-busy="true">
      <div className="rounded-2xl bg-zinc-100" style={{ aspectRatio: "16 / 9" }} />
      <div className="mt-6 h-3 w-24 rounded bg-zinc-100" />
      <div className="mt-3 h-5 w-4/5 rounded bg-zinc-100" />
      <div className="mt-2 h-5 w-3/5 rounded bg-zinc-100" />
    </div>
  );
}

function BoardMessage({
  title,
  description,
  onOpen,
}: {
  title: string;
  description: string;
  onOpen: () => void;
}) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center px-8 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
        <Film className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet-800"
      >
        Abrir biblioteca <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}
