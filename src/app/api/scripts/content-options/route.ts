import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Types } from "mongoose";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Metric from "@/app/models/Metric";
import { resolveTargetScriptsUser, validateScriptsAccess } from "@/app/lib/scripts/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type CursorToken = {
  postDate: string;
  updatedAt: string;
  id: string;
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

  await connectToDatabase();
  const docs = await Metric.find(query)
    .select("_id description postDate postLink type coverUrl stats.engagement stats.total_interactions updatedAt")
    .sort({ postDate: -1, updatedAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean()
    .exec();

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

  return NextResponse.json({
    ok: true,
    items,
    pagination: {
      nextCursor,
      hasMore,
      limit,
    },
  });
}
