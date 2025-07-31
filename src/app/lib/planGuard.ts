import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { logger } from '@/app/lib/logger';
import { sendAlert } from '@/app/lib/alerts';
import type { PlanStatus } from '@/types/enums';

export interface PlanGuardMetrics {
  blocked: number;
  byRoute: Record<string, number>;
}

// In-memory metrics used by the support dashboard to monitor blocked access
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
  // Update metrics for monitoring purposes
  planGuardMetrics.blocked += 1;
  planGuardMetrics.byRoute[path] = (planGuardMetrics.byRoute[path] || 0) + 1;
  logger.warn({ userId, status, path });
  void sendAlert(
    `[planGuard] Blocked request for user ${userId} with status ${status} on ${path}`
  );

  return NextResponse.json(
    { error: 'Seu acesso está inativo. Verifique sua assinatura para continuar.' },
    { status: 403 }
  );
}
