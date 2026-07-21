import { getUpcomingMentorshipOperationalEvent } from "./events";
import {
  computeNextWeeklyMeeting,
  WEEKLY_MEETING_DURATION_MINUTES,
  WEEKLY_MEETING_TIMEZONE,
} from "./weeklyMeeting";

export type WeeklyMeetingExperience = {
  title: string;
  description: string;
  startAt: Date;
  endAt: Date;
  timezone: string;
  joinUrl: string | null;
  location: string;
  source: "scheduled" | "weekly_fallback";
  status: "forecast" | "scheduled" | "cancelled";
};

export async function getWeeklyMeetingExperience(
  now = new Date(),
): Promise<WeeklyMeetingExperience> {
  const event = await getUpcomingMentorshipOperationalEvent().catch(() => null);
  const configuredFallbackJoinUrl =
    process.env.WEEKLY_MEETING_JOIN_URL?.trim() || null;

  const eventEnd = event
    ? event.endAt ||
      new Date(event.startAt.getTime() + WEEKLY_MEETING_DURATION_MINUTES * 60 * 1000)
    : null;

  if (event?.status === "cancelled") {
    return {
      title: event.title,
      description:
        event.description ||
        "Esta edição foi cancelada. Confira o WhatsApp para acompanhar as próximas atualizações.",
      startAt: event.startAt,
      endAt: eventEnd || event.startAt,
      timezone: event.timezone || WEEKLY_MEETING_TIMEZONE,
      joinUrl: null,
      location: event.location || "Online",
      source: "scheduled",
      status: "cancelled",
    };
  }

  if (event && eventEnd && !event.isFallback && eventEnd.getTime() > now.getTime()) {
    return {
      title: event.title,
      description:
        event.description ||
        "Análises de conteúdo ao vivo com Arthur e Ronaldo, criador a criador.",
      startAt: event.startAt,
      endAt: eventEnd,
      timezone: event.timezone || WEEKLY_MEETING_TIMEZONE,
      joinUrl: event.joinUrl || null,
      location: event.location || "Online",
      source: "scheduled",
      status: "scheduled",
    };
  }

  const fallback = computeNextWeeklyMeeting(now);
  return {
    title: "Reunião semanal Data2Content",
    description:
      "Análises de conteúdo ao vivo com Arthur e Ronaldo, criador a criador.",
    startAt: fallback.startAt,
    endAt: fallback.endAt,
    timezone: fallback.timezone,
    joinUrl: configuredFallbackJoinUrl,
    location: "Online",
    source: "weekly_fallback",
    status: "forecast",
  };
}
