// @/app/api/planner/public/route.ts
import { NextResponse } from 'next/server';
import { Types } from 'mongoose';
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
import {
  TARGET_SUGGESTIONS_MIN,
  TARGET_SUGGESTIONS_MAX,
  WINDOW_DAYS,
  PLANNER_TIMEZONE,
} from '@/app/lib/planner/constants';
import { PLANNER_PLAN_READ_PROJECTION } from '@/app/lib/planner/planProjection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Versão do algoritmo/snapshot (2 = baseado em views)
const ALGO_VERSION = 2;

// === Toggle de freeze/cache ===
const FREEZE_DEFAULT = process.env.NODE_ENV === 'production';
const FREEZE_ENABLED_ENV =
  process.env.PLANNER_FREEZE_ENABLED === '1'
    ? true
    : process.env.PLANNER_FREEZE_ENABLED === '0'
    ? false
    : FREEZE_DEFAULT;

/** Loader dinâmico e robusto do modelo PlannerPlan */
let _PlannerPlanModel: any;
async function loadPlannerPlanModel() {
  if (_PlannerPlanModel) return _PlannerPlanModel;

  // ⚠️ importante: evitar confusão de alias/rota — prefira caminho absoluto com alias
  const mod: any = await import('@/app/models/PlannerPlan');

  // candidatos óbvios
  let candidate =
    mod?.default ??
    mod?.PlannerPlan ??
    mod?.PlannerPlanModel ??
    mod;

  const looksLikeModel =
    candidate &&
    typeof candidate.findOne === 'function' &&
    typeof candidate.findOneAndUpdate === 'function';

  if (!looksLikeModel && mod && typeof mod === 'object') {
    // varre exports à procura de um Model do mongoose
    for (const k of Object.keys(mod)) {
      const v = (mod as any)[k];
      if (v && typeof v.findOne === 'function' && typeof v.findOneAndUpdate === 'function') {
        candidate = v;
        break;
      }
    }
  }

  if (!candidate || typeof candidate.findOne !== 'function') {
    const keys = mod && typeof mod === 'object' ? Object.keys(mod) : [];
    throw new Error(
      `[planner/public] Não foi possível resolver o Model PlannerPlan em "@/app/models/PlannerPlan". ` +
      `Exports vistos: ${JSON.stringify(keys)}. ` +
      `Garanta algo como: export default PlannerPlanModel; export { PlannerPlanModel as PlannerPlan, PlannerPlanModel };`
    );
  }

  _PlannerPlanModel = candidate;
  return _PlannerPlanModel;
}

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

/** Offset (ms) do fuso informado em relação ao UTC no instante dado. */
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

/** Segunda 00:00 no fuso desejado → instante UTC correspondente */
function normalizeToMondayInTZ(d: Date, timeZone: string): Date {
  const zoned = new Date(d.getTime() + getTimeZoneOffsetMs(d, timeZone));
  const dow = zoned.getUTCDay(); // 0..6 já “no fuso”
  const shift = dow === 0 ? -6 : 1 - dow; // levar para segunda
  const mondayLocal = new Date(
    Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate() + shift, 0, 0, 0, 0)
  );
  return new Date(mondayLocal.getTime() - getTimeZoneOffsetMs(mondayLocal, timeZone));
}

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  if (!userId || !Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ ok: false, error: 'Invalid userId' }, { status: 400 });
  }
  const uid = new Types.ObjectId(userId);

  // Permite desativar cache por query (?nocache=1 ou ?disableFreeze=1)
  const noCache = parseBoolParam(request.url, 'nocache') || parseBoolParam(request.url, 'disableFreeze');
  const freezeEnabled = FREEZE_ENABLED_ENV && !noCache;

  // weekStart normalizado para Monday 00:00 no fuso do planner
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
    scope: 'planner-public',
    userId: uid.toString(),
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
    await connectToDatabase();

    // 🔸 Tente obter o Model; se falhar, seguimos sem plano salvo (rota pública não deve 500)
    let PlannerPlanModel: any | null = null;
    try { // eslint-disable-next-line react-hooks/rules-of-hooks
      PlannerPlanModel = await loadPlannerPlanModel();
    } catch (e) {
      console.warn('[planner/public] PlannerPlan model indisponível; seguindo com recomendações. Detalhe:', e);
    }

    // 1) Se houver um plano salvo para a semana, retorna o plano
    if (PlannerPlanModel) {
      const planData = await PlannerPlanModel.findOne({ userId: uid, platform: 'instagram', weekStart })
        .select(PLANNER_PLAN_READ_PROJECTION)
        .lean()
        .exec();
      if (planData) {
        return NextResponse.json({
          ok: true,
          mode: 'plan',
          metricBase: 'views',
          plan: planData,
          weekStart: weekStartISO,
          freezeEnabled,
          algoVersion: ALGO_VERSION,
        });
      }
    }

    if (!noCache) {
      const memoryHit = readPlannerRecommendationMemory<MemoryPayload>(memoryKey);
      if (memoryHit) {
        return NextResponse.json({
          ok: true,
          mode: 'recommendations',
          metricBase: 'views',
          recommendations: memoryHit.recommendations,
          heatmap: memoryHit.heatmap,
          weekStart: weekStartISO,
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
          mode: 'recommendations',
          metricBase: 'views',
          recommendations: joined.recommendations,
          heatmap: joined.heatmap,
          weekStart: weekStartISO,
          frozenAt: joined.frozenAt,
          cached: joined.cachedFromMongo,
          coalesced: true,
          freezeEnabled,
          algoVersion: ALGO_VERSION,
        });
      }
    }

    const computePayload = async (): Promise<MemoryPayload> => {
      // 2) Se freeze estiver habilitado → tenta snapshot semanal (válido só se versão bater)
      if (freezeEnabled) {
        type CachedRec = {
          userId: Types.ObjectId;
          weekStart: Date;
          recommendations: any[];
          heatmap: any[];
          frozenAt: Date;
          algoVersion?: number;
        };

        const cached = (await PlannerRecCache
          .findOne({ userId: uid, weekStart })
          .lean()
          .exec()) as CachedRec | null;

        if (cached && cached.algoVersion === ALGO_VERSION) {
          return {
            recommendations: cached.recommendations || [],
            heatmap: cached.heatmap || [],
            frozenAt:
              cached.frozenAt?.toISOString?.() ||
              new Date(cached.frozenAt as any).toISOString?.(),
            cachedFromMongo: true,
          };
        }
      }

      // 3) Sem plano/snapshot → gera recomendações + heatmap
      const [recsRaw, heatmap] = await Promise.all([
        recommendWeeklySlots({
          userId: uid,
          weekStart,
          targetSlotsPerWeek,
          periodDays,
        }),
        getTimeBlockScores(uid, periodDays),
      ]);

      // 4) Enriquecer cada slot com TEMAS
      const recs = await Promise.all(
        (recsRaw || []).map(async (r) => {
          try {
            const { themes, keyword } = await getThemesForSlot(
              uid,
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

      // 5) Congela somente se habilitado (com versão do algoritmo)
      if (freezeEnabled) {
        await PlannerRecCache.findOneAndUpdate(
          { userId: uid, weekStart },
          {
            $set: {
              userId: uid,
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
        mode: 'recommendations',
        metricBase: 'views',
        recommendations: computed.recommendations,
        heatmap: computed.heatmap,
        weekStart: weekStartISO,
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
    console.error('[planner/public GET] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load public planner' }, { status: 500 });
  }
}
