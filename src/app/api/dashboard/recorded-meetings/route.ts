import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { canAccessRecordedMeetings } from "@/app/lib/community/recordedMeetingsAccess";
import { getRecordedMeetingsState } from "@/app/lib/community/recordedMeetingsService";

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
    const result = await getRecordedMeetingsState();
    if (result.status === "unavailable") {
      return NextResponse.json(
        { ok: false, status: result.status, error: "recorded_meetings_unavailable" },
        { status: 502 },
      );
    }
    if (result.status === "unconfigured") {
      console.error(
        "[recorded-meetings] Configuração ausente:",
        result.missingConfiguration?.join(", "),
      );
      return NextResponse.json(
        { ok: false, status: result.status, error: "recorded_meetings_unconfigured" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, status: result.status, meetings: result.meetings });
  } catch (error) {
    console.error("[recorded-meetings] Falha ao carregar playlist:", error);
    return NextResponse.json(
      { ok: false, error: "recorded_meetings_unavailable" },
      { status: 502 },
    );
  }
}
