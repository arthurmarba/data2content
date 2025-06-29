/**
 * @fileoverview API Endpoint for fetching creator-specific time series data.
 * @version 1.0.0
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Types } from 'mongoose';
import { logger } from '@/app/lib/logger';
import { fetchCreatorTimeSeriesData, IFetchCreatorTimeSeriesArgs } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
import { getAdminSession } from "@/lib/getAdminSession";

const SERVICE_TAG = '[api/admin/dashboard/creators/[creatorId]/time-series]';

// Schema for request validation (params and query)
const metricEnum = z.enum(['post_count', 'avg_engagement_rate', 'avg_likes', 'avg_shares', 'total_interactions']);
const periodEnum = z.enum(['monthly', 'weekly']);

const requestSchema = z.object({
  creatorId: z.string().refine((val) => Types.ObjectId.isValid(val), {
    message: "Invalid MongoDB ObjectId for creatorId.",
  }),
  metric: metricEnum,
  period: periodEnum,
  startDate: z.string().datetime({ offset: true }).transform((val) => new Date(val)),
  endDate: z.string().datetime({ offset: true }).transform((val) => new Date(val)),
}).refine(data => data.startDate <= data.endDate, {
  message: "startDate cannot be after endDate.",
  path: ["endDate"], // Path to highlight for the error
});


// Real Admin Session Validation

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

/**
 * @handler GET
 * @description Handles GET requests to fetch time series data for a specific creator.
 * Validates admin session, creatorId, and query parameters (metric, period, dateRange).
 * Calls the `fetchCreatorTimeSeriesData` service function.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @param {{ params: { creatorId: string } }} context - Context object containing route parameters.
 * @returns {Promise<NextResponse>} A Next.js response object.
 */
export async function GET(req: NextRequest, { params }: { params: { creatorId: string } }) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request for creator time series data. Creator ID: ${params.creatorId}`);

  try {
    const session = await getAdminSession(req);
    // CORREÇÃO: Adicionada verificação explícita para session.user.
    if (!session || !session.user) {
      return apiError('Acesso não autorizado. Sessão de administrador inválida.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const queryParams = Object.fromEntries(req.nextUrl.searchParams.entries());
    const rawInput = {
      creatorId: params.creatorId,
      ...queryParams,
    };

    const validationResult = requestSchema.safeParse(rawInput);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Invalid request parameters: ${errorMessage}`);
      return apiError(`Parâmetros de requisição inválidos: ${errorMessage}`, 400);
    }

    const { creatorId, metric, period, startDate, endDate } = validationResult.data;

    const serviceArgs: IFetchCreatorTimeSeriesArgs = {
      creatorId,
      metric,
      period,
      dateRange: { startDate, endDate },
    };

    logger.info(`${TAG} Calling fetchCreatorTimeSeriesData with args: ${JSON.stringify(serviceArgs)}`);
    const timeSeriesData = await fetchCreatorTimeSeriesData(serviceArgs);

    logger.info(`${TAG} Successfully fetched ${timeSeriesData.length} data points for creator ${creatorId}.`);
    return NextResponse.json(timeSeriesData, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    } else if (error.message.includes('Invalid creatorId format') || error.message.includes('Unsupported metric')) {
        // Specific errors thrown by the service for invalid inputs not caught by Zod (though creatorId is)
        return apiError(`Erro na requisição: ${error.message}`, 400);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
