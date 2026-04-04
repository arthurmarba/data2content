import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { invalidateDashboardHomeSummaryCache } from "@/app/lib/cache/dashboardCache";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";
import { COMMUNITY_INSPIRATION_TERMS_VERSION } from "@/lib/auth/legalConsent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FREE_COMMUNITY_URL =
  process.env.NEXT_PUBLIC_COMMUNITY_FREE_URL || "/planning/discover";

export async function GET() {
  const session = (await getServerSession(authOptions)) as Session | null;
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.redirect(
      new URL(
        `/login?callbackUrl=${encodeURIComponent("/api/dashboard/community/free-join")}`,
        process.env.NEXTAUTH_URL || "http://localhost:3000"
      )
    );
  }

  try {
    await connectToDatabase();
    const joinedAt = new Date();
    const result = await UserModel.updateOne(
      { _id: userId },
      {
        $set: {
          communityInspirationOptIn: true,
          communityInspirationOptInDate: joinedAt,
          communityInspirationTermsVersion: COMMUNITY_INSPIRATION_TERMS_VERSION,
        },
      }
    );

    if (!result.matchedCount) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }

    invalidateDashboardHomeSummaryCache(String(userId));
    return NextResponse.redirect(FREE_COMMUNITY_URL);
  } catch (error) {
    logger.error("[dashboard.community.free-join] Failed to confirm free community join", error);
    return NextResponse.json(
      { ok: false, error: "Failed to confirm free community join" },
      { status: 500 }
    );
  }
}
