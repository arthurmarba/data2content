import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { validatePostCreationBoardAccess } from "@/app/lib/postCreationTrial/access";
import { resolveTargetScriptsUser } from "@/app/lib/scripts/access";
import PostCreationFunnelEvent, {
} from "@/app/models/PostCreationFunnelEvent";
import {
  buildPostCreationEventCreatePayload,
  normalizePostCreationEventBody,
} from "@/app/api/post-creation/events/payload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function getAuthenticatedSession() {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = session?.user?.id;
  if (typeof userId !== "string" || !userId.trim()) return null;
  return session;
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await validatePostCreationBoardAccess({ request, session: session as any });
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, reason: access.reason }, { status: access.status });
  }

  let body: any = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const normalized = normalizePostCreationEventBody(body);
  if (!normalized.eventName || !normalized.stage) {
    return NextResponse.json({ ok: false, error: "Evento inválido." }, { status: 400 });
  }

  const targetResolution = resolveTargetScriptsUser({
    session: session as any,
    targetUserId: normalized.targetUserId,
  });
  if (!targetResolution.ok) {
    return NextResponse.json({ ok: false, error: targetResolution.error }, { status: targetResolution.status });
  }

  await connectToDatabase();

  const createPayload = buildPostCreationEventCreatePayload(normalized, targetResolution.userId);

  const created = await PostCreationFunnelEvent.create(createPayload);

  return NextResponse.json({ ok: true, id: String(created._id) });
}
