import { connectToDatabase } from "@/app/lib/mongoose";
import CommunityEventModel, { ICommunityEvent } from "@/app/models/CommunityEvent";

export interface MentorshipEventSummary {
  _id: string;
  title: string;
  description?: string | null;
  startAt: Date;
  endAt?: Date | null;
  timezone: string;
  joinUrl?: string | null;
  reminderUrl?: string | null;
  location?: string | null;
  isFallback?: boolean;
  status?: "scheduled" | "cancelled";
}

function toMentorshipEventSummary(
  event: ICommunityEvent,
  isFallback: boolean,
): MentorshipEventSummary {
  return {
    _id: event._id.toString(),
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt ?? null,
    timezone: event.timezone ?? "America/Sao_Paulo",
    joinUrl: event.joinUrl ?? null,
    reminderUrl: event.reminderUrl ?? null,
    location: event.location ?? null,
    isFallback,
    status: event.status === "cancelled" ? "cancelled" : "scheduled",
  };
}

export async function getUpcomingMentorshipOperationalEvent(): Promise<MentorshipEventSummary | null> {
  await connectToDatabase();
  const now = new Date();
  const possibleOngoingStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const event = await CommunityEventModel.findOne({
    type: "mentorship",
    status: { $in: ["scheduled", "cancelled"] },
    startAt: { $gte: possibleOngoingStart },
  })
    .sort({ startAt: 1 })
    .lean<ICommunityEvent>()
    .exec();

  return event ? toMentorshipEventSummary(event, false) : null;
}

export async function getUpcomingMentorshipEvent(): Promise<MentorshipEventSummary | null> {
  await connectToDatabase();
  const now = new Date();
  const possibleOngoingStart = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  const next = await CommunityEventModel.findOne({
    type: "mentorship",
    status: "scheduled",
    startAt: { $gte: possibleOngoingStart },
  })
    .sort({ startAt: 1 })
    .lean<ICommunityEvent>()
    .exec();

  if (next) {
    return toMentorshipEventSummary(next, false);
  }

  const latest = await CommunityEventModel.findOne({
    type: "mentorship",
    status: "scheduled",
  })
    .sort({ startAt: -1 })
    .lean<ICommunityEvent>()
    .exec();

  if (!latest) {
    return null;
  }

  return toMentorshipEventSummary(latest, true);
}
