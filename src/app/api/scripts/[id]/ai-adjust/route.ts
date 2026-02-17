import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ScriptEntry from "@/app/models/ScriptEntry";
import AIGeneratedPost from "@/app/models/AIGeneratedPost";
import { adjustScriptFromPrompt, ScriptAdjustScopeError } from "@/app/lib/scripts/ai";
import { applyScriptToPlannerSlot } from "@/app/lib/scripts/scriptSync";
import { resolveTargetScriptsUser, validateScriptsAccess } from "@/app/lib/scripts/access";
import { isScriptsIntelligenceV2Enabled, isScriptsStyleTrainingV1Enabled } from "@/app/lib/scripts/featureFlag";
import {
  buildIntelligencePromptSnapshot,
  buildScriptIntelligenceContext,
  type ScriptIntelligenceContext,
} from "@/app/lib/scripts/intelligenceContext";
import {
  buildScriptOutputDiagnostics,
  logScriptsGenerationObservability,
} from "@/app/lib/scripts/observability";
import { refreshScriptStyleProfile } from "@/app/lib/scripts/styleTraining";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

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

export async function POST(request: Request, { params }: Params) {
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
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
  if (!prompt) {
    return NextResponse.json({ ok: false, error: "Informe o ajuste que a IA deve fazer." }, { status: 400 });
  }
  const targetResolution = resolveTargetScriptsUser({ session: session as any, targetUserId });
  if (!targetResolution.ok) {
    return NextResponse.json({ ok: false, error: targetResolution.error }, { status: targetResolution.status });
  }
  const includeAdminAnnotation = true;
  const effectiveUserId = targetResolution.userId;
  const isRecommendation = targetResolution.isActingOnBehalf;
  const recommendedByAdminName = isRecommendation
    ? ((session.user as any)?.name || "Recomendação do time")
    : null;

  await connectToDatabase();
  const doc = await ScriptEntry.findOne({
    _id: new Types.ObjectId(params.id),
    userId: new Types.ObjectId(effectiveUserId),
  });
  if (!doc) {
    return NextResponse.json({ ok: false, error: "Roteiro não encontrado." }, { status: 404 });
  }

  let intelligenceContext: ScriptIntelligenceContext | null = null;
  const useIntelligence = await isScriptsIntelligenceV2Enabled();
  if (useIntelligence) {
    try {
      intelligenceContext = await buildScriptIntelligenceContext({
        userId: effectiveUserId,
        prompt,
        lookbackDays: 180,
      });
    } catch {
      intelligenceContext = null;
    }
  }

  let adjusted: Awaited<ReturnType<typeof adjustScriptFromPrompt>>;
  try {
    adjusted = await adjustScriptFromPrompt({
      prompt,
      title: doc.title,
      content: doc.content,
      intelligenceContext,
    });
  } catch (error: any) {
    if (error instanceof ScriptAdjustScopeError) {
      return NextResponse.json(
        { ok: false, error: error.message, code: error.code },
        { status: error.status }
      );
    }
    throw error;
  }

  const diagnostics = buildScriptOutputDiagnostics({
    operation: "adjust",
    prompt,
    title: adjusted.title,
    content: adjusted.content,
    previousContent: doc.content,
    intelligenceContext,
    adjustMeta: adjusted.adjustMeta,
  });

  const aiDoc = await AIGeneratedPost.create({
    userId: new Types.ObjectId(effectiveUserId),
    platform: "instagram",
    title: adjusted.title,
    script: adjusted.content,
    planId: null,
    slotId: doc.plannerRef?.slotId || null,
    promptContext: {
      prompt,
      source: "my_scripts_adjust",
      scriptId: String(doc._id),
      adminRecommendation: isRecommendation
        ? {
            recommendedByAdminId: session.user.id as string,
            recommendedByAdminName,
            targetUserId: effectiveUserId,
          }
        : null,
      intelligence: buildIntelligencePromptSnapshot(intelligenceContext),
      diagnostics,
    },
    strategy: "my_scripts_adjust",
  });

  doc.title = adjusted.title.slice(0, 180);
  doc.content = adjusted.content;
  doc.aiVersionId = String(aiDoc._id);
  doc.source = "ai";
  if (isRecommendation) {
    doc.isAdminRecommendation = true;
    doc.recommendedByAdminId = new Types.ObjectId(session.user.id as string);
    doc.recommendedByAdminName = recommendedByAdminName;
    doc.recommendedAt = new Date();
  }
  await doc.save();

  const styleTrainingEnabled = await isScriptsStyleTrainingV1Enabled();
  if (styleTrainingEnabled) {
    try {
      await refreshScriptStyleProfile(effectiveUserId);
    } catch {
      // Não bloqueia ajuste de roteiro.
    }
  }

  logScriptsGenerationObservability({
    userId: effectiveUserId,
    operation: "adjust",
    scriptId: String(doc._id),
    aiVersionId: String(aiDoc._id),
    diagnostics,
  });

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
      aiVersionId: String(aiDoc._id),
    });
  }

  return NextResponse.json({
    ok: true,
    item: serializeScriptItem(doc, { includeAdminAnnotation }),
  });
}
