// src/app/lib/planGuard.ts
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';
import mongoose from 'mongoose';

export interface PlanGuardMetrics {
  blocked: number;
  byRoute: Record<string, number>;
}

export const planGuardMetrics: PlanGuardMetrics = {
  blocked: 0,
  byRoute: {},
};

export function resetPlanGuardMetrics() {
  planGuardMetrics.blocked = 0;
  planGuardMetrics.byRoute = {};
}

export function getPlanGuardMetrics(): PlanGuardMetrics {
  return {
    blocked: planGuardMetrics.blocked,
    byRoute: { ...planGuardMetrics.byRoute },
  };
}

function isActiveLike(s: unknown): s is 'active' | 'non_renewing' {
  return s === 'active' || s === 'non_renewing';
}

/** Tenta extrair o token do request: next-auth -> fallback manual por cookie */
async function getAuthTokenFromRequest(req: NextRequest): Promise<Record<string, any> | null> {
  try {
    const t = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (t) return t as any;
  } catch (e) {
    console.error('[planGuard] getToken() error:', e);
  }

  // Fallback manual (funciona em dev/prod)
  const cookieName =
    process.env.NODE_ENV === 'production'
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

  const raw = req.cookies.get(cookieName)?.value;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!raw || !secret) return null;

  try {
    const { payload } = await jwtVerify(raw, new TextEncoder().encode(secret));
    // payload pode conter sub, email e planStatus (se você escreve isso no JWT)
    return payload as any;
  } catch (err) {
    console.error('[planGuard] jwtVerify fallback error:', err);
    return null;
  }
}

/**
 * Garante que o usuário tenha plano ativo antes de APIs premium.
 * - Confia no token para liberar rápido se já estiver ativo.
 * - Se o token vier inativo, revalida no DB (fonte da verdade).
 * - Se não conseguir ler token, retorna 401 (não autenticado).
 */
export async function guardPremiumRequest(
  req: NextRequest
): Promise<NextResponse | null> {
  const token = await getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json(
      { error: 'Não autenticado.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const claimedStatus = (token as any)?.planStatus as unknown;

  // ✅ Fast-path: se o token diz ativo, libera sem consultar DB.
  if (isActiveLike(claimedStatus)) {
    return null;
  }

  // Caso o token diga "inactive" (ou não traga status), verifica no DB.
  const tokenId = (token as any)?.id ?? (token as any)?.sub;
  const tokenEmail = (token as any)?.email as string | undefined;

  try {
    await connectToDatabase();

    let dbUser: { planStatus?: string } | null = null;

    if (tokenId && mongoose.isValidObjectId(tokenId)) {
      dbUser = await DbUser.findById(tokenId).select('planStatus').lean<{ planStatus?: string }>();
    } else if (tokenEmail) {
      dbUser = await DbUser.findOne({ email: tokenEmail })
        .select('planStatus')
        .lean<{ planStatus?: string }>();
    }

    const dbStatus = dbUser?.planStatus;
    if (isActiveLike(dbStatus)) {
      // ✅ DB confirma ativo: libera, mesmo que o JWT esteja “atrasado”.
      return null;
    }
  } catch (dbCheckError) {
    console.error('[planGuard] DB check failed:', dbCheckError);
    // Se houver falha de DB mas o token indicar ativo, ainda liberamos.
    if (isActiveLike(claimedStatus)) {
      return null;
    }
  }

  // 🚫 Bloqueia: não ativo (token + DB)
  const path = req.nextUrl.pathname;
  planGuardMetrics.blocked += 1;
  planGuardMetrics.byRoute[path] = (planGuardMetrics.byRoute[path] || 0) + 1;

  return NextResponse.json(
    { error: 'Seu acesso está inativo. Verifique sua assinatura para continuar.' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } }
  );
}
