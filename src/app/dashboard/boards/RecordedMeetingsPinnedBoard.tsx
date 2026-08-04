"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import React from "react";
import { ArrowRight, Film, LockKeyhole, Play } from "lucide-react";

import Board from "@/app/dashboard/components/Board";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import type { RecordedMeeting } from "@/app/lib/community/recordedMeetingsService";
import { RECORDED_MEETINGS_ROUTE } from "@/constants/routes";

type LoadState = "idle" | "loading" | "ready" | "error";

export default function RecordedMeetingsPinnedBoard({
  isHighlighted = false,
}: {
  isHighlighted?: boolean;
}) {
  const router = useRouter();
  const billing = useBillingStatus();
  const hasPremiumAccess = Boolean(billing.hasPremiumAccess);
  const [loadState, setLoadState] = React.useState<LoadState>("idle");
  const [meetings, setMeetings] = React.useState<RecordedMeeting[]>([]);

  React.useEffect(() => {
    if (!billing.hasResolvedOnce || !hasPremiumAccess) return;
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
  }, [billing.hasResolvedOnce, hasPremiumAccess]);

  const latestMeeting = meetings[0] ?? null;

  return (
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
      ) : !hasPremiumAccess ? (
        <div className="flex h-full min-h-[420px] flex-col justify-between bg-[linear-gradient(155deg,#18181b,#27272a_60%,#312e81)] p-6 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-violet-300">
              Exclusivo para assinantes
            </p>
            <h3 className="mt-3 text-2xl font-bold tracking-[-0.025em]">
              Reveja cada análise no seu tempo.
            </h3>
            <p className="mt-3 text-sm leading-6 text-zinc-300">
              As reuniões ficam organizadas em uma biblioteca privada para assinantes D2C Pro.
            </p>
            <button
              type="button"
              onClick={() => router.push("/pro")}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-zinc-950 transition hover:bg-violet-100"
            >
              Conhecer o Pro <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : loadState === "loading" || loadState === "idle" ? (
        <BoardSkeleton />
      ) : loadState === "error" ? (
        <BoardMessage
          title="Não foi possível carregar agora"
          description="A biblioteca continua disponível na página completa."
          onOpen={() => router.push(RECORDED_MEETINGS_ROUTE)}
        />
      ) : latestMeeting ? (
        <div className="flex h-full min-h-[420px] flex-col">
          <button
            type="button"
            onClick={() => router.push(RECORDED_MEETINGS_ROUTE)}
            className="group relative aspect-video w-full overflow-hidden bg-zinc-950 text-left"
            aria-label={`Assistir ${latestMeeting.title}`}
          >
            <Image
              src={latestMeeting.thumbnailUrl}
              alt=""
              fill
              sizes="(max-width: 1280px) 450px, 470px"
              className="object-cover opacity-85 transition duration-500 group-hover:scale-[1.025] group-hover:opacity-100"
            />
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
            <span className="absolute bottom-4 left-4 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-950 shadow-lg transition group-hover:scale-105">
              <Play className="ml-0.5 h-4 w-4 fill-current" />
            </span>
          </button>
          <div className="flex flex-1 flex-col p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-violet-700">
              Última reunião
            </p>
            <h3 className="mt-2 line-clamp-2 text-lg font-semibold leading-6 text-zinc-950">
              {latestMeeting.title}
            </h3>
            <p className="mt-2 text-sm text-zinc-500">
              {meetings.length} {meetings.length === 1 ? "gravação disponível" : "gravações disponíveis"}
            </p>
            <button
              type="button"
              onClick={() => router.push(RECORDED_MEETINGS_ROUTE)}
              className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-bold text-violet-800"
            >
              Abrir biblioteca <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <BoardMessage
          title="Biblioteca sendo preparada"
          description="As gravações aparecerão aqui assim que forem publicadas."
          onOpen={() => router.push(RECORDED_MEETINGS_ROUTE)}
        />
      )}
    </Board>
  );
}

function BoardSkeleton() {
  return (
    <div className="min-h-[420px] animate-pulse p-5" aria-busy="true">
      <div className="aspect-video rounded-2xl bg-zinc-100" />
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
