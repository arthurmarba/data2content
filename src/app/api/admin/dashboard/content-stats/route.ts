/**
 * @fileoverview API Endpoint for fetching dashboard overall content statistics.
 * @version 1.0.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchDashboardOverallContentStats, IFetchDashboardOverallContentStatsFilters } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
import { getAdminSession } from "@/lib/getAdminSession";
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/content-stats]';

// Schema for query parameters validation
const querySchema = z.object({
  startDate: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
}).refine(data => {
    if (data.startDate && data.endDate && data.startDate > data.endDate) {
        return false;
    }
    return true;
}, { message: "startDate cannot be after endDate" });

// Real Admin Session Validation

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

/**
 * @handler GET
 * @description Handles GET requests to fetch overall content statistics for the dashboard.
 * It validates query parameters for date range, checks for an admin session,
 * and then calls the `fetchDashboardOverallContentStats` service function.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object.
 */
export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request for overall content statistics.`);

  try {
    const session = await getAdminSession(req);
    // CORREÇÃO: Adicionada verificação para session.user para garantir que não seja indefinido.
    if (!session || !session.user) {
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

    const { startDate, endDate } = validationResult.data;

    const filters: IFetchDashboardOverallContentStatsFilters = {};
    if (startDate || endDate) {
        filters.dateRange = {};
        if (startDate) filters.dateRange.startDate = startDate;
        if (endDate) filters.dateRange.endDate = endDate;
    }

    logger.info(`${TAG} Calling fetchDashboardOverallContentStats with filters: ${JSON.stringify(filters)}`);
    const stats = await fetchDashboardOverallContentStats(filters);

    logger.info(`${TAG} Successfully fetched overall content statistics.`);
    return NextResponse.json(stats, { status: 200 });

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
