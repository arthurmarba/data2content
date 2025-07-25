import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { getAvailableContexts } from '@/app/lib/dataService/marketAnalysis/cohortsService';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[api/agency/dashboard/contexts]';

import { getAgencySession } from '@/lib/getAgencySession';

async function getSession(req: NextRequest) {
  const session = await getAgencySession(req);
  if (!session || !session.user) {
    logger.warn(`${SERVICE_TAG} Agency session validation failed.`);
    return null;
  }
  return session;
}

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request for available contexts.`);

  try {
    const session = await getSession(req);
    // CORRIGIDO: Verificação explícita de session e session.user para o TypeScript
    if (!session || !session.user) {
      return apiError('Acesso não autorizado. Sessão de administrador inválida.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const contexts = await getAvailableContexts();
    logger.info(`${TAG} Retrieved ${contexts.length} contexts.`);
    return NextResponse.json({ contexts }, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}