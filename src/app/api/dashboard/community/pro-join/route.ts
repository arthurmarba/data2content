import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { getCommunityWhatsAppUrl } from "@/app/lib/community/communityInvite.server";
import { canAccessPremiumContent } from "@/app/lib/community/recordedMeetingsAccess";
import { logger } from "@/app/lib/logger";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";
import { CREATOR_PROFILE_ROUTE } from "@/constants/routes";
import { PAYWALL_CONTEXT_PARAM, PAYWALL_URL_PARAM } from "@/types/paywall";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveCommunityUrl(): string {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  try {
    return new URL(getCommunityWhatsAppUrl(), base).toString();
  } catch {
    return new URL(CREATOR_PROFILE_ROUTE, base).toString();
  }
}

function resolvePremiumRequiredUrl(): URL {
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const url = new URL(CREATOR_PROFILE_ROUTE, base);
  url.searchParams.set(PAYWALL_URL_PARAM, "1");
  url.searchParams.set(PAYWALL_CONTEXT_PARAM, "community");
  return url;
}

export async function GET() {
  const session = await getServerSession(await resolveAuthOptions());
  const userId = (session as { user?: { id?: string } } | null)?.user?.id;

  if (!userId) {
    const callbackUrl = encodeURIComponent("/api/dashboard/community/pro-join");
    return NextResponse.redirect(new URL(`/login?callbackUrl=${callbackUrl}`, process.env.NEXTAUTH_URL || "http://localhost:3000"));
  }

  const viewer = (session as { user?: { id?: string; role?: string | null } } | null)?.user;
  if (!(await canAccessPremiumContent(viewer))) {
    return NextResponse.redirect(resolvePremiumRequiredUrl());
  }

  try {
    await connectToDatabase();
    const result = await UserModel.updateOne(
      { _id: userId },
      { $set: { whatsappGroupLinkOpenedAt: new Date() } },
    );
    if (!result.matchedCount) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: 404 });
    }
    return NextResponse.redirect(resolveCommunityUrl());
  } catch (error) {
    logger.error("[dashboard.community.pro-join] Failed to register group link open", error);
    return NextResponse.json({ ok: false, error: "Failed to open community invite" }, { status: 500 });
  }
}
