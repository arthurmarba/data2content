import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import type { Session } from "next-auth";
import { Types } from "mongoose";

import { resolveAuthOptions } from "@/app/api/auth/resolveAuthOptions";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import { connectToDatabase } from "@/app/lib/mongoose";
import UserModel from "@/app/models/User";
import AccountInsightModel from "@/app/models/AccountInsight";
import { normalizeCreatorAvatarUrl, resolveCreatorAvatar } from "@/app/lib/avatar/creatorAvatar";
import { resolveFreshInstagramAvatar } from "@/app/lib/instagram/resolveFreshAvatar";
import { getProxiedImageUrl } from "@/utils/imageUtils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function selectedInstagramAvatar(user: any): string | null {
  const accounts = Array.isArray(user?.availableIgAccounts) ? user.availableIgAccounts : [];
  const selected = user?.instagramAccountId
    ? accounts.find((account: any) => account?.igAccountId === user.instagramAccountId)
    : null;
  return normalizeCreatorAvatarUrl(user?.profile_picture_url)
    ?? normalizeCreatorAvatarUrl(selected?.profile_picture_url)
    ?? null;
}

function safeRedirectUrl(value: string, request: NextRequest): URL | null {
  try {
    const url = new URL(value, request.nextUrl.origin);
    if (url.protocol !== "https:" && url.origin !== request.nextUrl.origin) return null;
    return url;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ creatorId: string }> },
) {
  const session = (await getServerSession(await resolveAuthOptions())) as Session | null;
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const routePath = request.nextUrl.pathname;
  const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.message, reason: access.reason },
      { status: access.status },
    );
  }

  const sessionUser = session.user as { role?: string | null };
  const isAdmin = sessionUser.role?.trim().toLowerCase() === "admin";
  if (!isAdmin && !access.normalizedStatus) {
    return NextResponse.json(
      { ok: false, error: "Plano ativo necessário.", reason: "inactive" },
      { status: 403 },
    );
  }

  const { creatorId } = await params;
  if (!Types.ObjectId.isValid(creatorId)) {
    return NextResponse.json({ ok: false, error: "Invalid creator id" }, { status: 400 });
  }

  await connectToDatabase();
  const creator = await UserModel.findById(creatorId)
    .select(
      "profile_picture_url image providerImage isInstagramConnected instagramAccountId instagramAccessToken availableIgAccounts.igAccountId availableIgAccounts.profile_picture_url mediaKitSlug",
    )
    .lean<any>();
  if (!creator) return new Response(null, { status: 404 });

  const refreshedInstagramAvatar = await resolveFreshInstagramAvatar({
    userId: creator._id,
    currentImage: selectedInstagramAvatar(creator),
    instagramAccountId: creator.instagramAccountId ?? null,
    instagramAccessToken: creator.instagramAccessToken ?? null,
  });
  let avatarUrl = resolveCreatorAvatar({
    ...creator,
    profile_picture_url: refreshedInstagramAvatar,
  });
  if (!avatarUrl) {
    const historical = await AccountInsightModel.findOne({
      user: creator._id,
      "accountDetails.profile_picture_url": { $exists: true, $nin: [null, ""] },
    })
      .sort({ recordedAt: -1 })
      .select("accountDetails.profile_picture_url")
      .lean<{ accountDetails?: { profile_picture_url?: string | null } } | null>();
    avatarUrl = resolveCreatorAvatar({
      isInstagramConnected: true,
      profile_picture_url: historical?.accountDetails?.profile_picture_url ?? null,
    });
  }
  if (!avatarUrl) return new Response(null, { status: 404 });

  const stableUrl = getProxiedImageUrl(avatarUrl, true);
  if (!stableUrl) return new Response(null, { status: 404 });
  const destination = safeRedirectUrl(stableUrl, request);
  if (!destination) return new Response(null, { status: 422 });

  const response = NextResponse.redirect(destination, 307);
  response.headers.set("Cache-Control", "private, max-age=300, stale-while-revalidate=3600");
  return response;
}
