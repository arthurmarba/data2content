import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { logger } from "@/app/lib/logger";
import UserModel from "@/app/models/User";
import { invalidateDashboardHomeSummaryCache } from "@/app/lib/cache/dashboardCache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const joinedAt = new Date();
    const result = await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          vipCommunityJoinedAt: joinedAt,
        },
      }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    invalidateDashboardHomeSummaryCache(String(userId));
    return NextResponse.json({
      ok: true,
      vipCommunityJoinedAt: joinedAt.toISOString(),
    });
  } catch (error) {
    logger.error("[dashboard.community.vip-join-confirmation] Failed to confirm VIP join", error);
    return NextResponse.json(
      { ok: false, error: "Failed to confirm VIP community join" },
      { status: 500 }
    );
  }
}
