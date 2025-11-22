// src/app/api/alerts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Alert, { IAlert } from "@/app/models/Alert";
import type { FilterQuery } from "mongoose";
import { logger } from "@/app/lib/logger";
import User from "@/app/models/User";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

type AlertStatusFilter = "unread" | "all";

const unreadFilter: FilterQuery<IAlert> = {
  $or: [{ readAt: null }, { readAt: { $exists: false } }],
};

async function backfillFromLegacyHistory(userId: string) {
  try {
    const existingCount = await Alert.countDocuments({ user: userId });
    if (existingCount > 0) return;

    const user = await User.findById(userId, { alertHistory: 1 }).lean();
    const history = (user as any)?.alertHistory;
    if (!Array.isArray(history) || history.length === 0) return;

    const docs = history
      .slice(-100)
      .map((entry: any) => {
        const title =
          entry?.details?.title ||
          entry?.details?.reason ||
          entry?.type ||
          "Alerta";
        const body = entry?.finalUserMessage || entry?.messageForAI || title;
        const createdAt = entry?.date ? new Date(entry.date) : new Date();
        const severity =
          entry?.details?.severity === "critical" ||
          entry?.details?.severity === "warning" ||
          entry?.details?.severity === "success"
            ? entry.details.severity
            : "info";
        return {
          user: userId,
          title,
          body,
          channel: "system",
          severity,
          metadata: {
            type: entry?.type ?? null,
            details: entry?.details ?? null,
            legacy: true,
          },
          createdAt,
          updatedAt: createdAt,
        };
      })
      .filter(Boolean);

    if (docs.length > 0) {
      await Alert.insertMany(docs, { ordered: false });
    }
  } catch (error) {
    logger.warn("[api/alerts] Falha no backfill de alertHistory legado", error);
  }
}

function parseStatus(value: string | null): AlertStatusFilter {
  if (value === "all") return "all";
  return "unread";
}

function parseLimit(rawLimit: string | null): number {
  const parsed = Number(rawLimit);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

function parseCursor(rawCursor: string | null): Date | null {
  if (!rawCursor) return null;
  const date = new Date(rawCursor);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function serializeAlert(doc: IAlert) {
  return {
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    channel: doc.channel ?? "whatsapp",
    severity: doc.severity ?? "info",
    metadata: doc.metadata ?? null,
    sourceMessageId: doc.sourceMessageId ?? null,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt?.toISOString?.() ?? new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const status = parseStatus(searchParams.get("status"));
  const limit = parseLimit(searchParams.get("limit"));
  const cursor = parseCursor(searchParams.get("cursor"));

  try {
    await connectToDatabase();
    await backfillFromLegacyHistory(userId);

    const query: FilterQuery<IAlert> = { user: userId };
    if (status === "unread") {
      query.$or = unreadFilter.$or;
    }
    if (cursor) {
      query.createdAt = { $lt: cursor };
    }

    const results = await Alert.find(query)
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const items = results.slice(0, limit).map(serializeAlert);
    const hasNext = results.length > limit;
    const nextCursor =
      hasNext && items.length ? items[items.length - 1]?.createdAt : null;

    const unreadCount = await Alert.countDocuments({
      user: userId,
      ...unreadFilter,
    });

    return NextResponse.json({
      data: items,
      pageInfo: {
        hasNext,
        nextCursor: nextCursor ?? null,
        unreadCount,
      },
    });
  } catch (error) {
    logger.error("[api/alerts] Failed to list alerts", error);
    return NextResponse.json(
      { error: "Não foi possível carregar seus alertas agora." },
      { status: 500 }
    );
  }
}
