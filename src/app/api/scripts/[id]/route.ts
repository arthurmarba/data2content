import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ScriptEntry from "@/app/models/ScriptEntry";
import { applyScriptToPlannerSlot, clearScriptFromPlannerSlot } from "@/app/lib/scripts/scriptSync";
import { resolveTargetScriptsUser, validateScriptsAccess } from "@/app/lib/scripts/access";
import { isScriptsStyleTrainingV1Enabled } from "@/app/lib/scripts/featureFlag";
import { refreshScriptStyleProfile } from "@/app/lib/scripts/styleTraining";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

function normalizeBody(body: any) {
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
  const adminAnnotation =
    typeof body?.adminAnnotation === "string" || body?.adminAnnotation === null
      ? body.adminAnnotation
      : undefined;
  return { title, content, targetUserId, adminAnnotation };
}

function normalizeAdminAnnotation(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 5000);
}

function serializeScriptItem(item: any, options?: { includeAdminAnnotation?: boolean }) {
  const includeAdminAnnotation = Boolean(options?.includeAdminAnnotation);
  const hasRecommendation = Boolean(item?.isAdminRecommendation);
  return {
    id: String(item._id),
    title: item.title,
    content: item.content,
    source: item.source,
    linkType: item.linkType,
    plannerRef: item.plannerRef || null,
    aiVersionId: item.aiVersionId ?? null,
    recommendation: hasRecommendation
      ? {
          isRecommended: true,
          recommendedByAdminName: item.recommendedByAdminName || null,
          recommendedAt: item.recommendedAt || null,
        }
      : null,
    adminAnnotation: includeAdminAnnotation
      ? {
          notes: item.adminAnnotation || null,
          updatedByName: item.adminAnnotationUpdatedByName || null,
          updatedAt: item.adminAnnotationUpdatedAt || null,
        }
      : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function PATCH(request: Request, { params }: Params) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  const access = await validateScriptsAccess({ request, session: session as any });
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error, reason: access.reason },
      { status: access.status }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON inválido." }, { status: 400 });
  }

  const { title, content, targetUserId, adminAnnotation } = normalizeBody(body);
  const targetResolution = resolveTargetScriptsUser({ session: session as any, targetUserId });
  if (!targetResolution.ok) {
    return NextResponse.json({ ok: false, error: targetResolution.error }, { status: targetResolution.status });
  }
  const effectiveUserId = targetResolution.userId;
  const includeAdminAnnotation = true;
  const canWriteAdminAnnotation = targetResolution.isAdminActor;
  const normalizedAdminAnnotation = canWriteAdminAnnotation
    ? normalizeAdminAnnotation(adminAnnotation)
    : undefined;
  const finalTitle = (title || "Roteiro sem título").slice(0, 180);
  if (!content) {
    return NextResponse.json({ ok: false, error: "O conteúdo do roteiro não pode ficar vazio." }, { status: 400 });
  }

  await connectToDatabase();
  const doc = await ScriptEntry.findOne({
    _id: new Types.ObjectId(params.id),
    userId: new Types.ObjectId(effectiveUserId),
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Roteiro não encontrado." }, { status: 404 });
  }

  doc.title = finalTitle;
  doc.content = content;
  if (normalizedAdminAnnotation !== undefined) {
    doc.adminAnnotation = normalizedAdminAnnotation;
    doc.adminAnnotationUpdatedById = normalizedAdminAnnotation ? new Types.ObjectId(session.user.id as string) : null;
    doc.adminAnnotationUpdatedByName = normalizedAdminAnnotation ? ((session.user as any)?.name || "Admin") : null;
    doc.adminAnnotationUpdatedAt = normalizedAdminAnnotation ? new Date() : null;
  }
  await doc.save();

  const styleTrainingEnabled = await isScriptsStyleTrainingV1Enabled();
  if (styleTrainingEnabled) {
    void refreshScriptStyleProfile(effectiveUserId, { awaitCompletion: false }).catch(() => null);
  }

  if (doc.linkType === "planner_slot" && doc.plannerRef?.weekStart && doc.plannerRef?.slotId) {
    await applyScriptToPlannerSlot({
      userId: effectiveUserId,
      plannerRef: {
        weekStart: doc.plannerRef.weekStart,
        slotId: doc.plannerRef.slotId,
        dayOfWeek: doc.plannerRef.dayOfWeek,
        blockStartHour: doc.plannerRef.blockStartHour,
      },
      title: doc.title,
      content: doc.content,
      aiVersionId: doc.aiVersionId ?? null,
    });
  }

  return NextResponse.json({
    ok: true,
    item: serializeScriptItem(doc, { includeAdminAnnotation }),
  });
}

export async function DELETE(request: Request, { params }: Params) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (!Types.ObjectId.isValid(params.id)) {
    return NextResponse.json({ ok: false, error: "ID inválido." }, { status: 400 });
  }

  const access = await validateScriptsAccess({ request, session: session as any });
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.error, reason: access.reason },
      { status: access.status }
    );
  }

  const url = new URL(request.url);
  const targetResolution = resolveTargetScriptsUser({
    session: session as any,
    targetUserId: url.searchParams.get("targetUserId"),
  });
  if (!targetResolution.ok) {
    return NextResponse.json({ ok: false, error: targetResolution.error }, { status: targetResolution.status });
  }
  const effectiveUserId = targetResolution.userId;

  await connectToDatabase();
  const doc = await ScriptEntry.findOne({
    _id: new Types.ObjectId(params.id),
    userId: new Types.ObjectId(effectiveUserId),
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Roteiro não encontrado." }, { status: 404 });
  }

  if (doc.linkType === "planner_slot" && doc.plannerRef?.weekStart && doc.plannerRef?.slotId) {
    await clearScriptFromPlannerSlot({
      userId: effectiveUserId,
      plannerRef: {
        weekStart: doc.plannerRef.weekStart,
        slotId: doc.plannerRef.slotId,
        dayOfWeek: doc.plannerRef.dayOfWeek,
        blockStartHour: doc.plannerRef.blockStartHour,
      },
    });
  }

  await doc.deleteOne();
  return NextResponse.json({ ok: true });
}
