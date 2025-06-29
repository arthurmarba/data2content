import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/app/lib/logger';
import { getAvailableContexts } from '@/app/lib/dataService/marketAnalysis/cohortsService';
import { DatabaseError } from '@/app/lib/errors';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const SERVICE_TAG = '[api/admin/dashboard/contexts]';

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request for available contexts.`);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return apiError('Acesso não autorizado.', 401);
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
