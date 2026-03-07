import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import ScriptEntry from "@/app/models/ScriptEntry";
import AIGeneratedPost from "@/app/models/AIGeneratedPost";
import Metric from "@/app/models/Metric";
import CampaignLink from "@/app/models/CampaignLink";
import BrandProposal from "@/app/models/BrandProposal";
import { generateScriptFromPrompt } from "@/app/lib/scripts/ai";
import { applyScriptToPlannerSlot, normalizeToMondayInTZ } from "@/app/lib/scripts/scriptSync";
import { resolveTargetScriptsUser, validateScriptsAccess } from "@/app/lib/scripts/access";
import { isScriptsIntelligenceV2Enabled, isScriptsStyleTrainingV1Enabled } from "@/app/lib/scripts/featureFlag";
import {
  buildIntelligencePromptSnapshot,
  buildScriptIntelligenceContext,
  type ScriptIntelligenceContext,
} from "@/app/lib/scripts/intelligenceContext";
import { invalidatePlannerRecommendationMemory } from "@/app/lib/planner/recommendationMemoryCache";
import { refreshScriptOutcomeProfile } from "@/app/lib/scripts/outcomeTraining";
import { refreshScriptStyleProfile } from "@/app/lib/scripts/styleTraining";
import {
  buildScriptOutputDiagnostics,
  logScriptsGenerationObservability,
  type ScriptOutputDiagnostics,
} from "@/app/lib/scripts/observability";
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from "@/app/lib/mongoTransient";
import { logger } from "@/app/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;
const SCRIPTS_NOTIFICATIONS_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.SCRIPTS_NOTIFICATIONS_CACHE_TTL_MS ?? 20_000);
  return Number.isFinite(parsed) && parsed >= 2_000 ? Math.floor(parsed) : 20_000;
})();
const SCRIPTS_NOTIFICATIONS_CACHE_MAX_ENTRIES = (() => {
  const parsed = Number(process.env.SCRIPTS_NOTIFICATIONS_CACHE_MAX_ENTRIES ?? 10_000);
  return Number.isFinite(parsed) && parsed >= 500 ? Math.floor(parsed) : 10_000;
})();

const scriptsNotificationsCache = new Map<string, { expiresAt: number; payload: any }>();

function logScriptsMongoRetry(context: string, error: unknown, retryCount: number) {
  logger.warn("[scripts] Retry para erro transitorio de Mongo.", {
    context,
    retryCount,
    error: getErrorMessage(error),
  });
}

function buildScriptsTransientResponse(error: unknown, message: string) {
  logger.warn("[scripts] Erro transitorio de Mongo.", {
    error: getErrorMessage((error as any)?.cause ?? error),
  });
  return NextResponse.json({ ok: false, error: message }, { status: 503 });
}

