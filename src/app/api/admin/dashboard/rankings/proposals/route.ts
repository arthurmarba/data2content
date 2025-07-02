/**
 * @fileoverview API Endpoint for fetching proposal rankings.
 * @version 2.1.0
 * @description Corrigido o tipo de métrica para corresponder ao serviço genérico.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
// (ALTERADO) Importando a nova função genérica
import { fetchTopCategories } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/rankings/proposals]';

// --- CORREÇÃO ---
// Definindo as métricas permitidas para a validação, assim como no arquivo anterior.
const ALLOWED_METRICS = ['views', 'reach', 'likes', 'comments', 'shares', 'posts'] as const;

// Schema atualizado com validação de métrica específica.
const querySchema = z.object({
  // CORREÇÃO: Trocado z.string() por z.enum()
  metric: z.enum(ALLOWED_METRICS, {
    errorMap: () => ({ message: `Métrica inválida. Use uma de: ${ALLOWED_METRICS.join(', ')}` })
  }),
  startDate: z.string().datetime({ message: 'Invalid startDate format.' }).transform(val => new Date(val)),
  endDate: z.string().datetime({ message: 'Invalid endDate format.' }).transform(val => new Date(val)),
  limit: z.coerce.number().int().min(1).max(50).optional().default(5),
}).refine(data => data.startDate <= data.endDate, {
  message: 'startDate cannot be after endDate.',
  path: ['endDate'],
});

async function getAdminSession(req: NextRequest): Promise<{ user: { name:string } } | null> {
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

    const { metric, startDate, endDate, limit } = validationResult.data;

    // A chamada agora é segura em tipo, pois 'metric' tem o tipo correto.
    const results = await fetchTopCategories({
      dateRange: { startDate, endDate },
      category: 'proposal', // Hardcoded para esta rota específica de propostas
      metric,
      limit,
    });

    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}