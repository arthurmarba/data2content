import type { Session } from "next-auth";
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import { readJob } from '@/app/lib/collabs/jobs';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = (await getServerSession(await resolveAuthOptions()) as Session | null)?.user?.id;
  if (!userId) return NextResponse.json({ ok: false }, { status: 401 });
  const job = await readJob(userId, (await params).id);
  return NextResponse.json({ ok: !!job, job }, { status: job ? 200 : 404 });
}
