// src/app/api/admin/affiliates/[affiliateId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { updateAffiliateStatus } from '@/lib/services/adminCreatorService'; // Assumindo que o serviço ainda se chama adminCreatorService
import { AdminAffiliateStatus, AdminAffiliateUpdateStatusPayload } from '@/types/admin/affiliates';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const SERVICE_TAG = '[api/admin/affiliates/[affiliateId]/status]';

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// Zod Schema para validar o corpo da requisição PATCH
const bodySchema = z.object({
  status: z.enum(['pending_approval', 'active', 'inactive', 'suspended'] as const),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { affiliateId: string } } // O ID aqui será o userId do afiliado
) {
  const TAG = `${SERVICE_TAG}[PATCH]`;
  const { affiliateId: userId } = params; // Renomeando para clareza, pois o serviço espera userId
  logger.info(`${TAG} Received request to update status for affiliate (user ID): ${userId}`);

  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.isAdmin) {
      return apiError('Acesso não autorizado.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const body = await req.json();
    const validationResult = bodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Invalid request body: ${errorMessage}`);
      return apiError(`Corpo da requisição inválido: ${errorMessage}`, 400);
    }

    const payload: AdminAffiliateUpdateStatusPayload = validationResult.data;

    logger.info(`${TAG} Calling updateAffiliateStatus for user ID ${userId} with payload: ${JSON.stringify(payload)}`);
    const updatedUserAffiliate = await updateAffiliateStatus(userId, payload);

    return NextResponse.json(updatedUserAffiliate, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error for user ID ${userId}:`, error);
    if (error.message === 'Invalid userId format.' || error.message === 'User (affiliate) not found.') {
        return apiError(error.message, 404);
    }
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}
