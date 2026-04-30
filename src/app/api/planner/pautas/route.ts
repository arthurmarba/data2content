import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { WINDOW_DAYS } from '@/app/lib/planner/constants';
import { ensurePlannerAccess } from '@/app/lib/planGuard';
import { getPautasForSlot } from '@/app/lib/planner/pautas';
import {
  getPostCreationTrialAccess,
  hasFullPostCreationAccess,
  markPostCreationTrialPautaUsed,
  serializePostCreationTrial,
} from '@/app/lib/postCreationTrial/access';
import { recordPostCreationFunnelEvent } from '@/app/lib/postCreationTrial/events';
import {
  clearPlannerRecommendationInFlight,
  getPlannerRecommendationInFlight,
  readPlannerRecommendationMemory,
  setPlannerRecommendationInFlight,
  writePlannerRecommendationMemory,
} from '@/app/lib/planner/recommendationMemoryCache';
import type { PlannerCategories, PlannerFormat } from '@/types/planner';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PAUTAS_CACHE_VERSION = 11;

function buildPautasCacheKey(params: {
  userId: string;
  periodDays: number;
  dayOfWeek: number;
  blockStartHour: number;
  format?: string;
  durationId?: string;
  themeKeyword: string;
  categories: PlannerCategories;
  count: number;
}) {
  return [
    'planner-pautas',
    `v${PAUTAS_CACHE_VERSION}`,
    params.userId,
    String(params.periodDays),
    String(params.dayOfWeek),
    String(params.blockStartHour),
    params.format || '-',
    params.durationId || '-',
    params.themeKeyword.trim().toLowerCase(),
    String(params.count),
    JSON.stringify({
      context: params.categories.context || [],
      proposal: params.categories.proposal || [],
      reference: params.categories.reference || [],
      tone: params.categories.tone || null,
      contentIntent: params.categories.contentIntent || [],
      narrativeForm: params.categories.narrativeForm || [],
      contentSignals: params.categories.contentSignals || [],
      stance: params.categories.stance || [],
      proofStyle: params.categories.proofStyle || [],
      commercialMode: params.categories.commercialMode || [],
    }),
  ].join('|');
}

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  if (!session?.user?.id) {
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
    const hasFullAccess = hasFullPostCreationAccess(session.user);
    let shouldConsumeTrialPauta = false;
    if (!hasFullAccess) {
      const trialAccess = await getPostCreationTrialAccess(session.user.id);
      if (!trialAccess.ok) {
        return NextResponse.json(
          { ok: false, error: trialAccess.error, reason: trialAccess.reason },
          { status: trialAccess.status }
        );
      }
      if (!trialAccess.fullAccess) {
        if (!trialAccess.instagramConnected) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Conecte o Instagram para gerar a pauta de teste.',
              reason: 'post_creation_instagram_required',
            },
            { status: 403 }
          );
        }
        if (trialAccess.trial.pautaUsedAt) {
          return NextResponse.json(
            {
              ok: false,
              error: 'Você já usou a pauta gratuita deste teste.',
              reason: 'post_creation_trial_pauta_used',
              postCreationTrial: trialAccess.trial,
            },
            { status: 403 }
          );
        }
        shouldConsumeTrialPauta = true;
      }
    }

    const body = await request.json();
    const dayOfWeek = Number(body?.dayOfWeek);
    const blockStartHour = Number(body?.blockStartHour);
    const format =
      typeof body?.format === 'string' && body.format.trim()
        ? (body.format.trim() as PlannerFormat)
        : undefined;
    const durationId =
      typeof body?.durationId === 'string' && body.durationId.trim()
        ? body.durationId.trim()
        : undefined;
    const categories = (body?.categories || {}) as PlannerCategories;
    const themeKeyword =
      (typeof body?.themeKeyword === 'string' && body.themeKeyword.trim()) ||
      (typeof body?.title === 'string' && body.title.trim()) ||
      '';
    const periodDays = Number(body?.periodDays) > 0 ? Number(body.periodDays) : WINDOW_DAYS;
    const count = 5;

    if (!Number.isFinite(dayOfWeek) || !Number.isFinite(blockStartHour) || !themeKeyword) {
      console.warn('[API/Pautas] Parâmetros inválidos:', { dayOfWeek, blockStartHour, themeKeyword });
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    console.log('[API/Pautas] Iniciando busca:', { themeKeyword, dayOfWeek, blockStartHour, count });

    const cacheKey = buildPautasCacheKey({
      userId: session.user.id,
      periodDays,
      dayOfWeek,
      blockStartHour,
      format,
      durationId,
      categories,
      themeKeyword,
      count,
    });
    const userId = session.user.id;
    let result = readPlannerRecommendationMemory<Awaited<ReturnType<typeof getPautasForSlot>>>(cacheKey);
    if (!result) {
      const inFlight = getPlannerRecommendationInFlight<Awaited<ReturnType<typeof getPautasForSlot>>>(cacheKey);
      if (inFlight) {
        result = await inFlight;
      } else {
        const requestPromise = (async () => {
          await connectToDatabase();
          return getPautasForSlot({
            userId,
            periodDays,
            dayOfWeek,
            blockStartHour,
            format,
            durationId,
            categories,
            themeKeyword,
            count,
          });
        })();
        setPlannerRecommendationInFlight(cacheKey, requestPromise);
        try {
          result = await requestPromise;
          writePlannerRecommendationMemory(cacheKey, result);
        } finally {
          clearPlannerRecommendationInFlight(cacheKey);
        }
      }
    }

    console.log('[API/Pautas] Resultado final:', { source: result.source, count: result.pautas.length });

	    const updatedTrial = shouldConsumeTrialPauta
	      ? await markPostCreationTrialPautaUsed(session.user.id)
	      : null;
      if (shouldConsumeTrialPauta && !updatedTrial) {
        return NextResponse.json(
          {
            ok: false,
            error: 'Você já usou a pauta gratuita deste teste.',
            reason: 'post_creation_trial_pauta_used',
          },
          { status: 403 }
        );
      }
      if (shouldConsumeTrialPauta) {
        await recordPostCreationFunnelEvent({
          userId: session.user.id,
          eventName: 'post_creation_trial_pauta_generated',
          stage: 'idea',
          source: 'planner_pautas',
          metadata: {
            dayOfWeek,
            blockStartHour,
            format: format ?? null,
            durationId: durationId ?? null,
            themeKeyword,
            resultSource: result.source,
            retrievalMode: result.retrievalMode,
          },
        });
      }

	    return NextResponse.json({
	      ok: true,
	      keyword: result.keyword,
	      pautas: result.pautas,
	      captions: result.captions,
	      source: result.source,
	      retrievalMode: result.retrievalMode,
	      postCreationTrial: updatedTrial?.postCreationTrial
	        ? serializePostCreationTrial(updatedTrial.postCreationTrial as any)
	        : undefined,
	    });
  } catch (err) {
    console.error('[planner/pautas POST] error:', err);
    return NextResponse.json(
      { ok: false, error: 'Não foi possível gerar 5 pautas com IA para este recorte.' },
      { status: 502 }
    );
  }
}
