// src/app/api/alerts/[alertId]/mark-read/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import mongoose from "mongoose";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import Alert from "@/app/models/Alert";
import { logger } from "@/app/lib/logger";
import { invalidateCachedUnreadCount } from "@/app/lib/cache/alertsRuntimeCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { alertId: string } }
) {
  const session = (await getServerSession(authOptions)) as any;
  const userId = (session?.user as { id?: string } | undefined)?.id;

  if (!userId) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const alertId = params?.alertId;
  if (!alertId || !mongoose.Types.ObjectId.isValid(alertId)) {
    return NextResponse.json({ error: "ID inválido." }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const updated = await Alert.findOneAndUpdate(
      {
        _id: alertId,
        user: userId,
        $or: [{ readAt: null }, { readAt: { $exists: false } }],
      },
      { $set: { readAt: new Date() } },
      { new: true }
    ).lean();

    if (!updated) {
      const existing = await Alert.findOne({ _id: alertId, user: userId })
        .select("_id readAt")
        .lean();
      if (!existing) {
        return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
      }
      invalidateCachedUnreadCount(userId);
      return NextResponse.json({
        data: {
          id: existing._id.toString(),
          readAt: existing.readAt ? existing.readAt.toISOString() : null,
        },
      });
    }

    invalidateCachedUnreadCount(userId);

    return NextResponse.json({
      data: {
        id: updated._id.toString(),
        readAt: updated.readAt ? updated.readAt.toISOString() : null,
      },
    });
  } catch (error) {
    logger.error("[api/alerts/:id/mark-read] Failed to mark alert as read", error);
    return NextResponse.json(
      { error: "Não foi possível atualizar o alerta agora." },
      { status: 500 }
    );
  }
}
