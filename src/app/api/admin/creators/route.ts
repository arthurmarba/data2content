// src/app/api/admin/creators/route.ts (Corrigido)

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchCreators } from '@/lib/services/adminCreatorService'; // Ajuste o caminho se necessário
import { AdminCreatorStatus, AdminCreatorListParams } from '@/types/admin/creators'; // Ajuste o caminho se necessário
// import { getServerSession } from "next-auth/next" // Para auth real
// import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Para auth real

// ==================== INÍCIO DA CORREÇÃO ====================
// Força a rota a ser sempre renderizada dinamicamente no servidor,
// pois ela utiliza `req.url` para ler parâmetros de busca.
export const dynamic = 'force-dynamic';
// ==================== FIM DA CORREÇÃO ======================

const SERVICE_TAG = '[api/admin/creators]';

// Mock de validação de sessão de Admin (substituir pela real com getServerSession)
async function getAdminSession(req: NextRequest): Promise<{ user: { name: string, role?: string, isAdmin?: boolean } } | null> {
  // const session = await getServerSession(authOptions);
  // if (!session || !(session.user.role === 'admin' || session.user.isAdmin)) {
  //   logger.warn(`${SERVICE_TAG} Admin session validation failed or user is not admin.`);
  //   return null;
  // }
  // return session;
  // Mock para desenvolvimento:
  const mockSession = { user: { name: 'Admin User', role: 'admin' } }; // Simula um admin
  if (mockSession.user.role !== 'admin') return null;
  return mockSession;
}

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// Schema Zod para validar os query parameters
const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(10),
  search: z.string().optional(),
  planStatus: z.string().optional(), 
  sortBy: z.string().optional().default('registrationDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export async function GET(req: NextRequest) {
  const TAG = `${SERVICE_TAG}[GET]`;
  logger.info(`${TAG} Received request to list creators.`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
      return apiError('Acesso não autorizado ou privilégios insuficientes.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const { searchParams } = new URL(req.url);
    const queryParams = Object.fromEntries(searchParams.entries());

    // Para o tipo `type AdminCreatorStatus = 'pending' | 'approved' | 'rejected' | 'active';`
    // usamos z.enum:
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