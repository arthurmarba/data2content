import type { Session } from "next-auth";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import { collabsDecision, collabsPatch, collabsState } from '@/app/lib/collabs/apiService';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function userId() { return (await getServerSession(await resolveAuthOptions()) as Session | null)?.user?.id; }
export async function GET() {
  const id = await userId();
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  try { return NextResponse.json(await collabsState(id)); }
  catch { return NextResponse.json({ ok: false, reason: 'state_unavailable' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const result = await collabsDecision(id, await request.json());
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch { return NextResponse.json({ ok: false, reason: 'decision_failed' }, { status: 503 }); }
}
export async function PATCH(request: Request) {
  const id = await userId();
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  try { const result = await collabsPatch(id, await request.json()); return NextResponse.json(result, { status: result.ok ? 200 : 409 }); }
  catch { return NextResponse.json({ ok: false, reason: 'update_failed' }, { status: 503 }); }
}
