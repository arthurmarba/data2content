// src/app/api/planner/themes/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { getThemesForSlot } from '@/app/lib/planner/themes';
import { WINDOW_DAYS } from '@/app/lib/planner/constants';
import { getBlockSampleCaptions } from '@/utils/getBlockSampleCaptions';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import {
  clearPlannerRecommendationInFlight,
  getPlannerRecommendationInFlight,
  readPlannerRecommendationMemory,
  setPlannerRecommendationInFlight,
  writePlannerRecommendationMemory,
} from '@/app/lib/planner/recommendationMemoryCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THEMES_CACHE_VERSION = 1;

type ThemesPayload = {
  keyword: string;
  themes: string[];
  captions: string[];
};

function buildThemesCacheKey(params: {
  userId: string;
  periodDays: number;
  dayOfWeek: number;
  blockStartHour: number;
  formatId?: string;
  durationId?: string;
  preferredKeyword?: string;
  includeCaptions: boolean;
  categories: {
    context?: string[];
    tone?: string;
    proposal?: string[];
    reference?: string[];
    contentIntent?: string[];
    narrativeForm?: string[];
  };
}) {
  return [
    'planner-themes',
    `v${THEMES_CACHE_VERSION}`,
    params.userId,
    String(params.periodDays),
    String(params.dayOfWeek),
    String(params.blockStartHour),
    params.formatId || '-',
    params.durationId || '-',
    params.preferredKeyword?.trim().toLowerCase() || '-',
    params.includeCaptions ? 'captions1' : 'captions0',
    JSON.stringify({
      context: params.categories.context || [],
      proposal: params.categories.proposal || [],
      reference: params.categories.reference || [],
      tone: params.categories.tone || null,
      contentIntent: params.categories.contentIntent || [],
      narrativeForm: params.categories.narrativeForm || [],
    }),
  ].join('|');
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const routePath = new URL(request.url).pathname;
    const access = await ensurePlannerAccess({ session, routePath, forceReload: true });
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.message, reason: access.reason },
        { status: access.status }
      );
    }

    const body = await request.json();
    const dayOfWeek: number = Number(body?.dayOfWeek);
    const blockStartHour: number = Number(body?.blockStartHour);
    const formatId: string | undefined =
      typeof body?.format === 'string' && body.format.trim() ? body.format.trim() : undefined;
    const durationId: string | undefined =
      typeof body?.durationId === 'string' && body.durationId.trim() ? body.durationId.trim() : undefined;
    const categories = (body?.categories || {}) as {
      context?: string[];
      tone?: string;
      proposal?: string[];
      reference?: string[];
      contentIntent?: string[];
      narrativeForm?: string[];
    };
    const preferredKeyword =
      (typeof body?.themeKeyword === 'string' && body.themeKeyword.trim()) ||
      (typeof body?.title === 'string' && body.title.trim()) ||
      undefined;
    const periodDays: number = Number(body?.periodDays) > 0 ? Number(body?.periodDays) : WINDOW_DAYS;
    const includeCaptions: boolean = Boolean(body?.includeCaptions);

    if (!Number.isFinite(dayOfWeek) || !Number.isFinite(blockStartHour)) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const userId = session.user.id;
    const cacheKey = buildThemesCacheKey({
      userId,
      periodDays,
      dayOfWeek,
      blockStartHour,
      formatId,
      durationId,
      preferredKeyword,
      includeCaptions,
      categories,
    });
    let payload = readPlannerRecommendationMemory<ThemesPayload>(cacheKey);
    if (!payload) {
      const inFlight = getPlannerRecommendationInFlight<ThemesPayload>(cacheKey);
      if (inFlight) {
        payload = await inFlight;
      } else {
        const requestPromise = (async (): Promise<ThemesPayload> => {
          await connectToDatabase();
          const res = await getThemesForSlot(
            userId,
            periodDays,
            dayOfWeek,
            blockStartHour,
            categories,
            preferredKeyword,
            {
              formatId,
              durationId,
              contextId: categories.context?.[0],
              proposalId: categories.proposal?.[0],
              referenceId: categories.reference?.[0],
              toneId: categories.tone,
              contentIntentId: categories.contentIntent?.[0],
              narrativeFormId: categories.narrativeForm?.[0],
            }
          );
          let captions: string[] = [];
          if (includeCaptions) {
            try {
              captions = await getBlockSampleCaptions(userId, periodDays, dayOfWeek, blockStartHour, {
                formatId,
                durationId,
                contextId: categories.context?.[0],
                proposalId: categories.proposal?.[0],
                referenceId: categories.reference?.[0],
                toneId: categories.tone,
                contentIntentId: categories.contentIntent?.[0],
                narrativeFormId: categories.narrativeForm?.[0],
              }, 3);
            } catch { captions = []; }
          }
          return { keyword: res.keyword, themes: res.themes, captions };
        })();
        setPlannerRecommendationInFlight(cacheKey, requestPromise);
        try {
          payload = await requestPromise;
          writePlannerRecommendationMemory(cacheKey, payload);
        } finally {
          clearPlannerRecommendationInFlight(cacheKey);
        }
      }
    }

    return NextResponse.json({ ok: true, keyword: payload.keyword, themes: payload.themes, captions: payload.captions });
  } catch (err) {
    console.error('[planner/themes POST] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to compute themes' }, { status: 500 });
  }
}
