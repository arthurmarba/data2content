import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchPlatformSummary } from '@/app/lib/dataService/marketAnalysis/dashboardService';
import { DatabaseError } from '@/app/lib/errors';
import { getAgencySession } from '@/lib/getAgencySession';
import {
  buildAgencyPlatformSummaryCacheKey,
  dashboardCache,
  DEFAULT_DASHBOARD_TTL_MS,
} from '@/app/lib/cache/dashboardCache';
export const dynamic = 'force-dynamic';
const noStore = { 'Cache-Control': 'no-store' };


const TAG = '/api/agency/dashboard/platform-summary';

const querySchema = z.object({
  startDate: z.string().datetime({ message: 'Invalid start date format. Expected ISO 8601 string.' }).optional(),
  endDate: z.string().datetime({ message: 'Invalid end date format. Expected ISO 8601 string.' }).optional(),
  creatorContext: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.startDate && !data.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'endDate is required if startDate is provided.', path: ['endDate'] });
  }
  if (!data.startDate && data.endDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'startDate is required if endDate is provided.', path: ['startDate'] });
  }
  if (data.startDate && data.endDate && new Date(data.startDate) > new Date(data.endDate)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'endDate cannot be earlier than startDate.', path: ['endDate'] });
  }
});

export async function GET(req: NextRequest) {
  const start = performance.now ? performance.now() : Date.now();
  logger.info(`${TAG} Request received`);

  const session = await getAgencySession(req);
  if (!session || !session.user) {
    logger.warn(`${TAG} Unauthorized access attempt.`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStore });
  }

  // CORRIGIDO: Adicionado um 'type guard' para garantir que o agencyId existe.
  // Se um usuário de parceiro está logado, ele DEVE ter um agencyId.
  const agencyId = session.user.agencyId;
  if (typeof agencyId !== 'string' || !agencyId) {
    logger.error(`${TAG} Authenticated user ${session.user.id || session.user.email} has no agencyId.`);
    return NextResponse.json({ error: 'User is not associated with an agency' }, { status: 400, headers: noStore });
  }

  const { searchParams } = new URL(req.url);
  const queryParamsFromUrl = {
    startDate: searchParams.get('startDate') || undefined,
    endDate: searchParams.get('endDate') || undefined,
    creatorContext: searchParams.get('creatorContext') || undefined,
  };
  const definedQueryParams: any = {};
  if (queryParamsFromUrl.startDate) definedQueryParams.startDate = queryParamsFromUrl.startDate;
  if (queryParamsFromUrl.endDate) definedQueryParams.endDate = queryParamsFromUrl.endDate;
  if (queryParamsFromUrl.creatorContext) definedQueryParams.creatorContext = queryParamsFromUrl.creatorContext;

  const validationResult = querySchema.safeParse(definedQueryParams);
  if (!validationResult.success) {
    logger.warn(`${TAG} Invalid query parameters:`, validationResult.error.flatten());
    return NextResponse.json(
      { error: 'Invalid query parameters', details: validationResult.error.flatten() },
      { status: 400, headers: noStore }
    );
  }

  let dateRange: { startDate: Date; endDate: Date } | undefined;
  if (validationResult.data.startDate && validationResult.data.endDate) {
    dateRange = { startDate: new Date(validationResult.data.startDate), endDate: new Date(validationResult.data.endDate) };
  }

  logger.info(`${TAG} Query parameters validated. Date range: ${dateRange ? JSON.stringify(dateRange) : 'Not provided'}`);

  try {
    const cacheKey = buildAgencyPlatformSummaryCacheKey({
      agencyId,
      startDateIso: dateRange?.startDate?.toISOString() ?? null,
      endDateIso: dateRange?.endDate?.toISOString() ?? null,
      creatorContext: validationResult.data.creatorContext,
    });

    // A partir daqui, o TypeScript sabe que session.user.agencyId é uma string.
    const { value: summaryData, hit } = await dashboardCache.wrap(
      cacheKey,
      () =>
        fetchPlatformSummary({
          dateRange,
          agencyId,
          ...(validationResult.data.creatorContext
            ? { creatorContext: validationResult.data.creatorContext }
            : {}),
        }),
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
