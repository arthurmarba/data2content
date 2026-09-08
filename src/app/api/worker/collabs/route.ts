import { Receiver } from '@upstash/qstash';
import { NextResponse } from 'next/server';
import { processJob } from '@/app/lib/collabs/jobs';
export const runtime = 'nodejs';
export const maxDuration = 150;
export async function POST(request: Request) {
  const text = await request.text();
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY, nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const allowed = currentSigningKey && nextSigningKey && await new Receiver({ currentSigningKey, nextSigningKey }).verify({ signature: request.headers.get('upstash-signature') || '', body: text }).catch(() => false);
  if (!allowed) return NextResponse.json({ ok: false }, { status: 401 });
  try { return NextResponse.json(await processJob(JSON.parse(text).jobId)); }
  catch { return NextResponse.json({ ok: false }, { status: 500 }); }
}
