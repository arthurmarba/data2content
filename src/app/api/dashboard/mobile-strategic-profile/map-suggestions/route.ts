import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { resolveAuthOptions } from '@/app/api/auth/resolveAuthOptions';
import { decideMapSuggestion, readMapSuggestions, MapSuggestionError } from '@/app/lib/mapaSeed/mapSuggestionService';

export const dynamic = 'force-dynamic';
async function userId() {
  const session = await getServerSession(await resolveAuthOptions());
  return (session as { user?: { id?: string } } | null)?.user?.id;
}
export async function GET() {
  const user = await userId();
  if (!user) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  try { return NextResponse.json({ mapa: await readMapSuggestions(user) }); }
  catch { return NextResponse.json({ message: 'Não foi possível carregar o mapa.' }, { status: 503 }); }
}
export async function POST(request: Request) {
  const user = await userId();
  if (!user) return NextResponse.json({ message: 'Não autenticado.' }, { status: 401 });
  try {
    const body = await request.json().catch(() => null);
    return NextResponse.json({ mapa: await decideMapSuggestion(user, body) });
  } catch (error) {
    return NextResponse.json({ message: error instanceof MapSuggestionError ? error.message : 'Não foi possível salvar a decisão.' }, { status: error instanceof MapSuggestionError ? error.status : 500 });
  }
}
