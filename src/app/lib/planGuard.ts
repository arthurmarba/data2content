// src/app/lib/planGuard.ts — v2.1.0
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';
import type { Session } from 'next-auth';
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

/** tenta pegar o valor de forma segura e útil pra logs */
function safe<T = unknown>(v: T): T | undefined {
  return (v === undefined || v === null) ? undefined : v;
}

function registerBlock(routePath?: string) {
  planGuardMetrics.blocked += 1;
  if (!routePath) return;
  planGuardMetrics.byRoute[routePath] = (planGuardMetrics.byRoute[routePath] || 0) + 1;
}

export type PlannerAccessFailureReason = 'unauthenticated' | 'inactive' | 'error';

export interface EnsurePlannerAccessOptions {
  session?: Session | null;
  userId?: string | null;
  email?: string | null;
  planStatus?: unknown;
  allowAdmin?: boolean;
  routePath?: string;
  forceReload?: boolean;
}

export type EnsurePlannerAccessResult =
  | { ok: true; normalizedStatus: ActiveLikeStatus | null; source: 'session' | 'database' | 'token' }
  | { ok: false; status: number; reason: PlannerAccessFailureReason; message: string };

export async function ensurePlannerAccess(
  options: EnsurePlannerAccessOptions = {}
): Promise<EnsurePlannerAccessResult> {
  const {
    session,
    userId,
    email,
    planStatus,
    allowAdmin = true,
    routePath,
    forceReload = false,
  } = options;

  const sessionUser = session?.user as (Session['user'] & { role?: string; planStatus?: unknown }) | undefined;
  const sessionRole = typeof sessionUser?.role === 'string' ? sessionUser.role.toLowerCase() : undefined;

  if (allowAdmin && sessionRole === 'admin') {
    const statusCandidate = planStatus ?? sessionUser?.planStatus;
    const normalizedStatus = normalizePlanStatus(statusCandidate);
    const activeLike = isActiveLike(normalizedStatus) ? (normalizedStatus as ActiveLikeStatus) : null;
    return { ok: true, normalizedStatus: activeLike, source: 'session' };
  }

  const statusCandidate = planStatus ?? sessionUser?.planStatus;
  const normalizedStatus = normalizePlanStatus(statusCandidate);
  if (!forceReload) {
    const activeLike = isActiveLike(normalizedStatus) ? (normalizedStatus as ActiveLikeStatus) : null;
    return { ok: true, normalizedStatus: activeLike, source: 'session' };
  }

  const resolvedUserId = safe(userId) ?? safe((sessionUser as any)?.id) ?? safe((session as any)?.id);
  const resolvedEmail = safe(email) ?? safe(sessionUser?.email);

  if (!resolvedUserId && !resolvedEmail) {
    console.warn('[planGuard] ensurePlannerAccess: missing identifiers - blocking');
    registerBlock(routePath);
    return {
      ok: false,
      status: 401,
      reason: 'unauthenticated',
      message: 'Não autenticado.',
    };
  }

  try {
    await connectToDatabase();

    let dbUser: { planStatus?: string; role?: string } | null = null;

    if (resolvedUserId && mongoose.isValidObjectId(resolvedUserId)) {
      dbUser = await DbUser.findById(resolvedUserId).select('planStatus role').lean();
    } else if (resolvedEmail) {
      dbUser = await DbUser.findOne({ email: resolvedEmail }).select('planStatus role').lean();
    }

    const dbRole = typeof dbUser?.role === 'string' ? dbUser.role.toLowerCase() : undefined;
    if (allowAdmin && dbRole === 'admin') {
      return { ok: true, normalizedStatus: 'active', source: 'database' };
    }

    const dbStatusNorm = normalizePlanStatus(dbUser?.planStatus);
    const activeLike = isActiveLike(dbStatusNorm) ? (dbStatusNorm as ActiveLikeStatus) : null;
    return { ok: true, normalizedStatus: activeLike, source: 'database' };
  } catch (error) {
    console.error('[planGuard] ensurePlannerAccess() DB error:', error);
    return {
      ok: true,
      normalizedStatus: null,
      source: 'database',
    };
  }
}

/**
 * Tenta extrair o token do request: next-auth -> fallback manual por cookie.
 * Caso o token de `getToken` não possua identificadores básicos (id, sub ou email),
 * tentamos decodificar manualmente o cookie para reconstruir os dados.
 */
async function getAuthTokenFromRequest(req: NextRequest): Promise<Record<string, any> | null> {
  // 1) next-auth
  try {
    const t = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (t && !(t as any).id && (t as any).sub) {
      (t as any).id = String((t as any).sub);
    }
    const hasIdOrEmail = Boolean((t as any)?.id || (t as any)?.email);
    if (t && hasIdOrEmail) return t as any;
    if (t) console.warn('[planGuard] getToken() -> token sem id/email, tentando fallback por cookie.');
  } catch (e) {
    console.error('[planGuard] getToken() error:', e);
  }

  // 2) Fallback manual (tenta ambos os nomes, útil em proxys/dev/prod)
  const cookieCandidates = [
    '__Secure-next-auth.session-token', // prod
    'next-auth.session-token',          // dev
  ];

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[planGuard] NEXTAUTH_SECRET ausente — não é possível decodificar cookie manualmente.');
    return null;
  }

  const enc = new TextEncoder().encode(secret);
  for (const name of cookieCandidates) {
    const raw = req.cookies.get(name)?.value;
    if (!raw) continue;
    try {
      const { payload } = await jwtVerify(raw, enc);
      const p: any = payload || {};
      if (!p.id && p.sub) p.id = String(p.sub);
      if (p.id || p.email) {
        return p;
      }
    } catch (err) {
      // tenta próximo cookie name
      continue;
    }
  }

  return null; // sem identificador mesmo após fallbacks
}

/**
 * Garante que o usuário tenha plano ativo antes de APIs premium.
 * - Confia no token para liberar rápido se já estiver ativo-like (active | non_renewing | trial | trialing).
 * - Se o token vier inativo/indefinido, revalida no DB (fonte da verdade).
 * - Se não conseguir ler token, retorna 401 (não autenticado).
 */
export async function guardPremiumRequest(req: NextRequest): Promise<NextResponse | null> {
  const token = await getAuthTokenFromRequest(req);
  if (!token) {
    return NextResponse.json(
      { error: 'Não autenticado.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  const tokenId = (token as any)?.id ?? (token as any)?.sub;
  const tokenEmail = (token as any)?.email as string | undefined;

  const sessionStub = {
    user: {
      id: tokenId ? String(tokenId) : undefined,
      email: tokenEmail,
      role: (token as any)?.role,
      planStatus: (token as any)?.planStatus,
    },
  } as Session;

  const result = await ensurePlannerAccess({
    session: sessionStub,
    userId: typeof tokenId === 'string' ? tokenId : undefined,
    email: tokenEmail,
    planStatus: safe((token as any)?.planStatus),
    routePath: req.nextUrl.pathname,
    forceReload: true,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, reason: result.reason },
      { status: result.status, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return null;
}
