/**
 * @fileoverview API Endpoint for fetching dashboard creators.
 * @version 1.0.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchDashboardCreatorsList, IFetchDashboardCreatorsListParams } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[api/admin/dashboard/creators]';

// Schema for query parameters validation
const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortBy: z.string().optional().default('totalPosts'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  nameSearch: z.string().optional(),
  planStatus: z.string().optional().transform(val => val ? val.split(',') : undefined),
  expertiseLevel: z.string().optional().transform(val => val ? val.split(',') : undefined),
  minTotalPosts: z.coerce.number().int().min(0).optional(),
});

// Simulated Admin Session Validation (to be replaced with actual session logic)
async function getAdminSession(req: NextRequest): Promise<{ user: { name: string } } | null> {
  // SIMULAÇÃO: Substitua pela sua lógica real de sessão (ex: next-auth)
  // In a real app, this would involve checking tokens, cookies, or session stores.
  const session = { user: { name: 'Admin User' } }; // Mock session
  const isAdmin = true; // Mock admin check
  // Example: const token = req.headers.get('Authorization');
  // if (!token || !isValidAdminToken(token)) return null;
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
 * @handler GET
 * @description Handles GET requests to fetch a list of dashboard creators.
 * It validates query parameters, checks for an admin session,
 * and then calls the `fetchDashboardCreatorsList` service function.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object.
 */
export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request for dashboard creators list.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado. Sessão de administrador inválida.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = querySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Invalid query parameters: ${errorMessage}`);
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const validatedParams: IFetchDashboardCreatorsListParams = {
      ...validationResult.data,
      filters: {
        nameSearch: validationResult.data.nameSearch,
        planStatus: validationResult.data.planStatus,
        expertiseLevel: validationResult.data.expertiseLevel,
        minTotalPosts: validationResult.data.minTotalPosts,
        // minFollowers is not included here as it's not in querySchema yet
      },
    };
    // Remove undefined filter values to keep the service call clean
    Object.keys(validatedParams.filters!).forEach(key => {
        if (validatedParams.filters![key as keyof typeof validatedParams.filters] === undefined) {
            delete validatedParams.filters![key as keyof typeof validatedParams.filters];
        }
    });


    logger.info(`${TAG} Calling fetchDashboardCreatorsList with params: ${JSON.stringify(validatedParams)}`);
    const { creators, totalCreators } = await fetchDashboardCreatorsList(validatedParams);

    logger.info(`${TAG} Successfully fetched ${creators.length} creators. Total available: ${totalCreators}.`);
    return NextResponse.json({ creators, totalCreators, page: validatedParams.page, limit: validatedParams.limit }, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    }
    if (error instanceof z.ZodError) { // Should be caught by safeParse, but as a fallback
        return apiError(`Erro de validação: ${error.errors.map(e => e.message).join(', ')}`, 400);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
