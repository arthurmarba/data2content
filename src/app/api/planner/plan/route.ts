// src/app/api/planner/plan/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { logger } from '@/app/lib/logger';

import { Types } from 'mongoose';
import { getCategoryByValue } from '@/app/lib/classification';
import { ALLOWED_BLOCKS, P90_MULT, PLANNER_TIMEZONE } from '@/app/lib/planner/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Loader dinâmico e robusto do modelo PlannerPlan */
let _PlannerPlanModel: any;
async function loadPlannerPlanModel() {
  if (_PlannerPlanModel) return _PlannerPlanModel;

  // ⚠️ caminho relativo evita colisão "planner/plan" vs "PlannerPlan" em FS case-insensitive
  const mod: any = await import('../../../models/PlannerPlan');

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
      `[planner/plan] Não foi possível resolver o Model PlannerPlan em "@/app/models/PlannerPlan". ` +
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

/** Segunda 00:00 no fuso informado → instante UTC correspondente */
function normalizeToMondayInTZ(d: Date, timeZone: string): Date {
  const zoned = new Date(d.getTime() + getTimeZoneOffsetMs(d, timeZone));
  const dow = zoned.getUTCDay(); // 0=Dom..6=Sáb no fuso alvo
  const shift = dow === 0 ? -6 : 1 - dow; // levar para segunda
  const mondayLocal = new Date(
    Date.UTC(zoned.getUTCFullYear(), zoned.getUTCMonth(), zoned.getUTCDate() + shift, 0, 0, 0, 0)
  );
  return new Date(mondayLocal.getTime() - getTimeZoneOffsetMs(mondayLocal, timeZone));
}

// ---- Sanitização/normalização de slots (server-side) ----

const ALLOWED_STATUS = new Set(['planned', 'drafted', 'test', 'posted']);

function isValidDay(d: any): d is number {
  return Number.isInteger(d) && d >= 1 && d <= 7;
}
function isValidBlock(h: any): h is number {
  return typeof h === 'number' && ALLOWED_BLOCKS.includes(h as any);
}

function normalizeFormat(fmt: unknown): string {
  if (typeof fmt !== 'string' || !fmt) return 'reel';
  const cat = getCategoryByValue(fmt, 'format');
  const id = (cat?.id || fmt).toString().toLowerCase();
  const allowed = new Set(['reel', 'photo', 'carousel', 'story', 'live', 'long_video']);
  return allowed.has(id) ? id : 'reel';
}

function uniq<T>(arr: T[]): T[] {
  const set = new Set<T>();
  const out: T[] = [];
  for (const v of arr) {
    if (!set.has(v)) {
      set.add(v);
      out.push(v);
    }
  }
  return out;
}

function normalizeStringIdArray(
  v: unknown,
  dim: 'context' | 'proposal' | 'reference' | 'tone',
  maxLen: number
): string[] {
  const arr = Array.isArray(v) ? v : (typeof v === 'string' && v ? [v] : []);
  const ids = arr
    .map((x) => {
      if (typeof x !== 'string' || !x) return null;
      const c = getCategoryByValue(x, dim);
      return (c?.id || x).toString();
    })
    .filter(Boolean) as string[];
  return uniq(ids).slice(0, maxLen);
}

function normalizeTone(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v) return undefined;
  const c = getCategoryByValue(v, 'tone');
  return (c?.id || v).toString();
}

function toIntNonNeg(n: unknown): number | undefined {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x) || x < 0) return undefined;
  return x;
}

/** Garante tema 1 palavra (começa com letra), máx 24 chars. */
function sanitizeThemeKeyword(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  const match = trimmed.match(/\p{L}[\p{L}\p{N}]*/u);
  const word = match?.[0] || '';
  if (!word) return undefined;
  if (/^\d+$/.test(word)) return undefined;
  return word.slice(0, 24);
}

type IncomingSlot = {
  slotId?: string;
  dayOfWeek: number;
  blockStartHour: number;
  format?: string;
  categories?: { context?: string[]; proposal?: string[]; reference?: string[]; tone?: string };
  status?: string;
  isExperiment?: boolean;
  expectedMetrics?: { viewsP50?: number; viewsP90?: number; sharesP50?: number };
  recordingTimeSec?: number;
  aiVersionId?: string | null;
  title?: string;
  scriptShort?: string;
  notes?: string;
  themeKeyword?: string;
};

