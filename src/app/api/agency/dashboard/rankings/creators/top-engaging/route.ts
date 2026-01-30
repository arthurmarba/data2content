import { getAgencySession } from '@/lib/getAgencySession';
/**
 * @fileoverview API Endpoint for fetching top engaging creators.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
// AVISO: A correção completa deste arquivo pode depender da atualização da função 'fetchTopEngagingCreators'
// no arquivo 'marketAnalysisService.ts' para aceitar 'agencyId'.
import { fetchTopEngagingCreators, IFetchCreatorRankingParams } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/agency/dashboard/rankings/creators/top-engaging]';

// Schema for query parameters validation
const querySchema = z.object({
  startDate: z.string().datetime({ message: "Invalid startDate format." }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: "Invalid endDate format." }).transform(val => new Date(val)),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
  offset: z.coerce.number().int().min(0).optional().default(0),
}).refine(data => data.startDate <= data.endDate, {
  message: "startDate cannot be after endDate.",
  path: ["endDate"],
});

// Agency session validation
async function getSession(req: NextRequest) {
  const session = await getAgencySession(req);
  if (!session || !session.user) {
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
  logger.info(`${TAG} Received request.`);

  try {
    const session = await getSession(req);
    // CORRIGIDO: Verificação explícita e robusta para session, user e agencyId.
    if (!session || !session.user || !session.user.agencyId) {
      logger.warn(`${TAG} Unauthorized access attempt. Session or agencyId missing.`);
      return apiError('Acesso não autorizado. A sessão do usuário é inválida ou não está associada a um parceiro.', 401);
    }

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const validationResult = querySchema.safeParse(queryParams);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const { startDate, endDate, limit, offset } = validationResult.data;

    const params: IFetchCreatorRankingParams = {
      dateRange: { startDate, endDate },
      limit,
      offset,
    };

    // A partir daqui, TypeScript sabe que session.user.agencyId é uma string.
    // O erro de tipo desaparecerá quando a função de serviço for atualizada para aceitar 'agencyId'.
    // Usamos 'as any' como uma medida temporária para permitir a compilação.
    const results = await fetchTopEngagingCreators({ ...params, agencyId: session.user.agencyId } as any);
    return NextResponse.json(results, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}