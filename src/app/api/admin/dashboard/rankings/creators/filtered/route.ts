/**
 * @fileoverview API Endpoint for fetching creator rankings with filters.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchCreatorsWithFilters, IFetchCreatorRankingWithFilters } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[api/admin/dashboard/rankings/creators/filtered]';

const querySchema = z.object({
  startDate: z.string().datetime().transform(val => new Date(val)),
  endDate: z.string().datetime().transform(val => new Date(val)),
  metric: z.string(),
  minFollowers: z.coerce.number().int().nonnegative(),
  maxFollowers: z.coerce.number().int().nonnegative().optional(),
  minAvgViews: z.coerce.number().nonnegative().optional(),
  maxAvgViews: z.coerce.number().nonnegative().optional(),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
}).refine(data => data.startDate <= data.endDate, {
  message: 'startDate cannot be after endDate.',
  path: ['endDate'],
});

async function getAdminSession(req: NextRequest): Promise<{ user: { name: string } } | null> {
  const session = { user: { name: 'Admin User' } };
  const isAdmin = true;
  if (!session || !isAdmin) {
    logger.warn(`${SERVICE_TAG} Admin session validation failed.`);
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
  logger.info(`${TAG} Received request.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado.', 401);
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validation = querySchema.safeParse(queryParams);
    if (!validation.success) {
      const errorMessage = validation.error.errors.map(e => `${e.path.join('.')} : ${e.message}`).join(', ');
      return apiError(`Parâmetros inválidos: ${errorMessage}`, 400);
    }

    const { startDate, endDate, metric, minFollowers, maxFollowers, minAvgViews, maxAvgViews, limit } = validation.data;

    const args: IFetchCreatorRankingWithFilters = {
      metric,
      minFollowers,
      maxFollowers,
      minAvgViews,
      maxAvgViews,
      dateRange: { startDate, endDate },
      limit,
    };

    const results = await fetchCreatorsWithFilters(args);
    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
