/**
 * @fileoverview API Endpoint for fetching category rankings in a single request.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchTopCategories } from '@/app/lib/dataService/marketAnalysis/rankingsService';
import { DatabaseError } from '@/app/lib/errors';
import { dashboardCache, DEFAULT_DASHBOARD_TTL_MS } from '@/app/lib/cache/dashboardCache';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/rankings/categories/batch]';

const CATEGORY_KEYS = ['format', 'proposal', 'context', 'tone', 'references'] as const;
const METRICS = ['posts', 'avg_total_interactions'] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];
type MetricKey = (typeof METRICS)[number];
type RankItem = { category: string; value: number };
type BatchResponse = Record<CategoryKey, Record<MetricKey, RankItem[]>>;

const querySchema = z.object({
  startDate: z.string().datetime({ message: 'Formato de data invalido para startDate.' }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: 'Formato de data invalido para endDate.' }).transform(val => new Date(val)),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
  userId: z.string().optional(),
  onlyActiveSubscribers: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  context: z.string().optional(),
  creatorContext: z.string().optional(),
}).refine(data => data.startDate <= data.endDate, {
  message: 'A data de inicio nao pode ser posterior a data de termino.',
  path: ['endDate'],
});

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

async function getAdminSession(_req: NextRequest): Promise<{ user: { name: string } } | null> {
  const isAdmin = true;
  if (isAdmin) {
    return { user: { name: 'Admin User' } };
  }
  return null;
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  const start = performance.now ? performance.now() : Date.now();
  logger.info(`${TAG} Requisicao recebida.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso nao autorizado.', 401);
    }

    const { searchParams } = new URL(req.url);
    const validationResult = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return apiError(`Parametros de consulta invalidos: ${errorMessage}`, 400);
    }

    const {
      startDate,
      endDate,
      limit,
      userId,
      onlyActiveSubscribers,
      context,
      creatorContext,
    } = validationResult.data;

    const cacheKey = `${SERVICE_TAG}:${JSON.stringify({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      limit,
      userId: userId || '',
      onlyActiveSubscribers: Boolean(onlyActiveSubscribers),
      context: context || '',
      creatorContext: creatorContext || '',
    })}`;

    const { value: results, hit } = await dashboardCache.wrap(
      cacheKey,
      async () => {
        const baseParams = {
          dateRange: { startDate, endDate },
          limit,
          ...(userId ? { userId } : {}),
          ...(onlyActiveSubscribers ? { onlyActiveSubscribers } : {}),
          ...(context ? { context } : {}),
          ...(creatorContext ? { creatorContext } : {}),
        };

        const batchEntries = await Promise.all(
          CATEGORY_KEYS.map(async (category) => {
            const metricEntries = await Promise.all(
              METRICS.map(async (metric) => {
                const items = await fetchTopCategories({
                  ...baseParams,
                  category,
                  metric,
                });
                return [metric, items] as const;
              }),
            );
            return [category, Object.fromEntries(metricEntries)] as const;
          }),
        );

        return Object.fromEntries(batchEntries) as BatchResponse;
      },
      DEFAULT_DASHBOARD_TTL_MS,
    );

    const duration = Math.round((performance.now ? performance.now() : Date.now()) - start);
    logger.info(`${TAG} Responded in ${duration}ms (cacheHit=${hit})`);

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Erro inesperado:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
