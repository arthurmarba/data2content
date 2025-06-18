import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchMarketPerformance } from '@/app/lib/dataService/marketAnalysis/segmentService';
import { DatabaseError } from '@/app/lib/errors';

const SERVICE_TAG = '[api/admin/dashboard/market-performance]';

const querySchema = z.object({
  format: z.string(),
  proposal: z.string(),
  days: z.coerce.number().int().positive().optional().default(30),
});

// Simulated Admin Session Validation (replace with real session check)
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
  logger.error(`${SERVICE_TAG} Error ${status}: ${message}`);
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
      const errMsg = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Invalid query parameters: ${errMsg}`);
      return apiError(`Parâmetros inválidos: ${errMsg}`, 400);
    }

    const { format, proposal, days } = validationResult.data;

    logger.info(`${TAG} Calling fetchMarketPerformance for ${format}/${proposal} (${days} days)`);
    const result = await fetchMarketPerformance({ format, proposal, days });
    logger.info(`${TAG} Successfully fetched market performance.`);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(`Erro de banco de dados: ${error.message}`, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
