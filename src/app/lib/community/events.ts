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
}

export async function getUpcomingMentorshipEvent(): Promise<MentorshipEventSummary | null> {
  await connectToDatabase();
  const now = new Date();

  const next = await CommunityEventModel.findOne({
    type: "mentorship",
    status: "scheduled",
    startAt: { $gte: now },
  })
    .sort({ startAt: 1 })
    .lean<ICommunityEvent>()
    .exec();

  if (next) {
    return {
      _id: next._id.toString(),
      title: next.title,
      description: next.description,
      startAt: next.startAt,
      endAt: next.endAt ?? null,
      timezone: next.timezone ?? "America/Sao_Paulo",
      joinUrl: next.joinUrl ?? null,
      reminderUrl: next.reminderUrl ?? null,
      location: next.location ?? null,
      isFallback: false,
    };
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

  return {
    _id: latest._id.toString(),
    title: latest.title,
    description: latest.description,
    startAt: latest.startAt,
    endAt: latest.endAt ?? null,
    timezone: latest.timezone ?? "America/Sao_Paulo",
    joinUrl: latest.joinUrl ?? null,
    reminderUrl: latest.reminderUrl ?? null,
    location: latest.location ?? null,
    isFallback: true,
  };
}

