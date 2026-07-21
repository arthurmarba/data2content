export const WEEKLY_MEETING_TIMEZONE = "America/Sao_Paulo";
export const WEEKLY_MEETING_WEEKDAY = 4; // quinta-feira
export const WEEKLY_MEETING_START_HOUR = 19;
export const WEEKLY_MEETING_DURATION_MINUTES = 120;

export type WeeklyMeetingSlot = {
  startAt: Date;
  endAt: Date;
  timezone: typeof WEEKLY_MEETING_TIMEZONE;
};

/**
 * São Paulo permanece em UTC-3 desde 2019. Trabalhar sobre o relógio local
 * deslocado evita que a quinta-feira vire quarta/sexta em servidores UTC.
 */
export function computeNextWeeklyMeeting(now = new Date()): WeeklyMeetingSlot {
  const saoPauloClock = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const localWeekday = saoPauloClock.getUTCDay();
  const daysUntilThursday =
    (WEEKLY_MEETING_WEEKDAY - localWeekday + 7) % 7;

  const candidateStart = new Date(
    Date.UTC(
      saoPauloClock.getUTCFullYear(),
      saoPauloClock.getUTCMonth(),
      saoPauloClock.getUTCDate() + daysUntilThursday,
      WEEKLY_MEETING_START_HOUR + 3,
      0,
      0,
      0,
    ),
  );
  const candidateEnd = new Date(
    candidateStart.getTime() + WEEKLY_MEETING_DURATION_MINUTES * 60 * 1000,
  );

  if (daysUntilThursday === 0 && now.getTime() >= candidateEnd.getTime()) {
    const startAt = new Date(candidateStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    return {
      startAt,
      endAt: new Date(startAt.getTime() + WEEKLY_MEETING_DURATION_MINUTES * 60 * 1000),
      timezone: WEEKLY_MEETING_TIMEZONE,
    };
  }

  return {
    startAt: candidateStart,
    endAt: candidateEnd,
    timezone: WEEKLY_MEETING_TIMEZONE,
  };
}

export function formatWeeklyMeetingDate(startAt: Date) {
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: WEEKLY_MEETING_TIMEZONE,
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(startAt);

  return `${date.charAt(0).toUpperCase()}${date.slice(1)}, às 19h`;
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function formatIcsDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildWeeklyMeetingIcs(input: {
  startAt: Date;
  endAt: Date;
  title?: string;
  description?: string | null;
  meetingPageUrl: string;
  status?: "tentative" | "cancelled";
  generatedAt?: Date;
}) {
  const cancelled = input.status === "cancelled";
  const title = cancelled
    ? `Cancelada — ${input.title || "Reunião semanal Data2Content"}`
    : `Previsão — ${input.title || "Reunião semanal Data2Content"}`;
  const description = [
    input.description ||
      "Análises de conteúdo ao vivo com Arthur e Ronaldo. Usuários gratuitos podem assistir.",
    cancelled
      ? "Esta edição foi cancelada. Confira os avisos no WhatsApp."
      : "Este é o horário previsto. Mudanças e cancelamentos são informados primeiro pelo WhatsApp.",
    `Acesse pelo app: ${input.meetingPageUrl}`,
  ].join("\n\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "PRODID:-//Data2Content//Reuniao semanal//PT-BR",
    "BEGIN:VEVENT",
    `UID:reuniao-${formatIcsDate(input.startAt)}@data2content.ai`,
    `DTSTAMP:${formatIcsDate(input.generatedAt || new Date())}`,
    `DTSTART:${formatIcsDate(input.startAt)}`,
    `DTEND:${formatIcsDate(input.endAt)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText("Online — Data2Content")}`,
    `STATUS:${cancelled ? "CANCELLED" : "TENTATIVE"}`,
    `URL:${input.meetingPageUrl}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
