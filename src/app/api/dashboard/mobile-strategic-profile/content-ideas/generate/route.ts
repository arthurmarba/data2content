import type { Session } from "next-auth";
import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import { isMobileStrategicProfileEnabled } from '@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag';
import { requestIdeas } from '@/app/lib/collabs/apiService';
export async function POST(request: Request) {
  if (!isMobileStrategicProfileEnabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const id = (await getServerSession(await resolveAuthOptions()) as Session | null)?.user?.id;
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const result = await requestIdeas(id, body, request.headers.get('Idempotency-Key') || crypto.randomUUID());
  return NextResponse.json(result.data, { status: result.status });
}
