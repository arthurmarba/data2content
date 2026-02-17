import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ScriptEntry from "@/app/models/ScriptEntry";
import AIGeneratedPost from "@/app/models/AIGeneratedPost";
import { generateScriptFromPrompt } from "@/app/lib/scripts/ai";
import { applyScriptToPlannerSlot, normalizeToMondayInTZ } from "@/app/lib/scripts/scriptSync";
import { resolveTargetScriptsUser, validateScriptsAccess } from "@/app/lib/scripts/access";
import { isScriptsIntelligenceV2Enabled, isScriptsStyleTrainingV1Enabled } from "@/app/lib/scripts/featureFlag";
import {
  buildIntelligencePromptSnapshot,
  buildScriptIntelligenceContext,
  type ScriptIntelligenceContext,
} from "@/app/lib/scripts/intelligenceContext";
import { refreshScriptStyleProfile } from "@/app/lib/scripts/styleTraining";
import {
  buildScriptOutputDiagnostics,
  logScriptsGenerationObservability,
  type ScriptOutputDiagnostics,
} from "@/app/lib/scripts/observability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

type CursorToken = {
  updatedAt: string;
  id: string;
};

type ScriptOriginFilter = "all" | "manual" | "ai" | "planner";

function parseLimit(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function encodeCursor(token: CursorToken): string {
  return Buffer.from(JSON.stringify(token)).toString("base64url");
}

function decodeCursor(raw: string | null): CursorToken | null {
  if (!raw) return null;
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    if (
      decoded &&
      typeof decoded.updatedAt === "string" &&
      typeof decoded.id === "string" &&
      Types.ObjectId.isValid(decoded.id)
    ) {
      return decoded as CursorToken;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeOrigin(value: string | null): ScriptOriginFilter {
  if (value === "manual" || value === "ai" || value === "planner") return value;
  return "all";
}

function normalizeCreateBody(body: any) {
  const mode = body?.mode === "ai" ? "ai" : "manual";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const linkToSlot = body?.linkToSlot && typeof body.linkToSlot === "object" ? body.linkToSlot : null;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
  const adminAnnotation =
    typeof body?.adminAnnotation === "string" || body?.adminAnnotation === null
      ? body.adminAnnotation
      : undefined;
  return { mode, title, content, prompt, linkToSlot, targetUserId, adminAnnotation };
}

function normalizeAdminAnnotation(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 5000);
}

function normalizeLinkToSlot(linkToSlot: any) {
  if (!linkToSlot) return null;
  if (typeof linkToSlot?.slotId !== "string" || !linkToSlot.slotId.trim()) return null;
  const weekStartRaw = new Date(linkToSlot.weekStart);
  if (Number.isNaN(weekStartRaw.getTime())) return null;
  const weekStart = normalizeToMondayInTZ(weekStartRaw);
  return {
    slotId: linkToSlot.slotId.trim(),
    weekStart,
    dayOfWeek: typeof linkToSlot.dayOfWeek === "number" ? linkToSlot.dayOfWeek : undefined,
    blockStartHour: typeof linkToSlot.blockStartHour === "number" ? linkToSlot.blockStartHour : undefined,
  };
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

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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
  const includeAdminAnnotation = true;
  const limit = parseLimit(url.searchParams.get("limit"));
  const cursor = decodeCursor(url.searchParams.get("cursor"));
  const q = (url.searchParams.get("q") || "").trim();
  const origin = normalizeOrigin(url.searchParams.get("origin"));

  const query: Record<string, any> = {
    userId: new Types.ObjectId(effectiveUserId),
  };
  const andConditions: Record<string, any>[] = [];

  if (origin === "manual") andConditions.push({ source: "manual" });
  if (origin === "ai") andConditions.push({ source: "ai" });
  if (origin === "planner") {
    andConditions.push({ $or: [{ linkType: "planner_slot" }, { source: "planner" }] });
  }

  if (q) {
    const regex = new RegExp(escapeRegex(q), "i");
    andConditions.push({ $or: [{ title: regex }, { content: regex }] });
  }

  if (cursor) {
    const cursorDate = new Date(cursor.updatedAt);
    if (!Number.isNaN(cursorDate.getTime())) {
      andConditions.push({
        $or: [
          { updatedAt: { $lt: cursorDate } },
          {
            updatedAt: cursorDate,
            _id: { $lt: new Types.ObjectId(cursor.id) },
          },
        ],
      });
    }
  }

  if (andConditions.length) {
    query.$and = andConditions;
  }

  await connectToDatabase();

  const docs = await ScriptEntry.find(query)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean()
    .exec();

  const hasMore = docs.length > limit;
  const pageItems = hasMore ? docs.slice(0, limit) : docs;
  const last = pageItems[pageItems.length - 1];

  const nextCursor =
    hasMore && last
      ? encodeCursor({
          updatedAt: new Date(last.updatedAt).toISOString(),
          id: String(last._id),
        })
      : null;

  return NextResponse.json({
    ok: true,
    items: pageItems.map((item: any) => serializeScriptItem(item, { includeAdminAnnotation })),
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
  });
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
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

  const { mode, title, content, prompt, linkToSlot, targetUserId, adminAnnotation } = normalizeCreateBody(body);
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
  const isRecommendation = targetResolution.isActingOnBehalf;
  const recommendedByAdminName = isRecommendation
    ? ((session.user as any)?.name || "Recomendação do time")
    : null;
  const normalizedLink = normalizeLinkToSlot(linkToSlot);

  let nextTitle = title;
  let nextContent = content;
  let aiVersionId: string | null = null;
  let intelligenceContext: ScriptIntelligenceContext | null = null;
  let diagnostics: ScriptOutputDiagnostics | null = null;

  if (mode === "ai") {
    if (!prompt) {
      return NextResponse.json({ ok: false, error: "Prompt é obrigatório para gerar com IA." }, { status: 400 });
    }
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

    const generated = await generateScriptFromPrompt({ prompt, intelligenceContext });
    nextTitle = generated.title;
    nextContent = generated.content;
    diagnostics = buildScriptOutputDiagnostics({
      operation: "create",
      prompt,
      title: nextTitle,
      content: nextContent,
      intelligenceContext,
    });
  }

  if (!nextTitle && !nextContent) {
    return NextResponse.json({ ok: false, error: "Preencha o título ou o roteiro." }, { status: 400 });
  }

  const finalTitle = (nextTitle || "Roteiro sem título").trim().slice(0, 180);
  const finalContent = (nextContent || "").trim();
  if (!finalContent) {
    return NextResponse.json({ ok: false, error: "O conteúdo do roteiro não pode ficar vazio." }, { status: 400 });
  }

  await connectToDatabase();

  if (mode === "ai") {
    const aiDoc = await AIGeneratedPost.create({
      userId: new Types.ObjectId(effectiveUserId),
      platform: "instagram",
      title: finalTitle,
      script: finalContent,
      promptContext: {
        prompt,
        source: "my_scripts_create",
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
      strategy: "my_scripts_create",
    });
    aiVersionId = String(aiDoc._id);

    logScriptsGenerationObservability({
      userId: effectiveUserId,
      operation: "create",
      aiVersionId,
      diagnostics:
        diagnostics ||
        buildScriptOutputDiagnostics({
          operation: "create",
          prompt: prompt || "",
          title: finalTitle,
          content: finalContent,
          intelligenceContext,
        }),
    });
  }

  if (normalizedLink) {
    await applyScriptToPlannerSlot({
      userId: effectiveUserId,
      plannerRef: {
        weekStart: normalizedLink.weekStart,
        slotId: normalizedLink.slotId,
        dayOfWeek: normalizedLink.dayOfWeek,
        blockStartHour: normalizedLink.blockStartHour,
      },
      title: finalTitle,
      content: finalContent,
      aiVersionId,
    });
  }

  const query = normalizedLink
    ? {
        userId: new Types.ObjectId(effectiveUserId),
        linkType: "planner_slot",
        "plannerRef.weekStart": normalizedLink.weekStart,
        "plannerRef.slotId": normalizedLink.slotId,
      }
    : null;

  const payload = {
    userId: new Types.ObjectId(effectiveUserId),
    title: finalTitle,
    content: finalContent,
    source: mode,
    linkType: normalizedLink ? "planner_slot" : "standalone",
    plannerRef: normalizedLink
      ? {
          weekStart: normalizedLink.weekStart,
          slotId: normalizedLink.slotId,
          dayOfWeek: normalizedLink.dayOfWeek,
          blockStartHour: normalizedLink.blockStartHour,
        }
      : undefined,
    aiVersionId,
    isAdminRecommendation: isRecommendation,
    recommendedByAdminId: isRecommendation ? new Types.ObjectId(session.user.id as string) : null,
    recommendedByAdminName: isRecommendation ? recommendedByAdminName : null,
    recommendedAt: isRecommendation ? new Date() : null,
    ...(normalizedAdminAnnotation !== undefined
      ? {
          adminAnnotation: normalizedAdminAnnotation,
          adminAnnotationUpdatedById: normalizedAdminAnnotation ? new Types.ObjectId(session.user.id as string) : null,
          adminAnnotationUpdatedByName: normalizedAdminAnnotation ? ((session.user as any)?.name || "Admin") : null,
          adminAnnotationUpdatedAt: normalizedAdminAnnotation ? new Date() : null,
        }
      : {}),
  };

  const saved = query
    ? await ScriptEntry.findOneAndUpdate(query, { $set: payload }, { new: true, upsert: true, setDefaultsOnInsert: true })
        .lean()
        .exec()
    : await ScriptEntry.create(payload);

  const asLean = (saved as any)?._doc ? (saved as any)._doc : saved;

  const styleTrainingEnabled = await isScriptsStyleTrainingV1Enabled();
  if (styleTrainingEnabled) {
    try {
      await refreshScriptStyleProfile(effectiveUserId);
    } catch {
      // Não bloqueia o fluxo de salvar roteiro.
    }
  }

  return NextResponse.json({
    ok: true,
    item: serializeScriptItem(asLean, { includeAdminAnnotation }),
  });
}
