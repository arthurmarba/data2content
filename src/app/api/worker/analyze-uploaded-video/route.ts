import { Receiver } from '@upstash/qstash';
import { NextResponse } from 'next/server';
import { processVideoAnalysis } from '@/app/lib/videoAnalysis/jobs';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request: Request) {
  const body = await request.text();
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const allowed = currentSigningKey && nextSigningKey && await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature: request.headers.get('upstash-signature') || '', body }).catch(() => false);
  if (!allowed) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const id = JSON.parse(body).jobId;
    if (typeof id !== 'string' || id.length > 150) return NextResponse.json({ ok: false }, { status: 400 });
    return NextResponse.json(await processVideoAnalysis(id));
  } catch { return NextResponse.json({ ok: false }, { status: 500 }); }
}
