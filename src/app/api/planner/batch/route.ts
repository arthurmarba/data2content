import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Session } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { connectToDatabase } from "@/app/lib/mongoose";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import PlannerPlan from "@/app/models/PlannerPlan";
import PlannerRecCache from "@/app/models/PlannerRecCache";
import { recommendWeeklySlots, getTimeBlockScores } from "@/app/lib/planner/recommender";
import { getThemesForSlot } from "@/app/lib/planner/themes";
import {
  TARGET_SUGGESTIONS_MIN,
  TARGET_SUGGESTIONS_MAX,
  WINDOW_DAYS,
  PLANNER_TIMEZONE,
} from "@/app/lib/planner/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Mantido em sincronia com /api/planner/recommendations
const ALGO_VERSION = 3;

const FREEZE_DEFAULT = process.env.NODE_ENV === "production";
const FREEZE_ENABLED_ENV =
  process.env.PLANNER_FREEZE_ENABLED === "1"
    ? true
    : process.env.PLANNER_FREEZE_ENABLED === "0"
      ? false
      : FREEZE_DEFAULT;

type TimingEntry = { name: string; durationMs: number };

type RecommendationBatchResult = {
  recommendations: any[];
  heatmap: any[];
  cached: boolean;
  frozenAt?: string;
  cacheLookupMs: number;
  recommendMs: number;
  recommendSlotsMs: number;
  heatmapMs: number;
  themesMs: number;
  cacheWriteMs: number;
  totalMs: number;
};

const nowMs = () =>
  typeof performance !== "undefined" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

function jsonWithTiming(
  body: any,
  status: number,
  timings: TimingEntry[],
  headers?: Record<string, string | undefined>
) {
  const response = NextResponse.json(body, { status });
  if (timings.length) {
    response.headers.set(
      "Server-Timing",
      timings.map((entry) => `${entry.name};dur=${entry.durationMs.toFixed(1)}`).join(", ")
    );
  }
  if (headers) {
    for (const [key, value] of Object.entries(headers)) {
      if (!value) continue;
      response.headers.set(key, value);
    }
  }
  return response;
}

function parseWeekStartParam(url: string): Date | undefined {
  const { searchParams } = new URL(url);
  const ws = searchParams.get("weekStart");
  if (!ws) return undefined;
  const d = new Date(ws);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseIntParam(url: string, key: string): number | undefined {
  const { searchParams } = new URL(url);
  const v = searchParams.get(key);
  if (!v) return undefined;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : undefined;
}

function parseBoolParam(url: string, key: string): boolean {
  const { searchParams } = new URL(url);
  const v = (searchParams.get(key) || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour || "0"),
    Number(map.minute || "0"),
    Number(map.second || "0")
  );
  return asUTC - date.getTime();
}

function normalizeToMondayInTZ(d: Date, timeZone: string): Date {
  const zoned = new Date(d.getTime() + getTimeZoneOffsetMs(d, timeZone));
  const dow = zoned.getUTCDay();
  const shift = dow === 0 ? -6 : 1 - dow;
  const mondayLocal = new Date(
    Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate() + shift, 0, 0, 0, 0)
  );
  return new Date(mondayLocal.getTime() - getTimeZoneOffsetMs(mondayLocal, timeZone));
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

