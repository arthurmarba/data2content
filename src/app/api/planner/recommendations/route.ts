// @/app/api/planner/recommendations/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import PlannerRecCache from '@/app/models/PlannerRecCache';
import {
  buildPlannerRecommendationMemoryKey,
  clearPlannerRecommendationInFlight,
  getPlannerRecommendationInFlight,
  readPlannerRecommendationMemory,
  setPlannerRecommendationInFlight,
  writePlannerRecommendationMemory,
} from '@/app/lib/planner/recommendationMemoryCache';
import { recommendWeeklySlots, getTimeBlockScores } from '@/app/lib/planner/recommender';
import { getThemesForSlot } from '@/app/lib/planner/themes';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import {
  TARGET_SUGGESTIONS_MIN,
  TARGET_SUGGESTIONS_MAX,
  WINDOW_DAYS,
  PLANNER_TIMEZONE,
} from '@/app/lib/planner/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Versão do algoritmo/snapshot
// 3 = mantém base em views, mas muda enriquecimento de TEMAS (modo flex por default)
const ALGO_VERSION = 3;

// === Toggle de freeze/cache ===
// Em produção: segue env; em dev: desligado por padrão (p/ testes).
const FREEZE_DEFAULT = process.env.NODE_ENV === 'production';
const FREEZE_ENABLED_ENV =
  process.env.PLANNER_FREEZE_ENABLED === '1'
    ? true
    : process.env.PLANNER_FREEZE_ENABLED === '0'
    ? false
    : FREEZE_DEFAULT;

function parseWeekStartParam(url: string): Date | undefined {
  const { searchParams } = new URL(url);
  const ws = searchParams.get('weekStart');
  if (!ws) return undefined;
  const d = new Date(ws);
  return isNaN(d.getTime()) ? undefined : d;
}
function parseIntParam(url: string, key: string): number | undefined {
  const { searchParams } = new URL(url);
  const v = searchParams.get(key);
  if (!v) return undefined;
  const n = parseInt(v, 10);
  return isNaN(n) ? undefined : n;
}
function parseBoolParam(url: string, key: string): boolean {
  const { searchParams } = new URL(url);
  const v = (searchParams.get(key) || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** Offset (ms) do fuso desejado em relação ao UTC no instante fornecido. */
function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour || '0'),
    Number(map.minute || '0'),
    Number(map.second || '0')
  );
  return asUTC - date.getTime();
}

