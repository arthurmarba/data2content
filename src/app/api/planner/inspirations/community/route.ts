// src/app/api/planner/inspirations/community/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import findCommunityInspirationPosts from '@/utils/findCommunityInspirationPosts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  try {
    await connectToDatabase();
    const body = await request.json();
    const userId: string | undefined = body?.userId || (session?.user?.id as string | undefined);
    const categories = (body?.categories || {}) as { context?: string[]; proposal?: string[]; reference?: string[] };
    const script: string = String(body?.script || '');
    const themeKeyword: string | undefined = body?.themeKeyword || undefined;
    const limit: number = Math.max(3, Math.min(24, Number(body?.limit) || 12));
    const periodDays: number = Math.max(30, Math.min(365, Number(body?.periodDays) || 180));
    const styleHints: string[] = Array.isArray(body?.styleHints) ? body.styleHints : [];

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const posts = await findCommunityInspirationPosts({
      excludeUserId: userId,
      categories,
      script,
      themeKeyword,
      limit,
      periodInDays: periodDays,
      styleHints,
    });

    return NextResponse.json({ ok: true, posts });
  } catch (err) {
    console.error('[planner/inspirations/community] Error:', err);
    return NextResponse.json({ ok: false, error: 'Failed to load community inspirations' }, { status: 500 });
  }
}
