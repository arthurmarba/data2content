import { Receiver } from '@upstash/qstash';
import { NextResponse } from 'next/server';
import { recoverVideoAnalyses } from '@/app/lib/videoAnalysis/jobs';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  const body = await request.text();
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const bearer = Boolean(process.env.CRON_SECRET) && request.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`;
  const signed = currentSigningKey && nextSigningKey && await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature: request.headers.get('upstash-signature') || '', body }).catch(() => false);
  if (!bearer && !signed) return NextResponse.json({ ok: false }, { status: 401 });
  try { return NextResponse.json(await recoverVideoAnalyses()); }
  catch { return NextResponse.json({ ok: false }, { status: 500 }); }
}
