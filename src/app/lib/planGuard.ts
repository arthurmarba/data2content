// src/app/lib/planGuard.ts

import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { connectToDatabase } from '@/app/lib/mongoose';
import DbUser from '@/app/models/User';
import type { PlanStatus } from '@/types/enums';

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
    // Se o plano está ativo no token, permite a passagem imediatamente.
    return null;
  }

  // CORREÇÃO: A verificação redundante foi removida.
  // Se o código chegou até aqui, já sabemos que o status não é 'active' nem 'non_renewing'.
  // Agora, apenas verificamos se temos um userId para tentar uma consulta ao banco de dados.
  if (userId) {
    try {
      await connectToDatabase();
      const dbUser = await DbUser.findById(userId)
        .select('planStatus')
        .lean<{ planStatus?: PlanStatus }>();
      const dbStatus = dbUser?.planStatus;
      
      // Se o banco de dados mostrar que o plano está ativo, permite a passagem.
      if (dbStatus === 'active' || dbStatus === 'non_renewing') {
        return null;
      }
    } catch (dbCheckError) {
      // O Edge runtime não permite usar logger; fallback para console.
      console.error('[planGuard] DB check failed', dbCheckError);
    }
  }

  // Se o plano não está ativo (nem no token, nem no DB), bloqueia a requisição.
  const path = req.nextUrl.pathname;

  // Atualiza as métricas para monitoramento.
  planGuardMetrics.blocked += 1;
  planGuardMetrics.byRoute[path] = (planGuardMetrics.byRoute[path] || 0) + 1;

  // Retorna a resposta de bloqueio.
  return NextResponse.json(
    { error: 'Seu acesso está inativo. Verifique sua assinatura para continuar.' },
    { status: 403 }
  );
}
