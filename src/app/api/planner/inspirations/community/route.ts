// src/app/api/planner/inspirations/community/route.ts
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import type { Session } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { connectToDatabase } from '@/app/lib/mongoose';
import { buildThemeStyleHints } from '@/app/lib/planner/themes';
import findCommunityInspirationPosts from '@/utils/findCommunityInspirationPosts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = (await getServerSession(authOptions as any)) as Session | null;
  try {
    await connectToDatabase();
    const body = await request.json();
    const userId: string | undefined = body?.userId || (session?.user?.id as string | undefined);
    const rawCategories = (body?.categories || {}) as {
      context?: string[];
      proposal?: string[];
      reference?: string[];
      tone?: string | string[];
    };
    const script: string = String(body?.script || '');
    const themeKeyword: string | undefined = body?.themeKeyword || undefined;
    const format: string | undefined = body?.format || undefined;
    const limit: number = Math.max(3, Math.min(24, Number(body?.limit) || 12));
    const periodDays: number = Math.max(30, Math.min(365, Number(body?.periodDays) || 180));
    const normalizedCategories = {
      ...rawCategories,
      tone: Array.isArray(rawCategories.tone) ? rawCategories.tone[0] : rawCategories.tone,
    };
    const tone: string | undefined = body?.tone || normalizedCategories.tone || undefined;
    const styleHints: string[] = Array.isArray(body?.styleHints)
      ? body.styleHints
      : buildThemeStyleHints(normalizedCategories);

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'Parâmetros inválidos' }, { status: 400 });
    }

    const posts = await findCommunityInspirationPosts({
      excludeUserId: userId,
      categories: normalizedCategories,
      format,
      tone,
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
