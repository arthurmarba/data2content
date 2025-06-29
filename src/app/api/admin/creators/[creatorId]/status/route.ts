// src/app/api/admin/creators/[creatorId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { updateCreatorStatus } from '@/lib/services/adminCreatorService';
import { AdminCreatorUpdateStatusPayload } from '@/types/admin/creators';
import { getAdminSession } from '@/lib/getAdminSession';

const SERVICE_TAG = '[api/admin/creators/[creatorId]/status]';


function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// Zod Schema para validar o corpo da requisição PATCH
const bodySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'active'] as const),
  feedback: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { creatorId: string } }
) {
  const TAG = `${SERVICE_TAG}[PATCH]`;
  const { creatorId } = params;
  logger.info(`${TAG} Received request to update status for creatorId: ${creatorId}`);

  try {
    const session = await getAdminSession(req);
    // <<< CORREÇÃO 1: A verificação agora inclui !session.user >>>
    if (!session || !session.user) {
      return apiError('Acesso não autorizado ou privilégios insuficientes.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    const body = await req.json();
    const validationResult = bodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      logger.warn(`${TAG} Invalid request body: ${errorMessage}`);
      return apiError(`Corpo da requisição inválido: ${errorMessage}`, 400);
    }

    const payload: AdminCreatorUpdateStatusPayload = validationResult.data;

    logger.info(`${TAG} Calling updateCreatorStatus for creatorId ${creatorId} with payload: ${JSON.stringify(payload)}`);
    const updatedCreator = await updateCreatorStatus(creatorId, payload);

    return NextResponse.json(updatedCreator, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error for creatorId ${creatorId}:`, error);
    if (error.message === 'Invalid creatorId format.' || error.message === 'Creator not found.') {
        return apiError(error.message, 404);
    }
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { creatorId: string } }
) {
  const TAG = `${SERVICE_TAG}[PUT]`;
  const { creatorId } = params;
  logger.info(`${TAG} Received request to approve creatorId: ${creatorId}`);

  try {
    const session = await getAdminSession(req);
    // <<< CORREÇÃO 2: A mesma verificação rigorosa é aplicada aqui >>>
    if (!session || !session.user) {
      return apiError('Acesso não autorizado ou privilégios insuficientes.', 401);
    }
    logger.info(`${TAG} Admin session validated for user: ${session.user.name}`);

    let feedback: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.feedback === 'string') {
        feedback = body.feedback;
      }
    } catch (_) {
      // Sem corpo ou corpo inválido
    }

    const payload: AdminCreatorUpdateStatusPayload = feedback
      ? { status: 'approved', feedback }
      : { status: 'approved' };

    logger.info(`${TAG} Calling updateCreatorStatus for creatorId ${creatorId} with payload: ${JSON.stringify(payload)}`);
    const updatedCreator = await updateCreatorStatus(creatorId, payload);

    return NextResponse.json(updatedCreator, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error for creatorId ${creatorId}:`, error);
    if (error.message === 'Invalid creatorId format.' || error.message === 'Creator not found.') {
        return apiError(error.message, 404);
    }
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}