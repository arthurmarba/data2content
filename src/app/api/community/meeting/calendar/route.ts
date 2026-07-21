import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { buildWeeklyMeetingIcs } from "@/app/lib/community/weeklyMeeting";
import { getWeeklyMeetingExperience } from "@/app/lib/community/weeklyMeetingService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const meeting = await getWeeklyMeetingExperience();
  const origin = new URL(request.url).origin;
  const ics = buildWeeklyMeetingIcs({
    startAt: meeting.startAt,
    endAt: meeting.endAt,
    title: meeting.title,
    description: meeting.description,
    meetingPageUrl: `${origin}/reuniao`,
    status: meeting.status === "cancelled" ? "cancelled" : "tentative",
  });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reuniao-data2content.ics"',
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}
