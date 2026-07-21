"use client";

import { COMMUNITY_FREE_JOIN_ROUTE, COMMUNITY_WHATSAPP_URL } from "@/app/lib/communityLinks";
import Link from "next/link";
import { openPaywallModal } from "@/utils/paywallModal";
import { MOBILE_PROFILE_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";
import {
  CS_FONT_DISPLAY,
  CS_INK_HEX,
  CS_PAPER_HEX,
} from "./diagnosticoTokens";

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
  const whatsappUrl = isPro
    ? COMMUNITY_WHATSAPP_URL
    : COMMUNITY_FREE_JOIN_ROUTE;
  const whatsappLabel = isPro ? "Abrir grupo Pro" : "Receber avisos";
  const supportingCopy = cancelled
    ? "Confira o WhatsApp para acompanhar a previsão da próxima edição."
    : isPro
      ? "Confirme presença no grupo Pro para ser analisado."
      : "Assista grátis. O WhatsApp avisa sobre link, mudanças e cancelamentos.";

  return (
    <section
      aria-labelledby="weekly-meeting-profile-title"
      style={{ padding: "0 18px 0" }}
    >
      <style>{`
        .d2c-meeting-action {
          transition: transform 160ms ease, background-color 160ms ease, border-color 160ms ease;
        }
        .d2c-meeting-action:hover { transform: translateY(-1px); }
        .d2c-meeting-action:active { transform: translateY(0) scale(.985); }
        .d2c-meeting-action:focus-visible { outline: 3px solid rgba(196, 181, 253, .72); outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .d2c-meeting-action { transition: none; }
        }
        @media (max-width: 350px) {
          .d2c-meeting-actions { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div
        style={{
          overflow: "hidden",
          borderRadius: 22,
          background: CS_INK_HEX,
          color: CS_PAPER_HEX,
          padding: "19px 18px 18px",
          boxShadow: "0 12px 32px rgba(28,28,30,0.14)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 7, color: "#c4b5fd", fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase" }}>
            <CalendarGlyph /> Reunião semanal
          </span>
          <span style={{ borderRadius: 999, background: cancelled ? "#3f3f46" : "rgba(255,255,255,0.1)", padding: "5px 9px", color: cancelled ? "#fca5a5" : "#e4e4e7", fontSize: 10, fontWeight: 750, whiteSpace: "nowrap" }}>
            {cancelled ? "Cancelada" : "Horário previsto"}
          </span>
        </div>

        <h2
          id="weekly-meeting-profile-title"
          style={{
            margin: "17px 0 0",
            fontFamily: CS_FONT_DISPLAY,
            fontSize: 23,
            fontWeight: 700,
            letterSpacing: "-0.035em",
            lineHeight: 1.08,
          }}
        >
          {cancelled ? "Esta edição foi cancelada" : formatMeetingDate(meeting.startAt)}
        </h2>
        <p style={{ margin: "8px 0 0", color: "#d4d4d8", fontSize: 13, lineHeight: 1.48 }}>
          {supportingCopy}
        </p>

        <div className="d2c-meeting-actions" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, .82fr)", gap: 9, marginTop: 17 }}>
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="d2c-meeting-action"
            style={{ minHeight: 46, borderRadius: 999, background: "#25D366", color: "#101713", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", textDecoration: "none", fontSize: 12.5, fontWeight: 800, textAlign: "center" }}
          >
            <WhatsAppGlyph /> {whatsappLabel}
          </a>
          <Link
            href="/reuniao"
            className="d2c-meeting-action"
            style={{ minHeight: 46, borderRadius: 999, border: "1px solid #52525b", color: CS_PAPER_HEX, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 12px", textDecoration: "none", fontSize: 12.5, fontWeight: 750, textAlign: "center" }}
          >
            Ver reunião
          </Link>
        </div>

        {!isPro && !cancelled ? (
          <button
            type="button"
            onClick={() =>
              openPaywallModal({
                context: "mentoria",
                source: "profile_weekly_meeting_card",
                returnTo: MOBILE_PROFILE_ROUTE,
                // Depois do pagamento, o grupo vem antes de qualquer outra coisa.
                postCheckoutIntent: "join_community",
              })
            }
            className="d2c-meeting-action"
            style={{
              marginTop: 14,
              width: "100%",
              minHeight: 40,
              borderRadius: 999,
              border: "1px solid rgba(196,181,253,.34)",
              background: "rgba(196,181,253,.11)",
              color: "#ddd6fe",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "9px 12px",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Quer levar seu conteúdo para análise? Conheça o Pro
          </button>
        ) : null}
      </div>
    </section>
  );
}
