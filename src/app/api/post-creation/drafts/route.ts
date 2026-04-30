import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { validatePostCreationBoardAccess } from "@/app/lib/postCreationTrial/access";
import { resolveTargetScriptsUser } from "@/app/lib/scripts/access";
import PostCreationDraft from "@/app/models/PostCreationDraft";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeDraftBody(body: any) {
  return {
    stage:
      body?.stage === "idea" ||
      body?.stage === "blueprint" ||
      body?.stage === "script" ||
      body?.stage === "published"
        ? body.stage
        : "path",
    titleSnapshot: typeof body?.titleSnapshot === "string" ? body.titleSnapshot.trim().slice(0, 240) : null,
    state:
      body?.state && typeof body.state === "object" && !Array.isArray(body.state)
        ? body.state
        : {},
    selectedSlotId:
      typeof body?.selectedSlotId === "string" && body.selectedSlotId.trim()
        ? body.selectedSlotId.trim().slice(0, 120)
        : null,
    selectedScriptId:
      typeof body?.selectedScriptId === "string" && body.selectedScriptId.trim()
        ? body.selectedScriptId.trim().slice(0, 120)
        : null,
    linkedContentId:
      typeof body?.linkedContentId === "string" && body.linkedContentId.trim()
        ? body.linkedContentId.trim().slice(0, 120)
        : null,
    targetUserId: typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "",
  };
}

function serializeDraft(doc: any) {
  return {
    id: String(doc._id),
    titleSnapshot: doc.titleSnapshot || null,
    stage: doc.stage,
    state: doc.state || {},
    selectedSlotId: doc.selectedSlotId || null,
    selectedScriptId: doc.selectedScriptId || null,
    linkedContentId: doc.linkedContentId || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

async function getAuthenticatedSession() {
  const session = (await getServerSession(authOptions as any)) as any;
  const userId = session?.user?.id;
  if (typeof userId !== "string" || !userId.trim()) return null;
  return session;
}

export async function GET(request: Request) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await validatePostCreationBoardAccess({ request, session: session as any });
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, reason: access.reason }, { status: access.status });
  }

  const url = new URL(request.url);
  const targetResolution = resolveTargetScriptsUser({
    session: session as any,
    targetUserId: url.searchParams.get("targetUserId"),
  });
  if (!targetResolution.ok) {
    return NextResponse.json({ ok: false, error: targetResolution.error }, { status: targetResolution.status });
  }

  await connectToDatabase();

  if (url.searchParams.get("latest") === "1") {
    const latest = await PostCreationDraft.findOne({
      userId: new Types.ObjectId(targetResolution.userId),
    })
      .sort({ updatedAt: -1 })
      .lean()
      .exec();

    return NextResponse.json({ ok: true, item: latest ? serializeDraft(latest) : null });
  }

  return NextResponse.json({ ok: false, error: "Missing supported query." }, { status: 400 });
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

  const normalized = normalizeDraftBody(body);
  const targetResolution = resolveTargetScriptsUser({
    session: session as any,
    targetUserId: normalized.targetUserId,
  });
  if (!targetResolution.ok) {
    return NextResponse.json({ ok: false, error: targetResolution.error }, { status: targetResolution.status });
  }

  await connectToDatabase();

  const created = await PostCreationDraft.create({
    userId: new Types.ObjectId(targetResolution.userId),
    titleSnapshot: normalized.titleSnapshot,
    stage: normalized.stage,
    state: normalized.state,
    selectedSlotId: normalized.selectedSlotId,
    selectedScriptId: normalized.selectedScriptId,
    linkedContentId: normalized.linkedContentId,
  });

  return NextResponse.json({ ok: true, item: serializeDraft(created.toObject()) });
}
