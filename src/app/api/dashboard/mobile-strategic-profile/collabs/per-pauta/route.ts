import type { Session } from "next-auth";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import { prepareCollabs } from '@/app/lib/collabs/apiService';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST() {
  const id = (await getServerSession(await resolveAuthOptions()) as Session | null)?.user?.id;
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  try { return NextResponse.json(await prepareCollabs(id)); }
  catch { return NextResponse.json({ ok: false, reason: 'matching_unavailable' }, { status: 503 }); }
}
