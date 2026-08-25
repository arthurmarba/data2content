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
import { ProfileSectionHeader } from "./ProfileSectionHeader";
import type { WeeklyMeetingProfileData } from "./WeeklyMeetingProfileCard";

/**
 * Reuniões da comunidade — campo fixo, igual para quem assina e para quem não.
 *
 * É a única coisa desta tela que se repete toda semana, e por isso a única com
 * lugar permanente. Também é proposta de valor: quem ainda não assina precisa ver
 * a capa e o assunto da última reunião para entender o que está comprando — o
 * convite para assinar aparece no play, não antes.
 */

/** Quantas gravadas cabem na gaveta antes de ela virar catálogo. */
const RECORDINGS_SHOWN = 3;

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
  const [recordings, setRecordings] = useState<RecordedMeetingCatalogItem[]>([]);
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
        // A gaveta mostra as últimas, não só a última: uma capa sozinha faz o
        // acervo parecer ter um item, e é ele que sustenta o convite.
        setRecordings((meetings as RecordedMeetingCatalogItem[]).slice(0, RECORDINGS_SHOWN));
      })
      .catch(() => {
        /* silencioso: o card continua válido sem a gravação */
      });
    return () => controller.abort();
  }, []);

  const handlePlay = useCallback(async (meeting: RecordedMeetingCatalogItem) => {
    onOpenRecording?.(meeting.id, isPro);

    if (!isPro) {
      onUpgrade("recorded_meetings");
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
      setPlaying(payload.meeting as RecordedMeetingPlayback);
    } catch {
      window.location.assign(`${RECORDED_MEETINGS_ROUTE}?meeting=${encodeURIComponent(meeting.id)}`);
    }
  }, [isPro, onOpenRecording, onUpgrade]);

  return (
    <>
      <section id="community-d2c">
        {/* "Comunidade", não "Reuniões da comunidade": o cabeçalho nomeia o
            assunto e o card diz o que acontece nele. */}
        <ProfileSectionHeader title="Comunidade" />
        <div className="ds-card-stamp mt-4 rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-[18px]">
          {/* A DATA é o elemento grande, não uma frase de convencimento: quem já
              está dentro volta aqui para saber quando é, e quem ainda não está
              entende a oferta melhor vendo que ela tem hora marcada. */}
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
            Próxima ao vivo
          </p>
          <h2 className="mt-2.5 text-[19px] font-semibold leading-[1.24] tracking-[-0.025em] text-[var(--ds-color-ink)]">
            {cancelled ? "A próxima edição foi cancelada." : formatNextMeeting(meeting)}
          </h2>
          <p className="mt-1.5 text-[12.5px] leading-[1.4] text-[var(--ds-color-text-muted)]">
            {cancelled ? "Avisamos no grupo quando a próxima for marcada." : "Ao vivo, no WhatsApp"}
          </p>

          {isPro ? (
            <a
              href={COMMUNITY_PRO_JOIN_ROUTE}
              target="_blank"
              rel="noreferrer"
              className="ds-button ds-button--secondary ds-button--block mt-3.5 no-underline"
              onClick={onOpenWhatsAppGroup}
            >
              {whatsappGroupLinkOpened ? "Abrir a comunidade" : "Entrar na comunidade"}
            </a>
          ) : (
            <button
              type="button"
              className="ds-button ds-button--secondary ds-button--block mt-3.5"
              onClick={() => onUpgrade("community")}
            >
              Entrar na comunidade
            </button>
          )}

          {recordings.length > 0 ? (
            <div className="mt-[18px] border-t border-dashed border-[var(--ds-color-line)] pt-3.5">
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
                Gravadas
              </p>
              {recordings.map((recording) => (
                <button
                  key={recording.id}
                  type="button"
                  onClick={() => void handlePlay(recording)}
                  className="mt-3 flex w-full items-center gap-3 text-left"
                >
                  <span className="relative block h-[46px] w-[64px] shrink-0 overflow-hidden rounded-[8px] bg-[var(--ds-color-neutral)]">
                    <Image
                      src={recording.thumbnailUrl}
                      alt=""
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-medium leading-[1.3] text-[var(--ds-color-ink)]">
                      {recording.title}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-[1.2] text-[var(--ds-color-text-muted)]">
                      Gravada em {formatRecordingDate(recording.publishedAt)}
                      {isPro ? "" : " · assinantes assistem completo"}
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-[13px] font-semibold text-[var(--ds-color-text-muted)]">
                    ›
                  </span>
                </button>
              ))}

              <Link
                href={RECORDED_MEETINGS_ROUTE}
                className="mt-3.5 flex w-full items-center gap-2.5 pt-0.5 text-[12.5px] font-semibold text-[var(--ds-color-ink)] no-underline"
              >
                <span className="min-w-0 flex-1">Ver todas as gravadas</span>
                <span aria-hidden="true" className="text-[13px] text-[var(--ds-color-text-muted)]">
                  ›
                </span>
              </Link>
            </div>
          ) : null}
        </div>
      </section>

      <RecordedMeetingPlayerDialog meeting={playing} onClose={() => setPlaying(null)} />
    </>
  );
}
