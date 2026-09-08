import { NextRequest, NextResponse } from 'next/server';
import { Receiver } from '@upstash/qstash';
import { Types } from 'mongoose';
import { enrichMapaSeedWithInstagram } from '@/app/lib/mapaSeed/enrichMapaSeedForUser';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  const manual = Boolean(process.env.CRON_SECRET && request.headers.get('x-cron-key') === process.env.CRON_SECRET);
  const signed = currentSigningKey && nextSigningKey
    ? await new Receiver({ currentSigningKey, nextSigningKey }).verify({ body, signature: request.headers.get('upstash-signature') ?? '' }).catch(() => false)
    : false;
  if (!manual && !signed) return NextResponse.json({ message: 'Não autorizado.' }, { status: 401 });
  let input: { userId?: string };
  try { input = JSON.parse(body); } catch { return NextResponse.json({ message: 'Corpo inválido.' }, { status: 400 }); }
  if (!input || typeof input !== 'object' || !input.userId || !Types.ObjectId.isValid(input.userId)) return NextResponse.json({ message: 'Usuário inválido.' }, { status: 400 });
  const state = await enrichMapaSeedWithInstagram(input.userId);
  return NextResponse.json({ ok: state !== 'deferred', state: state ?? 'unchanged' }, { status: state === 'deferred' ? 503 : 200 });
}