async function getAuthenticatedSession(context: string) {
  try {
    const session = (await getServerSession(authOptions as any)) as any;
    const userId = session?.user?.id;
    if (typeof userId !== "string" || !userId.trim()) {
      return null;
    }
    return session;
  } catch (error) {
    logger.warn("[scripts] Sessao invalida ao autenticar requisicao.", {
      context,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

function pruneScriptsNotificationsCache(nowTs: number) {
  for (const [key, value] of scriptsNotificationsCache.entries()) {
    if (value.expiresAt <= nowTs) scriptsNotificationsCache.delete(key);
  }
  if (scriptsNotificationsCache.size <= SCRIPTS_NOTIFICATIONS_CACHE_MAX_ENTRIES) return;
  const overflow = scriptsNotificationsCache.size - SCRIPTS_NOTIFICATIONS_CACHE_MAX_ENTRIES;
  const keys = Array.from(scriptsNotificationsCache.keys());
  for (let i = 0; i < overflow; i += 1) {
    const key = keys[i];
    if (!key) break;
    scriptsNotificationsCache.delete(key);
  }
}

type CursorToken = {
  updatedAt: string;
  id: string;
};

type ScriptOriginFilter = "all" | "manual" | "ai" | "planner";
type ScriptPostedFilter = "all" | "posted" | "unposted";
type ScriptLinkingCampaignSummary = {
  proposalId: string;
  linkId: string;
  campaignTitle: string;
  brandName: string;
  linkedAt: string | null;
};
type ScriptLinkingSummary = {
  isLinked: boolean;
  totalLinks: number;
  campaigns: ScriptLinkingCampaignSummary[];
};

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

function isNotificationsView(value: string | null): boolean {
  return value === "notifications";
}

function normalizePostedFilter(value: string | null): ScriptPostedFilter {
  if (value === "posted" || value === "unposted") return value;
  return "all";
}

function createEmptyLinkingSummary(): ScriptLinkingSummary {
  return {
    isLinked: false,
    totalLinks: 0,
    campaigns: [],
  };
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
  const inlineAnnotations = Array.isArray(body?.inlineAnnotations) ? body.inlineAnnotations : undefined;
  const isPosted = typeof body?.isPosted === "boolean" ? body.isPosted : undefined;
  const postedContentId =
    typeof body?.postedContentId === "string" || body?.postedContentId === null
      ? body.postedContentId
      : undefined;
  const clientRequestId =
    typeof body?.clientRequestId === "string" || body?.clientRequestId === null
      ? body.clientRequestId
      : undefined;
  return {
    mode,
    title,
    content,
    prompt,
    linkToSlot,
    targetUserId,
    adminAnnotation,
    inlineAnnotations,
    isPosted,
    postedContentId,
    clientRequestId,
  };
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

function normalizePostedContentId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function normalizeClientRequestId(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, 120);
}

function buildPostedContentCaptionPreview(description: unknown): string | null {
  if (typeof description !== "string") return null;
  const normalized = description.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= 320) return normalized;
  return `${normalized.slice(0, 319).trimEnd()}...`;
}

async function resolvePostedContentForCreate(params: {
  userId: string;
  isPosted?: boolean;
  postedContentId?: string | null;
}) {
  const { userId, isPosted, postedContentId } = params;
  const normalizedPostedContentId = normalizePostedContentId(postedContentId);
  const shouldBePosted = isPosted === true || typeof normalizedPostedContentId === "string";

  if (!shouldBePosted) {
    return { ok: true as const, postedAt: null, postedContent: null };
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
      onRetry: (error, retryCount) => logScriptsMongoRetry("resolvePostedContentForCreate", error, retryCount),
    }
  );

  if (!metricDoc) {
    return {
      ok: false as const,
      status: 404,
      error: "Conteúdo não encontrado para este usuário.",
    };
  }

  return {
    ok: true as const,
    postedAt: new Date(),
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

function serializeScriptItem(
  item: any,
  options?: {
    includeAdminAnnotation?: boolean;
    linkingSummaryByScriptId?: Map<string, ScriptLinkingSummary>;
  }
) {
  const includeAdminAnnotation = Boolean(options?.includeAdminAnnotation);
  const hasRecommendation = Boolean(item?.isAdminRecommendation);
  const hasPostedContent = Boolean(item?.postedContent?.metricId);
  const scriptId = String(item._id);
  const linkingSummary =
    options?.linkingSummaryByScriptId?.get(scriptId) || createEmptyLinkingSummary();
  return {
    id: scriptId,
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
    linkingSummary,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function serializeScriptNotificationItem(item: any) {
  const hasRecommendation = Boolean(item?.isAdminRecommendation);
  return {
    id: String(item._id),
    updatedAt: item.updatedAt,
    recommendation: hasRecommendation
      ? {
        isRecommended: true,
        recommendedAt: item.recommendedAt || null,
      }
      : null,
    adminAnnotation: {
      notes: item.adminAnnotation || null,
      updatedAt: item.adminAnnotationUpdatedAt || null,
    },
  };
}

async function buildLinkingSummaryByScriptId(params: {
  userId: string;
  scriptDocs: Array<{ _id: Types.ObjectId | string }>;
}): Promise<Map<string, ScriptLinkingSummary>> {
  const scriptIds = params.scriptDocs
    .map((doc) => String(doc._id))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  if (scriptIds.length === 0) {
    return new Map();
  }

  const links = await CampaignLink.find({
    userId: new Types.ObjectId(params.userId),
    entityType: "script",
    entityId: { $in: scriptIds },
  })
    .select("_id proposalId entityId createdAt updatedAt")
    .sort({ updatedAt: -1, _id: -1 })
    .lean()
    .exec();

  if (!links.length) {
    return new Map();
  }

  const proposalIds = links
    .map((link: any) => String(link.proposalId))
    .filter((id, index, all) => all.indexOf(id) === index)
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const proposals = proposalIds.length
    ? await BrandProposal.find({
      _id: { $in: proposalIds },
      userId: new Types.ObjectId(params.userId),
    })
      .select("_id campaignTitle brandName")
      .lean()
      .exec()
    : [];

  const proposalById = new Map<
    string,
    { campaignTitle: string; brandName: string }
  >();
  proposals.forEach((proposal: any) => {
    const proposalId = String(proposal._id);
    proposalById.set(proposalId, {
      campaignTitle:
        typeof proposal.campaignTitle === "string" && proposal.campaignTitle.trim()
          ? proposal.campaignTitle.trim()
          : "Campanha sem título",
      brandName:
        typeof proposal.brandName === "string" && proposal.brandName.trim()
          ? proposal.brandName.trim()
          : "Marca",
    });
  });

  const campaignsByScriptId = new Map<string, ScriptLinkingCampaignSummary[]>();
  links.forEach((link: any) => {
    const scriptId = String(link.entityId);
    const proposalId = String(link.proposalId);
    const proposal = proposalById.get(proposalId);
    if (!proposal) return;

    const campaigns = campaignsByScriptId.get(scriptId) || [];
    campaigns.push({
      proposalId,
      linkId: String(link._id),
      campaignTitle: proposal.campaignTitle,
      brandName: proposal.brandName,
      linkedAt: link.updatedAt
        ? new Date(link.updatedAt).toISOString()
        : link.createdAt
          ? new Date(link.createdAt).toISOString()
          : null,
    });
    campaignsByScriptId.set(scriptId, campaigns);
  });

  const linkingSummaryByScriptId = new Map<string, ScriptLinkingSummary>();
  campaignsByScriptId.forEach((campaigns, scriptId) => {
    linkingSummaryByScriptId.set(scriptId, {
      isLinked: campaigns.length > 0,
      totalLinks: campaigns.length,
      campaigns,
    });
  });

  return linkingSummaryByScriptId;
}

export async function GET(request: Request) {
  try {
    const session = await getAuthenticatedSession("GET /api/scripts");
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
    const posted = normalizePostedFilter(url.searchParams.get("posted"));
    const notificationsView = isNotificationsView(url.searchParams.get("view"));

    const query: Record<string, any> = {
      userId: new Types.ObjectId(effectiveUserId),
    };
    const andConditions: Record<string, any>[] = [];

    if (origin === "manual") andConditions.push({ source: "manual" });
    if (origin === "ai") andConditions.push({ source: "ai" });
    if (origin === "planner") {
      andConditions.push({ $or: [{ linkType: "planner_slot" }, { source: "planner" }] });
    }
    if (posted === "posted") {
      andConditions.push({ "postedContent.metricId": { $exists: true } });
    } else if (posted === "unposted") {
      andConditions.push({
        $or: [
          { postedContent: null },
          { postedContent: { $exists: false } },
          { "postedContent.metricId": { $exists: false } },
        ],
      });
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

    const cacheKey = notificationsView
      ? [
        effectiveUserId,
        limit,
        cursor?.updatedAt ?? "",
        cursor?.id ?? "",
        q,
        origin,
        posted,
      ].join("|")
      : null;
    const nowTs = Date.now();
    if (cacheKey) {
      pruneScriptsNotificationsCache(nowTs);
      const cached = scriptsNotificationsCache.get(cacheKey);
      if (cached && cached.expiresAt > nowTs) {
        return NextResponse.json(cached.payload);
      }
    }

    const { docs, linkingSummaryByScriptId } = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();

        let docsQuery = ScriptEntry.find(query);
        if (notificationsView) {
          docsQuery = docsQuery.select(
            "_id updatedAt isAdminRecommendation recommendedAt adminAnnotation adminAnnotationUpdatedAt"
          );
        }
        const docs = await docsQuery.sort({ updatedAt: -1, _id: -1 }).limit(limit + 1).lean().exec();

        const pageItems = docs.length > limit ? docs.slice(0, limit) : docs;
        const linkingSummaryByScriptId =
          notificationsView || pageItems.length === 0
            ? new Map<string, ScriptLinkingSummary>()
            : await buildLinkingSummaryByScriptId({
                userId: effectiveUserId,
                scriptDocs: pageItems,
              });

        return { docs, linkingSummaryByScriptId };
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => logScriptsMongoRetry("GET /api/scripts", error, retryCount),
      }
    );

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

    const payload = {
      ok: true,
      items: notificationsView
        ? pageItems.map((item: any) => serializeScriptNotificationItem(item))
        : pageItems.map((item: any) =>
            serializeScriptItem(item, { includeAdminAnnotation, linkingSummaryByScriptId })
          ),
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
    };

    if (cacheKey) {
      scriptsNotificationsCache.set(cacheKey, {
        payload,
        expiresAt: nowTs + SCRIPTS_NOTIFICATIONS_CACHE_TTL_MS,
      });
    }

    return NextResponse.json(payload);
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      return buildScriptsTransientResponse(
        error,
        "Os roteiros estao temporariamente indisponiveis. Tente novamente em instantes."
      );
    }

    logger.error("[scripts] Falha ao listar roteiros.", error);
    return NextResponse.json({ ok: false, error: "Nao foi possivel carregar os roteiros." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthenticatedSession("POST /api/scripts");
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

    const {
      mode,
      title,
      content,
      prompt,
      linkToSlot,
      targetUserId,
      adminAnnotation,
      inlineAnnotations,
      isPosted,
      postedContentId,
      clientRequestId,
    } = normalizeCreateBody(body);
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
    const normalizedClientRequestId = normalizeClientRequestId(clientRequestId);
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
        } catch (error) {
          intelligenceContext = null;
          logger.warn("[scripts][create][intelligence_context_failed]", {
            userId: effectiveUserId,
            promptLength: prompt.length,
            error: error instanceof Error ? error.message : String(error || ""),
          });
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

    await withMongoTransientRetry(
      () => connectToDatabase(),
      {
        retries: 1,
        onRetry: (error, retryCount) => logScriptsMongoRetry("POST /api/scripts connect", error, retryCount),
      }
    );

    if (normalizedClientRequestId) {
      const existing = await withMongoTransientRetry(
        () =>
          ScriptEntry.findOne({
            userId: new Types.ObjectId(effectiveUserId),
            clientRequestId: normalizedClientRequestId,
          })
            .lean()
            .exec(),
        {
          retries: 1,
          onRetry: (error, retryCount) => logScriptsMongoRetry("POST /api/scripts existing", error, retryCount),
        }
      );
      if (existing) {
        return NextResponse.json({
          ok: true,
          item: serializeScriptItem(existing, { includeAdminAnnotation }),
        });
      }
    }

    const postedContentResolution = await resolvePostedContentForCreate({
      userId: effectiveUserId,
      isPosted,
      postedContentId,
    });
    if (!postedContentResolution.ok) {
      return NextResponse.json(
        { ok: false, error: postedContentResolution.error },
        { status: postedContentResolution.status }
      );
    }

    if (mode === "ai") {
      const aiPayload = {
        userId: new Types.ObjectId(effectiveUserId),
        clientRequestId: normalizedClientRequestId ?? null,
        platform: "instagram",
        title: finalTitle,
        script: finalContent,
        promptContext: {
          prompt,
          source: "my_scripts_create",
          requestId: normalizedClientRequestId ?? null,
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
      };
      const aiDoc = normalizedClientRequestId
        ? await withMongoTransientRetry(
            () =>
              AIGeneratedPost.findOneAndUpdate(
                {
                  userId: new Types.ObjectId(effectiveUserId),
                  clientRequestId: normalizedClientRequestId,
                },
                { $setOnInsert: aiPayload },
                { new: true, upsert: true, setDefaultsOnInsert: true }
              ).exec(),
            {
              retries: 1,
              onRetry: (error, retryCount) => logScriptsMongoRetry("POST /api/scripts ai_upsert", error, retryCount),
            }
          )
        : await AIGeneratedPost.create(aiPayload);
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
      try {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        const missingPlannerTarget =
          message === "Plano da semana não encontrado para vincular roteiro." ||
          message === "Slot do planner não encontrado para vincular roteiro.";
        if (!missingPlannerTarget) {
          throw error;
        }
        logger.warn("[scripts][create][planner_sync_skipped_missing_target]", {
          userId: effectiveUserId,
          plannerRef: {
            weekStart: normalizedLink.weekStart,
            slotId: normalizedLink.slotId,
          },
        });
      }
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
      clientRequestId: normalizedClientRequestId ?? null,
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
      ...(inlineAnnotations !== undefined
        ? {
            inlineAnnotations: inlineAnnotations.map((ann: any) => ({
              ...ann,
              startIndex: Number(ann.startIndex) || 0,
              endIndex: Number(ann.endIndex) || 0,
              quote: String(ann.quote || "").slice(0, 2000),
              comment: String(ann.comment || "").slice(0, 2000),
              authorName: String(ann.authorName || "Admin").slice(0, 120),
              isOrphaned: Boolean(ann.isOrphaned),
              resolved: Boolean(ann.resolved),
              createdAt: ann.createdAt ? new Date(ann.createdAt) : new Date(),
            })),
          }
        : {}),
      postedAt: postedContentResolution.postedAt,
      postedContent: postedContentResolution.postedContent,
    };

    const saved = query
      ? await withMongoTransientRetry(
          () =>
            ScriptEntry.findOneAndUpdate(
              query,
              { $set: payload },
              { new: true, upsert: true, setDefaultsOnInsert: true }
            )
              .lean()
              .exec(),
          {
            retries: 1,
            onRetry: (error, retryCount) => logScriptsMongoRetry("POST /api/scripts upsert", error, retryCount),
          }
        )
      : normalizedClientRequestId
        ? await withMongoTransientRetry(
            () =>
              ScriptEntry.findOneAndUpdate(
                {
                  userId: new Types.ObjectId(effectiveUserId),
                  clientRequestId: normalizedClientRequestId,
                },
                { $setOnInsert: payload },
                { new: true, upsert: true, setDefaultsOnInsert: true }
              )
                .lean()
                .exec(),
            {
              retries: 1,
              onRetry: (error, retryCount) => logScriptsMongoRetry("POST /api/scripts create_idempotent", error, retryCount),
            }
          )
        : await ScriptEntry.create(payload);

    const asLean = (saved as any)?._doc ? (saved as any)._doc : saved;

    const styleTrainingEnabled = await isScriptsStyleTrainingV1Enabled();
    if (styleTrainingEnabled) {
      void refreshScriptStyleProfile(effectiveUserId, { awaitCompletion: false }).catch(() => null);
    }
    if (postedContentResolution.postedContent?.metricId) {
      void refreshScriptOutcomeProfile(effectiveUserId, { awaitCompletion: false }).catch(() => null);
      void Promise.resolve(invalidatePlannerRecommendationMemory({ userId: effectiveUserId })).catch(() => null);
    }

    return NextResponse.json({
      ok: true,
      item: serializeScriptItem(asLean, { includeAdminAnnotation }),
    });
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      return buildScriptsTransientResponse(
        error,
        "Nao foi possivel salvar o roteiro agora. Tente novamente em instantes."
      );
    }

    logger.error("[scripts] Falha ao criar roteiro.", error);
    return NextResponse.json({ ok: false, error: "Nao foi possivel salvar o roteiro." }, { status: 500 });
  }
}
