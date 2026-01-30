import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
// AVISO: A correção completa deste arquivo pode depender da atualização das funções 'fetchTopCreators' e 'fetchTopCreatorsWithScore'
// no arquivo 'marketAnalysisService.ts' para aceitarem 'agencyId'.
import { fetchTopCreators, fetchTopCreatorsWithScore, TopCreatorMetricEnum } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
import { getAgencySession } from '@/lib/getAgencySession';
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/agency/dashboard/rankings/top-creators]';

const querySchema = z.object({
  context: z.string().optional(),
  creatorContext: z.string().optional(),
  metric: TopCreatorMetricEnum.optional().default('total_interactions'),
  days: z.coerce.number().int().positive().max(365).optional().default(30),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
  composite: z.coerce.boolean().optional().default(false),
  offset: z.coerce.number().int().min(0).optional().default(0),
  onlyActiveSubscribers: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
});

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request.`);

  try {
    const session = await getAgencySession(req);
    // CORRIGIDO: Verificação explícita e robusta para session, user e agencyId.
    if (!session || !session.user || !session.user.agencyId) {
      logger.warn(`${TAG} Unauthorized access attempt. Session or agencyId missing.`);
      return apiError('Acesso não autorizado. A sessão do usuário é inválida ou não está associada a um parceiro.', 401);
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validationResult = querySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map(e => `${e.path.join('.')}?: ${e.message}`)
        .join(', ');
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const { context, creatorContext, metric, days, limit, composite, offset, onlyActiveSubscribers } = validationResult.data;
    let results;

    // A partir daqui, TypeScript sabe que session.user.agencyId é uma string.
    if (composite) {
      results = await fetchTopCreatorsWithScore({
        context: context ?? 'geral',
        days,
        limit,
        agencyId: session.user.agencyId,
        offset,
        ...(onlyActiveSubscribers ? { onlyActiveSubscribers } : {}),
        ...(creatorContext ? { creatorContext } : {}),
      });
    } else {
      results = await fetchTopCreators({
        context: context ?? 'geral',
        metricToSortBy: metric,
        days,
        limit,
        agencyId: session.user.agencyId,
        offset,
        ...(onlyActiveSubscribers ? { onlyActiveSubscribers } : {}),
        ...(creatorContext ? { creatorContext } : {}),
      });
    }

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
