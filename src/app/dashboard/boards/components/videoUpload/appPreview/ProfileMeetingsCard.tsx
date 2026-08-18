"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { COMMUNITY_PRO_JOIN_ROUTE } from "@/app/lib/communityLinks";
import type {
  RecordedMeetingCatalogItem,
  RecordedMeetingPlayback,
} from "@/app/lib/community/recordedMeetingsService";
import { RECORDED_MEETINGS_ROUTE } from "@/constants/routes";
import type { PaywallContext } from "@/types/paywall";

import RecordedMeetingPlayerDialog from "@/app/dashboard/recorded-meetings/RecordedMeetingPlayerDialog";
import type { WeeklyMeetingProfileData } from "./WeeklyMeetingProfileCard";

/**
 * Reuniões da comunidade — campo fixo, igual para quem assina e para quem não.
 *
 * É a única coisa desta tela que se repete toda semana, e por isso a única com
 * lugar permanente. Também é proposta de valor: quem ainda não assina precisa ver
 * a capa e o assunto da última reunião para entender o que está comprando — o
 * convite para assinar aparece no play, não antes.
 */

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

function formatRecordingDate(value: string) {
  if (!value) return "Data não informada";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Data não informada" : DATE_FORMATTER.format(date);
}

function formatNextMeeting(meeting: WeeklyMeetingProfileData | null) {
  if (!meeting) return "Toda quinta, às 19h";
  const date = new Date(meeting.startAt);
  if (Number.isNaN(date.getTime())) return "Toda quinta, às 19h";
  const label = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function PlayIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" />
    </svg>
  );
}

export function ProfileMeetingsCard({
  meeting,
  isPro,
  whatsappGroupLinkOpened,
  onUpgrade,
  onOpenWhatsAppGroup,
  onOpenRecording,
}: {
  meeting: WeeklyMeetingProfileData | null;
  isPro: boolean;
  whatsappGroupLinkOpened: boolean;
  onUpgrade: (context?: PaywallContext) => void;
  onOpenWhatsAppGroup: () => void;
  onOpenRecording?: (meetingId: string, allowed: boolean) => void;
}) {
  const [latest, setLatest] = useState<RecordedMeetingCatalogItem | null>(null);
  const [playing, setPlaying] = useState<RecordedMeetingPlayback | null>(null);
  const cancelled = meeting?.status === "cancelled";

  // O catálogo é aberto a qualquer sessão — só a reprodução é barrada. Por isso a
  // capa pode ser buscada sem olhar o plano.
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/dashboard/recorded-meetings", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload?.ok) return;
        const meetings = Array.isArray(payload.meetings) ? payload.meetings : [];
        setLatest((meetings[0] as RecordedMeetingCatalogItem) ?? null);
      })
      .catch(() => {
        /* silencioso: o card continua válido sem a gravação */
      });
    return () => controller.abort();
  }, []);

  const handlePlay = useCallback(async () => {
    if (!latest) return;
    onOpenRecording?.(latest.id, isPro);

    if (!isPro) {
      onUpgrade("recorded_meetings");
      return;
    }

    try {
      const response = await fetch(
        `/api/dashboard/recorded-meetings/${encodeURIComponent(latest.id)}/playback`,
        { cache: "no-store", credentials: "include" },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.ok || !payload?.meeting?.youtubeVideoId) {
        throw new Error("recorded_meeting_playback_unavailable");
      }
      setPlaying(payload.meeting as RecordedMeetingPlayback);
    } catch {
      window.location.assign(`${RECORDED_MEETINGS_ROUTE}?meeting=${encodeURIComponent(latest.id)}`);
    }
  }, [isPro, latest, onOpenRecording, onUpgrade]);

  return (
    <>
      <section id="community-d2c" className="ds-notebook-section">
        <span className="ds-notebook-label">Reuniões da comunidade</span>
        <h2 className="mt-2 text-[1.375rem] font-bold leading-[1.12] text-[var(--ds-color-ink)]">
          {cancelled ? "A próxima edição foi cancelada." : "Sua semana entra na pauta do grupo."}
        </h2>
        <p className="ds-caption mt-2">
          {cancelled ? "Avisamos no grupo quando a próxima for marcada." : `${formatNextMeeting(meeting)} · ao vivo, no WhatsApp`}
        </p>

        {latest ? (
          <div className="ds-notebook-media mt-4 overflow-hidden">
            <button
              type="button"
              onClick={() => void handlePlay()}
              className="relative block aspect-[16/9] w-full bg-[var(--ds-color-ink)]"
              aria-label={`Assistir: ${latest.title}`}
            >
              <Image
                src={latest.thumbnailUrl}
                alt=""
                fill
                sizes="(min-width: 1024px) 380px, 100vw"
                className="object-cover opacity-85"
              />
              <span className="absolute inset-0 grid place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--ds-color-paper)] pl-0.5 text-[var(--ds-color-ink)] shadow-[var(--ds-shadow-floating)]">
                  <PlayIcon />
                </span>
              </span>
            </button>
            <div className="px-4 pb-4 pt-3">
              <p className="text-[14px] font-bold leading-[1.25] text-[var(--ds-color-ink)]">{latest.title}</p>
              <p className="ds-caption mt-1">
                {formatRecordingDate(latest.publishedAt)} · última reunião
                {isPro ? "" : " · assinantes assistem completo"}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {isPro ? (
            <a
              href={COMMUNITY_PRO_JOIN_ROUTE}
              target="_blank"
              rel="noreferrer"
              className="ds-button ds-button--primary ds-button--small no-underline"
              onClick={onOpenWhatsAppGroup}
            >
              {whatsappGroupLinkOpened ? "Abrir a comunidade" : "Entrar na comunidade"}
            </a>
          ) : (
            <button type="button" className="ds-button ds-button--primary ds-button--small" onClick={() => onUpgrade("community")}>
              Entrar na comunidade
            </button>
          )}
          <Link href={RECORDED_MEETINGS_ROUTE} className="ds-button ds-button--quiet ds-button--small no-underline">
            Ver todas
          </Link>
        </div>
      </section>

      <RecordedMeetingPlayerDialog meeting={playing} onClose={() => setPlaying(null)} />
    </>
  );
}
