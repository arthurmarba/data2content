import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import type { IUser } from "@/app/models/User";

export const runtime = "nodejs";

const PRO_STATUSES = new Set([
  "active",
  "trial",
  "trialing",
  "non_renewing",
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
]);

const INTERNAL_EMAIL_REGEX = /@(data2content\.co|data2content\.ai)$/i;

const FOLLOWER_BANDS: Array<{ max: number; label: string }> = [
  { max: 1_000, label: "0-1k" },
  { max: 5_000, label: "1k-5k" },
  { max: 10_000, label: "5k-10k" },
  { max: 50_000, label: "10k-50k" },
  { max: 100_000, label: "50k-100k" },
  { max: 500_000, label: "100k-500k" },
  { max: Number.MAX_SAFE_INTEGER, label: "500k+" },
];

const computePlan = (planStatus?: string | null) => {
  if (!planStatus) return "free";
  return PRO_STATUSES.has(planStatus.toLowerCase()) ? "pro" : "free";
};

const computeFollowersBand = (followers?: number | null) => {
  if (typeof followers !== "number" || Number.isNaN(followers) || followers < 0) {
    return null;
  }
  const band = FOLLOWER_BANDS.find((range) => followers <= range.max);
  if (band) return band.label;
  const fallback = FOLLOWER_BANDS[FOLLOWER_BANDS.length - 1];
  return fallback ? fallback.label : null;
};

const resolveNiche = (user: Pick<IUser, "userPreferences">) => {
  const preferences = user.userPreferences;
  if (preferences?.preferredFormats && preferences.preferredFormats.length > 0) {
    return preferences.preferredFormats[0];
  }
  return null;
};

const resolveIsInternal = (user: Pick<IUser, "role" | "email">) => {
  if (user.role && ["admin", "staff", "internal"].includes(user.role)) {
    return true;
  }
  if (typeof user.email === "string" && INTERNAL_EMAIL_REGEX.test(user.email)) {
    return true;
  }
  return false;
};

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  await connectToDatabase();
  const user = await User.findById(session.user.id)
    .select(
      "planStatus mediaKitSlug isInstagramConnected instagramAccountId location followers_count role email userPreferences"
    )
    .lean<IUser | null>();

  if (!user) {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
  }

  const payload = {
    plan: computePlan(user.planStatus),
    country: user.location?.country ?? null,
    niche: resolveNiche(user),
    followersBand: computeFollowersBand(user.followers_count),
    hasMediaKit: Boolean(user.mediaKitSlug),
    instagramConnected: Boolean(user.isInstagramConnected && user.instagramAccountId),
    isInternal: resolveIsInternal(user),
  };

  return NextResponse.json({ ok: true, data: payload });
}
