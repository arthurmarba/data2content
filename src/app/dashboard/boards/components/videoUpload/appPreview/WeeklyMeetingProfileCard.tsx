"use client";

import { COMMUNITY_PRO_JOIN_ROUTE } from "@/app/lib/communityLinks";
import Link from "next/link";
import { openPaywallModal } from "@/utils/paywallModal";
import { MOBILE_PROFILE_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";

export type WeeklyMeetingProfileData = {
  startAt: string;
  status: "forecast" | "scheduled" | "cancelled";
};

interface WeeklyMeetingProfileCardProps {
  isPro: boolean;
  meeting: WeeklyMeetingProfileData;
}

function formatMeetingDate(startAt: string) {
  const date = new Date(startAt);
  if (Number.isNaN(date.getTime())) return "Toda quinta-feira · 19h–21h";

  const formatted = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);

  return `${formatted.charAt(0).toUpperCase()}${formatted.slice(1)} · 19h–21h`;
}

function CalendarGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M3.5 9.5h17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WhatsAppGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.5 8.5c0 4 3 7 6.5 7 .8 0 1.3-.6 1.3-1.2 0-.3-1.6-1.2-1.9-1.2-.4 0-.7.7-1 .7-.6 0-2.4-1.6-2.4-2.3 0-.3.6-.5.6-1 0-.3-.8-1.9-1.2-1.9-.5 0-1.2.5-1.2 1.1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

export function WeeklyMeetingProfileCard({
  isPro,
  meeting,
}: WeeklyMeetingProfileCardProps) {
  const cancelled = meeting.status === "cancelled";
  const supportingCopy = cancelled
    ? "Confira o WhatsApp para acompanhar a previsão da próxima edição."
    : isPro
      ? "Confirme presença no grupo Pro para ser analisado."
      : "Assine o Pro para entrar no grupo e confirmar presença para análise.";

  const openCommunityPaywall = () => {
    openPaywallModal({
      context: "mentoria",
      source: "profile_weekly_meeting_card",
      returnTo: MOBILE_PROFILE_ROUTE,
      // A ativação começa no app: Instagram primeiro, grupo depois.
      postCheckoutIntent: "connect_instagram",
    });
  };

  return (
    <section
      aria-labelledby="weekly-meeting-profile-title"
      className="ds-notebook-section"
      style={{ margin: "14px 18px 0" }}
    >
      <div className="flex items-center justify-between gap-3">
          <span className="ds-notebook-label inline-flex items-center gap-2">
            <CalendarGlyph /> Reunião semanal
          </span>
          <span className={`ds-badge shrink-0 ${cancelled ? "ds-badge--danger" : "ds-badge--neutral"}`}>
            {cancelled ? "Cancelada" : "Horário previsto"}
          </span>
      </div>

      <h2
        id="weekly-meeting-profile-title"
        className="mt-4 font-display text-[1.45rem] font-bold leading-[1.08] tracking-[-0.035em] text-[var(--ds-color-ink)]"
      >
        {cancelled ? "Esta edição foi cancelada" : formatMeetingDate(meeting.startAt)}
      </h2>
      <p className="ds-body mt-2">
        {supportingCopy}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
          {isPro ? (
            <a
              href={COMMUNITY_PRO_JOIN_ROUTE}
              target="_blank"
              rel="noreferrer"
              onClick={() => trackMobileNarrativeEvent("mobile_whatsapp_group_link_opened", {
                route: MOBILE_PROFILE_ROUTE,
                isPro: true,
                actionType: "weekly_meeting_card",
              })}
              className="ds-button ds-button--primary ds-button--small min-w-[8rem] flex-1 no-underline"
            >
              <WhatsAppGlyph /> Abrir grupo Pro
            </a>
          ) : (
            <button
              type="button"
              onClick={openCommunityPaywall}
              className="ds-button ds-button--quiet ds-button--small min-w-[8rem] flex-1"
            >
              <WhatsAppGlyph /> Abrir grupo Pro
            </button>
          )}
          <Link
            href="/reuniao"
            className="ds-button ds-button--ghost ds-button--small min-w-[8rem] flex-1 no-underline"
          >
            Ver reunião
          </Link>
      </div>
    </section>
  );
}
