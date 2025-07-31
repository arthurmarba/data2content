import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/app/lib/logger';
import type { PlanStatus } from '@/types/enums';

/**
 * Centralized helper to ensure a user has an active plan before accessing
 * premium APIs. Returns a NextResponse with status 403 when the plan is not
 * active. When the plan is active, returns null so the caller can proceed.
 */
export async function guardPremiumRequest(
  req: NextRequest
): Promise<NextResponse | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const status = token?.planStatus as PlanStatus | undefined;

  if (status === 'active') {
    return null;
  }

  const userId = token?.id ?? 'anonymous';
  const path = req.nextUrl.pathname;
  logger.warn(
    `[planGuard] Blocked request for user ${userId} with status ${status} on ${path}`
  );

  return NextResponse.json(
    { error: 'Seu acesso está inativo. Verifique sua assinatura para continuar.' },
    { status: 403 }
  );
}
