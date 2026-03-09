import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ScriptEntry from "@/app/models/ScriptEntry";
import Metric from "@/app/models/Metric";
import { invalidatePlannerRecommendationMemory } from "@/app/lib/planner/recommendationMemoryCache";
import { applyScriptToPlannerSlot, clearScriptFromPlannerSlot } from "@/app/lib/scripts/scriptSync";
import { resolveTargetScriptsUser, validateScriptsAccess } from "@/app/lib/scripts/access";
import { invalidateScriptsListCacheForUser } from "@/app/lib/scripts/scriptsListCache";
import { refreshScriptOutcomeProfile } from "@/app/lib/scripts/outcomeTraining";
import { isScriptsStyleTrainingV1Enabled } from "@/app/lib/scripts/featureFlag";
import { refreshScriptStyleProfile } from "@/app/lib/scripts/styleTraining";
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from "@/app/lib/mongoTransient";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: {
    id: string;
  };
};

async function getAuthenticatedSession(context: string) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    const userId = session?.user?.id;
    if (typeof userId !== "string" || !userId.trim()) {
      return null;
    }
    return session;
  } catch (error) {
    logger.warn("[scripts/id] Sessao invalida ao autenticar requisicao.", {
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function logScriptByIdMongoRetry(context: string, error: unknown, retryCount: number) {
  logger.warn("[scripts/id] Retry para erro transitorio de Mongo.", {
    context,
    retryCount,
    error: getErrorMessage(error),
  });
}

function buildScriptByIdTransientResponse(error: unknown, message: string) {
  logger.warn("[scripts/id] Erro transitorio de Mongo.", {
    error: getErrorMessage((error as any)?.cause ?? error),
  });
  return NextResponse.json({ ok: false, error: message }, { status: 503 });
}

function normalizeBody(body: any) {
  const title = typeof body?.title === "string" ? body.title.trim() : undefined;
  const content = typeof body?.content === "string" ? body.content.trim() : undefined;
  const targetUserId = typeof body?.targetUserId === "string" ? body.targetUserId.trim() : "";
  const adminAnnotation =
    typeof body?.adminAnnotation === "string" || body?.adminAnnotation === null
      ? body.adminAnnotation
      : undefined;
  const inlineAnnotations = Array.isArray(body?.inlineAnnotations) ? body.inlineAnnotations : undefined;
  const isPosted = typeof body?.isPosted === "boolean" ? body.isPosted : undefined;
  const postedContentId =
    typeof body?.postedContentId === "string" || body?.postedContentId === null
      ? body.postedContentId
      : undefined;
  return { title, content, targetUserId, adminAnnotation, inlineAnnotations, isPosted, postedContentId };
}

function normalizeAdminAnnotation(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 5000);
}

function normalizePostedContentId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function buildPostedContentCaptionPreview(description: unknown): string | null {
  if (typeof description !== "string") return null;
  const normalized = description.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= 320) return normalized;
  return `${normalized.slice(0, 319).trimEnd()}...`;
}

async function resolvePostedContentForPatch(params: {
  userId: string;
  currentDoc: any;
  isPosted?: boolean;
  postedContentId?: string | null;
}) {
  const { userId, currentDoc, isPosted, postedContentId } = params;
  const normalizedPostedContentId = normalizePostedContentId(postedContentId);
  const hasPublicationPatch =
    typeof isPosted === "boolean" || normalizedPostedContentId !== undefined;

  if (!hasPublicationPatch) {
    return { ok: true as const, shouldUpdate: false as const };
  }

  const shouldBePosted = isPosted === true || typeof normalizedPostedContentId === "string";
  if (!shouldBePosted) {
    return {
      ok: true as const,
      shouldUpdate: true as const,
      postedAt: null,
      postedContent: null,
    };
  }

  if (!normalizedPostedContentId) {
    return {
      ok: false as const,
      status: 400,
      error: "Selecione o conteúdo publicado para marcar o roteiro como postado.",
    };
  }
  if (!Types.ObjectId.isValid(normalizedPostedContentId)) {
    return {
      ok: false as const,
      status: 400,
      error: "Conteúdo selecionado inválido.",
    };
  }

  const metricDoc = await withMongoTransientRetry(
    () =>
      Metric.findOne({
        _id: new Types.ObjectId(normalizedPostedContentId),
        user: new Types.ObjectId(userId),
      })
        .select("_id description postDate postLink type stats.engagement stats.total_interactions")
        .lean()
        .exec(),
    {
      retries: 1,
      onRetry: (error, retryCount) => logScriptByIdMongoRetry("resolvePostedContentForPatch", error, retryCount),
    }
  );

  if (!metricDoc) {
    return {
      ok: false as const,
      status: 404,
      error: "Conteúdo não encontrado para este usuário.",
    };
  }

  const currentMetricId = currentDoc?.postedContent?.metricId
    ? String(currentDoc.postedContent.metricId)
    : null;
  const keepPostedAt =
    currentDoc?.postedAt && currentMetricId === normalizedPostedContentId
      ? currentDoc.postedAt
      : new Date();

  return {
    ok: true as const,
    shouldUpdate: true as const,
    postedAt: keepPostedAt,
    postedContent: {
      metricId: metricDoc._id,
      caption: buildPostedContentCaptionPreview(metricDoc.description),
      postDate: metricDoc.postDate ?? null,
      postLink: typeof metricDoc.postLink === "string" ? metricDoc.postLink : null,
      type: typeof metricDoc.type === "string" ? metricDoc.type : null,
      engagement:
        typeof metricDoc.stats?.engagement === "number" && Number.isFinite(metricDoc.stats.engagement)
          ? metricDoc.stats.engagement
          : null,
      totalInteractions:
        typeof metricDoc.stats?.total_interactions === "number" &&
          Number.isFinite(metricDoc.stats.total_interactions)
          ? metricDoc.stats.total_interactions
          : null,
    },
  };
}

function serializeScriptItem(item: any, options?: { includeAdminAnnotation?: boolean }) {
  const includeAdminAnnotation = Boolean(options?.includeAdminAnnotation);
  const hasRecommendation = Boolean(item?.isAdminRecommendation);
  const hasPostedContent = Boolean(item?.postedContent?.metricId);
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
    inlineAnnotations: Array.isArray(item.inlineAnnotations)
      ? item.inlineAnnotations.map((ann: any) => ({
        id: ann.id,
        startIndex: ann.startIndex,
        endIndex: ann.endIndex,
        quote: ann.quote,
        comment: ann.comment,
        authorName: ann.authorName,
        isOrphaned: ann.isOrphaned ?? false,
        resolved: ann.resolved ?? false,
        createdAt: typeof ann.createdAt?.toISOString === "function" ? ann.createdAt.toISOString() : ann.createdAt,
      }))
      : [],
    publication: {
      isPosted: hasPostedContent,
      postedAt: item.postedAt || null,
      content: hasPostedContent
        ? {
          id: String(item.postedContent.metricId),
          caption: item.postedContent.caption || null,
          postDate: item.postedContent.postDate || null,
          postLink: item.postedContent.postLink || null,
          type: item.postedContent.type || null,
          engagement:
            typeof item.postedContent.engagement === "number" ? item.postedContent.engagement : null,
          totalInteractions:
            typeof item.postedContent.totalInteractions === "number"
              ? item.postedContent.totalInteractions
              : null,
        }
        : null,
    },
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await getAuthenticatedSession("GET /api/scripts/[id]");
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
    const includeAdminAnnotation = true;

    const doc = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return ScriptEntry.findOne({
          _id: new Types.ObjectId(params.id),
          userId: new Types.ObjectId(effectiveUserId),
        }).lean();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => logScriptByIdMongoRetry("GET /api/scripts/[id]", error, retryCount),
      }
    );

    if (!doc) {
      return NextResponse.json({ ok: false, error: "Roteiro não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      ok: true,
      item: serializeScriptItem(doc, { includeAdminAnnotation }),
    });
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      return buildScriptByIdTransientResponse(
        error,
        "Nao foi possivel abrir o roteiro agora. Tente novamente em instantes."
      );
    }

    logger.error("[scripts/id] Falha ao carregar roteiro.", error);
    return NextResponse.json({ ok: false, error: "Nao foi possivel abrir o roteiro." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getAuthenticatedSession("PATCH /api/scripts/[id]");
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

    const { title, content, targetUserId, adminAnnotation, inlineAnnotations, isPosted, postedContentId } =
      normalizeBody(body);
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

    await withMongoTransientRetry(
      () => connectToDatabase(),
      {
        retries: 1,
        onRetry: (error, retryCount) => logScriptByIdMongoRetry("PATCH /api/scripts/[id] connect", error, retryCount),
      }
    );

    const doc = await withMongoTransientRetry(
      () =>
        ScriptEntry.findOne({
          _id: new Types.ObjectId(params.id),
          userId: new Types.ObjectId(effectiveUserId),
        }),
      {
        retries: 1,
        onRetry: (error, retryCount) => logScriptByIdMongoRetry("PATCH /api/scripts/[id] find", error, retryCount),
      }
    );
    if (!doc) {
      return NextResponse.json({ ok: false, error: "Roteiro não encontrado." }, { status: 404 });
    }

    const finalTitle = title !== undefined ? (title || "Roteiro sem título").slice(0, 180) : doc.title;
    const finalContent = content !== undefined ? content : doc.content;
    if (!finalContent) {
      return NextResponse.json({ ok: false, error: "O conteúdo do roteiro não pode ficar vazio." }, { status: 400 });
    }

    const postedContentResolution = await resolvePostedContentForPatch({
      userId: effectiveUserId,
      currentDoc: doc,
      isPosted,
      postedContentId,
    });
    if (!postedContentResolution.ok) {
      return NextResponse.json(
        { ok: false, error: postedContentResolution.error },
        { status: postedContentResolution.status }
      );
    }

    const previousPostedMetricId = doc.postedContent?.metricId ? String(doc.postedContent.metricId) : null;
    const previousIsPosted = Boolean(previousPostedMetricId);

    const scriptTextChanged = doc.title !== finalTitle || doc.content !== finalContent;
    doc.title = finalTitle;
    doc.content = finalContent;
    if (normalizedAdminAnnotation !== undefined) {
      doc.adminAnnotation = normalizedAdminAnnotation;
      doc.adminAnnotationUpdatedById = normalizedAdminAnnotation ? new Types.ObjectId(session.user.id as string) : null;
      doc.adminAnnotationUpdatedByName = normalizedAdminAnnotation ? ((session.user as any)?.name || "Admin") : null;
      doc.adminAnnotationUpdatedAt = normalizedAdminAnnotation ? new Date() : null;
    }
    if (inlineAnnotations !== undefined) {
      doc.inlineAnnotations = inlineAnnotations.map((ann: any) => ({
        ...ann,
        startIndex: Number(ann.startIndex) || 0,
        endIndex: Number(ann.endIndex) || 0,
        quote: String(ann.quote || "").slice(0, 2000),
        comment: String(ann.comment || "").slice(0, 2000),
        authorName: String(ann.authorName || "Admin").slice(0, 120),
        isOrphaned: Boolean(ann.isOrphaned),
        resolved: Boolean(ann.resolved),
        createdAt: ann.createdAt ? new Date(ann.createdAt) : new Date(),
      }));
    }
    if (postedContentResolution.shouldUpdate) {
      doc.postedAt = postedContentResolution.postedAt;
      doc.postedContent = postedContentResolution.postedContent;
    }

    await withMongoTransientRetry(
      () => doc.save(),
      {
        retries: 1,
        onRetry: (error, retryCount) => logScriptByIdMongoRetry("PATCH /api/scripts/[id] save", error, retryCount),
      }
    );

    const nextPostedMetricId = doc.postedContent?.metricId ? String(doc.postedContent.metricId) : null;
    const nextIsPosted = Boolean(nextPostedMetricId);
    const publicationChanged = previousIsPosted !== nextIsPosted || previousPostedMetricId !== nextPostedMetricId;

    const styleTrainingEnabled = await isScriptsStyleTrainingV1Enabled();
    if (styleTrainingEnabled) {
      void refreshScriptStyleProfile(effectiveUserId, { awaitCompletion: false }).catch(() => null);
    }
    if (publicationChanged) {
      void refreshScriptOutcomeProfile(effectiveUserId, { awaitCompletion: false }).catch(() => null);
      void Promise.resolve(invalidatePlannerRecommendationMemory({ userId: effectiveUserId })).catch(() => null);
    }
    invalidateScriptsListCacheForUser(effectiveUserId);

    if (
      scriptTextChanged &&
      doc.linkType === "planner_slot" &&
      doc.plannerRef?.weekStart &&
      doc.plannerRef?.slotId
    ) {
      try {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const missingPlannerTarget =
          message === "Plano da semana não encontrado para vincular roteiro." ||
          message === "Slot do planner não encontrado para vincular roteiro.";
        if (!missingPlannerTarget) {
          throw error;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      item: serializeScriptItem(doc, { includeAdminAnnotation }),
    });
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      return buildScriptByIdTransientResponse(
        error,
        "Nao foi possivel atualizar o roteiro agora. Tente novamente em instantes."
      );
    }

    logger.error("[scripts/id] Falha ao atualizar roteiro.", error);
    return NextResponse.json({ ok: false, error: "Nao foi possivel atualizar o roteiro." }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const session = await getAuthenticatedSession("DELETE /api/scripts/[id]");
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

    await withMongoTransientRetry(
      () => connectToDatabase(),
      {
        retries: 1,
        onRetry: (error, retryCount) => logScriptByIdMongoRetry("DELETE /api/scripts/[id] connect", error, retryCount),
      }
    );

    const doc = await withMongoTransientRetry(
      () =>
        ScriptEntry.findOne({
          _id: new Types.ObjectId(params.id),
          userId: new Types.ObjectId(effectiveUserId),
        }),
      {
        retries: 1,
        onRetry: (error, retryCount) => logScriptByIdMongoRetry("DELETE /api/scripts/[id] find", error, retryCount),
      }
    );
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

    const hadPostedContent = Boolean(doc.postedContent?.metricId);
    await withMongoTransientRetry(
      () => doc.deleteOne(),
      {
        retries: 1,
        onRetry: (error, retryCount) => logScriptByIdMongoRetry("DELETE /api/scripts/[id] delete", error, retryCount),
      }
    );

    const styleTrainingEnabled = await isScriptsStyleTrainingV1Enabled();
    if (styleTrainingEnabled) {
      void refreshScriptStyleProfile(effectiveUserId, { awaitCompletion: false }).catch(() => null);
    }
    if (hadPostedContent) {
      void refreshScriptOutcomeProfile(effectiveUserId, { awaitCompletion: false }).catch(() => null);
      void Promise.resolve(invalidatePlannerRecommendationMemory({ userId: effectiveUserId })).catch(() => null);
    }
    invalidateScriptsListCacheForUser(effectiveUserId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      return buildScriptByIdTransientResponse(
        error,
        "Nao foi possivel excluir o roteiro agora. Tente novamente em instantes."
      );
    }

    logger.error("[scripts/id] Falha ao excluir roteiro.", error);
    return NextResponse.json({ ok: false, error: "Nao foi possivel excluir o roteiro." }, { status: 500 });
  }
}
