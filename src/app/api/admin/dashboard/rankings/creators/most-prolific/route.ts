/**
 * @fileoverview API Endpoint for fetching most prolific creators.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchMostProlificCreators, IFetchCreatorRankingParams } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
import { getAdminSession } from "@/lib/getAdminSession";
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/rankings/creators/most-prolific]';

// Schema for query parameters validation
const querySchema = z.object({
  startDate: z.string().datetime({ message: "Invalid startDate format." }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: "Invalid endDate format." }).transform(val => new Date(val)),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
}).refine(data => data.startDate <= data.endDate, {
  message: "startDate cannot be after endDate.",
  path: ["endDate"],
});

// Real Admin Session Validation

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado.', 401);
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = querySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const { startDate, endDate, limit } = validationResult.data;

    const params: IFetchCreatorRankingParams = {
      dateRange: { startDate, endDate },
      limit,
    };

    const results = await fetchMostProlificCreators(params);
    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
