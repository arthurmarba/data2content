// src/app/api/admin/redemptions/[redemptionId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { updateRedemptionStatus } from '@/lib/services/adminCreatorService'; // Assumindo nome do serviço
import { RedemptionStatus, AdminRedemptionUpdateStatusPayload } from '@/types/admin/redemptions';
import { getAdminSession } from '@/lib/getAdminSession';

const SERVICE_TAG = '[api/admin/redemptions/[redemptionId]/status]';


function apiError(message: string, status: number): NextResponse {
  logger.error(`${SERVICE_TAG} Erro ${status}: ${message}`);
  return NextResponse.json({ error: message }, { status });
}

// Zod Schema para validar o corpo da requisição PATCH
const bodySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'processing', 'paid', 'failed', 'cancelled'] as const),
  adminNotes: z.string().optional(),
  transactionId: z.string().optional(),
});

/**
 * @async
 * @function PATCH
 * @description Handles PATCH requests to update the status of a specific redemption request.
 * Admin access is required. The request body should conform to AdminRedemptionUpdateStatusPayload.
 * @param {NextRequest} req - The incoming Next.js request object.
 * @param {{ params: { redemptionId: string } }} context - The context object containing route parameters.
 * @returns {Promise<NextResponse>} A JSON response containing the updated redemption object or an error response.
 *
 * @example Request Body:
 * {
 *   "status": "approved",
 *   "adminNotes": "User provided all necessary documents.",
 *   "transactionId": "txn_123abc"
 * }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { redemptionId: string } }
) {
  const TAG = `${SERVICE_TAG}[PATCH]`;
  const { redemptionId } = params;
  logger.info(`${TAG} Received request to update status for redemptionId: ${redemptionId}`);

  try {
    const session = await getAdminSession(req);
    if (!session) {
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

    const payload: AdminRedemptionUpdateStatusPayload = validationResult.data;

    logger.info(`${TAG} Calling updateRedemptionStatus for redemptionId ${redemptionId} with payload: ${JSON.stringify(payload)}`);
    const updatedRedemption = await updateRedemptionStatus(redemptionId, payload);

    return NextResponse.json(updatedRedemption, { status: 200 });

  } catch (error: any) {
    logger.error(`${TAG} Unexpected error for redemptionId ${redemptionId}:`, error);
    if (error.message === 'Invalid redemptionId format.' || error.message === 'Redemption not found.') {
        return apiError(error.message, 404);
    }
    return apiError(error.message || 'Ocorreu um erro interno no servidor.', 500);
  }
}
