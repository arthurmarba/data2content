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

/** Status que consideramos como com acesso ativo aos recursos premium (forma canônica). */
export type ActiveLikeStatus = 'active' | 'non_renewing' | 'trial' | 'trialing';

const ACTIVE_LIKE_CANONICAL: ReadonlySet<ActiveLikeStatus> = new Set<ActiveLikeStatus>([
  'active',
  'non_renewing',
  'trial',
  'trialing',
]);

/**
 * Normaliza o valor de planStatus para uma forma canônica:
 * - lower-case
 * - trim
 * - troca espaços e hífens por "_"
 * - colapsa múltiplos "_"
 * - mapeia aliases comuns (ex.: "nonrenewing" → "non_renewing", "trialling" → "trialing")
 */
export function normalizePlanStatus(value: unknown): string {
  if (value == null) return '';
  let v = String(value).trim().toLowerCase();

  // substituir espaço/hífen por "_"
  v = v.replace(/[\s-]+/g, '_').replace(/_+/g, '_');

  // aliases comuns
  if (v === 'nonrenewing') v = 'non_renewing';
  if (v === 'trialling') v = 'trialing';

  return v;
}

/** Type guard reutilizável: indica se o valor (após normalização) é um status com acesso ativo. */
export function isActiveLike(s: unknown): s is ActiveLikeStatus {
  const norm = normalizePlanStatus(s) as ActiveLikeStatus;
  return ACTIVE_LIKE_CANONICAL.has(norm);
}

/**
 * Tenta extrair o token do request: next-auth -> fallback manual por cookie.
 * Caso o token de `getToken` não possua identificadores básicos (id, sub ou email),
 * tentamos decodificar manualmente o cookie para reconstruir os dados.
 */
async function getAuthTokenFromRequest(
  req: NextRequest
): Promise<Record<string, any> | null> {
  try {
    const t = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    const hasId = (t as any)?.id || (t as any)?.sub || (t as any)?.email;
    if (t && hasId) return t as any;
    if (t) console.warn('[planGuard] getToken() -> token sem id/sub/email, tentando fallback');
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
    const hasId =
      (payload as any)?.id || (payload as any)?.sub || (payload as any)?.email;
    if (hasId) return payload as any;
    return null; // sem identificador mesmo após fallback
  } catch (err) {
    console.error('[planGuard] jwtVerify fallback error:', err);
    return null;
  }
}

/**
 * Garante que o usuário tenha plano ativo antes de APIs premium.
 * - Confia no token para liberar rápido se já estiver ativo-like (active | non_renewing | trial | trialing).
 * - Se o token vier inativo/indefinido, revalida no DB (fonte da verdade).
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

  const claimedStatusRaw = (token as any)?.planStatus as unknown;
  const claimedStatusNorm = normalizePlanStatus(claimedStatusRaw);

  // ✅ Fast-path: token já indica plano válido (active-like)
  if (isActiveLike(claimedStatusNorm)) {
    return null;
  }

  // Token não trouxe ativo: revalida no DB
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

    const dbStatusNorm = normalizePlanStatus(dbUser?.planStatus);

    if (isActiveLike(dbStatusNorm)) {
      // ✅ DB confirma ativo-like: libera, mesmo com JWT “atrasado”
      return null;
    }
  } catch (dbCheckError) {
    console.error('[planGuard] DB check failed:', dbCheckError);
    // Em falha de DB, se o token disser ativo-like, ainda liberamos.
    if (isActiveLike(claimedStatusNorm)) {
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
