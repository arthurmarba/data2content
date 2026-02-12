import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchPlatformSummary } from '@/app/lib/dataService/marketAnalysis/dashboardService';
import { DatabaseError } from '@/app/lib/errors';
import { getAdminSession } from '@/lib/getAdminSession';
import {
  buildAdminPlatformSummaryBatchCacheKey,
  dashboardCache,
  DEFAULT_DASHBOARD_TTL_MS,
} from '@/app/lib/cache/dashboardCache';

export const dynamic = 'force-dynamic';

const TAG = '/api/admin/dashboard/platform-summary/batch';
const noStore = { 'Cache-Control': 'no-store' };

const querySchema = z.object({
  startDate: z.string().datetime({ message: 'Invalid start date format. Expected ISO 8601 string.' }),
  endDate: z.string().datetime({ message: 'Invalid end date format. Expected ISO 8601 string.' }),
  onlyActiveSubscribers: z.enum(['true', 'false']).optional().transform(val => val === 'true'),
  context: z.string().optional(),
  creatorContext: z.string().optional(),
}).superRefine((data, ctx) => {
  if (new Date(data.startDate) > new Date(data.endDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'endDate cannot be earlier than startDate.', path: ['endDate'] });
  }
});

export async function GET(req: NextRequest) {
  const start = performance.now ? performance.now() : Date.now();
  logger.info(`${TAG} Request received`);

  const session = await getAdminSession(req);
  if (!session || !session.user) {
    logger.warn(`${TAG} Unauthorized access attempt.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  }

  const { searchParams } = new URL(req.url);
  const queryParamsFromUrl = {
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    onlyActiveSubscribers: searchParams.get('onlyActiveSubscribers') || undefined,
    context: searchParams.get('context') || undefined,
    creatorContext: searchParams.get('creatorContext') || undefined,
  };

  const validationResult = querySchema.safeParse(queryParamsFromUrl);
  if (!validationResult.success) {
    logger.warn(`${TAG} Invalid query parameters:`, validationResult.error.flatten());
    return NextResponse.json(
      { error: 'Invalid query parameters', details: validationResult.error.flatten() },
      { status: 400, headers: noStore }
    );
  }

  const currentStart = new Date(validationResult.data.startDate);
  const currentEnd = new Date(validationResult.data.endDate);
  const diffMs = currentEnd.getTime() - currentStart.getTime();
  const previousEnd = new Date(currentStart.getTime() - 1000);
  const previousStart = new Date(previousEnd.getTime() - diffMs);

  try {
    const cacheKey = buildAdminPlatformSummaryBatchCacheKey({
      currentStartIso: currentStart.toISOString(),
      currentEndIso: currentEnd.toISOString(),
      previousStartIso: previousStart.toISOString(),
      previousEndIso: previousEnd.toISOString(),
      onlyActiveSubscribers: validationResult.data.onlyActiveSubscribers ?? false,
      context: validationResult.data.context,
      creatorContext: validationResult.data.creatorContext,
    });

    const { value: summaryData, hit } = await dashboardCache.wrap(
      cacheKey,
      () => Promise.all([
        fetchPlatformSummary({
          dateRange: { startDate: currentStart, endDate: currentEnd },
          onlyActiveSubscribers: validationResult.data.onlyActiveSubscribers,
          context: validationResult.data.context,
          creatorContext: validationResult.data.creatorContext,
        }),
        fetchPlatformSummary({
          dateRange: { startDate: previousStart, endDate: previousEnd },
          onlyActiveSubscribers: validationResult.data.onlyActiveSubscribers,
          context: validationResult.data.context,
          creatorContext: validationResult.data.creatorContext,
        }),
      ]).then(([current, previous]) => ({ current, previous })),
      DEFAULT_DASHBOARD_TTL_MS
    );

    const duration = Math.round((performance.now ? performance.now() : Date.now()) - start);
    logger.info(`${TAG} Responded in ${duration}ms (cacheHit=${hit})`);
    return NextResponse.json(summaryData, { status: 200, headers: noStore });
  } catch (error: any) {
    logger.error(`${TAG} Error in request handler:`, { message: error.message, stack: error.stack });
    if (error instanceof DatabaseError) {
      return NextResponse.json({ error: 'Database error', details: error.message }, { status: 500, headers: noStore });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500, headers: noStore });
  }
}
