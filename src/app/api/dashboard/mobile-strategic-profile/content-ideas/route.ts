import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import { listContentIdeasForUser } from '@/app/dashboard/boards/videoUpload/contentIdeasReadService';
import { isMobileStrategicProfileEnabled } from '@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag';
import { quotaStatus } from '@/app/lib/collabs/jobs';
export async function GET(request: Request) {
  if (!isMobileStrategicProfileEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const id = (await getServerSession(await resolveAuthOptions()) as Session | null)?.user?.id;
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const params = new URL(request.url).searchParams;
    const status = params.get('status') === 'library' ? 'library' : params.get('status') === 'posted' ? 'posted' : params.get('status') === 'saved' ? 'saved' : undefined;
    const [ideas, quota] = await Promise.all([listContentIdeasForUser(id, { status, cursor: params.get('cursor') || undefined, activeOnly: params.get('activeOnly') === 'true' }), quotaStatus(id)]);
    return NextResponse.json({ ok: true, ideas, nextCursor: status && ideas.length === 30 ? ideas[ideas.length - 1]!.id : null, quota });
  } catch { return NextResponse.json({ ok: false, reason: 'ideas_unavailable' }, { status: 503 }); }
}