function sanitizeSlot(s: any): IncomingSlot | null {
  const day = s?.dayOfWeek;
  const block = s?.blockStartHour;
  if (!isValidDay(day) || !isValidBlock(block)) return null;

  const statusIn = typeof s?.status === 'string' ? s.status : 'planned';
  const status = ALLOWED_STATUS.has(statusIn) ? statusIn : 'planned';

  const categories = s?.categories || {};
  const ctx = normalizeStringIdArray(categories?.context, 'context', 4);
  const prop = normalizeStringIdArray(categories?.proposal, 'proposal', 4);
  const ref = normalizeStringIdArray(categories?.reference, 'reference', 3);
  const tone = normalizeTone(categories?.tone);

  const viewsP50 = toIntNonNeg(s?.expectedMetrics?.viewsP50) ?? 0;
  const viewsP90 = toIntNonNeg(s?.expectedMetrics?.viewsP90) ?? Math.round(viewsP50 * P90_MULT);
  const sharesP50 = toIntNonNeg(s?.expectedMetrics?.sharesP50);

  return {
    slotId: typeof s?.slotId === 'string' && s.slotId ? s.slotId : undefined,
    dayOfWeek: day,
    blockStartHour: block,
    format: normalizeFormat(s?.format),
    categories: { context: ctx, proposal: prop, reference: ref, ...(tone ? { tone } : {}) },
    status,
    isExperiment: status === 'test' ? true : !!s?.isExperiment,
    expectedMetrics: { viewsP50, viewsP90, ...(sharesP50 !== undefined ? { sharesP50 } : {}) },
    recordingTimeSec: toIntNonNeg(s?.recordingTimeSec),
    aiVersionId: typeof s?.aiVersionId === 'string' ? s.aiVersionId : null,
    title: typeof s?.title === 'string' ? s.title : undefined,
    scriptShort: typeof s?.scriptShort === 'string' ? s.scriptShort : undefined,
    notes: typeof s?.notes === 'string' ? s.notes : undefined,
    themeKeyword: sanitizeThemeKeyword(s?.themeKeyword),
  };
}

function dedupeByCell(slots: IncomingSlot[]): IncomingSlot[] {
  const seen = new Set<string>();
  const out: IncomingSlot[] = [];
  for (const s of slots) {
    const k = `${s.dayOfWeek}-${s.blockStartHour}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.blockStartHour - b.blockStartHour);
}

// ----------------------------------------------------------

export async function GET(request: Request) {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  const routePath = new URL(request.url).pathname;

  const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.message, reason: access.reason },
      { status: access.status }
    );
  }

  const rawWeekStart = parseWeekStartParam(request.url) ?? new Date();
  const weekStart = normalizeToMondayInTZ(rawWeekStart, PLANNER_TIMEZONE);

  try {
    const PlannerPlan = await loadPlannerPlanModel();
    await connectToDatabase();


    // se o model falhar, devolvemos plan=null (UI ainda funciona)
    let planData: any | null = null;
    try {
      planData = await PlannerPlan.findOne({ userId: session.user.id, platform: 'instagram', weekStart }).lean().exec();
    } catch (e) {
      console.warn('[planner/plan GET] PlannerPlan model indisponível; devolvendo plan=null. Detalhe:', e);
    }

    logger.info('[planner/plan GET] user=%s weekStart=%s', session.user.id, weekStart.toISOString());

    if (!PlannerPlan) {
      return NextResponse.json({ ok: true, plan: null, weekStart });
    }

    if (!planData) return NextResponse.json({ ok: true, plan: null, weekStart });
    return NextResponse.json({ ok: true, plan: planData, weekStart });
  } catch (err) {
    console.error('[planner/plan GET] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load plan' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json();
    const rawWeekStart: string | Date | undefined = body?.weekStart;
    const weekStart = rawWeekStart
      ? normalizeToMondayInTZ(new Date(rawWeekStart), PLANNER_TIMEZONE)
      : normalizeToMondayInTZ(new Date(), PLANNER_TIMEZONE);
    const userTimeZone = typeof body?.userTimeZone === 'string' ? body.userTimeZone : undefined;

    const routePath = new URL(request.url).pathname;
    const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.message, reason: access.reason },
        { status: access.status }
      );
    }

    const PlannerPlan = await loadPlannerPlanModel();
    await connectToDatabase();


    try {
    } catch (e) {
      console.error('[planner/plan POST] Model PlannerPlan não resolvido:', e);
      return NextResponse.json(
        { ok: false, error: 'PlannerPlan model not available. Verifique os exports do arquivo @/app/models/PlannerPlan.' },
        { status: 500 }
      );
    }

    // ---- Sanitização & dedupe ----
    const incoming = Array.isArray(body?.slots) ? body.slots : [];
    const sanitized = incoming
      .map(sanitizeSlot)
      .filter((s: IncomingSlot | null): s is IncomingSlot => s !== null);

    const deduped = dedupeByCell(sanitized).map((s) => ({
      slotId: s.slotId ?? new Types.ObjectId().toString(),
      dayOfWeek: s.dayOfWeek,
      blockStartHour: s.blockStartHour,
      format: s.format,
      categories: s.categories || {},
      status: s.status || 'planned',
      isExperiment: s.status === 'test' ? true : !!s.isExperiment,
      expectedMetrics: s.expectedMetrics,
      recordingTimeSec: s.recordingTimeSec,
      aiVersionId: s.aiVersionId ?? null,
      title: s.title,
      scriptShort: s.scriptShort,
      notes: s.notes,
      themeKeyword: s.themeKeyword,
    }));

    logger.info(
      '[planner/plan POST] user=%s weekStart=%s input=%d sanitized=%d saved=%d',
      session.user.id,
      weekStart.toISOString(),
      Array.isArray(body?.slots) ? body.slots.length : 0,
      sanitized.length,
      deduped.length
    );

    const upserted = await PlannerPlan.findOneAndUpdate(
      { userId: session.user.id, platform: 'instagram', weekStart },
      { $set: { userTimeZone, slots: deduped } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean().exec();

    return NextResponse.json({ ok: true, plan: upserted, weekStart });
  } catch (err) {
    console.error('[planner/plan POST] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to save plan' }, { status: 500 });
  }
}
