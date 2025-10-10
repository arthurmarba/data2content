// src/app/api/planner/inspirations/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { WINDOW_DAYS } from '@/app/lib/planner/constants';
import getBlockSamplePosts from '@/utils/getBlockSamplePosts';
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

    await connectToDatabase();

    const body = await request.json();
    const userId: string | undefined = body?.userId || (session.user.id as string | undefined);
    const dayOfWeek: number = Number(body?.dayOfWeek);
    const blockStartHour: number = Number(body?.blockStartHour);
    const categories = (body?.categories || {}) as { context?: string[]; tone?: string; proposal?: string[]; reference?: string[] };
    const periodDays: number = Number(body?.periodDays) > 0 ? Number(body?.periodDays) : WINDOW_DAYS;
    const limit: number = Math.max(1, Math.min(20, Number(body?.limit) || 6));

    if (!userId || !dayOfWeek || !blockStartHour) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    let posts = await getBlockSamplePosts(
      userId,
      periodDays,
      dayOfWeek,
      blockStartHour,
      {
        contextId: categories.context?.[0],
        proposalId: categories.proposal?.[0],
        referenceId: categories.reference?.[0],
      },
      limit
    );

    // Fallback: se nenhum conteúdo com as categorias, relaxa filtros (só bloco)
    if (!posts || posts.length === 0) {
      posts = await getBlockSamplePosts(
        userId,
        periodDays,
        dayOfWeek,
        blockStartHour,
        {},
        limit
      );
    }

    return NextResponse.json({ ok: true, posts });
  } catch (err) {
    console.error('[planner/inspirations] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load inspirations' }, { status: 500 });
  }
}