/** Segunda 00:00 local no fuso informado → instante UTC real */
function normalizeToMondayInTZ(d: Date, timeZone: string): Date {
  const zoned = new Date(d.getTime() + getTimeZoneOffsetMs(d, timeZone));
  const dow = zoned.getUTCDay(); // 0..6
  const shift = dow === 0 ? -6 : 1 - dow;
  const mondayLocal = new Date(
    Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate() + shift, 0, 0, 0, 0)
  );
  return new Date(mondayLocal.getTime() - getTimeZoneOffsetMs(mondayLocal, timeZone));
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const userId = session.user.id as string;
  const routePath = new URL(request.url).pathname;

  const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.message, reason: access.reason },
      { status: access.status }
    );
  }

  // Freeze pode ser desativado pelo query param durante os testes.
  const noCache = parseBoolParam(request.url, 'nocache') || parseBoolParam(request.url, 'disableFreeze');
  const freezeEnabled = FREEZE_ENABLED_ENV && !noCache;

  const rawWeekStart = parseWeekStartParam(request.url) ?? new Date();
  const weekStart = normalizeToMondayInTZ(rawWeekStart, PLANNER_TIMEZONE);
  const weekStartISO = weekStart.toISOString();

  const rawTarget = parseIntParam(request.url, 'targetSlotsPerWeek');
  const targetSlotsPerWeek = clamp(
    typeof rawTarget === 'number' ? rawTarget : TARGET_SUGGESTIONS_MAX,
    TARGET_SUGGESTIONS_MIN,
    TARGET_SUGGESTIONS_MAX
  );

  const rawPeriod = parseIntParam(request.url, 'periodDays');
  const periodDays = typeof rawPeriod === 'number' && rawPeriod > 0 ? rawPeriod : WINDOW_DAYS;
  const memoryKey = buildPlannerRecommendationMemoryKey({
    scope: 'planner-recommendations',
    userId,
    weekStart,
    periodDays,
    targetSlotsPerWeek,
    freezeEnabled,
    algoVersion: ALGO_VERSION,
  });

  type MemoryPayload = {
    recommendations: any[];
    heatmap: any[];
    frozenAt?: string;
    cachedFromMongo: boolean;
  };

  try {
    if (!noCache) {
      const memoryHit = readPlannerRecommendationMemory<MemoryPayload>(memoryKey);
      if (memoryHit) {
        return NextResponse.json({
          ok: true,
          metricBase: 'views',
          weekStart: weekStartISO,
          recommendations: memoryHit.recommendations,
          heatmap: memoryHit.heatmap,
          frozenAt: memoryHit.frozenAt,
          cached: true,
          memoryHit: true,
          freezeEnabled,
          algoVersion: ALGO_VERSION,
        });
      }

      const pending = getPlannerRecommendationInFlight<MemoryPayload>(memoryKey);
      if (pending) {
        const joined = await pending;
        return NextResponse.json({
          ok: true,
          metricBase: 'views',
          weekStart: weekStartISO,
          recommendations: joined.recommendations,
          heatmap: joined.heatmap,
          frozenAt: joined.frozenAt,
          cached: joined.cachedFromMongo,
          coalesced: true,
          freezeEnabled,
          algoVersion: ALGO_VERSION,
        });
      }
    }

    const computePayload = async (): Promise<MemoryPayload> => {
      await connectToDatabase();

      // 1) Snapshot semanal (apenas se habilitado) — respeita versão do algoritmo
      if (freezeEnabled) {
        type Cached = {
          userId: string;
          weekStart: Date;
          recommendations: any[];
          heatmap: any[];
          frozenAt: Date;
          algoVersion?: number;
        };

        const cached = (await PlannerRecCache.findOne({ userId, weekStart }).lean().exec()) as Cached | null;

        if (cached && cached.algoVersion === ALGO_VERSION) {
          return {
            recommendations: cached.recommendations || [],
            heatmap: cached.heatmap || [],
            frozenAt: cached.frozenAt?.toISOString?.() || new Date(cached.frozenAt as any).toISOString?.(),
            cachedFromMongo: true,
          };
        }
      }

      // 2) Sem cache válido → calcula recomendações + heatmap (já em views)
      const [recsRaw, heatmap] = await Promise.all([
        recommendWeeklySlots({
          userId,
          weekStart,
          targetSlotsPerWeek,
          periodDays,
        }),
        getTimeBlockScores(userId, periodDays),
      ]);

      // 3) Enriquecer cada slot com TEMAS (também “congela” se habilitado)
      const recs = await Promise.all(
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

      const frozenAt = freezeEnabled ? new Date().toISOString() : undefined;

      if (freezeEnabled) {
        await PlannerRecCache.findOneAndUpdate(
          { userId, weekStart },
          {
            $set: {
              userId,
              weekStart,
              recommendations: recs,
              heatmap,
              frozenAt: new Date(),
              algoVersion: ALGO_VERSION,
            },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        ).exec();
      }

      return {
        recommendations: recs,
        heatmap,
        frozenAt,
        cachedFromMongo: false,
      };
    };

    const pendingComputation = computePayload();
    if (!noCache) {
      setPlannerRecommendationInFlight(memoryKey, pendingComputation);
    }

    try {
      const computed = await pendingComputation;
      if (!noCache) {
        writePlannerRecommendationMemory(memoryKey, computed);
      }

      return NextResponse.json({
        ok: true,
        metricBase: 'views',
        weekStart: weekStartISO,
        recommendations: computed.recommendations,
        heatmap: computed.heatmap,
        frozenAt: computed.frozenAt,
        cached: computed.cachedFromMongo,
        freezeEnabled,
        algoVersion: ALGO_VERSION,
      });
    } finally {
      if (!noCache) {
        clearPlannerRecommendationInFlight(memoryKey);
      }
    }
  } catch (err) {
    console.error('[planner/recommendations] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to compute recommendations' }, { status: 500 });
  }
}
