import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { z } from 'zod';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { receiveAcquisition, revokeAcquisition } from '@/app/lib/acquisition/journey';
import { ACQUISITION_COOKIE, parseAcquisitionTouch } from '@/lib/analytics/acquisition';
import { checkRateLimit } from '@/utils/rateLimit';
import { createHash } from 'node:crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const inputSchema = z.object({
  step: z.enum(['arrival', 'pricing_viewed', 'signup_clicked', 'sync']),
  utm: z.object({ source: z.string().max(32), medium: z.string().max(32), campaign: z.string().max(100), content: z.string().max(60) }).optional(),
}).strict();
const sameOrigin = (req: NextRequest) => {
  const raw = req.headers.get('origin');
  if (!raw) return false;
  try {
    const origin = new URL(raw), requestUrl = new URL(req.url);
    // Next pode reconstruir req.url com localhost; Host conserva o endereço recebido.
    return raw === origin.origin && origin.protocol === requestUrl.protocol
      && (origin.host === requestUrl.host || origin.host === req.headers.get('host'));
  } catch { return false; }
};

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false }, { status: 403 });
  if (req.cookies.get('cookie_consent')?.value !== 'granted') return new NextResponse(null, { status: 204 });
  if (Number(req.headers.get('content-length')) > 2048) return new NextResponse(null, { status: 413 });
  const body = await req.text();
  if (body.length > 2048) return new NextResponse(null, { status: 413 });
  const parsed = inputSchema.safeParse((() => { try { return JSON.parse(body); } catch { return null; } })());
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const ipHash = createHash('sha256').update(req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown').digest('hex');
  if (!(await checkRateLimit(`acquisition:${ipHash}`, 90, 60)).allowed) return new NextResponse(null, { status: 429 });
  try {
    const session = await getServerSession(authOptions);
    const utm = parsed.data.utm;
    const touch = utm ? parseAcquisitionTouch(new URLSearchParams({ utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign, utm_content: utm.content })) : null;
    const result = await receiveAcquisition({ cookies: req.cookies, touch, step: parsed.data.step, userId: session?.user?.id });
    const response = NextResponse.json({ ok: true, tracked: Boolean(result) }, { headers: { 'Cache-Control': 'no-store' } });
    if (result) response.cookies.set(ACQUISITION_COOKIE, result.token!, { httpOnly: true, sameSite: 'lax', secure: new URL(req.url).protocol === 'https:', path: '/', maxAge: 90 * 86400 });
    return response;
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return new NextResponse(null, { status: 403 });
  try {
    const session = await getServerSession(authOptions);
    await revokeAcquisition(req.cookies, session?.user?.id);
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(ACQUISITION_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax' });
    return response;
  } catch { return NextResponse.json({ ok: false }, { status: 503 }); }
}
