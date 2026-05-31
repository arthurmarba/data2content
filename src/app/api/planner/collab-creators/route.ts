import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import { buildCollabCreatorSuggestions } from "@/app/lib/planner/collabCreatorSuggestionsService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = (await getServerSession(await resolveAuthOptions())) as Session | null;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const routePath = new URL(request.url).pathname;
    const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.message, reason: access.reason },
        { status: access.status },
      );
    }

    const body = await request.json().catch(() => ({}));
    const result = await buildCollabCreatorSuggestions({
      viewerId: session.user.id,
      categories: body?.categories || {},
      themeKeyword: typeof body?.themeKeyword === "string" ? body.themeKeyword : null,
      title: typeof body?.title === "string" ? body.title : null,
      periodDays: Number(body?.periodDays) || 180,
      limit: Number(body?.limit) || 3,
    });

    return NextResponse.json({ ok: true, items: result.items, contextLabel: result.contextLabel });
  } catch (err) {
    console.error("[planner/collab-creators] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to load collab creators" },
      { status: 500 },
    );
  }
}
