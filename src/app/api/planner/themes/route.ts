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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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
    const categories = (body?.categories || {}) as { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
    const periodDays: number = Number(body?.periodDays) > 0 ? Number(body?.periodDays) : WINDOW_DAYS;
    const includeCaptions: boolean = Boolean(body?.includeCaptions);

    if (!dayOfWeek || !blockStartHour) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    await connectToDatabase();
    const res = await getThemesForSlot(session.user.id, periodDays, dayOfWeek, blockStartHour, categories);
    let captions: string[] = [];
    if (includeCaptions) {
      try {
        captions = await getBlockSampleCaptions(session.user.id, periodDays, dayOfWeek, blockStartHour, {
          contextId: categories.context?.[0],
          proposalId: categories.proposal?.[0],
          referenceId: categories.reference?.[0],
        }, 3);
      } catch { captions = []; }
    }

    return NextResponse.json({ ok: true, keyword: res.keyword, themes: res.themes, captions });
  } catch (err) {
    console.error('[planner/themes POST] error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to compute themes' }, { status: 500 });
  }
}
