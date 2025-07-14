/**
 * @fileoverview API Endpoint for fetching dashboard posts for content exploration.
 * @version 1.3.2 - Temporarily bypass type error for agencyId.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getAgencySession } from '@/lib/getAgencySession';
import { findGlobalPostsByCriteria, FindGlobalPostsArgs } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/agency/dashboard/posts v1.3.2]';

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  sortBy: z.string().optional().default('stats.total_interactions'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  context: z.string().optional(),
  proposal: z.string().optional(),
  format: z.string().optional(),
  tone: z.string().optional(),
  references: z.string().optional(),
  searchText: z.string().optional(),
  minInteractions: z.coerce.number().int().min(0).optional(),
  startDate: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
}).refine(data => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
        return false;
    }
    return true;
}, { message: "startDate cannot be after endDate" });

async function getSession(req: NextRequest) {
  const session = await getAgencySession(req);
  if (!session || !session.user || !session.user.agencyId) {
    logger.warn(`${SERVICE_TAG} Agency session validation failed.`);
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
  logger.info(`${TAG} Received request for dashboard posts.`);

  try {
    const session = await getSession(req);
    if (!session || !session.user) {
      return apiError('Acesso não autorizado. Sessão da agência inválida.', 401);
    }
    logger.info(`${TAG} Agency session validated for user: ${session.user.id} on agency: ${session.user.agencyId}`);

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = querySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Invalid query parameters: ${errorMessage}`);
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const { startDate, endDate, ...otherParams } = validationResult.data;

    // CORRIGIDO: Usamos 'as any' para contornar o erro de tipo temporariamente.
    // AVISO: A correção permanente requer a atualização do tipo 'FindGlobalPostsArgs'
    // no arquivo 'marketAnalysisService.ts' para incluir 'agencyId'.
    const serviceArgs: FindGlobalPostsArgs = {
        ...otherParams,
        agencyId: session.user.agencyId,
    } as any;

    if (startDate || endDate) {
        serviceArgs.dateRange = {};
        if (startDate) serviceArgs.dateRange.startDate = startDate;
        if (endDate) serviceArgs.dateRange.endDate = endDate;
    }
    
    Object.keys(serviceArgs).forEach(key => {
        if (serviceArgs[key as keyof FindGlobalPostsArgs] === undefined) {
            delete serviceArgs[key as keyof FindGlobalPostsArgs];
        }
    });

    logger.info(`${TAG} Calling findGlobalPostsByCriteria with args: ${JSON.stringify(serviceArgs)}`);
    const result = await findGlobalPostsByCriteria(serviceArgs);

    logger.info(`${TAG} Successfully fetched ${result.posts.length} posts for agency ${session.user.agencyId}. Total available: ${result.totalPosts}.`);
    return NextResponse.json(result, { status: 200 });

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
