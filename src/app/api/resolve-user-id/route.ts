import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/app/lib/mongoose';
import { resolveMediaKitToken } from '@/app/lib/mediakit/slugService';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = (searchParams.get('slug') || '').trim();
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 });
    }

    await connectToDatabase();
    const resolved = await resolveMediaKitToken(slug);
    if (!resolved?.userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json({
      userId: resolved.userId,
      canonicalSlug: resolved.canonicalSlug,
      matchedByAlias: resolved.matchedByAlias,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to resolve user id' }, { status: 500 });
  }
}
