import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import { collabsState } from '@/app/lib/collabs/apiService';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/** Adaptador de leitura para clientes antigos. O contexto enviado não escolhe pessoas. */
export async function POST() {
  const session = await getServerSession(await resolveAuthOptions()) as Session | null;
  if (!session?.user?.id) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    const state = await collabsState(session.user.id);
    const dismissed = new Set(state.decisions.filter(item => item.decision === 'dismissed').map(item => item.pautaId));
    const items = Object.entries(state.suggestions).filter(([id]) => !dismissed.has(id)).map(([, match]) => match).slice(0, 3);
    return NextResponse.json({ ok: true, items, contextLabel: 'Propostas compartilhadas', themeKeyword: null });
  } catch { return NextResponse.json({ ok: false, reason: 'suggestions_unavailable' }, { status: 503 }); }
}
