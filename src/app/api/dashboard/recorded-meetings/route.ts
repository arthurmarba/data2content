import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessRecordedMeetings } from "@/app/lib/community/recordedMeetingsAccess";
import { getRecordedMeetings } from "@/app/lib/community/recordedMeetingsService";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const viewer = session.user as { id?: string | null; role?: string | null };
  if (!(await canAccessRecordedMeetings(viewer))) {
    return NextResponse.json({ ok: false, error: "premium_required" }, { status: 403 });
  }

  try {
    const meetings = await getRecordedMeetings();
    return NextResponse.json({ ok: true, meetings });
  } catch (error) {
    console.error("[recorded-meetings] Falha ao carregar playlist:", error);
    return NextResponse.json(
      { ok: false, error: "recorded_meetings_unavailable" },
      { status: 502 },
    );
  }
}
