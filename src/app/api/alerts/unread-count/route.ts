// src/app/api/alerts/unread-count/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Alert from "@/app/models/Alert";
import { logger } from "@/app/lib/logger";
import { getCachedUnreadCount, setCachedUnreadCount } from "@/app/lib/cache/alertsRuntimeCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const session = (await getServerSession(authOptions)) as any;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const cachedUnreadCount = getCachedUnreadCount(userId);
  if (typeof cachedUnreadCount === "number") {
    return NextResponse.json({ unreadCount: cachedUnreadCount });
  }

  try {
    await connectToDatabase();
    const unreadCount = await Alert.countDocuments({
      user: userId,
      $or: [{ readAt: null }, { readAt: { $exists: false } }],
    });

    setCachedUnreadCount(userId, unreadCount);

    return NextResponse.json({ unreadCount });
  } catch (error) {
    logger.error("[api/alerts/unread-count] Failed to compute unread count", error);
    return NextResponse.json(
      { error: "Não foi possível carregar seus alertas agora." },
      { status: 500 }
    );
  }
}
