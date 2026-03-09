import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from "@/app/lib/mongoTransient";
import { logger } from "@/app/lib/logger";
import Metric from "@/app/models/Metric";
import { resolveTargetScriptsUser, validateScriptsAccess } from "@/app/lib/scripts/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEV_E2E_USER_ID = "00000000000000000000e2e1";
const ALLOW_LOCAL_E2E_ROUTES = process.env.ALLOW_LOCAL_E2E_ROUTES === "1";
const CONTENT_OPTIONS_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.SCRIPTS_CONTENT_OPTIONS_CACHE_TTL_MS ?? 20_000);
  return Number.isFinite(parsed) && parsed >= 2_000 ? Math.floor(parsed) : 20_000;
})();
const CONTENT_OPTIONS_CACHE_STALE_WHILE_ERROR_MS = (() => {
  const parsed = Number(process.env.SCRIPTS_CONTENT_OPTIONS_CACHE_STALE_WHILE_ERROR_MS ?? 300_000);
  return Number.isFinite(parsed) && parsed >= 10_000 ? Math.floor(parsed) : 300_000;
})();
const CONTENT_OPTIONS_CACHE_MAX_ENTRIES = (() => {
  const parsed = Number(process.env.SCRIPTS_CONTENT_OPTIONS_CACHE_MAX_ENTRIES ?? 4_000);
  return Number.isFinite(parsed) && parsed >= 200 ? Math.floor(parsed) : 4_000;
})();

const contentOptionsCache = new Map<
  string,
  { expiresAt: number; staleUntil: number; payload: any }
>();

type CursorToken = {
  postDate: string;
  updatedAt: string;
  id: string;
};

function buildContentOptionsCacheKey(params: {
  effectiveUserId: string;
  limit: number;
  queryText: string;
  cursor: CursorToken | null;
}) {
  return [
    params.effectiveUserId,
    params.limit,
    params.queryText,
    params.cursor?.postDate ?? "",
    params.cursor?.updatedAt ?? "",
    params.cursor?.id ?? "",
  ].join("|");
}

function isDevE2EUser(session: any) {
  if (process.env.NODE_ENV === "production" && !ALLOW_LOCAL_E2E_ROUTES) return false;
  const userId = typeof session?.user?.id === "string" ? session.user.id.trim() : "";
  const email = typeof session?.user?.email === "string" ? session.user.email.trim() : "";
  return userId === DEV_E2E_USER_ID || email.endsWith("@data2content.test");
}

function pruneContentOptionsCache(nowTs: number) {
  for (const [key, value] of contentOptionsCache.entries()) {
    if (value.staleUntil <= nowTs) contentOptionsCache.delete(key);
  }
  if (contentOptionsCache.size <= CONTENT_OPTIONS_CACHE_MAX_ENTRIES) return;
  const overflow = contentOptionsCache.size - CONTENT_OPTIONS_CACHE_MAX_ENTRIES;
  const keys = Array.from(contentOptionsCache.keys());
  for (let index = 0; index < overflow; index += 1) {
    const key = keys[index];
    if (!key) break;
    contentOptionsCache.delete(key);
  }
}

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
      typeof decoded.postDate === "string" &&
      typeof decoded.updatedAt === "string" &&
      typeof decoded.id === "string" &&
      Types.ObjectId.isValid(decoded.id)
    ) {
      return decoded as CursorToken;
    }
  } catch {
    // no-op
  }
  return null;
}

function buildCaptionPreview(description: unknown): string {
  if (typeof description !== "string") return "Conteúdo sem legenda";
  const normalized = description.replace(/\s+/g, " ").trim();
  if (!normalized) return "Conteúdo sem legenda";
  if (normalized.length <= 140) return normalized;
  return `${normalized.slice(0, 139).trimEnd()}...`;
}

function toCursorDateString(value: unknown): string {
  const date = value instanceof Date ? value : new Date(value as any);
  if (Number.isFinite(date.getTime())) return date.toISOString();
  return new Date(0).toISOString();
}

