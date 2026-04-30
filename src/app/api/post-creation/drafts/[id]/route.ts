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

type Params = {
  params: {
    id: string;
  };
};

function normalizeDraftBody(body: any) {
  return {
    stage:
      body?.stage === "idea" ||
      body?.stage === "blueprint" ||
      body?.stage === "script" ||
      body?.stage === "published"
        ? body.stage
        : body?.stage === "path"
          ? "path"
          : undefined,
    titleSnapshot: typeof body?.titleSnapshot === "string" ? body.titleSnapshot.trim().slice(0, 240) : undefined,
    state:
      body?.state && typeof body.state === "object" && !Array.isArray(body.state)
        ? body.state
        : undefined,
    selectedSlotId:
      typeof body?.selectedSlotId === "string" && body.selectedSlotId.trim()
        ? body.selectedSlotId.trim().slice(0, 120)
        : body?.selectedSlotId === null
          ? null
          : undefined,
    selectedScriptId:
      typeof body?.selectedScriptId === "string" && body.selectedScriptId.trim()
        ? body.selectedScriptId.trim().slice(0, 120)
        : body?.selectedScriptId === null
          ? null
          : undefined,
    linkedContentId:
      typeof body?.linkedContentId === "string" && body.linkedContentId.trim()
        ? body.linkedContentId.trim().slice(0, 120)
        : body?.linkedContentId === null
          ? null
          : undefined,
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

export async function GET(request: Request, { params }: Params) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await validatePostCreationBoardAccess({ request, session: session as any });
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, reason: access.reason }, { status: access.status });
  }

  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ ok: false, error: "Draft inválido." }, { status: 400 });
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

  const item = await PostCreationDraft.findOne({
    _id: new Types.ObjectId(params.id),
    userId: new Types.ObjectId(targetResolution.userId),
  })
    .lean()
    .exec();

  if (!item) {
    return NextResponse.json({ ok: false, error: "Draft não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: serializeDraft(item) });
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getAuthenticatedSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const access = await validatePostCreationBoardAccess({ request, session: session as any });
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.error, reason: access.reason }, { status: access.status });
  }

  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ ok: false, error: "Draft inválido." }, { status: 400 });
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

  const update: Record<string, unknown> = {};
  if (normalized.stage !== undefined) update.stage = normalized.stage;
  if (normalized.titleSnapshot !== undefined) update.titleSnapshot = normalized.titleSnapshot || null;
  if (normalized.state !== undefined) update.state = normalized.state;
  if (normalized.selectedSlotId !== undefined) update.selectedSlotId = normalized.selectedSlotId;
  if (normalized.selectedScriptId !== undefined) update.selectedScriptId = normalized.selectedScriptId;
  if (normalized.linkedContentId !== undefined) update.linkedContentId = normalized.linkedContentId;

  const updated = await PostCreationDraft.findOneAndUpdate(
    {
      _id: new Types.ObjectId(params.id),
      userId: new Types.ObjectId(targetResolution.userId),
    },
    { $set: update },
    { new: true }
  )
    .lean()
    .exec();

  if (!updated) {
    return NextResponse.json({ ok: false, error: "Draft não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, item: serializeDraft(updated) });
}
