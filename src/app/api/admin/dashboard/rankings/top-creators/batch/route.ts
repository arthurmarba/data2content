import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchTopCreators, TopCreatorMetric, TopCreatorMetricEnum } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from '@/app/lib/cache/dashboardCache';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/rankings/top-creators/batch]';

const querySchema = z.object({
  context: z.string().optional(),
  creatorContext: z.string().optional(),
  metrics: z.string().optional(),
  days: z.coerce.number().int().positive().max(365).optional().default(30),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
  offset: z.coerce.number().int().min(0).optional().default(0),
  onlyActiveSubscribers: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
});

async function getAdminSession(_req: NextRequest): Promise<{ user: { name: string } } | null> {
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
  const start = performance.now ? performance.now() : Date.now();
  logger.info(`${TAG} Received request.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso nao autorizado.', 401);
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());
    const validationResult = querySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map(e => `${e.path.join('.')}?: ${e.message}`)
        .join(', ');
      return apiError(`Parametros de consulta invalidos: ${errorMessage}`, 400);
    }

    const {
      context,
      creatorContext,
      metrics,
      days,
      limit,
      offset,
      onlyActiveSubscribers,
    } = validationResult.data;

    const metricList = (metrics || '')
      .split(',')
      .map(metric => metric.trim())
      .filter(Boolean)
      .filter(metric => TopCreatorMetricEnum.safeParse(metric).success);

    const resolvedMetrics: TopCreatorMetric[] = metricList.length
      ? (metricList as TopCreatorMetric[])
      : ['total_interactions'];

    const cacheKey = `${SERVICE_TAG}:${JSON.stringify({
      context: context ?? 'geral',
      creatorContext: creatorContext ?? '',
      metrics: resolvedMetrics,
      days,
      limit,
      offset,
      onlyActiveSubscribers: Boolean(onlyActiveSubscribers),
    })}`;

    const { value: results, hit } = await dashboardCache.wrap(
      cacheKey,
      async () => {
        const entries = await Promise.all(
          resolvedMetrics.map(async (metric) => {
            const data = await fetchTopCreators({
              context: context ?? 'geral',
              metricToSortBy: metric,
              days,
              limit,
              offset,
              ...(onlyActiveSubscribers ? { onlyActiveSubscribers } : {}),
              ...(creatorContext ? { creatorContext } : {}),
            });
            return [metric, data] as const;
          })
        );
        return Object.fromEntries(entries);
      },
      DEFAULT_DASHBOARD_TTL_MS
    );

    const duration = Math.round((performance.now ? performance.now() : Date.now()) - start);
    logger.info(`${TAG} Responded in ${duration}ms (cacheHit=${hit})`);
    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
