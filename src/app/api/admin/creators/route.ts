// src/app/api/admin/creators/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchCreators, AdminCreatorListParams } from '@/lib/services/adminCreatorService'; // Ajuste o caminho se necessário
import { AdminCreatorStatus } from '@/types/admin/creators'; // Ajuste o caminho se necessário
// import { getServerSession } from "next-auth/next" // Para auth real
// import { authOptions } from "@/app/api/auth/[...nextauth]/route"; // Para auth real

const SERVICE_TAG = '[api/admin/creators]';

// Mock Admin Session Validation (substituir pela real com getServerSession)
async function getAdminSession(req: NextRequest): Promise<{ user: { name: string, role?: string, isAdmin?: boolean } } | null> {
  // const session = await getServerSession(authOptions);
  // if (!session || !(session.user.role === 'admin' || session.user.isAdmin)) {
  //   logger.warn(`${SERVICE_TAG} Admin session validation failed or user is not admin.`);
  //   return null;
  // }
  // return session;
  // Mocked para desenvolvimento:
  const mockSession = { user: { name: 'Admin User', role: 'admin' } }; // Simula um admin
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
  // status: z.nativeEnum(AdminCreatorStatus).optional(), // Use z.nativeEnum se AdminCreatorStatus for um enum TS
                                                    // Ou z.enum(['pending', 'approved', 'rejected', 'active']).optional() se for uma união de strings
  planStatus: z.string().optional(), // Pode ser uma string separada por vírgulas se múltiplos são permitidos
  sortBy: z.string().optional().default('registrationDate'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  // Adicionar startDate e endDate se forem suportados por fetchCreators para esta lista
  // startDate: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
  // endDate: z.string().datetime({ offset: true }).optional().transform(val => val ? new Date(val) : undefined),
});
// .refine(data => { /* Validação de startDate <= endDate se existirem */ })


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

    // Correção para o tipo de status no schema Zod
    // Se AdminCreatorStatus for um array de strings, o schema deve ser z.enum([...values...])
    // Se for um enum Typescript, z.nativeEnum(AdminCreatorStatus) é correto.
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

    // Se planStatus puder ser múltiplo e vier como string separada por vírgula:
    // if (typeof queryParams.planStatus === 'string' && typeof validatedParams.planStatus === 'string') {
    //   (validatedParams.planStatus as any) = validatedParams.planStatus.split(',');
    // }


    logger.info(`${TAG} Calling fetchCreators with params: ${JSON.stringify(validatedParams)}`);
    const { creators, totalCreators, totalPages } = await fetchCreators(validatedParams);

    return NextResponse.json({ creators, totalCreators, totalPages, page: validatedParams.page, limit: validatedParams.limit }, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    // Diferenciar entre DatabaseError e outros erros se tivermos DatabaseError customizado
    // if (error instanceof DatabaseError) {
    //   return apiError(error.message, 500);
    // }
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}
