import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ZodError } from 'zod';
import { PublicInstagramResearchError } from '@/app/lib/mcp/publicInstagramResearch';
import { beginMarketplaceConnection, disconnectMarketplace, finishMarketplaceConnection, marketplaceOrigin, marketplaceStatus, searchMarketplaceCreators } from './marketplace';

const COOKIE = 'd2c-marketplace-state';
async function owner() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new PublicInstagramResearchError('admin_required', 'Entre com sua conta administradora.');
  return session.user.id;
}
function errorResponse(error: unknown) {
  const safe = error instanceof PublicInstagramResearchError;
  return NextResponse.json({ error: safe ? error.code : error instanceof ZodError ? 'invalid_filters' : 'marketplace_unavailable',
    message: safe ? error.message : error instanceof ZodError ? 'Confira os filtros. Cidade, busca visual e combinações não suportadas são recusadas.' : 'Não foi possível concluir a operação.' },
  { status: safe && error.code === 'admin_required' ? 403 : 400, headers: { 'Cache-Control': 'no-store' } });
}
export async function handleMarketplaceGet() {
  try { return NextResponse.json(await marketplaceStatus(await owner()), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return errorResponse(error); }
}
export async function handleMarketplacePost(request: NextRequest) {
  try {
    if (request.headers.get('origin') !== marketplaceOrigin()) throw new PublicInstagramResearchError('invalid_origin', 'Reabra a página administrativa para continuar.');
    const actor = await owner();
    const text = await request.text();
    if (text.length > 4096) throw new Error('Requisição excede o limite.');
    const body = JSON.parse(text);
    if (body.action === 'connect') {
      const result = await beginMarketplaceConnection(actor);
      const response = NextResponse.json({ url: result.url }, { headers: { 'Cache-Control': 'no-store' } });
      response.cookies.set(COOKIE, result.state, { httpOnly: true, secure: marketplaceOrigin().startsWith('https:'), sameSite: 'lax', maxAge: 600, path: '/api/admin/creator-marketplace/callback' });
      return response;
    }
    if (body.action === 'disconnect') return NextResponse.json(await disconnectMarketplace(actor));
    if (body.action !== 'search') throw new Error('Ação inválida.');
    return NextResponse.json(await searchMarketplaceCreators(actor, body.filters), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return errorResponse(error); }
}
export async function handleMarketplaceCallback(request: NextRequest) {
  let result = 'connected';
  try {
    const actor = await owner();
    const params = request.nextUrl.searchParams;
    if (params.has('error')) throw new PublicInstagramResearchError('marketplace_cancelled', 'Autorização cancelada.');
    await finishMarketplaceConnection(actor, params.get('code') || '', params.get('state') || '', request.cookies.get(COOKIE)?.value || '');
  } catch (error) { result = error instanceof PublicInstagramResearchError ? error.code : 'marketplace_unavailable'; }
  const response = NextResponse.redirect(`${marketplaceOrigin()}/admin/creator-marketplace?connection=${encodeURIComponent(result)}`, 303);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.cookies.set(COOKIE, '', { httpOnly: true, secure: marketplaceOrigin().startsWith('https:'), sameSite: 'lax', maxAge: 0, path: '/api/admin/creator-marketplace/callback' });
  return response;
}
