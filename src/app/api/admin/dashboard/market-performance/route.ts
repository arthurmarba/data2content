/**
 * @fileoverview API Endpoint for fetching market performance for a specific content segment.
 * @version 2.1.0 - Ensures all optional criteria have default values to prevent type errors.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { fetchMarketPerformance } from '@/app/lib/dataService/marketAnalysis/segmentService';
import { DatabaseError } from '@/app/lib/errors';
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/market-performance v2.1.0]';

// --- Zod Schemas and Type Definitions ---

// Schema para os critérios de classificação.
const criteriaSchema = z.object({
  format: z.string().optional(),
  proposal: z.string().optional(),
  context: z.string().optional(),
  tone: z.string().optional(),
  references: z.string().optional(),
});

// Schema completo para os parâmetros da query, combinando critérios e dias.
const querySchema = criteriaSchema.extend({
  days: z.coerce.number().int().positive().optional().default(30),
}).refine(data => 
    data.format || data.proposal || data.context || data.tone || data.references, {
  message: "At least one classification criterion (format, proposal, context, tone, or references) must be provided."
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
  logger.error(`${SERVICE_TAG} Error ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

/**
 * @handler GET
 * @description Handles GET requests to fetch market performance for a single, specific content segment.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @returns {Promise<NextResponse>} A Next.js response object containing the market performance data or an error.
 */
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

    const { days, ...criteria } = validationResult.data;

    // ATUALIZAÇÃO FINAL: Garante que todos os critérios de classificação opcionais
    // sejam passados como strings vazias se não forem fornecidos. Isso evita erros de tipo
    // na camada de serviço, que pode esperar 'string' em vez de 'string | undefined'.
    const serviceArgs = {
        ...criteria,
        format: criteria.format ?? '',
        proposal: criteria.proposal ?? '',
        context: criteria.context ?? '',
        tone: criteria.tone ?? '',
        references: criteria.references ?? '',
        days,
    };

    logger.info(`${TAG} Calling fetchMarketPerformance for criteria: ${JSON.stringify(criteria)} (${days} days)`);
    const result = await fetchMarketPerformance(serviceArgs);
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
