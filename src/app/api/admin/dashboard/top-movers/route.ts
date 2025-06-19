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
} from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const SERVICE_TAG = '[api/admin/dashboard/top-movers]';

// --- Zod Schemas for Validation ---

const periodSchema = z.object({
  startDate: z.string().datetime({ message: "Invalid startDate format. Expected ISO datetime string." }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: "Invalid endDate format. Expected ISO datetime string." }).transform(val => new Date(val))
}).refine(data => data.startDate <= data.endDate, {
    message: "startDate in a period cannot be after its endDate.",
    path: ["endDate"],
});

const contentFiltersSchema = z.object({
  format: z.string().optional(),
  proposal: z.string().optional(),
  context: z.string().optional()
}).optional();

const creatorFiltersSchema = z.object({
  planStatus: z.array(z.string()).optional(),
  inferredExpertiseLevel: z.array(z.string()).optional()
}).optional();

const topMoverMetricLiterals: [TopMoverMetric, ...TopMoverMetric[]] = [
  'cumulativeViews', 'cumulativeLikes', 'cumulativeShares', 'cumulativeComments',
  'cumulativeSaved', 'cumulativeReach', 'cumulativeImpressions', 'cumulativeTotalInteractions'
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
  topN: z.number().int().positive().min(1).max(50).optional(),
  sortBy: topMoverSortByEnum.optional(),
  contentFilters: contentFiltersSchema,
  creatorFilters: creatorFiltersSchema
}).refine(data => data.previousPeriod.endDate < data.currentPeriod.startDate, {
  message: "Previous period must end before the current period starts.",
  path: ["currentPeriod", "startDate"],
});


// --- Helper Functions ---

async function getAdminSession(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== 'admin') {
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
    // CORREÇÃO: Adicionada verificação explícita para session.user.
    if (!session || !session.user) {
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

    const validatedArgs = validationResult.data as IFetchTopMoversArgs;

    logger.info(`${TAG} Calling fetchTopMoversData with validated args: ${JSON.stringify(validatedArgs)}`);
    const results: ITopMoverResult[] = await fetchTopMoversData(validatedArgs);

    logger.info(`${TAG} Successfully fetched ${results.length} top movers.`);
    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    } else if (error instanceof z.ZodError) {
        return apiError(`Erro de validação Zod inesperado: ${error.message}`, 400);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