async function loadRecommendationsWithCache({
  userId,
  weekStart,
  periodDays,
  targetSlotsPerWeek,
  freezeEnabled,
}: {
  userId: string;
  weekStart: Date;
  periodDays: number;
  targetSlotsPerWeek: number;
  freezeEnabled: boolean;
}) {
  const startedAt = nowMs();
  let cacheLookupMs = 0;
  let recommendMs = 0;
  let recommendSlotsMs = 0;
  let heatmapMs = 0;
  let themesMs = 0;
  let cacheWriteMs = 0;

  if (freezeEnabled) {
    const cacheLookupStart = nowMs();
    const cached = await PlannerRecCache.findOne({ userId, weekStart }).lean().exec();
    cacheLookupMs = nowMs() - cacheLookupStart;
    if (cached && (cached as any).algoVersion === ALGO_VERSION) {
      return {
        recommendations: Array.isArray((cached as any).recommendations)
          ? (cached as any).recommendations
          : [],
        heatmap: Array.isArray((cached as any).heatmap) ? (cached as any).heatmap : [],
        cached: true,
        frozenAt: (cached as any).frozenAt ? new Date((cached as any).frozenAt).toISOString() : undefined,
        cacheLookupMs,
        recommendMs,
        recommendSlotsMs,
        heatmapMs,
        themesMs,
        cacheWriteMs,
        totalMs: nowMs() - startedAt,
      };
    }
  }

  const recommendStart = nowMs();
  const recommendationsRawPromise = (async () => {
    const started = nowMs();
    try {
      return await recommendWeeklySlots({
        userId,
        weekStart,
        targetSlotsPerWeek,
        periodDays,
      });
    } finally {
      recommendSlotsMs = nowMs() - started;
    }
  })();
  const heatmapPromise = (async () => {
    const started = nowMs();
    try {
      return await getTimeBlockScores(userId, periodDays);
    } finally {
      heatmapMs = nowMs() - started;
    }
  })();
  const [recsRaw, heatmap] = await Promise.all([recommendationsRawPromise, heatmapPromise]);
  recommendMs = nowMs() - recommendStart;

  const themesStart = nowMs();
  const recommendations = await Promise.all(
    (recsRaw || []).map(async (r) => {
      try {
        const { themes, keyword } = await getThemesForSlot(
          userId,
          periodDays,
          r.dayOfWeek,
          r.blockStartHour,
          r.categories || {}
        );
        return { ...r, themes, themeKeyword: keyword };
      } catch {
        return { ...r, themes: [], themeKeyword: undefined };
      }
    })
  );
  themesMs = nowMs() - themesStart;

  if (freezeEnabled) {
    const cacheWriteStart = nowMs();
    await PlannerRecCache.findOneAndUpdate(
      { userId, weekStart },
      {
        $set: {
          userId,
          weekStart,
          recommendations,
          heatmap,
          frozenAt: new Date(),
          algoVersion: ALGO_VERSION,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();
    cacheWriteMs = nowMs() - cacheWriteStart;
  }

  return {
    recommendations,
    heatmap,
    cached: false,
    frozenAt: freezeEnabled ? new Date().toISOString() : undefined,
    cacheLookupMs,
    recommendMs,
    recommendSlotsMs,
    heatmapMs,
    themesMs,
    cacheWriteMs,
    totalMs: nowMs() - startedAt,
  } satisfies RecommendationBatchResult;
}

export async function GET(request: Request) {
  const requestStartedAt = nowMs();
  const timings: TimingEntry[] = [];

  const authStartedAt = nowMs();
  const session = (await getServerSession(authOptions as any)) as Session | null;
  timings.push({ name: "auth", durationMs: nowMs() - authStartedAt });
  if (!session || !session.user || !session.user.id) {
    timings.push({ name: "total", durationMs: nowMs() - requestStartedAt });
    return jsonWithTiming({ ok: false, error: "Unauthorized" }, 401, timings);
  }

  const userId = session.user.id as string;
  const routePath = new URL(request.url).pathname;
  const accessStartedAt = nowMs();
  const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
  timings.push({ name: "access", durationMs: nowMs() - accessStartedAt });
  if (!access.ok) {
    timings.push({ name: "total", durationMs: nowMs() - requestStartedAt });
    return jsonWithTiming(
      { ok: false, error: access.message, reason: access.reason },
      access.status,
      timings
    );
  }

  const noCache = parseBoolParam(request.url, "nocache") || parseBoolParam(request.url, "disableFreeze");
  const freezeEnabled = FREEZE_ENABLED_ENV && !noCache;
  const rawWeekStart = parseWeekStartParam(request.url) ?? new Date();
  const weekStart = normalizeToMondayInTZ(rawWeekStart, PLANNER_TIMEZONE);
  const weekStartISO = weekStart.toISOString();

  const rawTarget = parseIntParam(request.url, "targetSlotsPerWeek");
  const targetSlotsPerWeek = clamp(
    typeof rawTarget === "number" ? rawTarget : TARGET_SUGGESTIONS_MAX,
    TARGET_SUGGESTIONS_MIN,
    TARGET_SUGGESTIONS_MAX
  );
  const rawPeriod = parseIntParam(request.url, "periodDays");
  const periodDays = typeof rawPeriod === "number" && rawPeriod > 0 ? rawPeriod : WINDOW_DAYS;

  try {
    const dbStartedAt = nowMs();
    await connectToDatabase();
    timings.push({ name: "db", durationMs: nowMs() - dbStartedAt });

    const planPromise = (async () => {
      const startedAt = nowMs();
      try {
        return await PlannerPlan.findOne({ userId, platform: "instagram", weekStart }).lean().exec();
      } finally {
        timings.push({ name: "plan", durationMs: nowMs() - startedAt });
      }
    })();
    const recommendationsPromise = (async () => {
      const result: RecommendationBatchResult = await loadRecommendationsWithCache({
        userId,
        weekStart,
        periodDays,
        targetSlotsPerWeek,
        freezeEnabled,
      });
      timings.push({ name: "rec", durationMs: result.totalMs ?? 0 });
      if (typeof result.cacheLookupMs === "number" && result.cacheLookupMs > 0) {
        timings.push({ name: "recCache", durationMs: result.cacheLookupMs });
      }
      if (typeof result.recommendMs === "number" && result.recommendMs > 0) {
        timings.push({ name: "recCore", durationMs: result.recommendMs });
      }
      if (typeof result.recommendSlotsMs === "number" && result.recommendSlotsMs > 0) {
        timings.push({ name: "recSlots", durationMs: result.recommendSlotsMs });
      }
      if (typeof result.heatmapMs === "number" && result.heatmapMs > 0) {
        timings.push({ name: "recHeatmap", durationMs: result.heatmapMs });
      }
      if (typeof result.themesMs === "number" && result.themesMs > 0) {
        timings.push({ name: "recThemes", durationMs: result.themesMs });
      }
      if (typeof result.cacheWriteMs === "number" && result.cacheWriteMs > 0) {
        timings.push({ name: "recWrite", durationMs: result.cacheWriteMs });
      }
      return result;
    })();

    const [planResult, recResult] = await Promise.allSettled([planPromise, recommendationsPromise]);

    if (planResult.status === "rejected" && recResult.status === "rejected") {
      throw recResult.reason || planResult.reason || new Error("Falha ao carregar planner.");
    }

    const plan = planResult.status === "fulfilled" ? (planResult.value ?? null) : null;
    const recommendations =
      recResult.status === "fulfilled" && Array.isArray(recResult.value.recommendations)
        ? recResult.value.recommendations
        : [];
    const heatmap =
      recResult.status === "fulfilled" && Array.isArray(recResult.value.heatmap)
        ? recResult.value.heatmap
        : [];
    const cached = recResult.status === "fulfilled" ? recResult.value.cached : false;
    const frozenAt = recResult.status === "fulfilled" ? recResult.value.frozenAt : undefined;
    const partial = planResult.status === "rejected" || recResult.status === "rejected";
    timings.push({ name: "total", durationMs: nowMs() - requestStartedAt });

    return jsonWithTiming(
      {
        ok: true,
        weekStart: weekStartISO,
        metricBase: "views",
        plan,
        recommendations,
        heatmap,
        cached,
        freezeEnabled,
        algoVersion: ALGO_VERSION,
        frozenAt,
        partial,
      },
      200,
      timings,
      { "X-D2C-Cache": cached ? "hit" : "miss" }
    );
  } catch (err) {
    console.error("[planner/batch] Error:", err);
    timings.push({ name: "total", durationMs: nowMs() - requestStartedAt });
    return jsonWithTiming({ ok: false, error: "Failed to load planner batch" }, 500, timings);
  }
}
