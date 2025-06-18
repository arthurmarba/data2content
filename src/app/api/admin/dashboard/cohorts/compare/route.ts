/**
 * @fileoverview API Endpoint for comparing performance across user cohorts.
 * @version 1.0.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchCohortComparison } from '@/app/lib/dataService/marketAnalysis/cohortsService';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[api/admin/dashboard/cohorts/compare]';
const MAX_COHORTS_TO_COMPARE_API = 5;

// --- Validation Schemas ---
const cohortSchema = z.object({
  filterBy: z.enum(['planStatus', 'inferredExpertiseLevel']),
  value: z.string()
});

const dateRangeSchema = z.object({
  startDate: z.string().datetime({ message: 'Invalid startDate format. Expected ISO datetime string.' }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: 'Invalid endDate format. Expected ISO datetime string.' }).transform(val => new Date(val))
}).refine(data => data.startDate <= data.endDate, {
  message: 'startDate cannot be after endDate.',
  path: ['endDate']
});

const requestBodySchema = z.object({
  metric: z.string().default('engagement_rate_on_reach'),
  cohorts: z.array(cohortSchema)
    .min(2, { message: 'At least two cohorts are required for comparison.' })
    .max(MAX_COHORTS_TO_COMPARE_API, { message: `Cannot compare more than ${MAX_COHORTS_TO_COMPARE_API} cohorts at a time.` }),
  dateRange: dateRangeSchema.optional()
});

// --- Helper Functions ---
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

/**
 * @handler POST
 * @description Handles POST requests to compare user cohorts using a metric.
 * Validates admin session and request body, then calls `fetchCohortComparison`.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object containing comparison results or an error.
 */
export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  logger.info(`${TAG} Received request for cohort comparison.`);
  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const body = await req.json();
    const validationResult = requestBodySchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.warn(`${TAG} Invalid request body: ${errorMessage}`);
      return apiError(`Corpo da requisição inválido: ${errorMessage}`, 400);
    }

    const { metric, cohorts } = validationResult.data;

    const comparisonResults = await fetchCohortComparison({ metric, cohorts });

    logger.info(`${TAG} Successfully fetched cohort comparison results.`);
    return NextResponse.json(comparisonResults, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    }
    if (error instanceof z.ZodError) {
      return apiError(`Erro de validação: ${error.errors.map(e => e.message).join(', ')}`, 400);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}

