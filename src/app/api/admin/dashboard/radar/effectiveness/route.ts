import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/app/lib/logger';
import { fetchTucaRadarEffectiveness, IFetchTucaRadarEffectivenessArgs } from '@/app/lib/dataService/marketAnalysisService';
import { DatabaseError } from '@/app/lib/errors';
export const dynamic = 'force-dynamic';

const SERVICE_TAG = '[api/admin/dashboard/radar/effectiveness]';

const querySchema = z.object({
  alertType: z.string().optional(),
  periodDays: z.coerce.number().int().min(1).max(365).optional().default(30)
});

async function getAdminSession(_req: NextRequest): Promise<{ user: { name: string } } | null> {
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
      const errorMessage = validationResult.error.errors
        .map(e => `${e.path.join('.')} : ${e.message}`)
        .join(', ');
      return apiError(`Parâmetros de consulta inválidos: ${errorMessage}`, 400);
    }

    const args: IFetchTucaRadarEffectivenessArgs = {
      alertType: validationResult.data.alertType,
      periodDays: validationResult.data.periodDays
    };

    const results = await fetchTucaRadarEffectiveness(args);
    return NextResponse.json(results, { status: 200 });
  } catch (error: any) {
    logger.error(`${TAG} Unexpected error:`, error);
    if (error instanceof DatabaseError) {
      return apiError(error.message, 500);
    }
    return apiError('Ocorreu um erro interno no servidor.', 500);
  }
}
