import { NextRequest, NextResponse } from 'next/server';
import { logMediaKitAccess } from '@/lib/logMediaKitAccess';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();
    if (!userId) {
      return NextResponse.json({ error: 'userId obrigatório' }, { status: 400 });
    }
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null;
    const referer = request.headers.get('referer');
    await logMediaKitAccess(userId, ip, referer);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'erro' }, { status: 500 });
  }
}

