// src/app/lib/planGuard.ts

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';
// CORREÇÃO: Removidas as importações de 'logger' e 'sendAlert',
// pois são incompatíveis com o Edge Runtime do middleware.
// import { logger } from '@/app/lib/logger';
// import { sendAlert } from '@/app/lib/alerts';
import type { PlanStatus } from '@/types/enums';

export interface PlanGuardMetrics {
  blocked: number;
  byRoute: Record<string, number>;
}

// As métricas em memória podem continuar, pois não dependem de APIs do Node.js.
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
 * * Esta versão foi modificada para ser compatível com o Edge Runtime.
 */
export async function guardPremiumRequest(
  req: NextRequest
): Promise<NextResponse | null> {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const status = token?.planStatus as PlanStatus | undefined;
  const userId = token?.id ?? token?.sub;

  if (status === 'active' || status === 'non_renewing') {
    // Se o plano está ativo, permite a passagem sem fazer nada.
    return null;
  }

  // Para minimizar latência, apenas usuários cujo token não está ativo ou
  // em fase de não renovação disparam uma checagem extra no banco de dados
  // antes de bloquear o acesso.
  if (status !== 'active' && status !== 'non_renewing' && userId) {
    try {
      await connectToDatabase();
      const dbUser = await DbUser.findById(userId)
        .select('planStatus')
        .lean<{ planStatus?: PlanStatus }>();
      const dbStatus = dbUser?.planStatus;
      if (dbStatus === 'active' || dbStatus === 'non_renewing') {
        return null;
      }
    } catch (dbCheckError) {
      // Edge runtime doesn't allow using logger; fallback to console.
      console.error('[planGuard] DB check failed', dbCheckError);
    }
  }

  // Se o plano não está ativo, bloqueia a requisição.
  const path = req.nextUrl.pathname;

  // Atualiza as métricas para monitoramento.
  planGuardMetrics.blocked += 1;
  planGuardMetrics.byRoute[path] = (planGuardMetrics.byRoute[path] || 0) + 1;

  // CORREÇÃO: As chamadas para logger.warn e sendAlert foram removidas
  // porque não podem ser executadas no middleware. O monitoramento de
  // acessos bloqueados agora é feito apenas pelas métricas em memória.
  // logger.warn({ userId, status, path });
  // void sendAlert(
  //   `[planGuard] Blocked request for user ${userId} with status ${status} on ${path}`
  // );

  // Retorna a resposta de bloqueio.
  return NextResponse.json(
    { error: 'Seu acesso está inativo. Verifique sua assinatura para continuar.' },
    { status: 403 }
  );
}
