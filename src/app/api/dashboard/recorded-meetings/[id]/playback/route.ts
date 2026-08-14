import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { canAccessRecordedMeetings } from "@/app/lib/community/recordedMeetingsAccess";
import {
  getRecordedMeetingsState,
  toRecordedMeetingPlayback,
} from "@/app/lib/community/recordedMeetingsService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(await resolveAuthOptions());
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const viewer = session.user as { id?: string | null; role?: string | null };
  if (!(await canAccessRecordedMeetings(viewer))) {
    return NextResponse.json({ ok: false, error: "premium_required" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const result = await getRecordedMeetingsState();
    if (result.status === "unavailable" || result.status === "unconfigured") {
      return NextResponse.json(
        { ok: false, error: "recorded_meetings_unavailable" },
        { status: 503 },
      );
    }

    const meeting = result.meetings.find((candidate) => candidate.id === id);
    if (!meeting) {
      return NextResponse.json({ ok: false, error: "meeting_not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, meeting: toRecordedMeetingPlayback(meeting) });
  } catch {
    return NextResponse.json(
      { ok: false, error: "recorded_meetings_unavailable" },
      { status: 503 },
    );
  }
}
