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
    const copiedAt = new Date();
    const result = await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          proposalFormLinkCopiedAt: copiedAt,
        },
      }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    invalidateDashboardHomeSummaryCache(String(userId));
    return NextResponse.json({
      ok: true,
      proposalFormLinkCopiedAt: copiedAt.toISOString(),
    });
  } catch (error) {
    logger.error("[home.proposal-link-copied] Failed to persist copy event", error);
    return NextResponse.json(
      { ok: false, error: "Failed to persist proposal link copy event" },
      { status: 500 }
    );
  }
}