export async function GET(request: Request) {
  try {
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
    const limit = parseLimit(url.searchParams.get("limit"));
    const queryText = (url.searchParams.get("q") || "").trim();
    const cursor = decodeCursor(url.searchParams.get("cursor"));
    const cacheKey = buildContentOptionsCacheKey({
      effectiveUserId,
      limit,
      queryText,
      cursor,
    });
    const nowTs = Date.now();
    const shouldBypassCache = isDevE2EUser(session);
    pruneContentOptionsCache(nowTs);
    const cachedEntry = shouldBypassCache ? null : contentOptionsCache.get(cacheKey);

    if (cachedEntry && cachedEntry.expiresAt > nowTs) {
      return NextResponse.json(cachedEntry.payload);
    }

    const query: Record<string, any> = {
      user: new Types.ObjectId(effectiveUserId),
    };
    const andConditions: Record<string, any>[] = [];

    if (queryText) {
      const regex = new RegExp(escapeRegex(queryText), "i");
      andConditions.push({ $or: [{ description: regex }, { type: regex }] });
    }

    if (cursor) {
      const cursorPostDate = new Date(cursor.postDate);
      const cursorUpdatedAt = new Date(cursor.updatedAt);
      if (!Number.isNaN(cursorPostDate.getTime()) && !Number.isNaN(cursorUpdatedAt.getTime())) {
        andConditions.push({
          $or: [
            { postDate: { $lt: cursorPostDate } },
            {
              postDate: cursorPostDate,
              updatedAt: { $lt: cursorUpdatedAt },
            },
            {
              postDate: cursorPostDate,
              updatedAt: cursorUpdatedAt,
              _id: { $lt: new Types.ObjectId(cursor.id) },
            },
          ],
        });
      }
    }
    if (andConditions.length) {
      query.$and = andConditions;
    }

    const docs = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return Metric.find(query)
          .select("_id description postDate postLink type coverUrl stats.engagement stats.total_interactions updatedAt")
          .sort({ postDate: -1, updatedAt: -1, _id: -1 })
          .limit(limit + 1)
          .lean()
          .exec();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn("[scripts/content-options] Retry para erro transitorio de Mongo.", {
            retryCount,
            error: getErrorMessage(error),
          });
        },
      }
    );

    const hasMore = docs.length > limit;
    const pageItems = hasMore ? docs.slice(0, limit) : docs;
    const lastItem = pageItems[pageItems.length - 1];
    const nextCursor =
      hasMore && lastItem
        ? encodeCursor({
            postDate: toCursorDateString(lastItem.postDate),
            updatedAt: toCursorDateString(lastItem.updatedAt),
            id: String(lastItem._id),
          })
        : null;

    const items = pageItems.map((doc: any) => ({
      id: String(doc._id),
      caption: buildCaptionPreview(doc.description),
      postDate: doc.postDate ? new Date(doc.postDate).toISOString() : null,
      postLink: typeof doc.postLink === "string" ? doc.postLink : null,
      type: typeof doc.type === "string" ? doc.type : null,
      coverUrl: typeof doc.coverUrl === "string" ? doc.coverUrl : null,
      engagement:
        typeof doc.stats?.engagement === "number" && Number.isFinite(doc.stats.engagement)
          ? doc.stats.engagement
          : null,
      totalInteractions:
        typeof doc.stats?.total_interactions === "number" && Number.isFinite(doc.stats.total_interactions)
          ? doc.stats.total_interactions
          : null,
    }));

    const responsePayload = {
      ok: true,
      items,
      pagination: {
        nextCursor,
        hasMore,
        limit,
      },
      meta: {
        servedFromCache: false,
        stale: false,
      },
    };

    if (!shouldBypassCache) {
      contentOptionsCache.set(cacheKey, {
        payload: responsePayload,
        expiresAt: nowTs + CONTENT_OPTIONS_CACHE_TTL_MS,
        staleUntil: nowTs + CONTENT_OPTIONS_CACHE_STALE_WHILE_ERROR_MS,
      });
    }

    return NextResponse.json(responsePayload);
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      logger.warn("[scripts/content-options] Erro transitorio de Mongo.", {
        error: getErrorMessage((error as any)?.cause ?? error),
      });
      try {
        const session = (await getServerSession(authOptions as any)) as any;
        const targetUrl = new URL(request.url);
        const targetResolution = resolveTargetScriptsUser({
          session,
          targetUserId: targetUrl.searchParams.get("targetUserId"),
        });
        if (targetResolution.ok && !isDevE2EUser(session)) {
          const cacheKey = buildContentOptionsCacheKey({
            effectiveUserId: targetResolution.userId,
            limit: parseLimit(targetUrl.searchParams.get("limit")),
            queryText: (targetUrl.searchParams.get("q") || "").trim(),
            cursor: decodeCursor(targetUrl.searchParams.get("cursor")),
          });
          const cachedEntry = contentOptionsCache.get(cacheKey);
          if (cachedEntry && cachedEntry.staleUntil > Date.now()) {
            return NextResponse.json({
              ...cachedEntry.payload,
              meta: {
                ...(cachedEntry.payload?.meta ?? {}),
                servedFromCache: true,
                stale: true,
              },
            });
          }
        }
      } catch {
        // noop: fall back to structured 503 below
      }
      return NextResponse.json(
        { ok: false, error: "Os conteudos publicados estao temporariamente indisponiveis. Tente novamente em instantes." },
        { status: 503 }
      );
    }

    logger.error("[scripts/content-options] Falha ao carregar conteudos publicados.", error);
    return NextResponse.json(
      { ok: false, error: "Nao foi possivel carregar os conteudos publicados." },
      { status: 500 }
    );
  }
}
