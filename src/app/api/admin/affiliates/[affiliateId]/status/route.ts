import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { AdminAffiliateUpdateStatusPayload } from '@/types/admin/affiliates';
import { getAdminSession } from '@/lib/getAdminSession';

export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/affiliates/[affiliateId]/status]';

function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// Validação do corpo da requisição
const bodySchema = z.object({
  status: z.enum(['pending_approval', 'active', 'inactive', 'suspended'] as const),
  reason: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { affiliateId: string } }
) {
  const TAG = `${SERVICE_TAG}[PATCH]`;
  const { affiliateId: userId } = params;

  logger.info(`${TAG} Received request to update status for affiliate (user ID): ${userId}`);

  try {
    const session = await getAdminSession(req);
    if (!session || !session.user) {
      return apiError('Acesso não autorizado ou privilégios insuficientes.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const body = await req.json();
    const validationResult = bodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors
        .map(e => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      logger.warn(`${TAG} Invalid request body: ${errorMessage}`);
      return apiError(`Corpo da requisição inválido: ${errorMessage}`, 400);
    }

    const payload: AdminAffiliateUpdateStatusPayload = validationResult.data;

    logger.info(
      `${TAG} Updating affiliate status for user ID ${userId} with payload: ${JSON.stringify(payload)}`
    );

    // ⬇️ Import dinâmico evita o erro de “attempted import” nos builds
    const svc = (await import('@/lib/services/adminCreatorService')) as any;
    if (!svc?.updateAffiliateStatus) {
      logger.error(`${TAG} Serviço adminCreatorService.updateAffiliateStatus não encontrado`);
      return apiError('Serviço indisponível.', 500);
    }

    const updatedUserAffiliate = await svc.updateAffiliateStatus(userId, payload);

    return NextResponse.json(updatedUserAffiliate, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error for user ID ${userId}:`, error);
    if (
      error.message === 'Invalid userId format.' ||
      error.message === 'User (affiliate) not found.'
    ) {
      return apiError(error.message, 404);
    }
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}
