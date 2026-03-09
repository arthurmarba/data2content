import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { getErrorMessage, isTransientMongoError, withMongoTransientRetry } from "@/app/lib/mongoTransient";
import { logger } from "@/app/lib/logger";
import User from "@/app/models/User";
import type { IUser } from "@/app/models/User";

export const runtime = "nodejs";
const ANALYTICS_CONTEXT_CACHE_TTL_MS = (() => {
  const parsed = Number(process.env.ANALYTICS_CONTEXT_CACHE_TTL_MS ?? 60_000);
  return Number.isFinite(parsed) && parsed >= 5_000 ? Math.floor(parsed) : 60_000;
})();
const ANALYTICS_CONTEXT_CACHE_STALE_WHILE_ERROR_MS = (() => {
  const parsed = Number(process.env.ANALYTICS_CONTEXT_CACHE_STALE_WHILE_ERROR_MS ?? 300_000);
  return Number.isFinite(parsed) && parsed >= 10_000 ? Math.floor(parsed) : 300_000;
})();

type AnalyticsContextPayload = {
  plan: string;
  country: string | null;
  niche: string | null;
  followersBand: string | null;
  hasMediaKit: boolean;
  instagramConnected: boolean;
  isInternal: boolean;
};

const analyticsContextCache = new Map<
  string,
  {
    expiresAt: number;
    staleUntil: number;
    payload: {
      ok: true;
      data: AnalyticsContextPayload;
      meta: { servedFromCache: boolean; stale: boolean };
    };
  }
>();

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
    return preferences.preferredFormats[0] ?? null;
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

const buildPayloadFromUser = (
  user: Pick<
    IUser,
    | "planStatus"
    | "location"
    | "userPreferences"
    | "followers_count"
    | "mediaKitSlug"
    | "isInstagramConnected"
    | "instagramAccountId"
    | "role"
    | "email"
  >
): AnalyticsContextPayload => ({
  plan: computePlan(user.planStatus),
  country: user.location?.country ?? null,
  niche: resolveNiche(user),
  followersBand: computeFollowersBand(user.followers_count),
  hasMediaKit: Boolean(user.mediaKitSlug),
  instagramConnected: Boolean(user.isInstagramConnected && user.instagramAccountId),
  isInternal: resolveIsInternal(user),
});

const buildFallbackPayloadFromSession = (session: any): AnalyticsContextPayload => ({
  plan: computePlan(session?.user?.planStatus),
  country: null,
  niche: null,
  followersBand: null,
  hasMediaKit: false,
  instagramConnected: Boolean(session?.user?.instagramConnected),
  isInternal:
    typeof session?.user?.role === "string" &&
    ["admin", "staff", "internal"].includes(session.user.role),
});

export async function GET() {
  const session = (await getServerSession(authOptions)) as any;

  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const userId = String(session.user.id);
  const nowTs = Date.now();
  const cached = analyticsContextCache.get(userId);

  if (cached && cached.expiresAt > nowTs) {
    return NextResponse.json(cached.payload);
  }

  try {
    const user = await withMongoTransientRetry(
      async () => {
        await connectToDatabase();
        return User.findById(userId)
          .select(
            "planStatus mediaKitSlug isInstagramConnected instagramAccountId location followers_count role email userPreferences"
          )
          .lean<IUser | null>();
      },
      {
        retries: 1,
        onRetry: (error, retryCount) => {
          logger.warn("[analytics/context] Retry para erro transitorio de Mongo.", {
            retryCount,
            error: getErrorMessage(error),
            userId,
          });
        },
      }
    );

    if (!user) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    const payload = {
      ok: true as const,
      data: buildPayloadFromUser(user),
      meta: {
        servedFromCache: false,
        stale: false,
      },
    };

    analyticsContextCache.set(userId, {
      payload,
      expiresAt: nowTs + ANALYTICS_CONTEXT_CACHE_TTL_MS,
      staleUntil: nowTs + ANALYTICS_CONTEXT_CACHE_STALE_WHILE_ERROR_MS,
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (isTransientMongoError(error) || isTransientMongoError((error as any)?.cause)) {
      logger.warn("[analytics/context] Erro transitorio de Mongo.", {
        error: getErrorMessage((error as any)?.cause ?? error),
        userId,
      });

      if (cached && cached.staleUntil > nowTs) {
        return NextResponse.json({
          ...cached.payload,
          meta: {
            servedFromCache: true,
            stale: true,
          },
        });
      }

      return NextResponse.json({
        ok: true,
        data: buildFallbackPayloadFromSession(session),
        meta: {
          servedFromCache: true,
          stale: true,
        },
      });
    }

    logger.error("[analytics/context] Falha ao carregar contexto analitico.", error, { userId });
    return NextResponse.json({ ok: false, error: "analytics_context_unavailable" }, { status: 500 });
  }
}
