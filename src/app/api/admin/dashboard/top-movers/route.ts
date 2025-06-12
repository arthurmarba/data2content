/**
 * @fileoverview API Endpoint for fetching Top Movers data (content or creators).
 * @version 1.0.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import {
  fetchTopMoversData,
  IFetchTopMoversArgs,
  ITopMoverResult,
  TopMoverEntityType, // For Zod enum
  TopMoverMetric,     // For Zod enum
  TopMoverSortBy,     // For Zod enum
  // ISegmentDefinition is implicitly used by contentFiltersSchema
  // ITopMoverCreatorFilters is implicitly used by creatorFiltersSchema
} from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[api/admin/dashboard/top-movers]';

// --- Zod Schemas for Validation ---

const periodSchema = z.object({
  startDate: z.string().datetime({ message: "Invalid startDate format. Expected ISO datetime string." }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: "Invalid endDate format. Expected ISO datetime string." }).transform(val => new Date(val))
}).refine(data => data.startDate <= data.endDate, {
    message: "startDate in a period cannot be after its endDate.",
    path: ["endDate"],
});

// Reusing ISegmentDefinition structure for contentFilters
const contentFiltersSchema = z.object({
  format: z.string().optional(),
  proposal: z.string().optional(),
  context: z.string().optional()
}).optional();

// Reusing ITopMoverCreatorFilters structure
const creatorFiltersSchema = z.object({
  planStatus: z.array(z.string()).optional(),
  inferredExpertiseLevel: z.array(z.string()).optional() // Corrected field name based on typical User model
}).optional();

// Manually list out string literals for Zod enums from types
const topMoverMetricLiterals: [TopMoverMetric, ...TopMoverMetric[]] = [
  'cumulative_views', 'cumulative_likes', 'cumulative_shares', 'cumulative_comments',
  'cumulative_saves', 'cumulative_reach', 'cumulative_impressions', 'cumulative_total_interactions'
];
const topMoverMetricEnum = z.enum(topMoverMetricLiterals);

const topMoverSortByLiterals: [TopMoverSortBy, ...TopMoverSortBy[]] = [
  'absoluteChange_increase', 'absoluteChange_decrease',
  'percentageChange_increase', 'percentageChange_decrease'
];
const topMoverSortByEnum = z.enum(topMoverSortByLiterals);

const entityTypeLiterals: [TopMoverEntityType, ...TopMoverEntityType[]] = ['content', 'creator'];
const entityTypeEnum = z.enum(entityTypeLiterals);


const requestBodySchema = z.object({
  entityType: entityTypeEnum,
  metric: topMoverMetricEnum,
  currentPeriod: periodSchema,
  previousPeriod: periodSchema,
  topN: z.number().int().positive().min(1).max(50).optional(), // Example: Max 50
  sortBy: topMoverSortByEnum.optional(),
  contentFilters: contentFiltersSchema,
  creatorFilters: creatorFiltersSchema
}).refine(data => data.previousPeriod.endDate < data.currentPeriod.startDate, {
  message: "Previous period must end before the current period starts.",
  path: ["currentPeriod", "startDate"], // Path to highlight for the error
});


// --- Helper Functions ---

// Simulated Admin Session Validation
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
 * @description Handles POST requests to fetch Top Movers data.
 * Validates admin session and the complex request body.
 * Calls the `fetchTopMoversData` service function.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object containing an array of ITopMoverResult or an error.
 */
export async function POST(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[POST]`;
  logger.info(`${TAG} Received request for Top Movers data.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado. Sessão de administrador inválida.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const body = await req.json();
    const validationResult = requestBodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
      logger.warn(`${TAG} Invalid request body: ${errorMessage}`);
      return apiError(`Corpo da requisição inválido: ${errorMessage}`, 400);
    }

    const validatedArgs = validationResult.data as IFetchTopMoversArgs; // Cast after successful validation

    // Removed logger.warn as creator entity type logic is now implemented in the service.
    // if (validatedArgs.entityType === 'creator') {
    //   logger.warn(`${TAG} Processing request for 'creator' entity type...`);
    // }

    logger.info(`${TAG} Calling fetchTopMoversData with validated args: ${JSON.stringify(validatedArgs)}`);
    const results: ITopMoverResult[] = await fetchTopMoversData(validatedArgs);

    logger.info(`${TAG} Successfully fetched ${results.length} top movers.`);
    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    } else if (error instanceof z.ZodError) {
        // This case should ideally be caught by safeParse, but as a fallback
        return apiError(`Erro de validação Zod inesperado: ${error.message}`, 400);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
