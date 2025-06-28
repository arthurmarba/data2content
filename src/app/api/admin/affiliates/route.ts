// src/app/api/admin/affiliates/route.ts (Corrigido)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchAffiliates } from '@/lib/services/adminCreatorService'; // Assumindo que o serviço ainda se chama adminCreatorService
import { AdminAffiliateListParams, AdminAffiliateStatus } from '@/types/admin/affiliates';

// ==================== INÍCIO DA CORREÇÃO ====================
// Força a rota a ser sempre renderizada dinamicamente no servidor.
// Isso é necessário porque a rota utiliza `req.url` para ler parâmetros de busca,
// o que impede a geração estática durante o build.
export const dynamic = 'force-dynamic';
// ==================== FIM DA CORREÇÃO ======================

const SERVICE_TAG = '[api/admin/affiliates]';

// Mock Admin Session Validation (substituir pela real com getServerSession)
async function getAdminSession(req: NextRequest): Promise<{ user: { name: string, role?: string, isAdmin?: boolean } } | null> {
  const mockSession = { user: { name: 'Admin User', role: 'admin' } };
  if (mockSession.user.role !== 'admin') return null;
  return mockSession;
}

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// Zod Schema para validar os query parameters
const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().optional(),
  status: z.enum(['pending_approval', 'active', 'inactive', 'suspended'] as const).optional(),
  sortBy: z.string().optional().default('registrationDate'), // Ou 'affiliateSince'
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request to list affiliates.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado ou privilégios insuficientes.', 401);
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

    const validatedParams: AdminAffiliateListParams = validationResult.data;

    logger.info(`${TAG} Calling fetchAffiliates with params: ${JSON.stringify(validatedParams)}`);
    const { affiliates, totalAffiliates, totalPages } = await fetchAffiliates(validatedParams);

    return NextResponse.json({ affiliates, totalAffiliates, totalPages, page: validatedParams.page, limit: validatedParams.limit }, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}