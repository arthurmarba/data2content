// src/app/api/admin/creators/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchCreators } from '@/lib/services/adminCreatorService';
import { AdminCreatorListParams } from '@/types/admin/creators';
import { getAdminSession } from '@/lib/getAdminSession';


export const dynamic = 'force-dynamic';


const SERVICE_TAG = '[api/admin/creators]';


function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// Schema Zod para validar os query parameters
const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().optional(),
  // CORREÇÃO: Adicionado o status "expired" para manter consistência com outras partes do código.
  planStatus: z.enum(['active', 'trialing', 'pending', 'canceled', 'inactive', 'trial', 'expired', 'non_renewing']).optional(),
  sortBy: z.string().optional().default('registrationDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request to list creators.`);

  try {
    const session = await getAdminSession(req);
    // <<< CORREÇÃO AQUI: A verificação agora inclui !session.user >>>
    if (!session || !session.user) {
      return apiError('Acesso não autorizado ou privilégios insuficientes.', 401);
    }
    // Após a verificação acima, o TypeScript sabe que session.user é seguro de usar.
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    const actualQuerySchema = querySchema.extend({
        status: z.enum(['pending', 'approved', 'rejected', 'active'] as const).optional()
    });

    const validationResult = actualQuerySchema.safeParse(queryParams);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Invalid query parameters: ${errorMessage}`);
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const validatedParams: AdminCreatorListParams = validationResult.data;

    logger.info(`${TAG} Calling fetchCreators with params: ${JSON.stringify(validatedParams)}`);
    const { creators, totalCreators, totalPages } = await fetchCreators(validatedParams);

    return NextResponse.json({ creators, totalCreators, totalPages, page: validatedParams.page, limit: validatedParams.limit }, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}
