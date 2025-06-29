import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchTopCreators, TopCreatorMetricEnum } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/rankings/top-creators]';

const querySchema = z.object({
  context: z.string().optional(),
  metric: TopCreatorMetricEnum.optional().default('total_interactions'),
  days: z.coerce.number().int().positive().max(365).optional().default(30),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
});


function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request.`);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return apiError('Acesso não autorizado.', 401);
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

    const { context, metric, days, limit } = validationResult.data;
    const results = await fetchTopCreators({
      context: context ?? 'geral',
      metricToSortBy: metric,
      days,
      limit,
    });

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
